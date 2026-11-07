import type { Repositorio } from './repositorio';
import { criarRepositorioLocal } from './repositorio-local';
import { esquemaOportunidade, esquemaOportunidadeContato, esquemaOportunidadeParticipante, esquemaOportunidadeProduto, esquemaProposta, esquemaPropostaItem, esquemaPropostaVersao, esquemaViabilidade, type Oportunidade, type OportunidadeContato, type OportunidadeParticipante, type OportunidadeProduto, type Proposta, type PropostaItem, type PropostaVersao, type Viabilidade } from './tipos/comercial';
import { esquemaContrato, esquemaContratoContato, esquemaContratoSignatario, esquemaContratoVersao, esquemaDocumentoEmitido, esquemaEncerramentoContrato, esquemaEntidadeLicenciante, esquemaEntidadeSocias, esquemaEventoContrato, esquemaItemContrato, esquemaObrigacaoContratual, esquemaProgramacaoFinanceira, esquemaRegraPrazo, esquemaRelacaoAdesao, esquemaRenovacaoDecisao, type Contrato, type ContratoContato, type ContratoSignatario, type ContratoVersao, type DocumentoEmitido, type EncerramentoContrato, type EntidadeLicenciante, type EntidadeSocias, type EventoContrato, type ItemContrato, type ObrigacaoContratual, type ProgramacaoFinanceira, type RegraPrazo, type RelacaoAdesao, type RenovacaoDecisao } from './tipos/contrato';
import { esquemaClausula, esquemaClausulaVersao, esquemaDocumentoLegal, esquemaDocumentoLegalVersao, esquemaModeloDocumento, esquemaModeloVersao, esquemaSolicitacaoTitular, esquemaTratamentoDados, esquemaTratamentoFerramenta, esquemaValidacao, type Clausula, type ClausulaVersao, type DocumentoLegal, type DocumentoLegalVersao, type ModeloDocumento, type ModeloVersao, type SolicitacaoTitular, type TratamentoDados, type TratamentoFerramenta, type Validacao } from './tipos/legal';

export type RepositoriosF1 = {
  documento_legal: Repositorio<DocumentoLegal>;
  documento_legal_versao: Repositorio<DocumentoLegalVersao>;
  validacao: Repositorio<Validacao>;
  tratamento_dados: Repositorio<TratamentoDados>;
  tratamento_ferramenta: Repositorio<TratamentoFerramenta>;
  solicitacao_titular: Repositorio<SolicitacaoTitular>;
  clausula: Repositorio<Clausula>;
  clausula_versao: Repositorio<ClausulaVersao>;
  modelo_documento: Repositorio<ModeloDocumento>;
  modelo_versao: Repositorio<ModeloVersao>;
  oportunidade: Repositorio<Oportunidade>;
  oportunidade_produto: Repositorio<OportunidadeProduto>;
  oportunidade_contato: Repositorio<OportunidadeContato>;
  oportunidade_participante: Repositorio<OportunidadeParticipante>;
  viabilidade: Repositorio<Viabilidade>;
  proposta: Repositorio<Proposta>;
  proposta_versao: Repositorio<PropostaVersao>;
  proposta_item: Repositorio<PropostaItem>;
  contrato: Repositorio<Contrato>;
  contrato_contato: Repositorio<ContratoContato>;
  contrato_versao: Repositorio<ContratoVersao>;
  contrato_signatario: Repositorio<ContratoSignatario>;
  item_contrato: Repositorio<ItemContrato>;
  regra_prazo: Repositorio<RegraPrazo>;
  evento_contrato: Repositorio<EventoContrato>;
  obrigacao_contratual: Repositorio<ObrigacaoContratual>;
  documento_emitido: Repositorio<DocumentoEmitido>;
  programacao_financeira: Repositorio<ProgramacaoFinanceira>;
  relacao_adesao: Repositorio<RelacaoAdesao>;
  renovacao_decisao: Repositorio<RenovacaoDecisao>;
  encerramento_contrato: Repositorio<EncerramentoContrato>;
  entidade_socias: Repositorio<EntidadeSocias>;
  entidade_licenciante: Repositorio<EntidadeLicenciante>;
};

export const repositoriosF1: RepositoriosF1 = {
  documento_legal: criarRepositorioLocal({ tabela: 'documento_legal', esquema: esquemaDocumentoLegal, prefixoCodigo: 'DLG' }),
  documento_legal_versao: criarRepositorioLocal({ tabela: 'documento_legal_versao', esquema: esquemaDocumentoLegalVersao }),
  validacao: criarRepositorioLocal({ tabela: 'validacao', esquema: esquemaValidacao, prefixoCodigo: 'VAL' }),
  tratamento_dados: criarRepositorioLocal({ tabela: 'tratamento_dados', esquema: esquemaTratamentoDados }),
  tratamento_ferramenta: criarRepositorioLocal({ tabela: 'tratamento_ferramenta', esquema: esquemaTratamentoFerramenta }),
  solicitacao_titular: criarRepositorioLocal({ tabela: 'solicitacao_titular', esquema: esquemaSolicitacaoTitular, prefixoCodigo: 'SOL' }),
  clausula: criarRepositorioLocal({ tabela: 'clausula', esquema: esquemaClausula }),
  clausula_versao: criarRepositorioLocal({ tabela: 'clausula_versao', esquema: esquemaClausulaVersao }),
  modelo_documento: criarRepositorioLocal({ tabela: 'modelo_documento', esquema: esquemaModeloDocumento, prefixoCodigo: 'MOD' }),
  modelo_versao: criarRepositorioLocal({ tabela: 'modelo_versao', esquema: esquemaModeloVersao }),
  oportunidade: criarRepositorioLocal({ tabela: 'oportunidade', esquema: esquemaOportunidade, prefixoCodigo: 'OPO' }),
  oportunidade_produto: criarRepositorioLocal({ tabela: 'oportunidade_produto', esquema: esquemaOportunidadeProduto }),
  oportunidade_contato: criarRepositorioLocal({ tabela: 'oportunidade_contato', esquema: esquemaOportunidadeContato }),
  oportunidade_participante: criarRepositorioLocal({ tabela: 'oportunidade_participante', esquema: esquemaOportunidadeParticipante }),
  viabilidade: criarRepositorioLocal({ tabela: 'viabilidade', esquema: esquemaViabilidade }),
  proposta: criarRepositorioLocal({ tabela: 'proposta', esquema: esquemaProposta, prefixoCodigo: 'PRP' }),
  proposta_versao: criarRepositorioLocal({ tabela: 'proposta_versao', esquema: esquemaPropostaVersao }),
  proposta_item: criarRepositorioLocal({ tabela: 'proposta_item', esquema: esquemaPropostaItem }),
  contrato: criarRepositorioLocal({ tabela: 'contrato', esquema: esquemaContrato, prefixoCodigo: 'CTR' }),
  contrato_contato: criarRepositorioLocal({ tabela: 'contrato_contato', esquema: esquemaContratoContato }),
  contrato_versao: criarRepositorioLocal({ tabela: 'contrato_versao', esquema: esquemaContratoVersao }),
  contrato_signatario: criarRepositorioLocal({ tabela: 'contrato_signatario', esquema: esquemaContratoSignatario }),
  item_contrato: criarRepositorioLocal({ tabela: 'item_contrato', esquema: esquemaItemContrato }),
  regra_prazo: criarRepositorioLocal({ tabela: 'regra_prazo', esquema: esquemaRegraPrazo }),
  evento_contrato: criarRepositorioLocal({ tabela: 'evento_contrato', esquema: esquemaEventoContrato }),
  obrigacao_contratual: criarRepositorioLocal({ tabela: 'obrigacao_contratual', esquema: esquemaObrigacaoContratual }),
  documento_emitido: criarRepositorioLocal({ tabela: 'documento_emitido', esquema: esquemaDocumentoEmitido, prefixoCodigo: 'DOC' }),
  programacao_financeira: criarRepositorioLocal({ tabela: 'programacao_financeira', esquema: esquemaProgramacaoFinanceira }),
  relacao_adesao: criarRepositorioLocal({ tabela: 'relacao_adesao', esquema: esquemaRelacaoAdesao, prefixoCodigo: 'ADS' }),
  renovacao_decisao: criarRepositorioLocal({ tabela: 'renovacao_decisao', esquema: esquemaRenovacaoDecisao }),
  encerramento_contrato: criarRepositorioLocal({ tabela: 'encerramento_contrato', esquema: esquemaEncerramentoContrato }),
  entidade_socias: criarRepositorioLocal({ tabela: 'entidade_socias', esquema: esquemaEntidadeSocias }),
  entidade_licenciante: criarRepositorioLocal({ tabela: 'entidade_licenciante', esquema: esquemaEntidadeLicenciante }),
};
