/** T05.01: a lista de títulos, com abas, filtros e totais. */
import { repositorios } from '@/dados/repositorios';
import type { Area } from '@/dados/tipos/area';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import type { Contraparte } from '@/dados/tipos/contraparte';
import type { AssinaturaFerramenta, Ferramenta } from '@/dados/tipos/ferramenta';
import type { CategoriaFinanceira, ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Baixa, Titulo, TituloRateio } from '@/dados/tipos/titulo';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { normalizarTexto } from './duplicidade';
import { ultimoCambio } from './ferramentas';
import { estaVencido, saldoDoTitulo } from './titulos';

export type LinhaDoTitulo = Titulo & {
  rateio: TituloRateio[];
  baixas: Baixa[];
  saldo: number;
  vencido: boolean;
  /** Há pagamento sem o link do comprovante. */
  semComprovante: boolean;
};

export type DadosDosLancamentos = {
  titulos: LinhaDoTitulo[];
  pessoas: Pessoa[];
  produtos: Produto[];
  marcas: Marca[];
  areas: Area[];
  contrapartes: Contraparte[];
  categorias: CategoriaFinanceira[];
  contas: ContaFinanceira[];
  ferramentas: Ferramenta[];
  assinaturas: AssinaturaFerramenta[];
  cambios: CambioReferencia[];
};

export function montarLinhaDoTitulo(titulo: Titulo, rateios: readonly TituloRateio[], baixas: readonly Baixa[], hoje: string): LinhaDoTitulo {
  const dele = baixas.filter((baixa) => baixa.titulo_id === titulo.id);
  return {
    ...titulo,
    rateio: rateios.filter((linha) => linha.titulo_id === titulo.id),
    baixas: dele,
    saldo: saldoDoTitulo(titulo, dele),
    vencido: estaVencido(titulo, hoje),
    semComprovante: dele.some((baixa) => baixa.tipo === 'pagamento' && !baixa.comprovante_url),
  };
}

export async function carregarLancamentos(hoje: string): Promise<DadosDosLancamentos> {
  const [titulos, rateios, baixas, pessoas, produtos, marcas, areas, contrapartes, categorias, contas, ferramentas, assinaturas, cambios] = await Promise.all([
    repositorios.titulo.listar({ incluirArquivados: true }),
    repositorios.titulo_rateio.listar(),
    repositorios.baixa.listar(),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
    repositorios.area.listar(),
    repositorios.contraparte.listar({ incluirArquivados: true }),
    repositorios.categoria_financeira.listar({ incluirArquivados: true }),
    repositorios.conta_financeira.listar({ incluirArquivados: true }),
    repositorios.ferramenta.listar({ incluirArquivados: true }),
    repositorios.assinatura_ferramenta.listar({ onde: { situacao: 'ativa' } }),
    repositorios.cambio_referencia.listar(),
  ]);
  return { titulos: titulos.map((titulo) => montarLinhaDoTitulo(titulo, rateios, baixas, hoje)), pessoas, produtos, marcas, areas, contrapartes, categorias, contas, ferramentas, assinaturas, cambios };
}

// ---------- Abas e filtros ----------

export const ABAS_DE_LANCAMENTOS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'pagar', rotulo: 'A pagar' },
  { id: 'vencidos', rotulo: 'Vencidos' },
  { id: 'proximos', rotulo: 'Próximos 30 dias' },
  { id: 'sem_comprovante', rotulo: 'Sem comprovante' },
  { id: 'reembolsos', rotulo: 'Reembolsos a sócias' },
] as const;

export type IdDaAbaDeLancamentos = (typeof ABAS_DE_LANCAMENTOS)[number]['id'];

export type FiltrosLancamentos = {
  busca: string;
  aba: IdDaAbaDeLancamentos;
  situacao: string;
  vencimentoDe: string;
  vencimentoAte: string;
  competencia: string;
  contexto: string;
  categoria: string;
  contraparte: string;
  conta: string;
  origem: string;
  moeda: string;
  arquivados: boolean;
};

export const FILTROS_LANCAMENTOS_INICIAIS: FiltrosLancamentos = { busca: '', aba: 'todos', situacao: '', vencimentoDe: '', vencimentoAte: '', competencia: '', contexto: '', categoria: '', contraparte: '', conta: '', origem: '', moeda: '', arquivados: false };

const somarDias = (dia: string, dias: number) => {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

const emAberto = (titulo: Pick<Titulo, 'situacao'>) => titulo.situacao === 'previsto' || titulo.situacao === 'aberto' || titulo.situacao === 'parcial';

function passaNaAba(titulo: LinhaDoTitulo, aba: IdDaAbaDeLancamentos, hoje: string): boolean {
  if (aba === 'pagar') return titulo.natureza === 'pagar' && emAberto(titulo);
  if (aba === 'vencidos') return titulo.vencido;
  if (aba === 'proximos') return emAberto(titulo) && titulo.vencimento >= hoje && titulo.vencimento <= somarDias(hoje, 30);
  if (aba === 'sem_comprovante') return titulo.semComprovante;
  if (aba === 'reembolsos') return titulo.origem === 'reembolso';
  return true;
}

type OpcoesDoFiltro = { contextoGlobalId: string; hoje: string; nomeDaContraparte: (titulo: Titulo) => string };

function passaNosFiltros(titulo: LinhaDoTitulo, filtros: FiltrosLancamentos, { contextoGlobalId, nomeDaContraparte }: OpcoesDoFiltro): boolean {
  const texto = normalizarTexto(filtros.busca);
  const contexto = filtros.contexto || (contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId);
  if (Boolean(titulo.arquivado_em) !== filtros.arquivados) return false;
  if (texto && !normalizarTexto(`${titulo.codigo} ${titulo.descricao} ${nomeDaContraparte(titulo)}`).includes(texto)) return false;
  if (filtros.situacao && titulo.situacao !== filtros.situacao) return false;
  if (filtros.vencimentoDe && titulo.vencimento < filtros.vencimentoDe) return false;
  if (filtros.vencimentoAte && titulo.vencimento > filtros.vencimentoAte) return false;
  if (filtros.competencia && titulo.competencia.slice(0, 7) !== filtros.competencia) return false;
  if (contexto && !titulo.rateio.some((linha) => (linha.produto_id ?? ID_INSTITUCIONAL) === contexto)) return false;
  if (filtros.categoria && titulo.categoria_id !== filtros.categoria) return false;
  if (filtros.contraparte && titulo.contraparte_id !== filtros.contraparte) return false;
  if (filtros.conta && !titulo.baixas.some((baixa) => baixa.conta_financeira_id === filtros.conta)) return false;
  if (filtros.origem && titulo.origem !== filtros.origem) return false;
  if (filtros.moeda && titulo.moeda !== filtros.moeda) return false;
  return true;
}

export function filtrarTitulos(titulos: readonly LinhaDoTitulo[], filtros: FiltrosLancamentos, opcoes: OpcoesDoFiltro): LinhaDoTitulo[] {
  return titulos
    .filter((titulo) => passaNosFiltros(titulo, filtros, opcoes) && passaNaAba(titulo, filtros.aba, opcoes.hoje))
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento) || b.codigo.localeCompare(a.codigo));
}

export function contadoresDosLancamentos(titulos: readonly LinhaDoTitulo[], filtros: FiltrosLancamentos, opcoes: OpcoesDoFiltro): Record<IdDaAbaDeLancamentos, number> {
  const passam = titulos.filter((titulo) => passaNosFiltros(titulo, filtros, opcoes));
  return Object.fromEntries(ABAS_DE_LANCAMENTOS.map((aba) => [aba.id, passam.filter((titulo) => passaNaAba(titulo, aba.id, opcoes.hoje)).length])) as Record<IdDaAbaDeLancamentos, number>;
}

// ---------- Totais (T05.01): seguem os filtros ----------

export type TotaisDosLancamentos = {
  emAbertoPagar: number;
  vencido: number;
  pagoNoPeriodo: number;
  /** Há moeda estrangeira no total: o valor é estimado, pelo câmbio de referência (RN-05.05). */
  estimado: boolean;
  /** Moeda sem câmbio informado: fica de fora, em vez de somar moedas diferentes. */
  naoIncluidos: number;
};

function emReais(titulo: Pick<Titulo, 'moeda'>, valor: number, cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[]): number | null {
  if (titulo.moeda === 'BRL') return valor;
  const cambio = ultimoCambio(titulo.moeda, cambios);
  return cambio === null ? null : valor * cambio;
}

export function totaisDosLancamentos(titulos: readonly LinhaDoTitulo[], cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[], periodo: { de: string; ate: string }): TotaisDosLancamentos {
  let emAbertoPagar = 0;
  let vencido = 0;
  let pagoNoPeriodo = 0;
  let estimado = false;
  let naoIncluidos = 0;
  for (const titulo of titulos) {
    if (titulo.natureza !== 'pagar') continue;
    if (emAberto(titulo)) {
      const valor = emReais(titulo, titulo.saldo, cambios);
      if (valor === null) naoIncluidos += 1;
      else {
        if (titulo.moeda !== 'BRL') estimado = true;
        emAbertoPagar += valor;
        if (titulo.vencido) vencido += valor;
      }
    }
    for (const baixa of titulo.baixas) {
      if (baixa.data < periodo.de || baixa.data > periodo.ate) continue;
      pagoNoPeriodo += baixa.tipo === 'estorno' ? -baixa.valor_brl : baixa.valor_brl;
    }
  }
  const redondo = (valor: number) => Math.round(valor * 100) / 100;
  return { emAbertoPagar: redondo(emAbertoPagar), vencido: redondo(vencido), pagoNoPeriodo: redondo(pagoNoPeriodo), estimado, naoIncluidos };
}

/** Sem período nos filtros, "pago" é o mês corrente. */
export function periodoDosTotais(filtros: Pick<FiltrosLancamentos, 'vencimentoDe' | 'vencimentoAte'>, hoje: string): { de: string; ate: string; doMes: boolean } {
  if (filtros.vencimentoDe || filtros.vencimentoAte) return { de: filtros.vencimentoDe || '0000-01-01', ate: filtros.vencimentoAte || '9999-12-31', doMes: false };
  return { de: `${hoje.slice(0, 7)}-01`, ate: hoje, doMes: true };
}
