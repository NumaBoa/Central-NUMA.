import { describe, expect, it } from 'vitest';
import { formatarCotacao, formatarData, formatarDataHora, formatarDiaISO, formatarHora, formatarNumero, formatarTamanho } from './formatacao';

describe('datas', () => {
  it('mostra no fuso de São Paulo, em dd/mm/aaaa', () => {
    expect(formatarData('2026-11-06T02:30:00.000Z')).toBe('05/11/2026');
    expect(formatarHora('2026-11-06T02:30:00.000Z')).toBe('23:30');
    expect(formatarDataHora('2026-11-06T02:30:00.000Z')).toBe('05/11/2026 23:30');
  });
});

describe('datas de negócio', () => {
  it('mostram o dia escrito, sem depender do fuso', () => {
    expect(formatarDiaISO('2026-11-05')).toBe('05/11/2026');
  });
});

describe('cotação', () => {
  it('tem pelo menos 2 casas e guarda até 6, sem arredondar', () => {
    expect(formatarCotacao(5.4)).toBe('R$ 5,40');
    expect(formatarCotacao(5.123456)).toBe('R$ 5,123456');
    expect(formatarCotacao(1234.5)).toBe('R$ 1.234,50');
  });
});

describe('números', () => {
  it('usa o formato brasileiro', () => {
    expect(formatarNumero(12345)).toBe('12.345');
  });
});

describe('formatarTamanho', () => {
  it('escolhe a unidade', () => {
    expect(formatarTamanho(512)).toBe('512 B');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(2560)).toBe('2,5 KB');
    expect(formatarTamanho(5 * 1024 * 1024)).toBe('5 MB');
  });
});
