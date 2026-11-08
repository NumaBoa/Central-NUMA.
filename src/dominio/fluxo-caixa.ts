/**
 * T13.02 Fluxo de caixa, realizado e projetado (F0a), em Financeiro › Fluxo de caixa: por decisão de Kimberly
 * (07/11/2026), os relatórios ficam nos módulos, sem a Visão geral. Tudo em reais.
 *
 * - **Realizado** (até hoje): entradas e saídas pelas baixas (valor efetivo em reais); aportes e retiradas pelos
 *   movimentos societários em dinheiro; transferências entre contas à parte (no consolidado, não mudam o saldo).
 * - **Projetado** (de hoje em diante): o que falta receber e pagar dos títulos previstos, abertos e parciais, pelo
 *   vencimento. Vencido em aberto entra no mês atual: continua a pagar ou a receber. Moeda estrangeira vai a reais
 *   pelo câmbio de referência (estimado); sem câmbio, o mês fica em aberto, nunca zero.
 * - **Saldo:** fim do mês, das contas controladas. Nos meses projetados, o saldo de hoje mais o projetado acumulado.
 * - **Contexto:** com um produto (ou a Numa institucional), entra a parte do título rateada para ele; movimentos,
 *   transferências e saldo são da Numa inteira e ficam de fora. Título sem rateio conta como institucional.
 */
import { repositorios } from '@/dados/repositorios';
import type { TituloRateio } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { gerarCsv } from '@/lib/csv';
import { controlaSaldo } from './contas';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { somar, type Soma } from './custos-relatorio';
import { ultimoCambio } from './ferramentas';
import { carregarSaldos, saldoDaConta, type DadosDosSaldos } from './saldos';
import { saldoDoTitulo } from './titulos';

export type FiltrosDoFluxo = { de: string; ate: string; contaId: string };

export type MesDoFluxo = {
  mes: string;
  tipo: 'realizado' | 'atual' | 'projetado';
  entradas: Soma;
  saidas: Soma;
  aportes: number | null;
  retiradas: number | null;
  transferencias: Soma | null;
  /** Só nos meses que já começaram: a parte projetada do mês atual vem separada. */
  aReceber: Soma;
  aPagar: Soma;
  saldoFinal: Soma | null;
};

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const ZERO: Soma = { valor: 0, estimado: false };

function ultimoDia(mes: string) {
  const [ano, numero] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(ano, numero, 0)).toISOString().slice(0, 10);
}

export function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = [];
  let [ano, mes] = de.split('-').map(Number) as [number, number];
  while (`${ano}-${String(mes).padStart(2, '0')}` <= ate && meses.length < 36) {
    meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return meses;
}

/** Padrão: os 5 meses antes do atual, o atual e os 3 seguintes. */
export function periodoDoFluxo(hoje: string): Pick<FiltrosDoFluxo, 'de' | 'ate'> {
  const [ano, mes] = hoje.split('-').map(Number) as [number, number];
  return { de: new Date(Date.UTC(ano, mes - 1 - 5, 1)).toISOString().slice(0, 7), ate: new Date(Date.UTC(ano, mes - 1 + 3, 1)).toISOString().slice(0, 7) };
}

/** A parte do título que é do contexto: 1 no consolidado; pelo rateio, num produto ou no institucional. */
export function parteDoContexto(tituloId: string, rateios: readonly Pick<TituloRateio, 'titulo_id' | 'produto_id' | 'percentual' | 'arquivado_em'>[], contextoId: string): number {
  if (contextoId === ID_CONSOLIDADA) return 1;
  const doTitulo = rateios.filter((linha) => linha.titulo_id === tituloId && !linha.arquivado_em);
  if (!doTitulo.length) return contextoId === ID_INSTITUCIONAL ? 1 : 0;
  const alvo = contextoId === ID_INSTITUCIONAL ? null : contextoId;
  return doTitulo.filter((linha) => (linha.produto_id ?? null) === alvo).reduce((total, linha) => total + linha.percentual, 0) / 100;
}

export type DadosDoFluxo = Pick<DadosDosSaldos, 'contas' | 'baixas' | 'titulos' | 'transferencias' | 'movimentos' | 'cambios'> & { rateios: TituloRateio[] };

export function fluxoDeCaixa(dados: DadosDoFluxo, filtros: FiltrosDoFluxo, contextoId: string, hoje: string = hojeISO()): MesDoFluxo[] {
  const mesAtual = hoje.slice(0, 7);
  const consolidado = contextoId === ID_CONSOLIDADA;
  const conta = filtros.contaId ? dados.contas.find((item) => item.id === filtros.contaId) : undefined;
  const contas = (conta ? [conta] : dados.contas.filter((item) => !item.arquivado_em && controlaSaldo(item.tipo))).filter((item) => controlaSaldo(item.tipo));
  const tituloDe = new Map(dados.titulos.map((titulo) => [titulo.id, titulo]));
  const naConta = (contaId: string | null) => !conta || contaId === conta.id;
  const emReais = (valor: number, moeda: string): { valor: number | null; estimado: boolean } => {
    if (moeda === 'BRL') return { valor, estimado: false };
    const cambio = ultimoCambio(moeda, dados.cambios);
    return { valor: cambio === null ? null : valor * cambio, estimado: true };
  };

  // Projetado: o que resta de cada título em aberto, no mês do vencimento (vencido vai para o mês atual).
  const projetados = new Map<string, { receber: { valor: number | null; estimado: boolean }[]; pagar: { valor: number | null; estimado: boolean }[] }>();
  if (!conta) {
    for (const titulo of dados.titulos) {
      if (titulo.arquivado_em || titulo.suspenso || !['previsto', 'aberto', 'parcial'].includes(titulo.situacao)) continue;
      const resta = saldoDoTitulo(titulo, dados.baixas.filter((baixa) => baixa.titulo_id === titulo.id));
      const parte = parteDoContexto(titulo.id, dados.rateios, contextoId);
      if (resta <= 0 || parte === 0) continue;
      const mes = titulo.vencimento.slice(0, 7) < mesAtual ? mesAtual : titulo.vencimento.slice(0, 7);
      const valor = emReais(resta * parte, titulo.moeda);
      const linha = projetados.get(mes) ?? { receber: [], pagar: [] };
      linha[titulo.natureza].push(valor);
      projetados.set(mes, linha);
    }
  }

  const saldoEm = (dia: string): Soma | null => {
    if (!consolidado || !contas.length) return null;
    return somar(
      contas.flatMap((item) => {
        const valor = saldoDaConta(item, dados, dia);
        return valor === null ? [] : [emReais(valor, item.moeda)];
      }),
    );
  };
  const saldoDeHoje = saldoEm(hoje);
  let acumulado: Soma | null = saldoDeHoje;

  return mesesEntre(filtros.de, filtros.ate).map((mes) => {
    const tipo: MesDoFluxo['tipo'] = mes < mesAtual ? 'realizado' : mes === mesAtual ? 'atual' : 'projetado';
    const entradas: { valor: number; estimado: boolean }[] = [];
    const saidas: { valor: number; estimado: boolean }[] = [];
    if (tipo !== 'projetado') {
      for (const baixa of dados.baixas) {
        if (baixa.arquivado_em || baixa.data.slice(0, 7) !== mes || baixa.data > hoje || !naConta(baixa.conta_financeira_id)) continue;
        const titulo = tituloDe.get(baixa.titulo_id);
        if (!titulo) continue;
        const parte = parteDoContexto(titulo.id, dados.rateios, contextoId);
        if (parte === 0) continue;
        // Pagar sai, receber entra; o estorno inverte (RN-05.04).
        const entra = (titulo.natureza === 'receber') !== (baixa.tipo === 'estorno');
        (entra ? entradas : saidas).push({ valor: baixa.valor_brl * parte, estimado: false });
      }
    }
    let aportes: number | null = null;
    let retiradas: number | null = null;
    let transferencias: Soma | null = null;
    if (consolidado && tipo !== 'projetado') {
      const doMes = dados.movimentos.filter((movimento) => !movimento.arquivado_em && movimento.forma === 'dinheiro' && movimento.data.slice(0, 7) === mes && movimento.data <= hoje && naConta(movimento.conta_financeira_id));
      aportes = arredondar(doMes.filter((movimento) => movimento.tipo === 'aporte').reduce((total, movimento) => total + movimento.valor_brl, 0));
      retiradas = arredondar(doMes.filter((movimento) => movimento.tipo !== 'aporte').reduce((total, movimento) => total + movimento.valor_brl, 0));
      // Numa conta escolhida, a transferência entra ou sai dela; no consolidado, é só volume entre contas próprias.
      transferencias = somar(
        dados.transferencias
          .filter((linha) => !linha.arquivado_em && linha.data.slice(0, 7) === mes && linha.data <= hoje && (!conta || linha.conta_origem_id === conta.id || linha.conta_destino_id === conta.id))
          .map((linha) => {
            if (conta) {
              const entrando = linha.conta_destino_id === conta.id;
              const { valor, estimado } = emReais(entrando ? linha.valor_destino : linha.valor_origem, entrando ? linha.moeda_destino : linha.moeda_origem);
              return { valor: valor === null ? null : entrando ? valor : -valor, estimado };
            }
            return linha.moeda_origem === 'BRL' ? { valor: linha.valor_origem, estimado: false } : linha.moeda_destino === 'BRL' ? { valor: linha.valor_destino, estimado: false } : emReais(linha.valor_origem, linha.moeda_origem);
          }),
      );
    }
    const projetado = projetados.get(mes);
    const aReceber = tipo === 'realizado' ? ZERO : somar(projetado?.receber ?? []);
    const aPagar = tipo === 'realizado' ? ZERO : somar(projetado?.pagar ?? []);
    let saldoFinal: Soma | null;
    if (tipo === 'realizado') saldoFinal = saldoEm(ultimoDia(mes));
    else if (!acumulado || acumulado.valor === null || aReceber.valor === null || aPagar.valor === null) saldoFinal = acumulado && { valor: null, estimado: true };
    else {
      saldoFinal = { valor: arredondar(acumulado.valor + aReceber.valor - aPagar.valor), estimado: acumulado.estimado || aReceber.estimado || aPagar.estimado };
      acumulado = saldoFinal;
    }
    if (tipo !== 'realizado' && saldoFinal?.valor === null) acumulado = saldoFinal;
    return { mes, tipo, entradas: somar(entradas), saidas: somar(saidas), aportes, retiradas, transferencias, aReceber, aPagar, saldoFinal };
  });
}

const reais = (soma: Soma | number | null) => {
  if (soma === null) return '';
  const valor = typeof soma === 'number' ? soma : soma.valor;
  return valor === null ? 'sem câmbio' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const CABECALHO_DO_FLUXO = ['Mês', 'Tipo', 'Entradas', 'Saídas', 'A receber', 'A pagar', 'Aportes', 'Retiradas', 'Transferências', 'Saldo final'] as const;
const ROTULO_DO_TIPO = { realizado: 'Realizado', atual: 'Mês atual', projetado: 'Projetado' } as const;

export const csvDoFluxo = (meses: readonly MesDoFluxo[]) => gerarCsv(CABECALHO_DO_FLUXO, meses.map((linha) => [linha.mes, ROTULO_DO_TIPO[linha.tipo], reais(linha.entradas), reais(linha.saidas), reais(linha.aReceber), reais(linha.aPagar), reais(linha.aportes), reais(linha.retiradas), reais(linha.transferencias), reais(linha.saldoFinal)]));

export async function carregarFluxo(): Promise<DadosDoFluxo & Pick<DadosDosSaldos, 'contas'>> {
  const [saldos, rateios] = await Promise.all([carregarSaldos(), repositorios.titulo_rateio.listar()]);
  return { ...saldos, rateios };
}
