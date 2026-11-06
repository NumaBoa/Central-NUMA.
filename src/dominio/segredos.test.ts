import { describe, expect, it } from 'vitest';
import { pareceCredencial } from './segredos';

describe('pareceCredencial (RT-14)', () => {
  it('reconhece os padrões da especificação', () => {
    expect(pareceCredencial('senha: abc123')).toBe(true);
    expect(pareceCredencial('Senha = abc123')).toBe(true);
    expect(pareceCredencial('o password é esse')).toBe(true);
    expect(pareceCredencial('token do painel')).toBe(true);
    expect(pareceCredencial('API key da conta')).toBe(true);
    expect(pareceCredencial('a chave de api está aqui')).toBe(true);
  });

  it('reconhece sequências longas e aleatórias', () => {
    expect(pareceCredencial('sk9Xq2Lm7Pz4Tw8Rn3Bv6Yc1')).toBe(true);
    expect(pareceCredencial('use ghp_a1B2c3D4e5F6g7H8i9J0 no acesso')).toBe(true);
  });

  it('não incomoda em texto comum', () => {
    expect(pareceCredencial('')).toBe(false);
    expect(pareceCredencial('Cotação do Banco Central')).toBe(false);
    expect(pareceCredencial('Ainda faltam telas da fase 0a')).toBe(false);
    expect(pareceCredencial('Pediu para trocar a senha da conta')).toBe(false);
    expect(pareceCredencial('anticonstitucionalissimamente demais')).toBe(false);
    expect(pareceCredencial('12345678901234567890123')).toBe(false);
  });

  it('link não é segredo, mesmo com sequência longa', () => {
    expect(pareceCredencial('Ver https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view')).toBe(false);
  });

  it('mas o que vem junto do link continua contando', () => {
    expect(pareceCredencial('https://exemplo.com senha: 123')).toBe(true);
  });
});
