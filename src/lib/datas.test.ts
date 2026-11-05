import { describe, expect, it } from 'vitest';
import { hojeISO } from './datas';

describe('hojeISO', () => {
  it('calcula o dia no fuso de São Paulo, não em UTC', () => {
    // 02:30 UTC do dia 6 ainda é 23:30 do dia 5 em São Paulo.
    expect(hojeISO(new Date('2026-11-06T02:30:00Z'))).toBe('2026-11-05');
    expect(hojeISO(new Date('2026-11-06T03:00:00Z'))).toBe('2026-11-06');
  });

  it('respeita outro fuso quando informado', () => {
    expect(hojeISO(new Date('2026-11-06T02:30:00Z'), 'UTC')).toBe('2026-11-06');
  });
});
