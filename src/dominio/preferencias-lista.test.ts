import { beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { esquecerMetaEmMemoria, lerMeta } from '@/dados/meta';
import { colunasDaPreferencia, removerVisao, salvarColunas, salvarVisao, visoesDaPreferencia } from './preferencias-lista';

describe('preferências das listas (P1)', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
  });

  it('sem nada salvo, vale o padrão da tela', () => {
    expect(colunasDaPreferencia(lerMeta(), 'kim', 'ferramentas')).toBeNull();
    expect(visoesDaPreferencia(lerMeta(), 'kim', 'ferramentas')).toEqual([]);
  });

  it('as colunas são de cada pessoa e de cada lista', () => {
    salvarColunas('kim', 'ferramentas', ['nome', 'valor']);
    expect(colunasDaPreferencia(lerMeta(), 'kim', 'ferramentas')).toEqual(['nome', 'valor']);
    expect(colunasDaPreferencia(lerMeta(), 'camila', 'ferramentas')).toBeNull();
    expect(colunasDaPreferencia(lerMeta(), 'kim', 'ativos')).toBeNull();
  });

  it('continuam salvas depois de recarregar', () => {
    salvarColunas('kim', 'ferramentas', ['nome']);
    salvarVisao('kim', 'ferramentas', { nome: 'Críticas', filtros: { critica: 'sim' }, colunas: ['nome'] });
    esquecerMetaEmMemoria();
    expect(colunasDaPreferencia(lerMeta(), 'kim', 'ferramentas')).toEqual(['nome']);
    expect(visoesDaPreferencia(lerMeta(), 'kim', 'ferramentas').map((visao) => visao.nome)).toEqual(['Críticas']);
  });

  it('a visão guarda filtros e colunas, com o nome limpo', () => {
    const visao = salvarVisao('kim', 'ferramentas', { nome: '  Pagas  ', filtros: { modalidade: 'paga' }, colunas: ['nome', 'valor'] });
    expect(visao).toMatchObject({ nome: 'Pagas', filtros: { modalidade: 'paga' }, colunas: ['nome', 'valor'] });
  });

  it('visão precisa de nome, e o nome não repete para a mesma pessoa', () => {
    expect(() => salvarVisao('kim', 'ferramentas', { nome: '  ', filtros: {}, colunas: [] })).toThrow('Dê um nome para a visão.');
    salvarVisao('kim', 'ferramentas', { nome: 'Críticas', filtros: {}, colunas: [] });
    expect(() => salvarVisao('kim', 'ferramentas', { nome: 'CRITICAS', filtros: {}, colunas: [] })).toThrow('Já existe uma visão com esse nome.');
    expect(salvarVisao('camila', 'ferramentas', { nome: 'Críticas', filtros: {}, colunas: [] }).nome).toBe('Críticas');
  });

  it('remover tira só a visão escolhida e mantém as colunas', () => {
    salvarColunas('kim', 'ferramentas', ['nome']);
    const uma = salvarVisao('kim', 'ferramentas', { nome: 'Uma', filtros: {}, colunas: [] });
    salvarVisao('kim', 'ferramentas', { nome: 'Outra', filtros: {}, colunas: [] });
    removerVisao('kim', 'ferramentas', uma.id);
    expect(visoesDaPreferencia(lerMeta(), 'kim', 'ferramentas').map((visao) => visao.nome)).toEqual(['Outra']);
    expect(colunasDaPreferencia(lerMeta(), 'kim', 'ferramentas')).toEqual(['nome']);
  });
});
