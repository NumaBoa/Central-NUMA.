import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const valor = z.number().nonnegative().nullable();

export const ETAPAS_FUNIL = ['novo', 'qualificacao', 'proposta', 'negociacao', 'ganha', 'perdida'] as const;
export const MOTIVOS_PERDA = ['preco', 'momento', 'concorrente', 'sem_resposta', 'escopo', 'desistiu', 'outro'] as const;
export const TIPOS_OPORTUNIDADE = ['assinatura', 'implantacao_assinatura', 'sob_medida', 'parceria', 'patrocinio'] as const;
export const PERIODICIDADES_VALOR = ['unica', 'mensal', 'trimestral', 'semestral', 'anual'] as const;

/** `oportunidade` (OPO). Valor estimado vazio não é zero (RN-10.01). A próxima ação é uma atividade vinculada (RN-10.02). */
export const esquemaOportunidade = esquemaControle
  .extend({
    codigo: z.string().min(1),
    contraparte_id: z.string().min(1),
    titulo: z.string().trim().min(1),
    tipo: z.enum(TIPOS_OPORTUNIDADE),
    origem: z.enum(['indicacao', 'rede_social', 'site', 'evento', 'busca_ativa', 'lista_espera', 'outro']),
    campanha_id: texto,
    valor_estimado: valor,
    valor_periodicidade: z.enum(PERIODICIDADES_VALOR).nullable(),
    moeda: z.string().regex(/^[A-Z]{3}$/),
    probabilidade: z.number().min(0).max(100).nullable(),
    fechamento_previsto: dia,
    etapa: z.enum(ETAPAS_FUNIL),
    etapa_desde: z.iso.date(),
    responsavel_id: z.string().min(1),
    necessidade: texto,
    motivo_perda: z.enum(MOTIVOS_PERDA).nullable(),
    motivo_perda_texto: texto,
    ganha_em: dia,
    perdida_em: dia,
    adesao_padrao: z.boolean(),
  })
  .superRefine((oportunidade, contexto) => {
    if (oportunidade.etapa === 'perdida' && !oportunidade.motivo_perda) contexto.addIssue({ code: 'custom', path: ['motivo_perda'], message: 'Perdida exige motivo.' });
    if (oportunidade.motivo_perda === 'outro' && !oportunidade.motivo_perda_texto?.trim()) contexto.addIssue({ code: 'custom', path: ['motivo_perda_texto'], message: 'Diga qual foi o motivo.' });
  });
export type Oportunidade = z.infer<typeof esquemaOportunidade>;

export const esquemaOportunidadeProduto = esquemaControle.extend({ oportunidade_id: z.string().min(1), produto_id: z.string().min(1) });
export type OportunidadeProduto = z.infer<typeof esquemaOportunidadeProduto>;
export const esquemaOportunidadeContato = esquemaControle.extend({ oportunidade_id: z.string().min(1), pessoa_id: z.string().min(1), papel: texto });
export type OportunidadeContato = z.infer<typeof esquemaOportunidadeContato>;
export const esquemaOportunidadeParticipante = esquemaControle.extend({ oportunidade_id: z.string().min(1), pessoa_id: z.string().min(1) });
export type OportunidadeParticipante = z.infer<typeof esquemaOportunidadeParticipante>;

/** `viabilidade` (16 §4.10). Não bloqueia a proposta (T10.04). */
export const esquemaViabilidade = esquemaControle.extend({
  oportunidade_id: z.string().min(1),
  existe: z.string().trim().min(1),
  entregas: z.array(z.object({ descricao: z.string().trim().min(1), horas: z.number().positive(), prazo_dias: z.number().int().positive().nullable() })).min(1),
  horas_total: z.number().nonnegative(),
  prazo_estimado_dias: z.number().int().positive(),
  custo_estimado: valor,
  capacidade: z.string().trim().min(1),
  riscos: texto,
  conclusao: z.enum(['viavel', 'viavel_condicoes', 'nao_viavel']),
  decidido_em: z.iso.date(),
  decididores: z.array(z.string().min(1)).min(1),
});
export type Viabilidade = z.infer<typeof esquemaViabilidade>;

/** `proposta` (PRP). */
export const esquemaProposta = esquemaControle.extend({
  codigo: z.string().min(1),
  oportunidade_id: z.string().min(1),
  contraparte_id: z.string().min(1),
  versao_aceita_id: texto,
});
export type Proposta = z.infer<typeof esquemaProposta>;

export const SITUACOES_VERSAO_PROPOSTA = ['rascunho', 'pronta', 'enviada', 'aceita', 'recusada', 'expirada', 'substituida'] as const;

const esquemaCondicoesProposta = z.object({
  forma_pagamento: texto,
  vencimentos: texto,
  reajuste_indice: texto,
  reajuste_periodicidade_meses: z.number().int().positive().nullable(),
  prazo_entrega: texto,
  observacoes: texto,
});
export type CondicoesProposta = z.infer<typeof esquemaCondicoesProposta>;

/** `proposta_versao`: versão enviada não muda (RN-10.11); o aceite aponta para uma só. */
export const esquemaPropostaVersao = esquemaControle.extend({
  proposta_id: z.string().min(1),
  numero: z.number().int().positive(),
  situacao: z.enum(SITUACOES_VERSAO_PROPOSTA),
  entidade_id: texto,
  marca_id: texto,
  modelo_versao_id: texto,
  contatos: z.array(z.string().min(1)),
  validade: z.iso.date(),
  escopo_incluido: texto,
  escopo_excluido: texto,
  premissas: texto,
  dependencias: texto,
  condicoes: esquemaCondicoesProposta,
  enviada_em: dia,
  enviada_canal: texto,
  enviada_para: texto,
  enviada_evidencia_url: texto,
  aceite_em: dia,
  aceite_forma: z.enum(['email', 'mensagem', 'assinatura', 'verbal_confirmado']).nullable(),
  aceite_evidencia_url: texto,
  aceite_registrado_por: texto,
  recusa_motivo: texto,
  validade_reaberta_motivo: texto,
  snapshot: z.record(z.string(), z.unknown()).nullable(),
  documento_emitido_id: texto,
});
export type PropostaVersao = z.infer<typeof esquemaPropostaVersao>;

/**
 * `proposta_item`. O preço é copiado para o item (snapshot, RN-10.08). Sem aprovação de desconto:
 * o desconto só exige justificativa, com autor e data (D22). `desconto_aprovacao` não existe.
 */
export const esquemaPropostaItem = esquemaControle.extend({
  versao_id: z.string().min(1),
  produto_id: texto,
  tipo_item: z.enum(['oferta', 'sob_medida']),
  oferta_id: texto,
  preco_versao_id: texto,
  canal_id: texto,
  descricao: z.string().trim().min(1),
  quantidade: z.number().positive(),
  valor_unitario: valor,
  desconto_percentual: z.number().min(0).max(100).nullable(),
  desconto_valor: valor,
  desconto_justificativa: texto,
  desconto_por: texto,
  desconto_em: dia,
  valor_total: valor,
  recorrente: z.boolean(),
  periodicidade: z.enum(PERIODICIDADES_VALOR).nullable(),
  inicio_previsto: dia,
  horas_estimadas: z.number().nonnegative().nullable(),
  justificativa_valor: texto,
  recurso_planejado: texto,
  recurso_previsto_para: dia,
  ordem: z.number().int().nonnegative(),
});
export type PropostaItem = z.infer<typeof esquemaPropostaItem>;

