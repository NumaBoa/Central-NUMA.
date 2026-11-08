import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { catalogoDoM07 } from './integracoes/catalogo-m07';
import { esquemaFormularioOferta, FORMULARIO_OFERTA_VAZIO, formularioDaOferta, salvarOferta, type FormularioOferta } from './precificacao';

const formulario = (parcial: Partial<FormularioOferta>): FormularioOferta => ({ ...FORMULARIO_OFERTA_VAZIO, ...parcial });

describe('T07.04: campos da oferta para o contrato SaaS (19 §8)', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-07T15:00:00.000Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    usarDriverDeTeste(null);
  });

  it('nasce com tudo vazio, sem padrão inventado, e o catálogo não inventa suporte', async () => {
    const oferta = await salvarOferta(ID_PRODUTO_KIPI, formulario({ nome: 'Catálogo' }));
    expect(oferta).toMatchObject({ regras_uso: null, suporte_canal: null, disponibilidade_meta: null, teste_dias: null, adicionais_ids: [] });
    expect(await catalogoDoM07.oferta(oferta.id)).toMatchObject({ regras_uso: null, suporte: null, teste_dias: null, adicionais_ids: [] });
  });

  it('grava, volta para o formulário e chega ao contrato', async () => {
    const adicional = await salvarOferta(ID_PRODUTO_KIPI, formulario({ nome: 'Revendedoras extras', tipo: 'consumo' }));
    const plano = await salvarOferta(ID_PRODUTO_KIPI, formulario({ nome: 'Ateliê', regras_uso: 'Uso justo', suporte_canal: 'E-mail', suporte_prazo_critico: 'até 4 horas úteis', disponibilidade_meta: '99,5', teste_dias: '14', adicionais_ids: [adicional.id] }));
    expect(plano).toMatchObject({ disponibilidade_meta: 99.5, teste_dias: 14, adicionais_ids: [adicional.id] });
    expect(formularioDaOferta(plano, [])).toMatchObject({ disponibilidade_meta: '99,5', teste_dias: '14', suporte_canal: 'E-mail' });
    expect(await catalogoDoM07.oferta(plano.id)).toMatchObject({ teste_dias: 14, disponibilidade_meta: 99.5, suporte: { canal: 'E-mail', horario: null, prazo_critico: 'até 4 horas úteis', prazo_normal: null }, adicionais_ids: [adicional.id] });
  });

  it('adicional é outra oferta do mesmo produto, nunca a própria nem de outro produto', async () => {
    const plano = await salvarOferta(ID_PRODUTO_KIPI, formulario({ nome: 'Ateliê' }));
    const deOutro = await salvarOferta(ID_PRODUTO_ZUPI, formulario({ nome: 'Clínica' }));
    await expect(salvarOferta(ID_PRODUTO_KIPI, formulario({ nome: 'Ateliê', adicionais_ids: [plano.id] }), plano.id)).rejects.toThrow('outras ofertas deste produto');
    await expect(salvarOferta(ID_PRODUTO_KIPI, formulario({ nome: 'Revenda', adicionais_ids: [deOutro.id] }))).rejects.toThrow('outras ofertas deste produto');
  });

  it('teste em dias inteiros e meta de 0 a 100', () => {
    const erro = (parcial: Partial<FormularioOferta>) => esquemaFormularioOferta.safeParse(formulario({ nome: 'X', ...parcial })).error?.issues.map((issue) => issue.path.join('.'));
    expect(erro({ teste_dias: '7' })).toBeUndefined();
    expect(erro({ teste_dias: 'sete' })).toEqual(['teste_dias']);
    expect(erro({ disponibilidade_meta: '101' })).toEqual(['disponibilidade_meta']);
    expect(erro({ disponibilidade_meta: '99,9%' })).toBeUndefined();
  });
});
