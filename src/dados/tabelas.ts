import type { z } from 'zod';
import { esquemaAnexoLink, esquemaChecklistItem, esquemaComentario, esquemaVinculo } from './tipos/apoio';
import { esquemaArea, esquemaPessoaArea } from './tipos/area';
import { esquemaAtividade, esquemaAtividadeParticipante, esquemaAtividadeProduto } from './tipos/atividade';
import { esquemaFeriado } from './tipos/calendario';
import { esquemaEventoAuditoria } from './tipos/auditoria';
import { esquemaBackupRegistro } from './tipos/backup-registro';
import { esquemaCambioReferencia } from './tipos/cambio-referencia';
import { esquemaConfiguracao } from './tipos/configuracao';
import { esquemaContraparte, esquemaEntidade, esquemaEntidadeRepresentante } from './tipos/contraparte';
import { esquemaEtiqueta, esquemaEtiquetaVinculo } from './tipos/etiqueta';
import { esquemaCategoriaFinanceira, esquemaContaFinanceira } from './tipos/financeiro';
import { esquemaMarca, esquemaProduto } from './tipos/marca';
import { esquemaPessoa } from './tipos/pessoa';
import { esquemaRecorrencia } from './tipos/recorrencia';

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
  contraparte: { rotulo: 'Contrapartes', esquema: esquemaContraparte },
  entidade: { rotulo: 'Entidades', esquema: esquemaEntidade },
  entidade_representante: { rotulo: 'Representantes das entidades', esquema: esquemaEntidadeRepresentante },
  categoria_financeira: { rotulo: 'Categorias financeiras', esquema: esquemaCategoriaFinanceira },
  conta_financeira: { rotulo: 'Contas financeiras', esquema: esquemaContaFinanceira },
  feriado: { rotulo: 'Feriados', esquema: esquemaFeriado },
  etiqueta: { rotulo: 'Etiquetas', esquema: esquemaEtiqueta },
  etiqueta_vinculo: { rotulo: 'Etiquetas nos registros', esquema: esquemaEtiquetaVinculo },
  atividade: { rotulo: 'Atividades', esquema: esquemaAtividade },
  atividade_produto: { rotulo: 'Produtos das atividades', esquema: esquemaAtividadeProduto },
  atividade_participante: { rotulo: 'Participantes das atividades', esquema: esquemaAtividadeParticipante },
  checklist_item: { rotulo: 'Itens de checklist', esquema: esquemaChecklistItem },
  comentario: { rotulo: 'Comentários', esquema: esquemaComentario },
  vinculo: { rotulo: 'Vínculos', esquema: esquemaVinculo },
  anexo_link: { rotulo: 'Links do Drive', esquema: esquemaAnexoLink },
  recorrencia: { rotulo: 'Rotinas', esquema: esquemaRecorrencia },
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
 * 5: T02.05 e T02.06 acrescentam `entidade`, `entidade_representante` e `contraparte`.
 * 6: T02.07 a T02.10 acrescentam `categoria_financeira`, `conta_financeira`, `feriado`, `etiqueta` e `etiqueta_vinculo`.
 * 7: T03.01 acrescenta `atividade`, `atividade_produto` e `atividade_participante`.
 * 8: T03.02 e T03.03 acrescentam `checklist_item`, `comentario`, `vinculo` e `anexo_link`.
 * 9: T03.05 acrescenta `recorrencia`.
 */
export const VERSAO_DADOS = 9;
