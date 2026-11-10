import type { Pessoa } from '@/dados/tipos/pessoa';

/** "Você é" lista as pessoas internas ativas (02 §0.4). */
export function pessoasDoSeletor(pessoas: readonly Pessoa[]): Pessoa[] {
  return pessoas.filter((pessoa) => pessoa.tipo === 'interna' && pessoa.situacao === 'ativa' && !pessoa.arquivado_em);
}

/** Com login (Supabase), a pessoa interna ativa cadastrada com o e-mail de quem entrou. */
export function pessoaDoLogin(pessoas: readonly Pessoa[], emailDoLogin: string | null): Pessoa | null {
  const email = emailDoLogin?.trim().toLowerCase();
  if (!email) return null;
  return pessoasDoSeletor(pessoas).find((pessoa) => pessoa.email?.trim().toLowerCase() === email) ?? null;
}

/**
 * Com login, quem entrou; senão, a pessoa salva, se ainda puder ser escolhida; senão, a primeira da
 * lista. Sem pessoa com o e-mail do login, o "Você é" continua valendo.
 */
export function resolverPessoaAtual(pessoas: readonly Pessoa[], idSalvo: string | null, emailDoLogin: string | null = null): Pessoa | null {
  const doLogin = pessoaDoLogin(pessoas, emailDoLogin);
  if (doLogin) return doLogin;
  const opcoes = pessoasDoSeletor(pessoas);
  return opcoes.find((pessoa) => pessoa.id === idSalvo) ?? opcoes[0] ?? null;
}
