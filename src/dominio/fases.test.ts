import { describe, expect, it } from 'vitest';
import { avancouDeFase, faseAnterior, INFO_FASES, proximaFase, rotuloDaFase } from './fases';
import { FASES } from './navegacao';

describe('fases da Numa', () => {
  it('toda fase tem nome, pergunta e telas', () => {
    for (const fase of FASES) {
      expect(INFO_FASES[fase].nome).not.toBe('');
      expect(INFO_FASES[fase].pergunta).toMatch(/\?$/);
      expect(INFO_FASES[fase].telas.length).toBeGreaterThan(0);
    }
  });

  it('usa os nomes de 01 §3', () => {
    expect(FASES.map((fase) => rotuloDaFase(fase))).toEqual(['Fase 0a', 'Fase 0b', 'Fase 1', 'Fase 2', 'Fase 3']);
    expect(FASES.map((fase) => INFO_FASES[fase].nome)).toEqual(['Uso imediato', 'Casa em ordem', 'Empresa e primeira venda', 'Ecossistema e produtividade', 'Integrações']);
  });

  it('anda uma fase de cada vez, sem passar das pontas', () => {
    expect(proximaFase('f0a')).toBe('f0b');
    expect(proximaFase('f2')).toBe('f3');
    expect(proximaFase('f3')).toBeNull();
    expect(faseAnterior('f0b')).toBe('f0a');
    expect(faseAnterior('f0a')).toBeNull();
  });

  it('sabe se a mudança foi para a frente ou para trás', () => {
    expect(avancouDeFase('f0a', 'f0b')).toBe(true);
    expect(avancouDeFase('f1', 'f0b')).toBe(false);
  });
});
