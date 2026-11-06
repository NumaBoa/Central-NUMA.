import { z } from 'zod';
import { esquemaControle } from './controle';

const moeda = z.string().regex(/^[A-Z]{3}$/);

/** `transferencia` (16 §4.5): não é receita nem despesa (RN-05.10). As duas pernas estão na mesma linha. */
export const esquemaTransferencia = esquemaControle
  .extend({
    data: z.iso.date(),
    conta_origem_id: z.string().min(1),
    conta_destino_id: z.string().min(1),
    valor_origem: z.number().positive(),
    moeda_origem: moeda,
    valor_destino: z.number().positive(),
    moeda_destino: moeda,
    cambio: z.number().positive().nullable(),
    comprovante_url: z.string().nullable(),
    observacao: z.string().nullable(),
    /** Campo novo em relação a `16` (decisão de Kimberly em 06/11/2026): o estorno aponta para a original. Backup antigo, sem ele, vale como nulo. */
    transferencia_original_id: z.string().nullable().default(null),
  })
  .refine((transferencia) => transferencia.conta_origem_id !== transferencia.conta_destino_id, { path: ['conta_destino_id'], message: 'A conta de destino precisa ser outra.' });

export type Transferencia = z.infer<typeof esquemaTransferencia>;

/** `conferencia_saldo` (16 §4.5): o saldo do banco, o do sistema e a diferença, num dia. */
export const esquemaConferenciaSaldo = esquemaControle.extend({
  conta_id: z.string().min(1),
  data: z.iso.date(),
  saldo_informado: z.number(),
  saldo_sistema: z.number(),
  diferenca: z.number(),
  ajuste_titulo_id: z.string().nullable(),
});

export type ConferenciaSaldo = z.infer<typeof esquemaConferenciaSaldo>;
