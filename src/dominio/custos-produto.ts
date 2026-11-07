/**
 * Custos rateados ao produto, lidos do M05 (RN-07.11 e T05.09). A tela T05.09 ainda não existe: quando existir,
 * ela e o simulador devem usar esta mesma conta (AR-04). Só lê: rateio não é uma nova saída de caixa.
 */
import { repositorios } from '@/dados/repositorios';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import type { Baixa, Titulo, TituloRateio } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { somarMeses } from './cobrancas';
import { ultimoCambio } from './ferramentas';

export const MESES_DA_MEDIA = 3;

export type FontesDeCusto = {
  titulos: readonly Titulo[];
  rateios: readonly TituloRateio[];
  baixas: readonly Baixa[];
  categorias: readonly CategoriaFinanceira[];
  cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[];
};

export type LinhaDeCusto = { competencia: string; categoria_id: string; valor: number | null; moeda: string; estimado: boolean; investimento: boolean };

export function primeiroDiaDoMes(dia: string): string {
  return `${dia.slice(0, 7)}-01`;
}

/** Em reais: o que foi pago, quando já foi pago; em aberto, o câmbio de referência (estimado). */
function valorEmReais(titulo: Titulo, rateio: TituloRateio, baixas: readonly Baixa[], cambios: FontesDeCusto['cambios']): { valor: number | null; estimado: boolean } {
  if (titulo.moeda === 'BRL') return { valor: rateio.valor, estimado: false };
  const dele = baixas.filter((baixa) => baixa.titulo_id === titulo.id);
  if (titulo.situacao === 'quitado' && dele.length) {
    const pago = dele.reduce((total, baixa) => total + (baixa.tipo === 'estorno' ? -baixa.valor_brl : baixa.valor_brl), 0);
    return { valor: pago * (rateio.percentual / 100), estimado: false };
  }
  const cambio = ultimoCambio(titulo.moeda, cambios);
  return { valor: cambio === null ? null : rateio.valor * cambio, estimado: true };
}

/**
 * O que é custo do produto: despesa a pagar, não cancelada nem suspensa, sem os reembolsos (RN-05.07: o custo
 * já está na despesa original). Investimento fica marcado, para a média poder tirar.
 */
export function linhasDeCustoDoProduto(produtoId: string, { titulos, rateios, baixas, categorias, cambios }: FontesDeCusto): LinhaDeCusto[] {
  const porId = new Map(titulos.map((titulo) => [titulo.id, titulo]));
  const categoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  return rateios.flatMap((rateio) => {
    const titulo = porId.get(rateio.titulo_id);
    if (rateio.produto_id !== produtoId || !titulo || titulo.arquivado_em) return [];
    if (titulo.natureza !== 'pagar' || titulo.situacao === 'cancelado' || titulo.suspenso || titulo.origem === 'reembolso') return [];
    const { valor, estimado } = valorEmReais(titulo, rateio, baixas, cambios);
    return [{ competencia: titulo.competencia, categoria_id: titulo.categoria_id, valor, moeda: titulo.moeda, estimado, investimento: categoriaPorId.get(titulo.categoria_id)?.natureza_custo === 'investimento' }];
  });
}

export type CustoMedio = {
  /** `null` quando não dá para saber: nunca vira zero (RT-08). */
  valor: number | null;
  situacao: 'calculado' | 'sem_historico' | 'sem_cambio';
  /** As competências da janela, da mais antiga para a mais nova. */
  competencias: readonly string[];
  mesesComCusto: number;
  estimado: boolean;
  /** Moedas sem câmbio de referência. */
  moedasSemCambio: readonly string[];
};

/** Os 3 meses completos antes do mês atual: o mês corrente ainda está incompleto. */
export function competenciasDaMedia(hoje: string): string[] {
  const atual = primeiroDiaDoMes(hoje);
  return Array.from({ length: MESES_DA_MEDIA }, (_, indice) => somarMeses(atual, indice - MESES_DA_MEDIA));
}

/**
 * RN-07.11: média dos últimos 3 meses, sem investimento. Divide só pelos meses que têm lançamento: mês sem
 * lançamento é falta de informação, não custo zero, e a tela avisa quantos meses entraram.
 */
export function calcularCustoMedio(produtoId: string, fontes: FontesDeCusto, hoje: string): CustoMedio {
  const competencias = competenciasDaMedia(hoje);
  const linhas = linhasDeCustoDoProduto(produtoId, fontes).filter((linha) => !linha.investimento && competencias.includes(linha.competencia));
  const moedasSemCambio = [...new Set(linhas.filter((linha) => linha.valor === null).map((linha) => linha.moeda))];
  const mesesComCusto = new Set(linhas.map((linha) => linha.competencia)).size;
  const base = { competencias, mesesComCusto, estimado: linhas.some((linha) => linha.estimado), moedasSemCambio };
  if (moedasSemCambio.length) return { ...base, valor: null, situacao: 'sem_cambio' };
  if (!mesesComCusto) return { ...base, valor: null, situacao: 'sem_historico' };
  return { ...base, valor: linhas.reduce((total, linha) => total + (linha.valor as number), 0) / mesesComCusto, situacao: 'calculado' };
}

async function lerFontes(): Promise<FontesDeCusto> {
  const [titulos, rateios, baixas, categorias, cambios] = await Promise.all([repositorios.titulo.listar(), repositorios.titulo_rateio.listar(), repositorios.baixa.listar(), repositorios.categoria_financeira.listar({ incluirArquivados: true }), repositorios.cambio_referencia.listar()]);
  return { titulos, rateios, baixas, categorias, cambios };
}

export async function custoMedioDoProduto(produtoId: string, hoje: string = hojeISO()): Promise<CustoMedio> {
  return calcularCustoMedio(produtoId, await lerFontes(), hoje);
}

/** Vários de uma vez, lendo o financeiro uma vez só: é o caso do portfólio. */
export async function custosMediosDosProdutos(ids: readonly string[], hoje: string = hojeISO()): Promise<ReadonlyMap<string, CustoMedio>> {
  const fontes = await lerFontes();
  return new Map(ids.map((id) => [id, calcularCustoMedio(id, fontes, hoje)]));
}

export type MesDeCusto = { competencia: string; categorias: { nome: string; valor: number | null; investimento: boolean }[]; total: number | null; estimado: boolean };

/** Aba Custos da ficha: por mês e categoria, do mais novo para o mais antigo. Só o que tem lançamento. */
export async function custosPorMesDoProduto(produtoId: string): Promise<MesDeCusto[]> {
  const fontes = await lerFontes();
  const nomes = new Map(fontes.categorias.map((categoria) => [categoria.id, categoria.nome]));
  const linhas = linhasDeCustoDoProduto(produtoId, fontes);
  const meses = [...new Set(linhas.map((linha) => linha.competencia))].sort((a, b) => b.localeCompare(a));
  return meses.map((competencia) => {
    const doMes = linhas.filter((linha) => linha.competencia === competencia);
    const porCategoria = new Map<string, { nome: string; valor: number | null; investimento: boolean }>();
    for (const linha of doMes) {
      const atual = porCategoria.get(linha.categoria_id);
      const valor = atual === undefined ? linha.valor : atual.valor === null || linha.valor === null ? null : atual.valor + linha.valor;
      porCategoria.set(linha.categoria_id, { nome: nomes.get(linha.categoria_id) ?? 'Categoria removida', valor, investimento: linha.investimento });
    }
    const semValor = doMes.some((linha) => linha.valor === null);
    return { competencia, categorias: [...porCategoria.values()], total: semValor ? null : doMes.reduce((total, linha) => total + (linha.valor as number), 0), estimado: doMes.some((linha) => linha.estimado) };
  });
}
