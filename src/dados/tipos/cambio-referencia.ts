import { z } from 'zod';
import { esquemaControle } from './controle';

/** `numeric(12,6)` (RT-07): até 6 dígitos inteiros e 6 casas decimais. */
export const MAIOR_COTACAO = 999_999.999999;

/**
 * `cambio_referencia` (16 §4.1). Usado só em estimativas (RN-04.07 e RN-05.05): a baixa registra o
 * câmbio efetivo. Único por moeda e data entre as linhas ativas: a removida fica só no histórico.
 */
export const esquemaCambioReferencia = esquemaControle.extend({
  moeda: z.string().regex(/^[A-Z]{3}$/),
  valor_brl: z.number().positive().max(MAIOR_COTACAO),
  data_referencia: z.iso.date(),
  fonte: z.string().nullable(),
});

export type CambioReferencia = z.infer<typeof esquemaCambioReferencia>;
