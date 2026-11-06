import type { z } from 'zod';
import { esquemaEventoAuditoria } from './tipos/auditoria';
import { esquemaBackupRegistro } from './tipos/backup-registro';
import { esquemaPessoa } from './tipos/pessoa';

/**
 * Tabelas que existem nesta etapa. Cada tela acrescenta as suas (16 §0), e elas entram sozinhas em
 * exportar, importar, restaurar e limpar exemplos.
 */
export const TABELAS = {
  pessoa: { rotulo: 'Pessoas', esquema: esquemaPessoa },
  backup_registro: { rotulo: 'Backups registrados', esquema: esquemaBackupRegistro },
  auditoria: { rotulo: 'Histórico', esquema: esquemaEventoAuditoria },
} as const satisfies Record<string, { rotulo: string; esquema: z.ZodType }>;

export type Tabela = keyof typeof TABELAS;

export const NOMES_TABELAS = Object.keys(TABELAS) as Tabela[];

/** Sobe quando o formato de uma tabela muda; dados antigos passam por uma migração (02 §0.3). */
export const VERSAO_DADOS = 1;
