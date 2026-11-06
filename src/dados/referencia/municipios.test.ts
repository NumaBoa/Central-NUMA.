import { describe, expect, it } from 'vitest';
import { carregarMunicipios, municipiosDaUf } from './municipios';

describe('municípios do arquivo oficial do IBGE', () => {
  it('RJ contém Rio de Janeiro (D16)', async () => {
    const referencia = await carregarMunicipios();
    expect(municipiosDaUf(referencia, 'RJ')).toContain('Rio de Janeiro');
  });

  it('registra de onde veio e quando foi consultado', async () => {
    const referencia = await carregarMunicipios();
    expect(referencia.fonte).toContain('IBGE');
    expect(referencia.endereco).toMatch(/^https:\/\/servicodados\.ibge\.gov\.br\//);
    expect(referencia.consultado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('traz as 27 UFs, sem nenhuma vazia', async () => {
    const { ufs } = await carregarMunicipios();
    expect(ufs).toHaveLength(27);
    expect(ufs.every((uf) => /^[A-Z]{2}$/.test(uf.sigla) && uf.nome && uf.municipios.length > 0)).toBe(true);
  });

  it('o total confere com o que está no arquivo', async () => {
    const { ufs, total } = await carregarMunicipios();
    expect(ufs.reduce((soma, uf) => soma + uf.municipios.length, 0)).toBe(total);
  });

  it('nenhum município se repete dentro da mesma UF', async () => {
    const { ufs } = await carregarMunicipios();
    for (const uf of ufs) expect(new Set(uf.municipios).size).toBe(uf.municipios.length);
  });

  it('as listas vêm em ordem alfabética, para achar rápido', async () => {
    const { ufs } = await carregarMunicipios();
    const emOrdem = (lista: readonly string[]) => [...lista].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    expect(ufs.map((uf) => uf.nome)).toEqual(emOrdem(ufs.map((uf) => uf.nome)));
    for (const uf of ufs) expect(uf.municipios).toEqual(emOrdem(uf.municipios));
  });

  it('UF desconhecida não tem municípios', async () => {
    expect(municipiosDaUf(await carregarMunicipios(), 'ZZ')).toEqual([]);
  });
});
