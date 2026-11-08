import { z } from 'zod';
import { esquemaControle } from './controle';

/**
 * `venda_parceiro` (T05.13): as vendas de origem do repasse, lançadas à mão por contrato de parceiro. A importação
 * de arquivo fica para depois. `repasse_id` marca a venda já incluída num repasse.
 */
export const esquemaVendaParceiro = esquemaControle.extend({
  contrato_id: z.string().min(1),
  /** O item do contrato com os termos de repasse (RN-11.26). */
  item_contrato_id: z.string().min(1),
  produto_id: z.string().nullable(),
  data: z.iso.date(),
  descricao: z.string().trim().min(1),
  moeda: z.string().length(3),
  valor_bruto: z.number().positive(),
  taxas: z.number().nonnegative(),
  referencia: z.string().nullable(),
  repasse_id: z.string().nullable(),
});
export type VendaParceiro = z.infer<typeof esquemaVendaParceiro>;

/** Uma venda no cálculo: os termos da versão vigente na data da venda (RN-05.22). */
const esquemaLinhaDoRepasse = z.object({ venda_id: z.string().min(1), data: z.iso.date(), versao_numero: z.number().int(), base: z.number(), percentual: z.number(), retencao: z.number(), valor: z.number() });

/**
 * `repasse` (16, T05.13, RN-05.22): um repasse por parceiro × período (`chave_idempotencia`, só entre os não
 * cancelados). Gera o título a pagar ao parceiro. `percentual` fica vazio quando o período teve mais de um.
 */
export const esquemaRepasse = esquemaControle.extend({
  parceiro_id: z.string().min(1),
  contrato_id: z.string().nullable(),
  periodo_inicio: z.iso.date(),
  periodo_fim: z.iso.date(),
  moeda: z.string().length(3),
  base_calculo: z.number(),
  percentual: z.number().nullable(),
  retencao: z.number(),
  valor: z.number(),
  linhas: z.array(esquemaLinhaDoRepasse),
  titulo_id: z.string().nullable(),
  situacao: z.enum(['calculado', 'aprovado', 'pago', 'cancelado']),
  cancelado_motivo: z.string().nullable(),
  chave_idempotencia: z.string().min(1),
});
export type Repasse = z.infer<typeof esquemaRepasse>;
export type LinhaDoRepasse = z.infer<typeof esquemaLinhaDoRepasse>;
