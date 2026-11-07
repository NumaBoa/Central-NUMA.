import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const instante = z.iso.datetime().nullable();

export const TIPOS_DOCUMENTO_LEGAL = ['termos_uso', 'privacidade', 'cookies', 'termos_assinatura', 'termos_parceiro', 'outro'] as const;
export const SITUACOES_DOCUMENTO_LEGAL = ['rascunho', 'em_validacao', 'validado', 'publicado', 'substituido', 'devolvido', 'cancelado'] as const;

/** `documento_legal` (16 §4.9): um por produto e tipo; sem produto, é da Numa. */
export const esquemaDocumentoLegal = esquemaControle.extend({
  codigo: z.string().min(1),
  produto_id: texto,
  tipo: z.enum(TIPOS_DOCUMENTO_LEGAL),
  responsavel_id: z.string().min(1),
  versao_vigente_id: texto,
  revisao_necessaria: z.boolean(),
  revisao_motivo: texto,
  proxima_revisao: dia,
});
export type DocumentoLegal = z.infer<typeof esquemaDocumentoLegal>;

/** `documento_legal_versao`. O texto fica sempre no sistema (D23); o link do Drive é só anexo. */
export const esquemaDocumentoLegalVersao = esquemaControle.extend({
  documento_id: z.string().min(1),
  numero: z.number().int().positive(),
  situacao: z.enum(SITUACOES_DOCUMENTO_LEGAL),
  texto,
  arquivo_url: texto,
  url_publica: texto,
  publicado_em: dia,
  substituido_em: dia,
  resumo_mudancas: texto,
  validacao_id: texto,
  /** Termos públicos gerados a partir de um modelo (RN-11.37): modelo e documento são registros distintos. */
  modelo_versao_id: texto,
  /** "Revisado sem alterações" (RN-09.07): nova data de validação, mesma versão de texto. */
  revisado_sem_alteracoes_em: dia,
});
export type DocumentoLegalVersao = z.infer<typeof esquemaDocumentoLegalVersao>;

/**
 * `validacao` (VAL): a decisão fica no próprio registro, sem fila independente (decisão vigente 2).
 * Guarda quem pediu e quem decidiu, separados (RN-09.03).
 */
export const esquemaValidacao = esquemaControle
  .extend({
    codigo: z.string().min(1),
    registro_tipo: z.enum(['documento_legal_versao', 'clausula_versao', 'modelo_versao']),
    registro_id: z.string().min(1),
    solicitado_por: texto,
    solicitado_em: z.iso.datetime(),
    situacao: z.enum(['pendente', 'validado', 'devolvido']),
    decidido_por: texto,
    decidido_em: instante,
    observacoes: texto,
    motivo_devolucao: texto,
  })
  .superRefine((validacao, contexto) => {
    if (validacao.situacao === 'devolvido' && !validacao.motivo_devolucao?.trim()) contexto.addIssue({ code: 'custom', path: ['motivo_devolucao'], message: 'Devolver exige motivo.' });
  });
export type Validacao = z.infer<typeof esquemaValidacao>;

export const CATEGORIAS_TITULARES = ['usuarios_app', 'clientes_b2b', 'contatos_comerciais', 'inscritos_lista', 'parceiros', 'colaboradores'] as const;
export const CATEGORIAS_DADOS = ['identificacao', 'contato', 'localizacao', 'financeiro', 'uso', 'conteudo_gerado', 'dados_terceiros', 'sensiveis', 'criancas_adolescentes'] as const;
export const BASES_LEGAIS = ['consentimento', 'execucao_contrato', 'obrigacao_legal', 'legitimo_interesse', 'exercicio_direitos', 'protecao_credito', 'protecao_vida', 'tutela_saude', 'politicas_publicas', 'pesquisa'] as const;

/** `tratamento_dados` (16 §4.9): uma operação do inventário. */
export const esquemaTratamentoDados = esquemaControle
  .extend({
    produto_id: texto,
    nome: z.string().trim().min(1),
    finalidade: z.string().trim().min(1),
    titulares: z.array(z.enum(CATEGORIAS_TITULARES)).min(1),
    categorias_dados: z.array(z.enum(CATEGORIAS_DADOS)).min(1),
    justificativa_sensiveis: texto,
    base_legal: z.enum(BASES_LEGAIS),
    retencao: z.string().trim().min(1),
    transferencia_internacional: z.enum(['sim', 'nao', 'desconhecido']),
    medidas: texto,
    compartilhamentos: z.array(z.object({ contraparte_id: z.string().min(1), finalidade: z.string().trim().min(1) })),
    revisado_em: dia,
    revisado_por: texto,
  })
  .superRefine((tratamento, contexto) => {
    if (tratamento.categorias_dados.includes('sensiveis') && !tratamento.justificativa_sensiveis?.trim()) contexto.addIssue({ code: 'custom', path: ['justificativa_sensiveis'], message: 'Dados sensíveis exigem justificativa.' });
  });
export type TratamentoDados = z.infer<typeof esquemaTratamentoDados>;

/** `tratamento_ferramenta`: as ferramentas de M04 onde a operação acontece. */
export const esquemaTratamentoFerramenta = esquemaControle.extend({ tratamento_id: z.string().min(1), ferramenta_id: z.string().min(1) });
export type TratamentoFerramenta = z.infer<typeof esquemaTratamentoFerramenta>;

export const TIPOS_SOLICITACAO_TITULAR = ['confirmacao', 'acesso', 'correcao', 'anonimizacao_exclusao', 'portabilidade', 'informacao_compartilhamento', 'revogacao_consentimento', 'oposicao'] as const;

/**
 * `solicitacao_titular` (SOL). O prazo pode ficar vazio: não há prazo universal fixado (decisão vigente 11),
 * e dado não definido permanece pendente. `prazo_criterio` diz de onde a data veio.
 */
export const esquemaSolicitacaoTitular = esquemaControle.extend({
  codigo: z.string().min(1),
  produto_id: texto,
  titular_nome: z.string().trim().min(1),
  titular_contato: z.string().trim().min(1),
  canal: texto,
  tipo: z.enum(TIPOS_SOLICITACAO_TITULAR),
  recebida_em: z.iso.date(),
  prazo: dia,
  prazo_criterio: texto,
  responsavel_id: z.string().min(1),
  situacao: z.enum(['recebida', 'em_analise', 'respondida', 'encerrada']),
  resposta: texto,
  evidencia_url: texto,
  respondida_em: dia,
  acoes_tomadas: texto,
  encerrada_em: dia,
});
export type SolicitacaoTitular = z.infer<typeof esquemaSolicitacaoTitular>;

export const CATEGORIAS_CLAUSULA = ['objeto', 'escopo', 'preco_pagamento', 'reajuste', 'multa_juros', 'vigencia_renovacao', 'rescisao', 'sla_suporte', 'propriedade_intelectual', 'confidencialidade', 'protecao_dados', 'limitacao_responsabilidade', 'repasse_comissao', 'licenca_conteudo', 'foro', 'disposicoes_gerais', 'outra'] as const;
const SITUACOES_VALIDAVEIS = ['rascunho', 'validada', 'obsoleta'] as const;

/** `clausula`: código semântico, como `CL-REAJ-01`. */
export const esquemaClausula = esquemaControle.extend({
  codigo: z.string().regex(/^CL-[A-Z0-9]+-\d{2,}$/),
  titulo: z.string().trim().min(1),
  categoria: z.enum(CATEGORIAS_CLAUSULA),
  alternativa_de_id: texto,
});
export type Clausula = z.infer<typeof esquemaClausula>;

/** `clausula_versao`: editar uma validada cria outra versão; os modelos seguem presos à sua (RN-09.12). */
export const esquemaClausulaVersao = esquemaControle.extend({
  clausula_id: z.string().min(1),
  numero: z.number().int().positive(),
  texto: z.string(),
  quando_usar: texto,
  variaveis: z.array(z.string()),
  situacao: z.enum(SITUACOES_VALIDAVEIS),
  validacao_id: texto,
});
export type ClausulaVersao = z.infer<typeof esquemaClausulaVersao>;

export const TIPOS_DOCUMENTO = ['contrato', 'proposta', 'aditivo', 'termo', 'memorando', 'carta_reajuste', 'notificacao'] as const;
export const FAMILIAS_CONTRATO = ['cliente_negociado', 'adesao_condicao_especial', 'parceiro', 'fornecedor', 'institucional'] as const;

/** `modelo_documento` (MOD). `MOD-SAAS-LIC` é o código fixo da carga inicial. */
export const esquemaModeloDocumento = esquemaControle.extend({
  codigo: z.string().min(1),
  nome: z.string().trim().min(1),
  tipo_documento: z.enum(TIPOS_DOCUMENTO),
  familia: z.enum(FAMILIAS_CONTRATO).nullable(),
  marca_id: texto,
});
export type ModeloDocumento = z.infer<typeof esquemaModeloDocumento>;

export type BlocoModelo = {
  id: string;
  tipo: 'clausula' | 'texto' | 'tabela_itens' | 'condicional' | 'assinaturas';
  titulo: string | null;
  clausula_versao_id: string | null;
  conteudo: string | null;
  condicao: string | null;
  blocos: BlocoModelo[];
};

export const esquemaBlocoModelo: z.ZodType<BlocoModelo> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    tipo: z.enum(['clausula', 'texto', 'tabela_itens', 'condicional', 'assinaturas']),
    titulo: texto,
    clausula_versao_id: texto,
    conteudo: texto,
    condicao: texto,
    blocos: z.array(esquemaBlocoModelo),
  }),
);

export const esquemaVariavelModelo = z.object({ nome: z.string().min(1), origem: z.string(), formato: z.string(), obrigatoria: z.boolean() });
export type VariavelModelo = z.infer<typeof esquemaVariavelModelo>;

/** `modelo_versao`: `rotulo_versao` guarda o número do texto-fonte, como "2.0" em `MOD-SAAS-LIC`. */
export const esquemaModeloVersao = esquemaControle.extend({
  modelo_id: z.string().min(1),
  numero: z.number().int().positive(),
  rotulo_versao: z.string().min(1),
  estrutura: z.array(esquemaBlocoModelo),
  variaveis: z.array(esquemaVariavelModelo),
  cabecalho: z.string().nullable(),
  situacao: z.enum(SITUACOES_VALIDAVEIS),
  validacao_id: texto,
  /** Ressalva que acompanha a versão, como "rascunho para validação jurídica". */
  aviso: texto,
  observacoes: texto,
});
export type ModeloVersao = z.infer<typeof esquemaModeloVersao>;
