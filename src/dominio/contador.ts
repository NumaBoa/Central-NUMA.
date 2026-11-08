/**
 * T05.11 Exportação para a contabilidade (F1). Para uma competência: o CSV de títulos e baixas, o CSV de movimentos
 * societários e a lista de comprovantes (links). O envio fica registrado (data, para quem, como) na linha da
 * competência em `competencia_fechamento`, e é ele que marca o item 8 do fechamento (T05.10).
 * Valor em reais: a baixa traz o valor efetivo; o título em moeda estrangeira sem baixa fica sem valor em reais,
 * nunca estimado no arquivo do contador.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { CompetenciaFechamento } from '@/dados/tipos/fechamento';
import { gerarCsv } from '@/lib/csv';
import { formatarDiaISO } from '@/lib/formatacao';

export const CABECALHO_TITULOS = ['Data', 'Tipo', 'Descrição', 'Contraparte', 'Documento da contraparte', 'Categoria', 'Valor BRL', 'Conta', 'Comprovante'] as const;
export const CABECALHO_MOVIMENTOS = ['Data', 'Tipo', 'Sócia', 'Forma', 'Valor BRL', 'Conta', 'Comprovante'] as const;

const ultimoDia = (mes: string) => {
  const [ano, numero] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(ano, numero, 0)).toISOString().slice(0, 10);
};
const reais = (valor: number | null) => (valor === null ? '' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const TIPO_DA_BAIXA = { pagar: { pagamento: 'Pagamento', estorno: 'Estorno de pagamento', ajuste: 'Ajuste (juros e multas)' }, receber: { pagamento: 'Recebimento', estorno: 'Estorno de recebimento', ajuste: 'Ajuste' } } as const;
const TIPO_DO_MOVIMENTO = { aporte: 'Aporte', retirada: 'Retirada', distribuicao: 'Distribuição' } as const;
const FORMA_DO_MOVIMENTO = { dinheiro: 'Dinheiro', pagamento_despesa: 'Pagamento de despesa', bem_servico: 'Bem ou serviço' } as const;

export type PacoteDoContador = { mes: string; titulos: string[][]; movimentos: string[][]; comprovantes: string[]; envios: NonNullable<CompetenciaFechamento['envios_contador']> };

export async function montarPacote(mes: string): Promise<PacoteDoContador> {
  const [titulos, baixas, movimentos, contrapartes, categorias, contas, pessoas, fechamentos] = await Promise.all([
    repositorios.titulo.listar(),
    repositorios.baixa.listar(),
    repositorios.movimento_societario.listar(),
    repositorios.contraparte.listar({ incluirArquivados: true }),
    repositorios.categoria_financeira.listar({ incluirArquivados: true }),
    repositorios.conta_financeira.listar({ incluirArquivados: true }),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.competencia_fechamento.listar({ onde: { competencia: `${mes}-01` } }),
  ]);
  const inicio = `${mes}-01`;
  const fim = ultimoDia(mes);
  const doMes = (dia: string) => dia >= inicio && dia <= fim;
  const contraparteDe = (id: string | null) => contrapartes.find((item) => item.id === id);
  const categoria = (id: string) => categorias.find((item) => item.id === id)?.nome ?? '';
  const conta = (id: string | null) => contas.find((item) => item.id === id)?.nome ?? '';
  const tituloDe = new Map(titulos.map((titulo) => [titulo.id, titulo]));

  const linhasDosTitulos = titulos
    .filter((titulo) => !titulo.arquivado_em && titulo.situacao !== 'cancelado' && titulo.competencia.slice(0, 7) === mes)
    .map((titulo) => ({ data: titulo.vencimento, linha: [formatarDiaISO(titulo.vencimento), titulo.natureza === 'pagar' ? 'Título a pagar' : 'Título a receber', titulo.descricao, contraparteDe(titulo.contraparte_id)?.nome ?? '', contraparteDe(titulo.contraparte_id)?.documento ?? '', categoria(titulo.categoria_id), titulo.moeda === 'BRL' ? reais(titulo.valor) : '', '', ''] }));
  const daBaixa = baixas
    .filter((baixa) => !baixa.arquivado_em && doMes(baixa.data))
    .map((baixa) => {
      const titulo = tituloDe.get(baixa.titulo_id);
      const natureza = titulo?.natureza ?? 'pagar';
      return { data: baixa.data, linha: [formatarDiaISO(baixa.data), TIPO_DA_BAIXA[natureza][baixa.tipo], titulo?.descricao ?? 'Título removido', contraparteDe(titulo?.contraparte_id ?? null)?.nome ?? '', contraparteDe(titulo?.contraparte_id ?? null)?.documento ?? '', titulo ? categoria(titulo.categoria_id) : '', reais(baixa.valor_brl), conta(baixa.conta_financeira_id), baixa.comprovante_url ?? (baixa.sem_comprovante_motivo ? `Sem comprovante: ${baixa.sem_comprovante_motivo}` : '')] };
    });
  const doMesMovimentos = movimentos.filter((movimento) => !movimento.arquivado_em && doMes(movimento.data)).sort((a, b) => a.data.localeCompare(b.data));
  const nomeDaSocia = (id: string) => pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Sócia removida';
  const comprovantes = [...new Set([...baixas.filter((baixa) => !baixa.arquivado_em && doMes(baixa.data)).map((baixa) => baixa.comprovante_url), ...doMesMovimentos.map((movimento) => movimento.comprovante_url)].filter((link): link is string => Boolean(link)))];
  return {
    mes,
    titulos: [...linhasDosTitulos, ...daBaixa].sort((a, b) => a.data.localeCompare(b.data)).map((item) => item.linha),
    movimentos: doMesMovimentos.map((movimento) => [formatarDiaISO(movimento.data), TIPO_DO_MOVIMENTO[movimento.tipo], nomeDaSocia(movimento.socia_id), FORMA_DO_MOVIMENTO[movimento.forma], reais(movimento.valor_brl), conta(movimento.conta_financeira_id), movimento.comprovante_url ?? '']),
    comprovantes,
    envios: fechamentos[0]?.envios_contador ?? [],
  };
}

export const csvDosTitulos = (pacote: PacoteDoContador) => gerarCsv(CABECALHO_TITULOS, pacote.titulos);
export const csvDosMovimentos = (pacote: PacoteDoContador) => gerarCsv(CABECALHO_MOVIMENTOS, pacote.movimentos);
export const listaDeComprovantes = (pacote: PacoteDoContador) => gerarCsv(['Comprovante'], pacote.comprovantes.map((link) => [link]));

/** Registra o envio do pacote (data, para quem, como). Pode haver mais de um: o contador às vezes pede de novo. */
export async function registrarEnvio(mes: string, { data, para, como }: { data: string; para: string; como: string }, responsavelId: string): Promise<void> {
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de registrar o envio.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroDeRegra('Informe a data do envio.');
  if (!para.trim()) throw new ErroDeRegra('Informe para quem foi enviado.');
  if (!como.trim()) throw new ErroDeRegra('Informe como foi enviado (e-mail, Drive…).');
  const competencia = `${mes}-01`;
  const existente = (await repositorios.competencia_fechamento.listar({ onde: { competencia } }))[0];
  const envio = { data, para: para.trim(), como: como.trim(), por: responsavelId };
  if (existente) await repositorios.competencia_fechamento.atualizar(existente.id, { envios_contador: [...(existente.envios_contador ?? []), envio] });
  else await repositorios.competencia_fechamento.criar({ competencia, situacao: 'em_fechamento', checklist: {}, fechada_em: null, fechada_por: null, fechada_com_pendencias: null, reaberta_em: null, reaberta_motivo: null, envios_contador: [envio], exemplo: false });
}
