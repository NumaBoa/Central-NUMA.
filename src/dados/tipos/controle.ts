import { z } from 'zod';

/** Campos de controle de toda tabela de domínio (RT-02), mais `exemplo` (16 §0). */
export const esquemaControle = z.object({
  id: z.uuid(),
  criado_em: z.iso.datetime(),
  criado_por: z.uuid().nullable(),
  atualizado_em: z.iso.datetime(),
  atualizado_por: z.uuid().nullable(),
  arquivado_em: z.iso.datetime().nullable(),
  arquivado_por: z.uuid().nullable(),
  versao_registro: z.number().int().positive(),
  exemplo: z.boolean(),
});

export type Controle = z.infer<typeof esquemaControle>;
