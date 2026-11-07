import { describe, expect, it } from 'vitest';
import {
  faseLiberada,
  IDS_BARRA_CELULAR,
  MODULO_CONFIGURACOES,
  MODULOS_EMPRESA,
  MODULOS_TOPO,
  moduloAtivo,
  moduloDisponivel,
  type Modulo,
} from './navegacao';

const todos = [...MODULOS_TOPO, ...MODULOS_EMPRESA, MODULO_CONFIGURACOES];

describe('estrutura do menu', () => {
  it('traz os doze módulos da especificação, sem repetir', () => {
    expect(todos).toHaveLength(12);
    expect(new Set(todos.map((modulo) => modulo.id)).size).toBe(12);
  });

  it('coloca na barra do celular só módulos que existem no menu', () => {
    for (const id of IDS_BARRA_CELULAR) expect(todos.some((modulo) => modulo.id === id)).toBe(true);
  });

  it('não tem link para nenhuma tela ainda não construída', () => {
    expect(todos.filter((modulo) => modulo.href).map((modulo) => modulo.id)).toEqual(['meu-dia', 'produtos', 'financeiro', 'ferramentas', 'configuracoes']);
  });
});

describe('faseLiberada', () => {
  it('libera a fase ativa e as anteriores', () => {
    expect(faseLiberada('f0a', 'f0a')).toBe(true);
    expect(faseLiberada('f0a', 'f1')).toBe(true);
    expect(faseLiberada('f0b', 'f0a')).toBe(false);
    expect(faseLiberada('f3', 'f2')).toBe(false);
  });
});

describe('moduloDisponivel', () => {
  const pronta: Modulo = { id: 'produtos', nome: 'Produtos', fase: 'f0b', href: '/produtos' };
  const semTela: Modulo = { id: 'financeiro', nome: 'Financeiro', fase: 'f0a' };

  it('exige tela construída', () => {
    expect(moduloDisponivel(semTela, 'f3')).toBe(false);
    expect(moduloDisponivel(MODULO_CONFIGURACOES, 'f0a')).toBe(true);
  });

  it('mantém "Em breve" a tela pronta de fase ainda não ativa', () => {
    expect(moduloDisponivel(pronta, 'f0a')).toBe(false);
    expect(moduloDisponivel(pronta, 'f0b')).toBe(true);
  });
});

describe('moduloAtivo', () => {
  it('marca o módulo também nas telas filhas, sem confundir nomes parecidos', () => {
    expect(moduloAtivo(MODULO_CONFIGURACOES, '/configuracoes')).toBe(true);
    expect(moduloAtivo(MODULO_CONFIGURACOES, '/configuracoes/dados')).toBe(true);
    expect(moduloAtivo(MODULO_CONFIGURACOES, '/configuracoes-antigas')).toBe(false);
    expect(moduloAtivo(MODULOS_TOPO[0]!, '/meu-dia')).toBe(true);
    expect(moduloAtivo(MODULOS_TOPO[1]!, '/visao-geral')).toBe(false);
  });
});
