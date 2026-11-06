import { z } from 'zod';

/** `acao_auditoria` (16 §3). */
export const ACOES_AUDITORIA = ['inseriu', 'alterou', 'arquivou', 'restaurou', 'excluiu_rascunho', 'entrou', 'saiu', 'falhou_login', 'bloqueou', 'exportou', 'alterou_permissao', 'executou_acao'] as const;

/**
 * `auditoria` (16 §4.1): sem colunas de controle e somente inserção. Nesta etapa, `usuario_id`
 * guarda a pessoa escolhida em "Você é" (02 §0.3); `null` significa o Sistema.
 */
export const esquemaEventoAuditoria = z.object({
  id: z.uuid(),
  ocorrido_em: z.iso.datetime(),
  usuario_id: z.uuid().nullable(),
  acao: z.enum(ACOES_AUDITORIA),
  tabela: z.string().nullable(),
  registro_id: z.uuid().nullable(),
  registro_codigo: z.string().nullable(),
  antes: z.record(z.string(), z.unknown()).nullable(),
  depois: z.record(z.string(), z.unknown()).nullable(),
  campos_alterados: z.array(z.string()),
  motivo: z.string().nullable(),
});

export type EventoAuditoria = z.infer<typeof esquemaEventoAuditoria>;
