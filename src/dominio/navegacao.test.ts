import { describe, expect, it } from 'vitest';
import {
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
  it('traz os módulos da especificação, sem repetir (sem a Visão geral, decisão de 07/11/2026)', () => {
    expect(todos).toHaveLength(11);
    expect(new Set(todos.map((modulo) => modulo.id)).size).toBe(11);
  });

  it('coloca na barra do celular só módulos que existem no menu', () => {
    for (const id of IDS_BARRA_CELULAR) expect(todos.some((modulo) => modulo.id === id)).toBe(true);
  });

  it('não tem link para nenhuma tela ainda não construída', () => {
    expect(todos.filter((modulo) => modulo.href).map((modulo) => modulo.id)).toEqual(['meu-dia', 'empresa', 'produtos', 'comercial', 'contratos', 'financeiro', 'ferramentas', 'legal', 'configuracoes']);
  });
});

describe('moduloDisponivel', () => {
  const pronta: Modulo = { id: 'produtos', nome: 'Produtos', fase: 'f0b', href: '/produtos' };
  const semTela: Modulo = { id: 'financeiro', nome: 'Financeiro', fase: 'f0a' };

  it('exige tela construída', () => {
    expect(moduloDisponivel(semTela)).toBe(false);
    expect(moduloDisponivel(MODULO_CONFIGURACOES)).toBe(true);
  });

  it('libera a tela pronta mesmo de fase ainda não ativa (decisão de 07/11/2026)', () => {
    expect(moduloDisponivel(pronta)).toBe(true);
  });
});

describe('moduloAtivo', () => {
  it('marca o módulo também nas telas filhas, sem confundir nomes parecidos', () => {
    expect(moduloAtivo(MODULO_CONFIGURACOES, '/configuracoes')).toBe(true);
    expect(moduloAtivo(MODULO_CONFIGURACOES, '/configuracoes/dados')).toBe(true);
    expect(moduloAtivo(MODULO_CONFIGURACOES, '/configuracoes-antigas')).toBe(false);
    expect(moduloAtivo(MODULOS_TOPO[0]!, '/meu-dia')).toBe(true);
    expect(moduloAtivo(MODULOS_TOPO[0]!, '/meu-dia-antigo')).toBe(false);
    // Decisão de Kimberly em 07/11/2026: sem Visão geral (T13.01); o painel fica nos módulos.
    expect(MODULOS_TOPO.map((modulo) => modulo.id)).toEqual(['meu-dia']);
  });
});
