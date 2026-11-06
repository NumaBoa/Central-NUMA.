import { afterEach, describe, expect, it, vi } from 'vitest';
import { listarMoedas, nomeDaMoeda } from './moedas';

describe('moedas', () => {
  afterEach(() => vi.restoreAllMocks());

  it('BRL, USD e EUR ficam no topo, nessa ordem', () => {
    expect(listarMoedas().maisUsadas.map((moeda) => moeda.codigo)).toEqual(['BRL', 'USD', 'EUR']);
  });

  it('os nomes vêm em português, do próprio Intl', () => {
    expect(listarMoedas().maisUsadas.map((moeda) => moeda.nome)).toEqual(['Real brasileiro', 'Dólar americano', 'Euro']);
    expect(nomeDaMoeda('GBP')).toBe('Libra esterlina');
  });

  it('a lista vem do navegador, e não só as três do topo', () => {
    const { demais } = listarMoedas();
    expect(demais.length).toBeGreaterThan(100);
    expect(demais.map((moeda) => moeda.codigo)).toContain('GBP');
  });

  it('as demais vêm em ordem alfabética, sem repetir as do topo', () => {
    const { demais } = listarMoedas();
    expect(demais.map((moeda) => moeda.nome)).toEqual([...demais.map((moeda) => moeda.nome)].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    expect(demais.map((moeda) => moeda.codigo)).not.toEqual(expect.arrayContaining(['BRL']));
    expect(new Set(demais.map((moeda) => moeda.codigo)).size).toBe(demais.length);
  });

  it('deixa de fora o que não é moeda ou não tem nome em português', () => {
    const { demais } = listarMoedas();
    const codigos = demais.map((moeda) => moeda.codigo);
    expect(codigos).not.toContain('XXX');
    expect(codigos).not.toContain('XTS');
    expect(demais.every((moeda) => moeda.nome !== moeda.codigo)).toBe(true);
  });

  it('no câmbio, o real não entra: a cotação já é em reais', () => {
    const { maisUsadas, demais } = listarMoedas({ semReal: true });
    expect(maisUsadas.map((moeda) => moeda.codigo)).toEqual(['USD', 'EUR']);
    expect(demais.map((moeda) => moeda.codigo)).not.toContain('BRL');
  });

  it('o valor salvo continua na lista, mesmo desconhecido', () => {
    expect(listarMoedas({ atual: 'ZZZ' }).demais.map((moeda) => moeda.codigo)).toContain('ZZZ');
  });

  it('sem o recurso no navegador, ainda oferece as mais usadas', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new Error('não deveria quebrar a lista');
    });
    const original = Intl.supportedValuesOf;
    // @ts-expect-error simula um navegador antigo, sem o método
    Intl.supportedValuesOf = undefined;
    try {
      expect(listarMoedas().maisUsadas.map((moeda) => moeda.codigo)).toEqual(['BRL', 'USD', 'EUR']);
      expect(listarMoedas().demais).toEqual([]);
    } finally {
      Intl.supportedValuesOf = original;
    }
  });
});
