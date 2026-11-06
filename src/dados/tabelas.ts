import type { z } from 'zod';
import { esquemaEventoAuditoria } from './tipos/auditoria';
import { esquemaBackupRegistro } from './tipos/backup-registro';
import { esquemaCambioReferencia } from './tipos/cambio-referencia';
import { esquemaConfiguracao } from './tipos/configuracao';
import { esquemaPessoa } from './tipos/pessoa';

/**
 * Tabelas que existem nesta etapa. Cada tela acrescenta as suas (16 §0), e elas entram sozinhas em
 * exportar, importar, restaurar e limpar exemplos.
 */
export const TABELAS = {
  pessoa: { rotulo: 'Pessoas', esquema: esquemaPessoa },
  configuracao: { rotulo: 'Configurações', esquema: esquemaConfiguracao },
  cambio_referencia: { rotulo: 'Câmbio de referência', esquema: esquemaCambioReferencia },
  backup_registro: { rotulo: 'Backups registrados', esquema: esquemaBackupRegistro },
  auditoria: { rotulo: 'Histórico', esquema: esquemaEventoAuditoria },
} as const satisfies Record<string, { rotulo: string; esquema: z.ZodType }>;

export type Tabela = keyof typeof TABELAS;

export const NOMES_TABELAS = Object.keys(TABELAS) as Tabela[];

/**
 * Sobe quando o formato das tabelas muda; dados antigos passam pela migração em `carga.ts` (02 §0.3).
 * 2: T02.01 acrescenta `configuracao` e `cambio_referencia`.
 */
export const VERSAO_DADOS = 2;
