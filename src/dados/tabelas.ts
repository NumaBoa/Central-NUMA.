import type { z } from 'zod';
import { esquemaArea, esquemaPessoaArea } from './tipos/area';
import { esquemaEventoAuditoria } from './tipos/auditoria';
import { esquemaBackupRegistro } from './tipos/backup-registro';
import { esquemaCambioReferencia } from './tipos/cambio-referencia';
import { esquemaConfiguracao } from './tipos/configuracao';
import { esquemaMarca, esquemaProduto } from './tipos/marca';
import { esquemaPessoa } from './tipos/pessoa';

/**
 * Tabelas que existem nesta etapa. Cada tela acrescenta as suas (16 §0), e elas entram sozinhas em
 * exportar, importar, restaurar e limpar exemplos.
 */
export const TABELAS = {
  pessoa: { rotulo: 'Pessoas', esquema: esquemaPessoa },
  area: { rotulo: 'Áreas', esquema: esquemaArea },
  pessoa_area: { rotulo: 'Pessoas nas áreas', esquema: esquemaPessoaArea },
  marca: { rotulo: 'Marcas', esquema: esquemaMarca },
  produto: { rotulo: 'Produtos', esquema: esquemaProduto },
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
 * 3: T02.03 acrescenta `area` e `pessoa_area`.
 * 4: T02.04 acrescenta `marca` e `produto`; o contexto escolhido passa a ser o id do produto.
 */
export const VERSAO_DADOS = 4;
