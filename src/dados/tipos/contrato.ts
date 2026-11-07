import { z } from 'zod';
import { esquemaControle } from './controle';
import { FAMILIAS_CONTRATO } from './legal';
import { PERIODICIDADES_VALOR } from './comercial';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const instante = z.iso.datetime().nullable();
const valor = z.number().nonnegative().nullable();
const inteiro = z.number().int().nonnegative().nullable();

export const SITUACOES_DOCUMENTAIS = ['rascunho', 'em_revisao', 'aprovado_envio', 'enviado_assinatura', 'assinado', 'recusado', 'cancelado'] as const;
export const SITUACOES_RENOVACAO = ['nao_se_aplica', 'em_analise', 'renovar', 'nao_renovar', 'renovado'] as const;
export const TIPOS_CONTRATO = ['assinatura', 'implantacao', 'desenvolvimento', 'suporte', 'parceria', 'prestacao_servico', 'patrocinio', 'confidencialidade'] as const;

/**
 * `contrato` (CTR). Uma linha por contrato. As situações de vigência e financeira são derivadas
 * (`contratos.ts`): só "suspenso" e "encerrado" são fatos gravados aqui, nos campos próprios.
 */
export const esquemaContrato = esquemaControle.extend({
  codigo: z.string().min(1),
  titulo: z.string().trim().min(1),
  familia: z.enum(FAMILIAS_CONTRATO),
  tipo: z.enum(TIPOS_CONTRATO),
  entidade_id: z.string().min(1),
  contraparte_id: z.string().min(1),
  responsavel_id: z.string().min(1),
  participantes: z.array(z.string().min(1)),
  proposta_versao_id: texto,
  moeda: z.string().regex(/^[A-Z]{3}$/),
  situacao_documental: z.enum(SITUACOES_DOCUMENTAIS),
  renovacao_situacao: z.enum(SITUACOES_RENOVACAO),
  versao_vigente_id: texto,
  versao_elaboracao_id: texto,
  classe: z.enum(['pub', 'int', 'fin', 'doc']),
  /** Usa o modelo único de assinatura (T11.14). */
  saas: z.boolean(),
  suspensao: z.object({ inicio: z.iso.date(), fim: dia, motivo: z.string().min(1) }).nullable(),
  /** Renovação automática (RN-11.22): a versão assinada não muda; o novo fim fica aqui, com evento registrado. */
  vigencia_prorrogada_ate: dia,
  encerrado_em: dia,
  encerramento_motivo: z.enum(['termino', 'rescisao_numa', 'rescisao_contraparte', 'acordo']).nullable(),
  cancelado_motivo: texto,
  /** Correção administrativa (RN-11.11): só o que não tem efeito contratual. O snapshot e o arquivo assinado não mudam. */
  administrativo: z.object({ endereco_correspondencia: texto, dados_bancarios: texto, observacoes: texto }),
});
export type Contrato = z.infer<typeof esquemaContrato>;

export const esquemaContratoContato = esquemaControle.extend({ contrato_id: z.string().min(1), pessoa_id: z.string().min(1), papel: z.enum(['principal', 'financeiro', 'tecnico']) });
export type ContratoContato = z.infer<typeof esquemaContratoContato>;

const esquemaParcela = z.object({ percentual: z.number().positive().max(100), gatilho: z.enum(['data', 'evento']), data: dia, evento: texto });
export type ParcelaUnica = z.infer<typeof esquemaParcela>;

/** `condicoes` de `contrato_versao` (16 §4.11). */
export const esquemaCondicoesContrato = z.object({
  forma_pagamento: z.enum(['pix', 'boleto', 'cartao', 'transferencia', 'loja_gateway']).nullable(),
  dia_vencimento: z.number().int().min(1).max(28).nullable(),
  parcelas: z.array(esquemaParcela),
  multa_atraso: z.number().min(0).nullable(),
  juros_mes: z.number().min(0).nullable(),
  fidelidade_meses: inteiro,
  fidelidade_motivo: texto,
  multa_rescisoria: texto,
  reajuste_indice: texto,
  reajuste_periodicidade_meses: inteiro,
  reajuste_aviso_dias: inteiro,
  renovacao_tipo: z.enum(['sem_renovacao', 'automatica', 'mediante_aditivo']).nullable(),
  renovacao_periodo_meses: inteiro,
  aviso_previo_dias: inteiro,
  aceite_criterios: texto,
  aceite_prazo_dias: inteiro,
});
export type CondicoesContrato = z.infer<typeof esquemaCondicoesContrato>;

export const CONDICOES_VAZIAS: CondicoesContrato = { forma_pagamento: null, dia_vencimento: null, parcelas: [], multa_atraso: null, juros_mes: null, fidelidade_meses: null, fidelidade_motivo: null, multa_rescisoria: null, reajuste_indice: null, reajuste_periodicidade_meses: null, reajuste_aviso_dias: null, renovacao_tipo: null, renovacao_periodo_meses: null, aviso_previo_dias: null, aceite_criterios: null, aceite_prazo_dias: null };

/** O que T11.14 preenche além do contrato comum (19 §5). Limites legais em `contrato-saas.ts`. */
export const esquemaDadosSaas = z.object({
  produto_id: texto,
  representante_contraparte_id: texto,
  oferta_id: texto,
  periodicidade: z.enum(['mensal', 'anual']).nullable(),
  canal_id: texto,
  adicionais: z.array(z.object({ oferta_id: z.string(), quantidade: z.number().int().positive() })),
  condicao_especial: z.object({ valor: z.number().nonnegative().nullable(), duracao_meses: z.number().int().positive().nullable(), motivo: texto }).nullable(),
  modalidades: z.array(z.string()),
  data_inicio: dia,
  data_inicio_justificativa: texto,
  forma_pagamento_texto: texto,
  vencimento_texto: texto,
  dia_vencimento: z.number().int().min(1).max(28).nullable(),
  teste_dias: inteiro,
  garantia_dias: inteiro,
  multa_atraso_pct: z.number().min(0).nullable(),
  juros_mes_pct: z.number().min(0).nullable(),
  suspensao_dias_atraso: inteiro,
  aviso_suspensao_dias: inteiro,
  cancelamento_dias_atraso: inteiro,
  reajuste_indice: texto,
  reajuste_aviso_dias: inteiro,
  fidelidade_meses: inteiro,
  fidelidade_motivo: texto,
  multa_rescisoria_texto: texto,
  limite_responsabilidade_meses: inteiro,
  limite_responsabilidade_justificativa: texto,
  relacao_nao_consumo: z.boolean(),
  foro: texto,
  local: texto,
  forma_assinatura: z.enum(['Eletrônica', 'Manuscrita']).nullable(),
  plataforma_assinatura: texto,
  signatarios_licenciante: z.array(z.string()),
  testemunha1_nome: texto,
  testemunha1_cpf: texto,
  testemunha2_nome: texto,
  testemunha2_cpf: texto,
  /** Mudar um padrão pede justificativa, que fica na revisão (19 §5, etapa 3). */
  justificativas_padrao: texto,
});
export type DadosSaas = z.infer<typeof esquemaDadosSaas>;

/** `contrato_versao`. Publicada é imutável (RN-11.03). */
export const esquemaContratoVersao = esquemaControle.extend({
  contrato_id: z.string().min(1),
  numero: z.number().int().positive(),
  tipo: z.enum(['original', 'aditivo', 'renovacao']),
  situacao: z.enum(['em_elaboracao', 'publicada', 'cancelada']),
  data_efeito: dia,
  retroatividade_justificativa: texto,
  resumo_mudancas: texto,
  vigencia_inicio: dia,
  vigencia_inicio_evento: z.enum(['assinatura', 'data_fixa', 'outro']),
  vigencia_inicio_evento_nome: texto,
  vigencia_fim: dia,
  vigencia_duracao_meses: inteiro,
  vigencia_indeterminada: z.boolean(),
  condicoes: esquemaCondicoesContrato,
  dados_saas: esquemaDadosSaas.nullable(),
  modelo_versao_id: texto,
  snapshot: z.record(z.string(), z.unknown()).nullable(),
  aprovada_envio_por: texto,
  aprovada_envio_em: instante,
  enviada_em: dia,
  enviada_canal: texto,
  enviada_destinatarios: texto,
  enviada_documento_id: texto,
  assinado_arquivo_url: texto,
  assinatura_evidencia_url: texto,
  assinatura_confirmada_por: texto,
  assinatura_confirmada_em: instante,
  publicada_em: instante,
  publicada_por: texto,
  devolucao_motivo: texto,
  recusa_motivo: texto,
});
export type ContratoVersao = z.infer<typeof esquemaContratoVersao>;

export const esquemaContratoSignatario = esquemaControle.extend({ versao_id: z.string().min(1), parte: z.enum(['numa', 'contraparte']), pessoa_id: z.string().min(1), assinado_em: dia });
export type ContratoSignatario = z.infer<typeof esquemaContratoSignatario>;

/** `item_contrato`: valores únicos e recorrentes separados por periodicidade (RN-11.05). */
export const esquemaItemContrato = esquemaControle.extend({
  versao_id: z.string().min(1),
  produto_id: texto,
  oferta_id: texto,
  preco_versao_id: texto,
  canal_id: texto,
  descricao: z.string().trim().min(1),
  quantidade: z.number().positive(),
  valor_unitario: valor,
  desconto: valor,
  desconto_justificativa: texto,
  desconto_por: texto,
  desconto_em: dia,
  valor_total: valor,
  recorrente: z.boolean(),
  periodicidade: z.enum(PERIODICIDADES_VALOR).nullable(),
  inicio: dia,
  fim: dia,
  item_origem_id: texto,
  proposta_item_id: texto,
  ordem: z.number().int().nonnegative(),
});
export type ItemContrato = z.infer<typeof esquemaItemContrato>;

export const EVENTOS_REFERENCIA = ['assinatura', 'inicio_vigencia', 'entrega', 'aceite', 'data_fixa', 'outro'] as const;

/** `regra_prazo`: a data calculada é derivada (`contratos-prazos.ts`), e fica pendente enquanto o evento não ocorrer. */
export const esquemaRegraPrazo = esquemaControle.extend({
  versao_id: z.string().min(1),
  nome: z.string().trim().min(1),
  uso: z.enum(['vigencia_inicio', 'vigencia_fim', 'entrega', 'obrigacao', 'pagamento']),
  produto_id: texto,
  evento_referencia: z.enum(EVENTOS_REFERENCIA),
  evento_nome: texto,
  data_fixa: dia,
  duracao: inteiro,
  unidade: z.enum(['dias_corridos', 'dias_uteis', 'meses']).nullable(),
  excecao_justificativa: texto,
});
export type RegraPrazo = z.infer<typeof esquemaRegraPrazo>;

/** `evento_contrato`. */
export const esquemaEventoContrato = esquemaControle.extend({
  contrato_id: z.string().min(1),
  tipo: z.enum(EVENTOS_REFERENCIA),
  nome: texto,
  produto_id: texto,
  data: z.iso.date(),
  confirmado_por: z.string().min(1),
  evidencia_url: texto,
  observacao: texto,
  corrigido_de: dia,
  correcao_motivo: texto,
});
export type EventoContrato = z.infer<typeof esquemaEventoContrato>;

/** `obrigacao_contratual`: "Atrasada" é derivada do prazo. */
export const esquemaObrigacaoContratual = esquemaControle.extend({
  versao_id: z.string().min(1),
  parte: z.enum(['numa', 'contraparte', 'terceiro']),
  descricao: z.string().trim().min(1),
  clausula_ref: texto,
  prazo_data: dia,
  regra_prazo_id: texto,
  responsavel_id: z.string().min(1),
  criterio: texto,
  situacao: z.enum(['pendente', 'cumprida', 'dispensada']),
  cumprida_em: dia,
  evidencia_url: texto,
  dispensada_motivo: texto,
  depende_de: z.array(z.string()),
});
export type ObrigacaoContratual = z.infer<typeof esquemaObrigacaoContratual>;

/** `documento_emitido` (DOC): guarda o texto como saiu; mudanças depois não alteram o que foi emitido (CA-11.04). */
export const esquemaDocumentoEmitido = esquemaControle.extend({
  codigo: z.string().min(1),
  registro_tipo: z.enum(['proposta_versao', 'contrato_versao', 'documento_legal_versao']),
  registro_id: z.string().min(1),
  modelo_versao_id: texto,
  numero_emissao: z.number().int().positive(),
  final: z.boolean(),
  modelo_nao_validado_confirmado: z.boolean(),
  motivo: texto,
  dados_snapshot: z.record(z.string(), z.unknown()),
  arquivo_url: texto,
  emitido_por: texto,
  emitido_em: z.iso.datetime(),
  enviado: z.boolean(),
});
export type DocumentoEmitido = z.infer<typeof esquemaDocumentoEmitido>;

/** `programacao_financeira`: ativar de novo não duplica (RN-11.17). */
export const esquemaProgramacaoFinanceira = esquemaControle.extend({
  versao_id: z.string().min(1),
  contrato_id: z.string().min(1),
  ativada_em: z.iso.datetime(),
  ativada_por: texto,
  janela_ate: z.iso.date(),
  situacao: z.enum(['ativa', 'encerrada']),
});
export type ProgramacaoFinanceira = z.infer<typeof esquemaProgramacaoFinanceira>;

/** `relacao_adesao` (ADS): agregada, sem contrato por assinante (RN-11.25). */
export const esquemaRelacaoAdesao = esquemaControle.extend({
  codigo: z.string().min(1),
  produto_id: z.string().min(1),
  oferta_id: z.string().min(1),
  canal_id: z.string().min(1),
  documento_legal_id: z.string().min(1),
  inicio: z.iso.date(),
  situacao: z.enum(['ativa', 'encerrada']),
  encerrada_em: dia,
});
export type RelacaoAdesao = z.infer<typeof esquemaRelacaoAdesao>;

/** `renovacao_decisao`. "Renegociar" mantém a renovação em análise (ver relatório da frente). */
export const esquemaRenovacaoDecisao = esquemaControle.extend({
  contrato_id: z.string().min(1),
  data_limite: dia,
  decisao: z.enum(['renovar', 'nao_renovar', 'renegociar']),
  motivo: z.string().trim().min(1),
  decidido_por: texto,
  decidido_em: z.iso.datetime(),
  versao_renovacao_id: texto,
});
export type RenovacaoDecisao = z.infer<typeof esquemaRenovacaoDecisao>;

/** `encerramento_contrato`. */
export const esquemaEncerramentoContrato = esquemaControle.extend({
  contrato_id: z.string().min(1),
  data_efetiva: z.iso.date(),
  motivo: z.enum(['termino', 'rescisao_numa', 'rescisao_contraparte', 'acordo']),
  multa: z.object({ valor: valor, descricao: texto }).nullable(),
  checklist: z.array(z.object({ texto: z.string(), feito: z.boolean(), observacao: texto })),
  concluido_em: instante,
  titulos_cancelados: z.array(z.string()),
});
export type EncerramentoContrato = z.infer<typeof esquemaEncerramentoContrato>;

/**
 * `entidade_socias` e `entidade_licenciante` (19 §8): o tipo "Sócias pessoas físicas", sem solidariedade
 * (D-CTR-01) e sem recebedora no contrato (D-CTR-02). Ficam em tabelas à parte para backups antigos de
 * `entidade` continuarem válidos.
 */
export const esquemaEntidadeSocias = esquemaControle.extend({
  entidade_id: z.string().min(1),
  marca_comercial: z.string().trim().min(1),
});
export type EntidadeSocias = z.infer<typeof esquemaEntidadeSocias>;

export const esquemaEntidadeLicenciante = esquemaControle.extend({
  entidade_id: z.string().min(1),
  pessoa_id: z.string().min(1),
  nome_civil: texto,
  nacionalidade: texto,
  cpf: texto,
  /** Comercial ou residencial (D-CTR-03). Sai como escrito, em "com endereço em". */
  endereco: texto,
  email: texto,
  /** Soma 100% entre as sócias (CA-11.21). Vazia, bloqueia a emissão final. */
  responsabilidade_pct: z.number().min(0).max(100).nullable(),
});
export type EntidadeLicenciante = z.infer<typeof esquemaEntidadeLicenciante>;
