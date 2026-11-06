import { describe, expect, it } from 'vitest';
import { novoEvento } from '@/dados/historico';
import { descreverEvento } from './historico';

const ID_KIMBERLY = '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01';
const nomes = new Map([[ID_KIMBERLY, 'Kimberly Grebe']]);
const descrever = (dados: Parameters<typeof novoEvento>[0]) => descreverEvento(novoEvento(dados), nomes);

describe('descreverEvento', () => {
  it('sempre diz quem fez, por extenso', () => {
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'exportou' })).toBe('Kimberly Grebe exportou todos os dados');
  });

  it('o que o sistema faz sozinho aparece como Sistema', () => {
    expect(descrever({ usuarioId: null, acao: 'executou_acao', depois: { funcao: 'carga_inicial' } })).toBe('Sistema carregou os dados de exemplo');
  });

  it('não some quando a pessoa foi removida', () => {
    expect(descrever({ usuarioId: '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03', acao: 'exportou' })).toBe('Pessoa removida exportou todos os dados');
  });

  it('descreve as ações da tela de dados', () => {
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'executou_acao', depois: { funcao: 'importar_dados', registros: 1 } })).toBe('Kimberly Grebe importou 1 registro de um arquivo');
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'executou_acao', depois: { funcao: 'importar_dados', registros: 4, copia_antes: true } })).toBe('Kimberly Grebe importou 4 registros de um arquivo, com cópia do que havia antes');
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'executou_acao', depois: { funcao: 'limpar_exemplos', registros: 2 } })).toBe('Kimberly Grebe limpou 2 registros de exemplo');
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'executou_acao', depois: { funcao: 'restaurar_exemplos' } })).toBe('Kimberly Grebe restaurou os dados de exemplo');
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'executou_acao', depois: { funcao: 'rodar_rotinas' } })).toBe('Kimberly Grebe rodou as rotinas do dia');
  });

  it('descreve as alterações de registros, com código e motivo', () => {
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'inseriu', tabela: 'pessoa' })).toBe('Kimberly Grebe criou um registro em Pessoas');
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'alterou', tabela: 'atividade', registroCodigo: 'ATV-2026-0001' })).toBe('Kimberly Grebe alterou um registro em atividade ATV-2026-0001');
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'arquivou', tabela: 'pessoa', motivo: 'Saiu da equipe' })).toBe('Kimberly Grebe arquivou um registro em Pessoas. Motivo: Saiu da equipe');
    expect(descrever({ usuarioId: ID_KIMBERLY, acao: 'restaurou', tabela: 'pessoa' })).toBe('Kimberly Grebe restaurou um registro em Pessoas');
  });
});
