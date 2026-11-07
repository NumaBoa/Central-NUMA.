/**
 * O que M09, M10 e M11 acrescentam aos registros do Meu dia (M03). Sem importações de propósito: é lido por
 * `atividades.ts` e `atividades-painel.ts`, e qualquer importação aqui criaria um ciclo. Detalhes em
 * `frente-m09-m11/INTEGRACAO.md`.
 */

/** Ações dos alertas (RN-03.12): o botão leva à ação certa no módulo de origem. */
export const ACOES_DE_ALERTA_F1: Readonly<Record<string, { rotulo: string; caminho: (origemId: string) => string }>> = {
  revisar_documento_legal: { rotulo: 'Revisar', caminho: (id) => `/legal/documentos/${id}` },
  responder_titular: { rotulo: 'Responder', caminho: () => '/legal/privacidade/solicitacoes' },
  abrir_oportunidade: { rotulo: 'Abrir oportunidade', caminho: (id) => `/comercial/oportunidades/${id}` },
  abrir_proposta: { rotulo: 'Renovar validade', caminho: (id) => `/comercial/propostas/${id}` },
  registrar_assinatura: { rotulo: 'Registrar assinatura', caminho: (id) => `/contratos/${id}` },
  decidir_renovacao: { rotulo: 'Decidir renovação', caminho: () => '/contratos/renovacao' },
  registrar_cumprimento: { rotulo: 'Registrar cumprimento', caminho: (id) => `/contratos/${id}?aba=obrigacoes` },
};

/** Filtro "Origem" do Meu dia. */
export const ROTULOS_ORIGEM_ALERTA_F1: Readonly<Record<string, string>> = { documento_legal: 'Legal', solicitacao_titular: 'Legal', proposta: 'Comercial', contrato: 'Contratos', obrigacao_contratual: 'Contratos' };

/** Registros que uma atividade pode vincular (T03.02), inclusive a próxima ação da oportunidade (RN-10.02). */
export const REGISTROS_VINCULAVEIS_F1: Readonly<Record<string, { rotulo: string; href: (id: string) => string }>> = {
  documento_legal: { rotulo: 'Documento legal', href: (id) => `/legal/documentos/${id}` },
  oportunidade: { rotulo: 'Oportunidade', href: (id) => `/comercial/oportunidades/${id}` },
  proposta: { rotulo: 'Proposta', href: (id) => `/comercial/propostas/${id}` },
  contrato: { rotulo: 'Contrato', href: (id) => `/contratos/${id}` },
};

/** Tipo do registro → origem dos alertas dele, para a aba Atividades das fichas. */
export const ORIGEM_DO_ALERTA_F1: Readonly<Record<string, string>> = { documento_legal: 'documento_legal', proposta: 'proposta', contrato: 'contrato' };
