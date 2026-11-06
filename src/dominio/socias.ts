/** T05.05: aportes, retiradas e reembolsos das sócias (RN-05.06, RN-05.11 e RN-05.19). */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { MovimentoSocietario, Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { lerValor } from './dinheiro';
import { normalizarTexto } from './duplicidade';
import { carregarLancamentos, type DadosDosLancamentos, type LinhaDoTitulo } from './lancamentos';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { rotuloDaCompetencia } from './titulos';

export const ROTULOS_TIPO_MOVIMENTO: Readonly<Record<MovimentoSocietario['tipo'], string>> = { aporte: 'Aporte', retirada: 'Retirada', distribuicao: 'Distribuição' };
export const ROTULOS_FORMA_MOVIMENTO: Readonly<Record<MovimentoSocietario['forma'], string>> = { dinheiro: 'Dinheiro', pagamento_despesa: 'Pagamento de despesa', bem_servico: 'Bem ou serviço' };

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const somar = (valores: readonly number[]) => arredondar(valores.reduce((total, valor) => total + valor, 0));

export type DadosDasSocias = DadosDosLancamentos & {
  socias: Pessoa[];
  movimentos: MovimentoSocietario[];
  /** Reembolsos a sócias que não foram cancelados. */
  reembolsos: LinhaDoTitulo[];
  /** Abertura da primeira entidade PJ ativa. Sem ela, o período pré-operacional vai até hoje. */
  fimDoPreOperacional: string | null;
};

/** RN-05.19: pré-operacional é antes de haver entidade PJ ativa. */
export function fimDoPreOperacional(entidades: readonly Pick<Entidade, 'tipo_pessoa' | 'situacao' | 'data_abertura' | 'arquivado_em'>[]): string | null {
  const aberturas = entidades.flatMap((entidade) => (!entidade.arquivado_em && entidade.tipo_pessoa === 'pj' && entidade.situacao === 'ativa' && entidade.data_abertura ? [entidade.data_abertura] : []));
  return aberturas.sort()[0] ?? null;
}

export async function carregarSocias(hoje: string = hojeISO()): Promise<DadosDasSocias> {
  const [lancamentos, movimentos, entidades] = await Promise.all([carregarLancamentos(hoje), repositorios.movimento_societario.listar(), repositorios.entidade.listar()]);
  return {
    ...lancamentos,
    // Sócia arquivada continua aqui se tiver movimento: o total de cada uma não pode sumir.
    socias: lancamentos.pessoas.filter((pessoa) => pessoa.eh_socia && (!pessoa.arquivado_em || movimentos.some((movimento) => movimento.socia_id === pessoa.id))),
    movimentos: [...movimentos].sort((a, b) => b.data.localeCompare(a.data) || b.codigo.localeCompare(a.codigo)),
    reembolsos: lancamentos.titulos.filter((titulo) => titulo.origem === 'reembolso' && titulo.situacao !== 'cancelado' && !titulo.arquivado_em),
    fimDoPreOperacional: fimDoPreOperacional(entidades),
  };
}

// ---------- Cartões por sócia ----------

export type ResumoDaSocia = {
  socia: Pessoa;
  aportes: number;
  retiradasEDistribuicoes: number;
  reembolsosPagos: number;
  reembolsosEmAberto: number;
  /** Aportes − retiradas − distribuições, independentemente dos reembolsos (CA-05.05). */
  investimentoLiquido: number;
};

type ReembolsoDaConta = Pick<Titulo, 'beneficiario_pessoa_id' | 'valor'> & { saldo: number };

export function resumoDaSocia(socia: Pessoa, movimentos: readonly Pick<MovimentoSocietario, 'socia_id' | 'tipo' | 'valor_brl'>[], reembolsos: readonly ReembolsoDaConta[]): ResumoDaSocia {
  const dela = movimentos.filter((movimento) => movimento.socia_id === socia.id);
  const aportes = somar(dela.filter((movimento) => movimento.tipo === 'aporte').map((movimento) => movimento.valor_brl));
  const retiradasEDistribuicoes = somar(dela.filter((movimento) => movimento.tipo !== 'aporte').map((movimento) => movimento.valor_brl));
  const seus = reembolsos.filter((titulo) => titulo.beneficiario_pessoa_id === socia.id);
  return {
    socia,
    aportes,
    retiradasEDistribuicoes,
    reembolsosPagos: somar(seus.map((titulo) => titulo.valor - titulo.saldo)),
    reembolsosEmAberto: somar(seus.map((titulo) => titulo.saldo)),
    investimentoLiquido: arredondar(aportes - retiradasEDistribuicoes),
  };
}

/** O que ainda falta pagar às sócias, do vencimento mais próximo ao mais distante. */
export function reembolsosEmAberto<T extends Pick<Titulo, 'vencimento'> & { saldo: number }>(reembolsos: readonly T[]): T[] {
  return reembolsos.filter((titulo) => titulo.saldo > 0).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

// ---------- Lista de movimentos ----------

export type FiltrosMovimentos = { busca: string; socia: string; tipo: string; forma: string };

export const FILTROS_MOVIMENTOS_INICIAIS: FiltrosMovimentos = { busca: '', socia: '', tipo: '', forma: '' };

export function filtrarMovimentos<T extends MovimentoSocietario>(movimentos: readonly T[], { busca, socia, tipo, forma }: FiltrosMovimentos, nomeDaSocia: (id: string) => string): T[] {
  const procurado = normalizarTexto(busca);
  return movimentos.filter((movimento) => {
    if (socia && movimento.socia_id !== socia) return false;
    if (tipo && movimento.tipo !== tipo) return false;
    if (forma && movimento.forma !== forma) return false;
    return !procurado || normalizarTexto(`${movimento.codigo} ${nomeDaSocia(movimento.socia_id)} ${movimento.observacao ?? ''}`).includes(procurado);
  });
}

// ---------- Novo aporte em dinheiro ----------

export function criarEsquemaAporte(hoje: string = hojeISO()) {
  return z
    .object({
      socia_id: z.string().min(1, 'Escolha a sócia.'),
      data: z.string().min(1, 'Informe a data.'),
      valor: z.string().trim(),
      conta_id: z.string().min(1, 'Escolha a conta da Numa que recebeu.'),
      comprovante_url: z.string().trim(),
      sem_comprovante: z.boolean(),
      sem_comprovante_motivo: z.string().trim(),
      observacao: z.string().trim(),
    })
    .superRefine((dados, contexto) => {
      const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
      if (dados.data > hoje) falha('data', 'A data não pode ser futura.');
      const valor = lerValor(dados.valor);
      if (valor === null || valor <= 0) falha('valor', 'Informe o valor, como 0,00.');
      if (dados.sem_comprovante) {
        if (!dados.sem_comprovante_motivo) falha('sem_comprovante_motivo', 'Diga por que não tem comprovante.');
      } else if (!dados.comprovante_url) falha('comprovante_url', 'Cole o link do comprovante, ou marque que não tem.');
      else if (!linkDoDriveValido(dados.comprovante_url)) falha('comprovante_url', MENSAGEM_LINK_DRIVE);
    });
}

export type FormularioAporte = z.infer<ReturnType<typeof criarEsquemaAporte>>;

export const formularioAporteVazio = (hoje: string = hojeISO()): FormularioAporte => ({ socia_id: '', data: hoje, valor: '', conta_id: '', comprovante_url: '', sem_comprovante: false, sem_comprovante_motivo: '', observacao: '' });

/** O aporte é em reais e entra numa conta da Numa: conta pessoal de sócia não recebe. */
export const contasParaAporte = <T extends Pick<ContaFinanceira, 'arquivado_em' | 'situacao' | 'tipo' | 'moeda'>>(contas: readonly T[]): T[] => contas.filter((conta) => !conta.arquivado_em && conta.situacao === 'ativa' && conta.tipo !== 'pessoal_socia' && conta.moeda === 'BRL');

export async function novoAporteEmDinheiro(formulario: FormularioAporte, hoje: string = hojeISO()): Promise<MovimentoSocietario> {
  if (formulario.data > hoje) throw new ErroDeRegra('A data não pode ser futura.');
  const [conta, socia] = await Promise.all([repositorios.conta_financeira.obter(formulario.conta_id), repositorios.pessoa.obter(formulario.socia_id)]);
  if (!socia?.eh_socia) throw new ErroDeRegra('Escolha a sócia.');
  if (!conta || !contasParaAporte([conta]).length) throw new ErroDeRegra('Escolha uma conta da Numa, em reais.');
  const observacao = [formulario.observacao, formulario.sem_comprovante ? `Sem comprovante: ${formulario.sem_comprovante_motivo}` : ''].filter(Boolean).join(' · ');
  return repositorios.movimento_societario.criar({
    tipo: 'aporte',
    socia_id: socia.id,
    data: formulario.data,
    valor_brl: lerValor(formulario.valor) as number,
    forma: 'dinheiro',
    titulo_origem_id: null,
    baixa_origem_id: null,
    conta_financeira_id: conta.id,
    comprovante_url: formulario.sem_comprovante ? null : formulario.comprovante_url,
    observacao: observacao || null,
  });
}

// ---------- Relatório do período pré-operacional (RN-05.19) ----------

export type LinhaDoRelatorio = { id: string; mes: string; rotulo: string; sociaId: string; aportes: number; retiradas: number; liquido: number };

/** Por sócia e por mês, do mais antigo ao mais recente. É a base do memorando de integralização (M06). */
export function relatorioDeInvestimento(movimentos: readonly Pick<MovimentoSocietario, 'data' | 'socia_id' | 'tipo' | 'valor_brl'>[], fim: string | null): LinhaDoRelatorio[] {
  const noPeriodo = movimentos.filter((movimento) => !fim || movimento.data < fim);
  const chaves = [...new Set(noPeriodo.map((movimento) => `${movimento.data.slice(0, 7)}|${movimento.socia_id}`))].sort();
  return chaves.map((chave) => {
    const [mes = '', sociaId = ''] = chave.split('|');
    const dele = noPeriodo.filter((movimento) => movimento.socia_id === sociaId && movimento.data.startsWith(mes));
    const aportes = somar(dele.filter((movimento) => movimento.tipo === 'aporte').map((movimento) => movimento.valor_brl));
    const retiradas = somar(dele.filter((movimento) => movimento.tipo !== 'aporte').map((movimento) => movimento.valor_brl));
    return { id: chave, mes, rotulo: rotuloDaCompetencia(`${mes}-01`), sociaId, aportes, retiradas, liquido: arredondar(aportes - retiradas) };
  });
}

export type ConsolidadoDaSocia = { socia: Pessoa; aportes: number; retiradas: number; reembolsosEmAberto: number; total: number };

/** RN-05.19: por sócia, aportes − retiradas + reembolsos em aberto. */
export function consolidadoDoRelatorio(socias: readonly Pessoa[], linhas: readonly LinhaDoRelatorio[], reembolsos: readonly ReembolsoDaConta[]): ConsolidadoDaSocia[] {
  return socias.map((socia) => {
    const dela = linhas.filter((linha) => linha.sociaId === socia.id);
    const aportes = somar(dela.map((linha) => linha.aportes));
    const retiradas = somar(dela.map((linha) => linha.retiradas));
    const emAberto = somar(reembolsos.filter((titulo) => titulo.beneficiario_pessoa_id === socia.id).map((titulo) => titulo.saldo));
    return { socia, aportes, retiradas, reembolsosEmAberto: emAberto, total: arredondar(aportes - retiradas + emAberto) };
  });
}
