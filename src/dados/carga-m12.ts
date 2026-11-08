import { chaveDaTabela, driver } from './armazenamento';
import { NOMES_TABELAS_M12 } from './tabelas-m12';

/** O M12 começa vazio: nenhum exemplo e nenhum padrão inventado (RT-08). */
export function tabelasIniciaisM12(): Record<(typeof NOMES_TABELAS_M12)[number], never[]> {
  return Object.fromEntries(NOMES_TABELAS_M12.map((tabela) => [tabela, []])) as unknown as Record<(typeof NOMES_TABELAS_M12)[number], never[]>;
}

/** Versão 21: só acrescenta as tabelas que faltam, seja qual for o número de origem. Quem já usa a Central não perde nada. */
export function acrescentarTabelasM12(alteracoes: Record<string, readonly unknown[]>) {
  for (const tabela of NOMES_TABELAS_M12) if (driver().getItem(chaveDaTabela(tabela)) === null) alteracoes[tabela] = [];
}
