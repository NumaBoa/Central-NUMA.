/**
 * Projeção de caixa de 30, 60 e 90 dias, em Financeiro › Contas e saldos (decisão de Kimberly em 07/11/2026: fica onde
 * já se procura, sem a T13.01). Regra de 15-M13 §2: saldo das contas controladas + a receber − a pagar, em aberto e
 * previstos, pelo vencimento. Vencidos ainda em aberto entram: continuam a receber ou a pagar.
 * Moeda estrangeira vai a reais pelo câmbio de referência (estimado); sem câmbio, a projeção fica em aberto, nunca zero.
 */
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { controlaSaldo } from './contas';
import { somar, type Soma } from './custos-relatorio';
import { ultimoCambio } from './ferramentas';
import { saldoDaConta, type DadosDosSaldos } from './saldos';
import { saldoDoTitulo } from './titulos';

export const HORIZONTES_DA_PROJECAO = [30, 60, 90] as const;

export type ProjecaoDoHorizonte = { dias: number; ate: string; saldo: Soma; aReceber: Soma; aPagar: Soma; projetado: Soma };

const somarDias = (dia: string, dias: number) => {
  const data = new Date(`${dia}T00:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

function emReais(valor: number, moeda: string, cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[]): { valor: number | null; estimado: boolean } {
  if (moeda === 'BRL') return { valor, estimado: false };
  const cambio = ultimoCambio(moeda, cambios);
  return { valor: cambio === null ? null : valor * cambio, estimado: true };
}

/** O que ainda falta pagar ou receber de um título, em reais, se ele vence até `ate`. */
function emAberto(titulos: readonly Titulo[], baixas: readonly Baixa[], natureza: Titulo['natureza'], ate: string, cambios: DadosDosSaldos['cambios']) {
  return titulos.flatMap((titulo) => {
    if (titulo.arquivado_em || titulo.natureza !== natureza || titulo.suspenso || !['previsto', 'aberto', 'parcial'].includes(titulo.situacao) || titulo.vencimento > ate) return [];
    const resta = saldoDoTitulo(titulo, baixas.filter((baixa) => baixa.titulo_id === titulo.id));
    return resta > 0 ? [emReais(resta, titulo.moeda, cambios)] : [];
  });
}

export function projecaoDeCaixa(dados: Pick<DadosDosSaldos, 'contas' | 'baixas' | 'titulos' | 'transferencias' | 'movimentos' | 'cambios'>, hoje: string = hojeISO()): ProjecaoDoHorizonte[] {
  const controladas = dados.contas.filter((conta: ContaFinanceira) => !conta.arquivado_em && conta.situacao === 'ativa' && controlaSaldo(conta.tipo));
  const saldo = somar(
    controladas.flatMap((conta) => {
      const valor = saldoDaConta(conta, dados);
      return valor === null ? [] : [emReais(valor, conta.moeda, dados.cambios)];
    }),
  );
  return HORIZONTES_DA_PROJECAO.map((dias) => {
    const ate = somarDias(hoje, dias);
    const aReceber = somar(emAberto(dados.titulos, dados.baixas, 'receber', ate, dados.cambios));
    const aPagar = somar(emAberto(dados.titulos, dados.baixas, 'pagar', ate, dados.cambios));
    const valores = [saldo.valor, aReceber.valor, aPagar.valor];
    const projetado: Soma = { valor: valores.some((valor) => valor === null) ? null : Math.round(((saldo.valor as number) + (aReceber.valor as number) - (aPagar.valor as number)) * 100) / 100, estimado: saldo.estimado || aReceber.estimado || aPagar.estimado };
    return { dias, ate, saldo, aReceber, aPagar, projetado };
  });
}
