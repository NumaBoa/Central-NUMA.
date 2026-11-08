import { z } from 'zod';
import { esquemaControle } from './controle';

/** Os itens que dependem de alguém conferir à mão (T05.10): quem marcou e quando. */
const esquemaMarca = z.object({ por: z.string().min(1), em: z.iso.datetime() });

/**
 * `competencia_fechamento` (16 §4.5, T05.10, RN-05.18): uma linha por competência. Fechada, bloqueia lançamentos,
 * baixas e rateios daquela competência; reabrir exige motivo e fica no histórico.
 */
export const esquemaCompetenciaFechamento = esquemaControle.extend({
  /** Primeiro dia do mês. Único. */
  competencia: z.iso.date(),
  situacao: z.enum(['em_fechamento', 'fechada', 'aberta']),
  checklist: z.record(z.string(), esquemaMarca),
  fechada_em: z.iso.datetime().nullable(),
  fechada_por: z.string().nullable(),
  /** Fechar com pendência exige dizer por quê. */
  fechada_com_pendencias: z.string().nullable(),
  reaberta_em: z.iso.datetime().nullable(),
  reaberta_motivo: z.string().nullable(),
  /** T05.11: os envios do pacote ao contador (data, para quem, como). */
  envios_contador: z.array(z.object({ data: z.iso.date(), para: z.string().min(1), como: z.string().min(1), por: z.string().min(1) })).default([]),
});
export type CompetenciaFechamento = z.infer<typeof esquemaCompetenciaFechamento>;
