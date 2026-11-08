import { z } from 'zod';
import { esquemaControle } from './controle';

/** `orcamento` (16 §4.5, T05.08): limite mensal por contexto. Sem produto é a Numa institucional. Único (produto_id, competencia). */
export const esquemaOrcamento = esquemaControle.extend({
  produto_id: z.string().nullable(),
  /** Primeiro dia do mês. */
  competencia: z.iso.date(),
  valor_brl: z.number().nonnegative(),
});

export type Orcamento = z.infer<typeof esquemaOrcamento>;
