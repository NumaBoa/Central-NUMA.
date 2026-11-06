/**
 * Estrutura real da Numa: sócias (D18) e contextos (18 §3.2, CA-02.03).
 * Os contextos passam para os repositórios junto com a T02.04.
 */
export const ID_KIMBERLY = '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01';
export const ID_CAMILA = '1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02';

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
