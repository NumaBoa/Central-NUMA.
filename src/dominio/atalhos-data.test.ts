import { describe, expect, it } from 'vitest';
import { atalhosDeData, fimDoMes } from './atalhos-data';

describe('atalhos do campo de data (pedido de Kimberly em 06/11/2026)', () => {
  it('Hoje, +7 dias e Fim do mês, a partir de hoje', () => {
    expect(atalhosDeData('2026-11-06')).toEqual([
      { rotulo: 'Hoje', dia: '2026-11-06' },
      { rotulo: '+7 dias', dia: '2026-11-13' },
      { rotulo: 'Fim do mês', dia: '2026-11-30' },
    ]);
  });

  it('virando o mês e o ano', () => {
    expect(atalhosDeData('2026-12-28').map((atalho) => atalho.dia)).toEqual(['2026-12-28', '2027-01-04', '2026-12-31']);
  });

  it('o fim do mês conhece fevereiro e o ano bissexto', () => {
    expect(fimDoMes('2027-02-10')).toBe('2027-02-28');
    expect(fimDoMes('2028-02-10')).toBe('2028-02-29');
    expect(fimDoMes('2026-04-01')).toBe('2026-04-30');
    expect(fimDoMes('2026-01-31')).toBe('2026-01-31');
  });

  it('respeita os limites do campo', () => {
    expect(atalhosDeData('2026-11-06', { max: '2026-11-06' }).map((atalho) => atalho.rotulo)).toEqual(['Hoje']);
    expect(atalhosDeData('2026-11-30', { max: '2026-11-30' }).map((atalho) => atalho.rotulo)).toEqual(['Hoje', 'Fim do mês']);
    expect(atalhosDeData('2026-11-06', { min: '2026-11-10' }).map((atalho) => atalho.rotulo)).toEqual(['+7 dias', 'Fim do mês']);
    expect(atalhosDeData('2026-11-06', { min: '2026-12-01' })).toEqual([]);
  });
});
