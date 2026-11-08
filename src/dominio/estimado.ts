/**
 * RN-12.06 (adaptação da viabilidade histórica): horas estimadas × apontadas e prazo estimado × realizado.
 * O prazo realizado vai do Início realizado à Entrega realizada. Sem um dos lados, não há desvio (RT-08).
 */
import type { Implantacao, ImplantacaoMarco } from '@/dados/tipos/operacao';
import { diasEntre } from './implantacoes';

export type EstimadoRealizado = {
  horasEstimadas: number | null;
  horasApontadas: number;
  /** (apontadas − estimadas) / estimadas, em %. */
  desvioHoras: number | null;
  prazoEstimadoDias: number | null;
  prazoRealizadoDias: number | null;
  desvioPrazo: number | null;
};

const percentual = (realizado: number, estimado: number) => Math.round(((realizado - estimado) / estimado) * 1000) / 10;

export function estimadoRealizado(implantacao: Pick<Implantacao, 'horas_estimadas' | 'prazo_estimado_dias'>, marcos: readonly Pick<ImplantacaoMarco, 'marco' | 'realizado_em'>[], horasApontadas: number): EstimadoRealizado {
  const inicio = marcos.find((marco) => marco.marco === 'inicio')?.realizado_em ?? null;
  const entrega = marcos.find((marco) => marco.marco === 'entrega')?.realizado_em ?? null;
  const prazoRealizadoDias = inicio && entrega ? Math.max(0, diasEntre(inicio, entrega)) : null;
  const estimadas = implantacao.horas_estimadas;
  return {
    horasEstimadas: estimadas,
    horasApontadas,
    desvioHoras: estimadas ? percentual(horasApontadas, estimadas) : null,
    prazoEstimadoDias: implantacao.prazo_estimado_dias,
    prazoRealizadoDias,
    desvioPrazo: implantacao.prazo_estimado_dias && prazoRealizadoDias !== null ? percentual(prazoRealizadoDias, implantacao.prazo_estimado_dias) : null,
  };
}

export function textoDoPercentual(valor: number | null): string {
  if (valor === null) return '—';
  if (valor === 0) return 'Igual ao estimado';
  return `${valor > 0 ? '+' : '−'}${Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
