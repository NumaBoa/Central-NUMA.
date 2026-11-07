import type { z } from 'zod';
import { esquemaOportunidade, esquemaOportunidadeContato, esquemaOportunidadeParticipante, esquemaOportunidadeProduto, esquemaProposta, esquemaPropostaItem, esquemaPropostaVersao, esquemaViabilidade } from './tipos/comercial';
import { esquemaContrato, esquemaContratoContato, esquemaContratoSignatario, esquemaContratoVersao, esquemaDocumentoEmitido, esquemaEncerramentoContrato, esquemaEntidadeLicenciante, esquemaEntidadeSocias, esquemaEventoContrato, esquemaItemContrato, esquemaObrigacaoContratual, esquemaProgramacaoFinanceira, esquemaRegraPrazo, esquemaRelacaoAdesao, esquemaRenovacaoDecisao } from './tipos/contrato';
import { esquemaClausula, esquemaClausulaVersao, esquemaDocumentoLegal, esquemaDocumentoLegalVersao, esquemaModeloDocumento, esquemaModeloVersao, esquemaSolicitacaoTitular, esquemaTratamentoDados, esquemaTratamentoFerramenta, esquemaValidacao } from './tipos/legal';

/** Tabelas de M09, M10 e M11, à parte para não disputar linhas com as frentes paralelas em `tabelas.ts`. */
export const TABELAS_F1 = {
  documento_legal: { rotulo: 'Documentos legais', esquema: esquemaDocumentoLegal },
  documento_legal_versao: { rotulo: 'Versões de documentos legais', esquema: esquemaDocumentoLegalVersao },
  validacao: { rotulo: 'Validações jurídicas', esquema: esquemaValidacao },
  tratamento_dados: { rotulo: 'Inventário de tratamento', esquema: esquemaTratamentoDados },
  tratamento_ferramenta: { rotulo: 'Ferramentas do inventário', esquema: esquemaTratamentoFerramenta },
  solicitacao_titular: { rotulo: 'Solicitações de titulares', esquema: esquemaSolicitacaoTitular },
  clausula: { rotulo: 'Cláusulas', esquema: esquemaClausula },
  clausula_versao: { rotulo: 'Versões de cláusulas', esquema: esquemaClausulaVersao },
  modelo_documento: { rotulo: 'Modelos de documentos', esquema: esquemaModeloDocumento },
  modelo_versao: { rotulo: 'Versões de modelos', esquema: esquemaModeloVersao },
  oportunidade: { rotulo: 'Oportunidades', esquema: esquemaOportunidade },
  oportunidade_produto: { rotulo: 'Produtos das oportunidades', esquema: esquemaOportunidadeProduto },
  oportunidade_contato: { rotulo: 'Contatos das oportunidades', esquema: esquemaOportunidadeContato },
  oportunidade_participante: { rotulo: 'Participantes das oportunidades', esquema: esquemaOportunidadeParticipante },
  viabilidade: { rotulo: 'Viabilidades', esquema: esquemaViabilidade },
  proposta: { rotulo: 'Propostas', esquema: esquemaProposta },
  proposta_versao: { rotulo: 'Versões de propostas', esquema: esquemaPropostaVersao },
  proposta_item: { rotulo: 'Itens de propostas', esquema: esquemaPropostaItem },
  contrato: { rotulo: 'Contratos', esquema: esquemaContrato },
  contrato_contato: { rotulo: 'Contatos dos contratos', esquema: esquemaContratoContato },
  contrato_versao: { rotulo: 'Versões de contratos', esquema: esquemaContratoVersao },
  contrato_signatario: { rotulo: 'Signatários', esquema: esquemaContratoSignatario },
  item_contrato: { rotulo: 'Itens de contratos', esquema: esquemaItemContrato },
  regra_prazo: { rotulo: 'Regras de prazo', esquema: esquemaRegraPrazo },
  evento_contrato: { rotulo: 'Eventos de contratos', esquema: esquemaEventoContrato },
  obrigacao_contratual: { rotulo: 'Obrigações contratuais', esquema: esquemaObrigacaoContratual },
  documento_emitido: { rotulo: 'Documentos emitidos', esquema: esquemaDocumentoEmitido },
  programacao_financeira: { rotulo: 'Programações financeiras', esquema: esquemaProgramacaoFinanceira },
  relacao_adesao: { rotulo: 'Relações de adesão', esquema: esquemaRelacaoAdesao },
  renovacao_decisao: { rotulo: 'Decisões de renovação', esquema: esquemaRenovacaoDecisao },
  encerramento_contrato: { rotulo: 'Encerramentos', esquema: esquemaEncerramentoContrato },
  entidade_socias: { rotulo: 'Entidades de sócias', esquema: esquemaEntidadeSocias },
  entidade_licenciante: { rotulo: 'Licenciantes das entidades', esquema: esquemaEntidadeLicenciante },
} as const satisfies Record<string, { rotulo: string; esquema: z.ZodType }>;

export const NOMES_TABELAS_F1 = Object.keys(TABELAS_F1) as (keyof typeof TABELAS_F1)[];

/** Ficam fora da contagem de cadastros (`dominio/dados.ts`): são partes de outro registro ou texto-base do sistema. */
export const TABELAS_F1_FORA_DA_CONTAGEM = ['documento_legal_versao', 'validacao', 'tratamento_ferramenta', 'clausula_versao', 'modelo_documento', 'modelo_versao', 'oportunidade_produto', 'oportunidade_contato', 'oportunidade_participante', 'proposta_versao', 'proposta_item', 'contrato_contato', 'contrato_versao', 'contrato_signatario', 'item_contrato', 'regra_prazo', 'evento_contrato', 'obrigacao_contratual', 'documento_emitido', 'programacao_financeira', 'renovacao_decisao', 'encerramento_contrato', 'entidade_socias', 'entidade_licenciante'] as const;
