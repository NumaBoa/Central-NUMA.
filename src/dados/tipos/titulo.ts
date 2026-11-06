import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const moeda = z.string().regex(/^[A-Z]{3}$/);

export const ORIGENS_DO_TITULO = ['manual', 'assinatura', 'contrato', 'reembolso', 'canal', 'repasse', 'obrigacao_corporativa', 'ajuste'] as const;
export const SITUACOES_DO_TITULO = ['previsto', 'aberto', 'parcial', 'quitado', 'cancelado'] as const;

/** `titulo` (16 §4.5). `competencia` é o primeiro dia do mês. A situação é mantida a partir das baixas (RN-05.02). */
export const esquemaTitulo = esquemaControle.extend({
  codigo: z.string().min(1),
  natureza: z.enum(['pagar', 'receber']),
  descricao: z.string().trim().min(1),
  contraparte_id: texto,
  /** Reembolso à sócia (RN-05.06). */
  beneficiario_pessoa_id: texto,
  categoria_id: z.string().min(1),
  competencia: z.iso.date(),
  vencimento: z.iso.date(),
  valor: z.number().positive(),
  moeda,
  situacao: z.enum(SITUACOES_DO_TITULO),
  responsavel_id: z.string().min(1),
  entidade_id: texto,
  origem: z.enum(ORIGENS_DO_TITULO),
  origem_id: texto,
  chave_idempotencia: texto,
  ajustado_manualmente: z.boolean(),
  ferramenta_id: texto,
  assinatura_id: texto,
  periodo_inicio: dia,
  periodo_fim: dia,
  suspenso: z.boolean(),
  cancelado_motivo: texto,
  observacao: texto,
});

export type Titulo = z.infer<typeof esquemaTitulo>;

/** `titulo_rateio`: sem produto, é a Numa. O valor é calculado, e o último contexto fica com o resíduo (RN-05.08). */
export const esquemaTituloRateio = esquemaControle.extend({
  titulo_id: z.string().min(1),
  produto_id: texto,
  percentual: z.number().min(0).max(100),
  valor: z.number(),
});

export type TituloRateio = z.infer<typeof esquemaTituloRateio>;

/** `baixa`: valores sempre positivos; quem diz o sentido é o `tipo`. Estorno nunca apaga a baixa original (RN-05.04). */
export const esquemaBaixa = esquemaControle.extend({
  titulo_id: z.string().min(1),
  tipo: z.enum(['pagamento', 'estorno', 'ajuste']),
  baixa_original_id: texto,
  data: z.iso.date(),
  conta_financeira_id: z.string().min(1),
  valor_moeda: z.number().positive(),
  cambio: z.number().positive().nullable(),
  iof_brl: z.number().nonnegative().nullable(),
  valor_brl: z.number().positive(),
  comprovante_url: texto,
  sem_comprovante_motivo: texto,
  tratamento: z.enum(['aporte', 'reembolso']).nullable(),
  movimento_societario_id: texto,
  titulo_reembolso_id: texto,
  motivo: texto,
  registrado_por: texto,
});

export type Baixa = z.infer<typeof esquemaBaixa>;

/** `movimento_societario` (MOV): não é receita nem despesa (RN-05.11). */
export const esquemaMovimentoSocietario = esquemaControle.extend({
  codigo: z.string().min(1),
  tipo: z.enum(['aporte', 'retirada', 'distribuicao']),
  socia_id: z.string().min(1),
  data: z.iso.date(),
  valor_brl: z.number().positive(),
  forma: z.enum(['dinheiro', 'pagamento_despesa', 'bem_servico']),
  titulo_origem_id: texto,
  baixa_origem_id: texto,
  conta_financeira_id: texto,
  comprovante_url: texto,
  observacao: texto,
});

export type MovimentoSocietario = z.infer<typeof esquemaMovimentoSocietario>;
