import { resolverPessoaAtual } from '@/dominio/pessoa-atual';
import { lerTabela } from './armazenamento';
import { garantirCarga } from './carga';
import { lerMeta } from './meta';
import type { Pessoa } from './tipos/pessoa';

/** A pessoa de "Você é": autoria dos registros e do histórico (02 §0.3 e §0.4). */
export function pessoaAtual(): Pessoa | null {
  garantirCarga();
  return resolverPessoaAtual(lerTabela<Pessoa>('pessoa'), lerMeta().pessoa_atual_id);
}

let emNomeDoSistema = 0;

/** O que nasce das rotinas do dia aparece como "Sistema" no histórico, e não como quem abriu a Central. */
export async function comoSistema<R>(corpo: () => Promise<R>): Promise<R> {
  emNomeDoSistema += 1;
  try {
    return await corpo();
  } finally {
    emNomeDoSistema -= 1;
  }
}

export function idDaPessoaAtual(): string | null {
  if (emNomeDoSistema) return null;
  return pessoaAtual()?.id ?? null;
}
