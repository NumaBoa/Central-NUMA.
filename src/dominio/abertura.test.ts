import { describe, expect, it } from 'vitest';
import { deveMostrarAbertura, duracaoDaAbertura, embaracoDoFio, modoDaAbertura } from './abertura';

describe('deveMostrarAbertura', () => {
  it('aparece na primeira vez e uma vez por dia (CA-18.01)', () => {
    expect(deveMostrarAbertura(null, '2026-11-05')).toBe(true);
    expect(deveMostrarAbertura('2026-11-04', '2026-11-05')).toBe(true);
    expect(deveMostrarAbertura('2026-11-05', '2026-11-05')).toBe(false);
  });

  it('pode ser revista pelo endereço, mesmo já exibida hoje', () => {
    expect(deveMostrarAbertura('2026-11-05', '2026-11-05', 'forcar')).toBe(true);
    expect(deveMostrarAbertura('2026-11-05', '2026-11-05', 'manter')).toBe(true);
  });
});

describe('modoDaAbertura', () => {
  it('lê o modo do endereço', () => {
    expect(modoDaAbertura('')).toBe('normal');
    expect(modoDaAbertura('?outro=1')).toBe('normal');
    expect(modoDaAbertura('?abertura=1')).toBe('forcar');
    expect(modoDaAbertura('?abertura=manter')).toBe('manter');
  });
});

describe('duracaoDaAbertura', () => {
  it('dura até 1,6s e 600ms com movimento reduzido (18 §10.1)', () => {
    expect(duracaoDaAbertura(false)).toBe(1600);
    expect(duracaoDaAbertura(true)).toBe(600);
  });

  it('fica na tela até um clique no modo manter', () => {
    expect(duracaoDaAbertura(false, 'manter')).toBeNull();
    expect(duracaoDaAbertura(true, 'manter')).toBeNull();
  });
});

describe('embaracoDoFio', () => {
  it('começa embaraçado e chega quase reto ao fim da abertura', () => {
    expect(embaracoDoFio(0)).toBe(1);
    expect(embaracoDoFio(150)).toBe(1);
    expect(embaracoDoFio(800)).toBeLessThan(0.5);
    expect(embaracoDoFio(1600)).toBeLessThan(0.05);
  });
});
