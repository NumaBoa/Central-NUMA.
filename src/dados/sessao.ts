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

export function idDaPessoaAtual(): string | null {
  return pessoaAtual()?.id ?? null;
}
