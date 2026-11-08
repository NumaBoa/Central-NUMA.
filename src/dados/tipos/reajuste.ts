import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().trim().min(1).nullable();

/** Um item ou título na prévia do reajuste: o valor de antes e o de depois. */
const esquemaLinhaDaPrevia = z.object({ id: z.string().min(1), descricao: z.string(), de: z.number(), para: z.number(), vencimento: z.iso.date().nullable() });

/**
 * `reajuste_aplicado` (16 §4.11, T11.10, RN-11.20): um aniversário do contrato, calculado, aplicado ou dispensado.
 * A prévia guarda os itens recorrentes e os títulos futuros não pagos, com o valor antes e depois.
 * Único (contrato_id, data_base).
 */
export const esquemaReajusteAplicado = esquemaControle.extend({
  contrato_id: z.string().min(1),
  versao_id: z.string().min(1),
  data_base: z.iso.date(),
  indice_nome: z.string().trim().min(1),
  /** Percentual do índice no período, informado à mão (RN-11.20). */
  percentual: z.number().nullable(),
  indice_fonte: texto,
  indice_data: z.iso.date().nullable(),
  previa: z.object({ itens: z.array(esquemaLinhaDaPrevia), titulos: z.array(esquemaLinhaDaPrevia) }),
  situacao: z.enum(['calculado', 'aplicado', 'dispensado']),
  aplicado_por: texto,
  aplicado_em: z.iso.datetime().nullable(),
  dispensado_motivo: texto,
  /** Registro da comunicação ao cliente (data, canal, evidência). */
  comunicado_em: z.iso.date().nullable(),
  comunicado_canal: texto,
  comunicado_evidencia_url: texto,
});
export type ReajusteAplicado = z.infer<typeof esquemaReajusteAplicado>;
export type LinhaDaPrevia = z.infer<typeof esquemaLinhaDaPrevia>;
