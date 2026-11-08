/**
 * T05.08 Orçamento por contexto (RN-05.17): limite mensal por produto ou pela Numa institucional.
 * Realizado = despesas da competência, rateadas, pela mesma conta do custo do produto (`custos-produto.ts`):
 * sem reembolso (RN-05.07), sem cancelado nem suspenso, moeda estrangeira paga pelo valor efetivo e, em aberto,
 * pelo câmbio de referência (estimado). Sem câmbio, o realizado do mês fica "falta câmbio", nunca zero.
 */
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { ErroDeRegra } from '@/dados/erros';
import type { Orcamento } from '@/dados/tipos/orcamento';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { lerFontes, linhasDeCustoDoProduto, type FontesDeCusto } from './custos-produto';
import { lerValor } from './dinheiro';

export const ALERTA_ATENCAO = 80;
export const ALERTA_ESTOURO = 100;

export type NivelDoConsumo = 'sem_orcamento' | 'ok' | 'atencao' | 'estourado';

export type CelulaDoOrcamento = {
  competencia: string;
  orcado: number | null;
  /** `null`: há despesa em moeda sem câmbio de referência. */
  realizado: number | null;
  estimado: boolean;
  percentual: number | null;
  nivel: NivelDoConsumo;
};

export type LinhaDoOrcamento = { contextoId: string; produtoId: string | null; nome: string; celulas: CelulaDoOrcamento[] };

export type TelaDoOrcamento = { ano: number; meses: string[]; linhas: LinhaDoOrcamento[]; total: CelulaDoOrcamento[] | null };

const redondo = (valor: number) => Math.round(valor * 100) / 100;

export function mesesDoAno(ano: number): string[] {
  return Array.from({ length: 12 }, (_, indice) => `${ano}-${String(indice + 1).padStart(2, '0')}-01`);
}

/** RN-05.17: atenção a partir de 80%, estourado a partir de 100%. Sem orçamento, não há percentual. */
export function nivelDoConsumo(orcado: number | null, realizado: number | null): { percentual: number | null; nivel: NivelDoConsumo } {
  if (orcado === null) return { percentual: null, nivel: 'sem_orcamento' };
  if (realizado === null) return { percentual: null, nivel: 'ok' };
  if (orcado === 0) return realizado > 0 ? { percentual: null, nivel: 'estourado' } : { percentual: 0, nivel: 'ok' };
  const percentual = Math.round((realizado / orcado) * 1000) / 10;
  return { percentual, nivel: percentual >= ALERTA_ESTOURO ? 'estourado' : percentual >= ALERTA_ATENCAO ? 'atencao' : 'ok' };
}

function celula(competencia: string, orcado: number | null, linhas: { competencia: string; valor: number | null; estimado: boolean }[]): CelulaDoOrcamento {
  const doMes = linhas.filter((linha) => linha.competencia.slice(0, 7) === competencia.slice(0, 7));
  const realizado = doMes.some((linha) => linha.valor === null) ? null : redondo(doMes.reduce((total, linha) => total + (linha.valor as number), 0));
  return { competencia, orcado, realizado, estimado: doMes.some((linha) => linha.estimado), ...nivelDoConsumo(orcado, realizado) };
}

/** Monta a tabela contexto × mês. Na Numa consolidada, todos os contextos e o total; num contexto, só ele. */
export function montarOrcamento(ano: number, contextoGlobalId: string, fontes: FontesDeCusto, produtos: readonly { id: string; nome: string }[], orcamentos: readonly Orcamento[]): TelaDoOrcamento {
  const meses = mesesDoAno(ano);
  const contextos = [...[...produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((produto) => ({ contextoId: produto.id, produtoId: produto.id as string | null, nome: produto.nome })), { contextoId: ID_INSTITUCIONAL, produtoId: null, nome: 'Numa institucional' }];
  const visiveis = contextoGlobalId === ID_CONSOLIDADA ? contextos : contextos.filter((contexto) => contexto.contextoId === contextoGlobalId);
  const orcadoDe = (produtoId: string | null, competencia: string) => orcamentos.find((item) => !item.arquivado_em && item.produto_id === produtoId && item.competencia === competencia)?.valor_brl ?? null;
  const linhas = visiveis.map((contexto) => {
    const custos = linhasDeCustoDoProduto(contexto.produtoId, fontes);
    return { ...contexto, celulas: meses.map((competencia) => celula(competencia, orcadoDe(contexto.produtoId, competencia), custos)) };
  });
  // O total só soma o que existe: mês sem nenhum orçamento fica sem orçado; falta de câmbio em um contexto deixa o realizado em aberto.
  const total =
    contextoGlobalId === ID_CONSOLIDADA && linhas.length > 1
      ? meses.map((competencia, indice) => {
          const doMes = linhas.map((linha) => linha.celulas[indice]!);
          const comOrcamento = doMes.filter((item) => item.orcado !== null);
          const orcado = comOrcamento.length ? redondo(comOrcamento.reduce((soma, item) => soma + (item.orcado as number), 0)) : null;
          const realizado = doMes.some((item) => item.realizado === null) ? null : redondo(doMes.reduce((soma, item) => soma + (item.realizado as number), 0));
          return { competencia, orcado, realizado, estimado: doMes.some((item) => item.estimado), ...nivelDoConsumo(orcado, realizado) };
        })
      : null;
  return { ano, meses, linhas, total };
}

export async function carregarOrcamento(ano: number, contextoGlobalId: string): Promise<TelaDoOrcamento> {
  const [fontes, produtos, orcamentos] = await Promise.all([lerFontes(), repositorios.produto.listar(), repositorios.orcamento.listar()]);
  return montarOrcamento(ano, contextoGlobalId, fontes, produtos, orcamentos);
}

/** As células do mês em atenção ou estouradas: é o alerta da tela (RN-05.17). */
export function alertasDoMes(tela: TelaDoOrcamento, competencia: string): { nome: string; celula: CelulaDoOrcamento }[] {
  return tela.linhas.flatMap((linha) => {
    const doMes = linha.celulas.find((item) => item.competencia === competencia);
    return doMes && (doMes.nivel === 'atencao' || doMes.nivel === 'estourado') ? [{ nome: linha.nome, celula: doMes }] : [];
  });
}

/** O orçado como texto do campo: vazio quando não há. */
export const textoDoOrcado = (valor: number | null) => (valor === null ? '' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * Grava os 12 meses de um contexto. Vazio apaga o orçamento do mês (fica "sem orçamento", que é diferente de R$ 0,00).
 * `valores`: competência → texto do campo.
 */
export async function salvarOrcamentoDoContexto(produtoId: string | null, valores: Readonly<Record<string, string>>): Promise<number> {
  const lidos = Object.entries(valores).map(([competencia, texto]) => {
    const limpo = texto.trim();
    if (!limpo) return { competencia, valor: null };
    const valor = lerValor(limpo);
    if (valor === null || valor < 0) throw new ErroDeRegra(`Valor inválido em ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}: use reais, como 1.250,00.`);
    return { competencia, valor: redondo(valor) };
  });
  const existentes = await repositorios.orcamento.listar({ onde: { produto_id: produtoId } });
  let mudancas = 0;
  await emTransacao(async () => {
    for (const { competencia, valor } of lidos) {
      const atual = existentes.find((item) => item.competencia === competencia);
      if (valor === null) {
        if (atual) {
          await repositorios.orcamento.arquivar(atual.id);
          mudancas += 1;
        }
      } else if (!atual) {
        await repositorios.orcamento.criar({ produto_id: produtoId, competencia, valor_brl: valor, exemplo: false });
        mudancas += 1;
      } else if (atual.valor_brl !== valor) {
        await repositorios.orcamento.atualizar(atual.id, { valor_brl: valor });
        mudancas += 1;
      }
    }
  });
  return mudancas;
}

/** "Copiar orçamento do mês anterior": preenche só os contextos ainda sem orçamento no mês. Nunca sobrescreve. */
export async function copiarDoMesAnterior(competencia: string): Promise<number> {
  const [ano, mes] = competencia.split('-').map(Number) as [number, number];
  const anterior = mes === 1 ? `${ano - 1}-12-01` : `${ano}-${String(mes - 1).padStart(2, '0')}-01`;
  const orcamentos = await repositorios.orcamento.listar();
  const doAnterior = orcamentos.filter((item) => item.competencia === anterior);
  if (!doAnterior.length) throw new ErroDeRegra('O mês anterior não tem orçamento para copiar.');
  const faltam = doAnterior.filter((item) => !orcamentos.some((outro) => outro.competencia === competencia && outro.produto_id === item.produto_id));
  await emTransacao(async () => {
    for (const item of faltam) await repositorios.orcamento.criar({ produto_id: item.produto_id, competencia, valor_brl: item.valor_brl, exemplo: false });
  });
  return faltam.length;
}
