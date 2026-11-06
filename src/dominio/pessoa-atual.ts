import type { Pessoa } from '@/dados/tipos/pessoa';

/** "Você é" lista as pessoas internas ativas (02 §0.4). */
export function pessoasDoSeletor(pessoas: readonly Pessoa[]): Pessoa[] {
  return pessoas.filter((pessoa) => pessoa.tipo === 'interna' && pessoa.situacao === 'ativa' && !pessoa.arquivado_em);
}

/** A pessoa salva, se ainda puder ser escolhida; senão, a primeira da lista. */
export function resolverPessoaAtual(pessoas: readonly Pessoa[], idSalvo: string | null): Pessoa | null {
  const opcoes = pessoasDoSeletor(pessoas);
  return opcoes.find((pessoa) => pessoa.id === idSalvo) ?? opcoes[0] ?? null;
}
