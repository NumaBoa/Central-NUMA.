import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { gerarUuid, montarCodigo } from './ids';

describe('gerarUuid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gera um UUID válido e diferente a cada vez', () => {
    const uuid = gerarUuid();
    expect(z.uuid().safeParse(uuid).success).toBe(true);
    expect(gerarUuid()).not.toBe(uuid);
  });

  it('funciona fora de contexto seguro, como ao abrir pelo IP da rede', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => real.getRandomValues(bytes) });
    const uuid = gerarUuid();
    expect(z.uuid().safeParse(uuid).success).toBe(true);
    expect(gerarUuid()).not.toBe(uuid);
  });
});

describe('montarCodigo', () => {
  it('segue o formato PREFIXO-aaaa-nnnn', () => {
    expect(montarCodigo('ATV', '2026', 1)).toBe('ATV-2026-0001');
    expect(montarCodigo('TIT', '2027', 12345)).toBe('TIT-2027-12345');
  });
});
