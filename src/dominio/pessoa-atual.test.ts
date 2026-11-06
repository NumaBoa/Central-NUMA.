import { describe, expect, it } from 'vitest';
import { ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { gerarExemplos } from '@/dados/exemplos';
import { pessoasDoSeletor, resolverPessoaAtual } from './pessoa-atual';

const { pessoa: pessoas } = gerarExemplos('2026-11-05T12:00:00.000Z');

describe('pessoasDoSeletor', () => {
  it('lista só pessoas internas e ativas (02 §0.4)', () => {
    expect(pessoasDoSeletor(pessoas).map((p) => p.nome_completo)).toEqual(['Kimberly Grebe', 'Camila Lima', 'Bruna Alves']);
  });

  it('não lista inativas nem arquivadas (CA-02.02)', () => {
    const lista = pessoas.map((p) => (p.id === ID_CAMILA ? { ...p, situacao: 'inativa' as const } : p));
    expect(pessoasDoSeletor(lista).some((p) => p.id === ID_CAMILA)).toBe(false);
    const arquivada = pessoas.map((p) => (p.id === ID_CAMILA ? { ...p, arquivado_em: '2026-11-05T12:00:00.000Z' } : p));
    expect(pessoasDoSeletor(arquivada).some((p) => p.id === ID_CAMILA)).toBe(false);
  });
});

describe('resolverPessoaAtual', () => {
  it('usa a pessoa salva', () => {
    expect(resolverPessoaAtual(pessoas, ID_CAMILA)?.id).toBe(ID_CAMILA);
  });

  it('volta para a primeira quando a salva não existe mais', () => {
    expect(resolverPessoaAtual(pessoas, 'removida')?.id).toBe(ID_KIMBERLY);
    expect(resolverPessoaAtual(pessoas, null)?.id).toBe(ID_KIMBERLY);
  });

  it('sem nenhuma pessoa possível, não inventa', () => {
    expect(resolverPessoaAtual([], ID_CAMILA)).toBeNull();
  });
});
