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
  /** Há pagamento de pé sem o link do comprovante, com exceção justificada ou não. */
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
  const comprovante = comprovanteDoTitulo({ baixas: dele }).estado;
  return {
    ...titulo,
    rateio: rateios.filter((linha) => linha.titulo_id === titulo.id),
    baixas: dele,
    saldo: saldoDoTitulo(titulo, dele),
    vencido: estaVencido(titulo, hoje),
    semComprovante: comprovante === 'excecao' || comprovante === 'pendente',
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

// ---------- Filtros ----------

/**
 * A situação fica num lugar só. Além das situações gravadas, há duas leituras derivadas:
 * "Vencidos" (M05 §2: em aberto ou parcial, passado o vencimento) e "Com saldo a pagar".
 */
export const OPCOES_DE_SITUACAO = [
  { valor: 'com_saldo', rotulo: 'Com saldo a pagar' },
  { valor: 'vencido', rotulo: 'Vencidos' },
  { valor: 'aberto', rotulo: 'Em aberto' },
  { valor: 'parcial', rotulo: 'Parciais' },
  { valor: 'previsto', rotulo: 'Previstos' },
  { valor: 'quitado', rotulo: 'Quitados' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
] as const;

export type FiltrosLancamentos = {
  busca: string;
  situacao: string;
  vencimentoDe: string;
  vencimentoAte: string;
  /** Data da baixa: recorta a lista e o cartão "Pago". Vazio, o cartão fica no mês corrente (decisão de 07/11/2026). */
  pagamentoDe: string;
  pagamentoAte: string;
  competencia: string;
  categoria: string;
  contraparte: string;
  conta: string;
  origem: string;
  moeda: string;
  responsavel: string;
  semComprovante: boolean;
  reembolsos: boolean;
  arquivados: boolean;
};

export const FILTROS_LANCAMENTOS_INICIAIS: FiltrosLancamentos = { busca: '', situacao: '', vencimentoDe: '', vencimentoAte: '', pagamentoDe: '', pagamentoAte: '', competencia: '', categoria: '', contraparte: '', conta: '', origem: '', moeda: '', responsavel: '', semComprovante: false, reembolsos: false, arquivados: false };

/** Os filtros que ficam dentro de "Mais filtros": é o número que o botão mostra. */
export function quantosMaisFiltros(filtros: FiltrosLancamentos): number {
  return [filtros.vencimentoDe || filtros.vencimentoAte, filtros.pagamentoDe || filtros.pagamentoAte, filtros.categoria, filtros.contraparte, filtros.conta, filtros.origem, filtros.moeda, filtros.responsavel, filtros.semComprovante, filtros.reembolsos, filtros.arquivados].filter(Boolean).length;
}

export const somarDias = (dia: string, dias: number) => {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

const dentroDoPeriodo = (dia: string, de: string, ate: string) => (!de || dia >= de) && (!ate || dia <= ate);

const emAberto = (titulo: Pick<Titulo, 'situacao'>) => titulo.situacao === 'previsto' || titulo.situacao === 'aberto' || titulo.situacao === 'parcial';

function passaNaSituacao(titulo: LinhaDoTitulo, situacao: string): boolean {
  if (!situacao) return true;
  if (situacao === 'vencido') return titulo.vencido;
  if (situacao === 'com_saldo') return titulo.natureza === 'pagar' && emAberto(titulo);
  return titulo.situacao === situacao;
}

type OpcoesDoFiltro = { contextoGlobalId: string; hoje: string; nomeDaContraparte: (titulo: Titulo) => string };

function passaNosFiltros(titulo: LinhaDoTitulo, filtros: FiltrosLancamentos, { contextoGlobalId, nomeDaContraparte }: OpcoesDoFiltro): boolean {
  const texto = normalizarTexto(filtros.busca);
  const contexto = contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId;
  if (Boolean(titulo.arquivado_em) !== filtros.arquivados) return false;
  if (texto && !normalizarTexto(`${titulo.codigo} ${titulo.descricao} ${nomeDaContraparte(titulo)}`).includes(texto)) return false;
  if (!passaNaSituacao(titulo, filtros.situacao)) return false;
  if (filtros.vencimentoDe && titulo.vencimento < filtros.vencimentoDe) return false;
  if (filtros.vencimentoAte && titulo.vencimento > filtros.vencimentoAte) return false;
  if ((filtros.pagamentoDe || filtros.pagamentoAte) && !titulo.baixas.some((baixa) => !baixa.arquivado_em && baixa.tipo === 'pagamento' && dentroDoPeriodo(baixa.data, filtros.pagamentoDe, filtros.pagamentoAte))) return false;
  if (filtros.competencia && titulo.competencia.slice(0, 7) !== filtros.competencia) return false;
  if (contexto && !titulo.rateio.some((linha) => (linha.produto_id ?? ID_INSTITUCIONAL) === contexto)) return false;
  if (filtros.categoria && titulo.categoria_id !== filtros.categoria) return false;
  if (filtros.contraparte && titulo.contraparte_id !== filtros.contraparte) return false;
  if (filtros.conta && !titulo.baixas.some((baixa) => baixa.conta_financeira_id === filtros.conta)) return false;
  if (filtros.origem && titulo.origem !== filtros.origem) return false;
  if (filtros.moeda && titulo.moeda !== filtros.moeda) return false;
  if (filtros.responsavel && titulo.responsavel_id !== filtros.responsavel) return false;
  if (filtros.semComprovante && !titulo.semComprovante) return false;
  if (filtros.reembolsos && titulo.origem !== 'reembolso') return false;
  return true;
}

/** Vencidos, do mais antigo; a vencer, do mais próximo; e o que já encerrou, do mais recente. */
function grupoDaOrdem(titulo: LinhaDoTitulo): number {
  if (titulo.vencido) return 0;
  return emAberto(titulo) ? 1 : 2;
}

export const ROTULO_ORDEM_PADRAO = 'Vencidos primeiro, depois a vencer e encerrados';

export function filtrarTitulos(titulos: readonly LinhaDoTitulo[], filtros: FiltrosLancamentos, opcoes: OpcoesDoFiltro): LinhaDoTitulo[] {
  return titulos
    .filter((titulo) => passaNosFiltros(titulo, filtros, opcoes))
    .sort((a, b) => {
      const grupo = grupoDaOrdem(a) - grupoDaOrdem(b);
      if (grupo) return grupo;
      const sentido = grupoDaOrdem(a) === 2 ? -1 : 1;
      return sentido * a.vencimento.localeCompare(b.vencimento) || a.codigo.localeCompare(b.codigo);
    });
}

const MESES_POR_EXTENSO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** `2026-11` vira "Novembro de 2026". */
export function rotuloDoMes(mes: string): string {
  const [ano, numero] = mes.split('-');
  return `${MESES_POR_EXTENSO[Number(numero) - 1]} de ${ano}`;
}

/** As competências que existem nos lançamentos, da mais recente para a mais antiga. */
export function competenciasDosTitulos(titulos: readonly Pick<Titulo, 'competencia' | 'arquivado_em'>[]): string[] {
  return [...new Set(titulos.filter((titulo) => !titulo.arquivado_em).map((titulo) => titulo.competencia.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
}

// ---------- Valor, pagamentos e comprovante de cada título ----------

/** O que já foi pago, na moeda do título: pagamentos menos estornos. Ajuste (juros, multa) não abate o saldo. */
export function pagoDoTitulo(titulo: Pick<LinhaDoTitulo, 'baixas'>): number {
  const total = titulo.baixas.filter((baixa) => !baixa.arquivado_em).reduce((soma, baixa) => soma + (baixa.tipo === 'pagamento' ? baixa.valor_moeda : baixa.tipo === 'estorno' ? -baixa.valor_moeda : 0), 0);
  return Math.round(total * 100) / 100;
}

export type ComprovanteDoTitulo = { estado: 'nao_se_aplica' | 'anexado' | 'excecao' | 'pendente'; motivo?: string };

/**
 * D17: comprovante sempre obrigatório, com exceção justificada. Só conta o pagamento que ficou de pé:
 * sem pagamento, ainda não há o que comprovar, e o estornado deixou de valer.
 */
export function comprovanteDoTitulo(titulo: Pick<LinhaDoTitulo, 'baixas'>): ComprovanteDoTitulo {
  const validas = titulo.baixas.filter((baixa) => !baixa.arquivado_em);
  const estornadas = new Set(validas.flatMap((baixa) => (baixa.tipo === 'estorno' && baixa.baixa_original_id ? [baixa.baixa_original_id] : [])));
  const pagamentos = validas.filter((baixa) => baixa.tipo === 'pagamento' && !estornadas.has(baixa.id));
  if (!pagamentos.length) return { estado: 'nao_se_aplica' };
  const semLink = pagamentos.filter((baixa) => !baixa.comprovante_url);
  if (!semLink.length) return { estado: 'anexado' };
  const semMotivo = semLink.some((baixa) => !baixa.sem_comprovante_motivo);
  return semMotivo ? { estado: 'pendente' } : { estado: 'excecao', motivo: semLink.map((baixa) => baixa.sem_comprovante_motivo).join(' · ') };
}

// ---------- Totais (T05.01): seguem os filtros ----------

/** Valor numa moeda que não foi somado aos reais, ou foi somado por estimativa. */
export type ValorPorMoeda = { moeda: string; valor: number };

export type TotaisDosLancamentos = {
  /** Em aberto e parciais, já confirmados. Os previstos ficam à parte (decisão de 07/11/2026, a revisar). */
  emAbertoPagar: number;
  /** Parte do em aberto. */
  vencido: number;
  /** À parte do em aberto: previstos, ainda não confirmados. */
  previsto: number;
  /** Pela data da baixa, no período. Sem o pagamento de reembolso à sócia, que repetiria a despesa (RN-05.07). */
  pagoNoPeriodo: number;
  /** Os reembolsos à sócia pagos no período, mostrados à parte. */
  reembolsosNoPeriodo: number;
  /** O que foi pago dos títulos da lista, em qualquer data: a leitura "títulos da competência". */
  pagoDosTitulos: number;
  /** Quantos títulos entraram na conta. */
  quantos: number;
  /** Há moeda estrangeira no total: o valor é estimado, pelo câmbio de referência (RN-05.05). */
  estimado: boolean;
  /** Moeda sem câmbio informado, fora dos previstos: fica de fora, em vez de somar moedas diferentes. */
  naoIncluidos: number;
  /** O que ficou de fora de cada total, na moeda do título. */
  semConversao: ValorPorMoeda[];
  vencidoSemConversao: ValorPorMoeda[];
  previstoSemConversao: ValorPorMoeda[];
  /** O que entrou em reais por estimativa, na moeda do título: no em aberto e nos previstos. */
  estimados: ValorPorMoeda[];
  previstoEstimados: ValorPorMoeda[];
};

function emReais(titulo: Pick<Titulo, 'moeda'>, valor: number, cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[]): number | null {
  if (titulo.moeda === 'BRL') return valor;
  const cambio = ultimoCambio(titulo.moeda, cambios);
  return cambio === null ? null : valor * cambio;
}

const redondo = (valor: number) => Math.round(valor * 100) / 100;

function acumular(lista: ValorPorMoeda[], moeda: string, valor: number) {
  const item = lista.find((atual) => atual.moeda === moeda);
  if (item) item.valor = redondo(item.valor + valor);
  else lista.push({ moeda, valor: redondo(valor) });
}

/**
 * RN-05.09: com um produto (ou a Numa institucional) no contexto, o título conta pela parte do rateio desse contexto.
 * Na Numa consolidada, conta inteiro, e cada baixa entra uma vez só. Sem rateio informado, é 100% do título (RN-05.08).
 */
export function parteDoContexto(titulo: Pick<LinhaDoTitulo, 'rateio'>, contextoId: string): number {
  if (!contextoId || contextoId === ID_CONSOLIDADA || !titulo.rateio.length) return 1;
  const percentual = titulo.rateio.filter((linha) => (linha.produto_id ?? ID_INSTITUCIONAL) === contextoId).reduce((soma, linha) => soma + linha.percentual, 0);
  return percentual / 100;
}

const valorDaBaixa = (baixa: Pick<Baixa, 'tipo' | 'valor_brl'>) => (baixa.tipo === 'estorno' ? -baixa.valor_brl : baixa.valor_brl);

export function totaisDosLancamentos(titulos: readonly LinhaDoTitulo[], cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[], periodo: { de: string; ate: string }, contextoId: string = ID_CONSOLIDADA): TotaisDosLancamentos {
  let emAbertoPagar = 0;
  let vencido = 0;
  let previsto = 0;
  let pagoNoPeriodo = 0;
  let reembolsosNoPeriodo = 0;
  let pagoDosTitulos = 0;
  let quantos = 0;
  let naoIncluidos = 0;
  const semConversao: ValorPorMoeda[] = [];
  const vencidoSemConversao: ValorPorMoeda[] = [];
  const previstoSemConversao: ValorPorMoeda[] = [];
  const estimados: ValorPorMoeda[] = [];
  const previstoEstimados: ValorPorMoeda[] = [];
  for (const titulo of titulos) {
    if (titulo.natureza !== 'pagar') continue;
    quantos += 1;
    const parte = parteDoContexto(titulo, contextoId);
    if (emAberto(titulo)) {
      const saldo = titulo.saldo * parte;
      const ePrevisto = titulo.situacao === 'previsto';
      const valor = emReais(titulo, saldo, cambios);
      if (valor === null) {
        if (ePrevisto) acumular(previstoSemConversao, titulo.moeda, saldo);
        else {
          naoIncluidos += 1;
          acumular(semConversao, titulo.moeda, saldo);
        }
        if (titulo.vencido) acumular(vencidoSemConversao, titulo.moeda, saldo);
      } else {
        if (titulo.moeda !== 'BRL') acumular(ePrevisto ? previstoEstimados : estimados, titulo.moeda, saldo);
        if (ePrevisto) previsto += valor;
        else emAbertoPagar += valor;
        if (titulo.vencido) vencido += valor;
      }
    }
    const reembolso = titulo.origem === 'reembolso';
    for (const baixa of titulo.baixas) {
      if (baixa.arquivado_em) continue;
      const valor = valorDaBaixa(baixa) * parte;
      if (!reembolso) pagoDosTitulos += valor;
      if (!dentroDoPeriodo(baixa.data, periodo.de, periodo.ate)) continue;
      if (reembolso) reembolsosNoPeriodo += valor;
      else pagoNoPeriodo += valor;
    }
  }
  return { emAbertoPagar: redondo(emAbertoPagar), vencido: redondo(vencido), previsto: redondo(previsto), pagoNoPeriodo: redondo(pagoNoPeriodo), reembolsosNoPeriodo: redondo(reembolsosNoPeriodo), pagoDosTitulos: redondo(pagoDosTitulos), quantos, estimado: estimados.length + previstoEstimados.length > 0, naoIncluidos, semConversao, vencidoSemConversao, previstoSemConversao, estimados, previstoEstimados };
}

/**
 * O período do cartão "Pago", sempre pela data da baixa (decisão de 07/11/2026, a revisar). Sem "Data do pagamento"
 * nos filtros, é o mês corrente. O vencimento não muda mais esse período: ele recorta só a lista.
 */
export function periodoDosTotais(filtros: Pick<FiltrosLancamentos, 'pagamentoDe' | 'pagamentoAte'>, hoje: string): { de: string; ate: string; doMes: boolean } {
  if (filtros.pagamentoDe || filtros.pagamentoAte) return { de: filtros.pagamentoDe || '0000-01-01', ate: filtros.pagamentoAte || '9999-12-31', doMes: false };
  return { de: `${hoje.slice(0, 7)}-01`, ate: hoje, doMes: true };
}
