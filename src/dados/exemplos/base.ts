/**
 * Estrutura real da Numa usada pela moldura: sócias (D18), marcas e produtos (18 §3.2, T02.04).
 * Na entrega 2 e nas telas T02.02 e T02.04, estes dados passam para os repositórios.
 */
export type PessoaInterna = { id: string; nome: string; iniciais: string };

export const PESSOAS_INTERNAS: readonly [PessoaInterna, ...PessoaInterna[]] = [
  { id: 'kimberly-grebe', nome: 'Kimberly Grebe', iniciais: 'KG' },
  { id: 'camila-lima', nome: 'Camila Lima', iniciais: 'CL' },
];

export type Contexto = {
  id: string;
  nome: string;
  /** Forma curta para a pílula do celular (18 §10.4). */
  curto?: string;
  provisorio?: boolean;
  /** Tokens de 18 §3.2. */
  cor: string;
  tinta: string;
};

export const CONTEXTOS: readonly [Contexto, ...Contexto[]] = [
  { id: 'consolidada', nome: 'Numa consolidada', cor: 'var(--c-numa)', tinta: 'var(--t-numa)' },
  { id: 'institucional', nome: 'Numa institucional', cor: 'var(--c-numa)', tinta: 'var(--t-numa)' },
  { id: 'urb', nome: 'Sobrevivência Urbana', curto: 'S. Urbana', cor: 'var(--c-urb)', tinta: 'var(--t-urb)' },
  { id: 'kipi', nome: 'Kipi', cor: 'var(--c-kipi)', tinta: 'var(--t-kipi)' },
  { id: 'zupi', nome: 'Zupi', cor: 'var(--c-zupi)', tinta: 'var(--t-zupi)' },
  { id: 'zarpa', nome: 'Zarpa', provisorio: true, cor: 'var(--c-zarpa)', tinta: 'var(--t-zarpa)' },
  { id: 'mimo', nome: 'Mimo', provisorio: true, cor: 'var(--c-mimo)', tinta: 'var(--t-mimo)' },
];

export function acharContexto(id: string): Contexto {
  return CONTEXTOS.find((contexto) => contexto.id === id) ?? CONTEXTOS[0];
}

export function acharPessoaInterna(id: string | null): PessoaInterna {
  return PESSOAS_INTERNAS.find((pessoa) => pessoa.id === id) ?? PESSOAS_INTERNAS[0];
}
