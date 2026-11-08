import { z } from 'zod';
import { esquemaControle } from './controle';

const inteiroOuVazio = z.int().nonnegative().nullable();

/** `receita_canal` (16 §4.5, T05.12, RN-05.21): receita agregada por produto × canal × competência. Único (produto_id, canal_id, competencia). */
export const esquemaReceitaCanal = esquemaControle.extend({
  produto_id: z.string().min(1),
  canal_id: z.string().min(1),
  /** Primeiro dia do mês. */
  competencia: z.iso.date(),
  moeda: z.string().length(3),
  receita_bruta: z.number().nonnegative(),
  /** Taxas do canal no mês: sugeridas pelo percentual do canal (M07), editáveis. */
  taxas: z.number().nonnegative(),
  receita_liquida: z.number(),
  assinantes_ativos: inteiroOuVazio,
  novos: inteiroOuVazio,
  cancelados: inteiroOuVazio,
  fonte_url: z.string().nullable(),
  /** O título a receber do canal (RN-05.21). */
  titulo_id: z.string().nullable(),
});

export type ReceitaCanal = z.infer<typeof esquemaReceitaCanal>;
