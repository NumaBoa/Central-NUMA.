import { describe, expect, it } from 'vitest';
import { estimadoRealizado, referenciaDoProduto, textoDaReferencia, textoDoPercentual, type LinhaParaReferencia } from './estimado';

const marcos = (inicio: string | null, entrega: string | null) => [{ marco: 'inicio' as const, realizado_em: inicio }, { marco: 'entrega' as const, realizado_em: entrega }];
const linha = (alteracoes: Partial<LinhaParaReferencia>): LinhaParaReferencia => ({ id: crypto.randomUUID(), codigo: 'IMP-2026-0001', produto_id: 'kipi', contraparte_id: 'c', concluida_em: '2026-11-20', situacao: 'concluida', horas_estimadas: 40, prazo_estimado_dias: 30, marcos: marcos('2026-10-01', '2026-10-31'), horasApontadas: 50, ...alteracoes });

describe('T12.08 Estimado × realizado (RN-12.06)', () => {
  it('desvio de horas e de prazo, em %; sem um dos lados, sem desvio', () => {
    expect(estimadoRealizado({ horas_estimadas: 40, prazo_estimado_dias: 30 }, marcos('2026-10-01', '2026-10-31'), 50)).toEqual({ horasEstimadas: 40, horasApontadas: 50, desvioHoras: 25, prazoEstimadoDias: 30, prazoRealizadoDias: 30, desvioPrazo: 0 });
    expect(estimadoRealizado({ horas_estimadas: null, prazo_estimado_dias: 30 }, marcos('2026-10-01', null), 10)).toMatchObject({ desvioHoras: null, prazoRealizadoDias: null, desvioPrazo: null });
    expect(textoDoPercentual(25)).toBe('+25%');
    expect(textoDoPercentual(-12.5)).toBe('−12,5%');
    expect(textoDoPercentual(0)).toBe('Igual ao estimado');
    expect(textoDoPercentual(null)).toBe('—');
  });

  it('a referência usa só as concluídas do produto, cada lado com a própria amostra', () => {
    const linhas = [linha({}), linha({ horasApontadas: 30, horas_estimadas: 20, marcos: marcos('2026-10-01', '2026-10-21') }), linha({ horasApontadas: 0, marcos: marcos(null, '2026-10-21') }), linha({ situacao: 'em_andamento', concluida_em: null, horasApontadas: 999 }), linha({ produto_id: 'zupi', horasApontadas: 999 })];
    const referencia = referenciaDoProduto('kipi', linhas);
    expect(referencia).toMatchObject({ amostra: 3, amostraHoras: 2, amostraPrazo: 2, mediaHoras: 40, mediaPrazoDias: 25, desvioMedioHoras: 37.5, desvioMedioPrazo: -16.6 });
    expect(textoDaReferencia(referencia, 'Kipi')).toBe('Kipi: média de 40 h (2 com horas) e 25 dias (2 com prazo), em 3 implantações concluídas');
  });

  it('sem amostra, "Histórico insuficiente", nunca uma estimativa artificial', () => {
    expect(textoDaReferencia(referenciaDoProduto('mimo', [linha({})]), 'Mimo')).toBe('Mimo: Histórico insuficiente');
    expect(textoDaReferencia(referenciaDoProduto('kipi', [linha({ horasApontadas: 0, marcos: marcos(null, null) })]), 'Kipi')).toBe('Kipi: Histórico insuficiente');
  });
});
