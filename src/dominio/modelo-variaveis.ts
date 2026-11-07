/** Dicionário de variáveis (19 §6): a lista ao lado do editor (T09.06 e T09.07) e o que a validação confere. */

export type VariavelDoDicionario = { origem: string; formato: string; grupo: string };

const de = (grupo: string, origem: string, nomes: readonly string[], formato = 'texto'): [string, VariavelDoDicionario][] => nomes.map((nome) => [nome, { origem, formato, grupo }]);

const PRODUTO_CONTRATO = ['diferencas_modalidades', 'email_contato', 'prazo_reembolso_dias', 'aviso_alteracao_dias', 'aviso_renovacao_anual_dias', 'aviso_manutencao_horas', 'aviso_suboperador_dias', 'prazo_encaminhar_titular_dias', 'prazo_aviso_incidente_horas', 'prazo_reativacao_horas', 'aviso_resilicao_dias', 'prazo_cura_dias', 'aviso_cessao_dias', 'prazo_exportacao_dias', 'prazo_exclusao_dias', 'prazo_expurgo_backup_dias', 'formatos_exportacao', 'categorias_dados_operador', 'categorias_titulares', 'categorias_dados_controlador', 'provedor_infraestrutura', 'local_armazenamento', 'transferencia_internacional_texto', 'medidas_seguranca', 'backup_frequencia', 'backup_retencao_dias', 'procedimento_recuperacao', 'canal_privacidade', 'canal_incidentes'].map((campo) => `produto.contrato.${campo}`);

export const DICIONARIO_VARIAVEIS: Readonly<Record<string, VariavelDoDicionario>> = Object.fromEntries([
  ...de('Modelo', 'Modelo (T09.07)', ['modelo.codigo', 'modelo.versao']),
  ...de('Contrato', 'Contrato (T11.14)', ['contrato.codigo', 'contrato.data_inicio', 'contrato.data_emissao_extenso', 'contrato.periodicidade', 'contrato.periodicidade_texto', 'contrato.valor_formatado', 'contrato.total_periodo_formatado', 'contrato.condicao_especial.valor_formatado', 'contrato.condicao_especial.duracao_texto', 'contrato.condicao_especial.motivo', 'contrato.modalidades_texto', 'contrato.canal_cobranca', 'contrato.gateway_nome', 'contrato.forma_pagamento_texto', 'contrato.vencimento_texto', 'contrato.teste_dias', 'contrato.garantia_dias', 'contrato.multa_atraso_pct', 'contrato.juros_mes_pct', 'contrato.suspensao_dias_atraso', 'contrato.aviso_suspensao_dias', 'contrato.cancelamento_dias_atraso', 'contrato.reajuste_indice', 'contrato.reajuste_aviso_dias', 'contrato.fidelidade_meses', 'contrato.fidelidade_motivo', 'contrato.multa_rescisoria_texto', 'contrato.limite_responsabilidade_meses', 'contrato.foro', 'contrato.local', 'contrato.forma_assinatura', 'contrato.plataforma_assinatura', 'contrato.testemunha1.nome', 'contrato.testemunha1.cpf', 'contrato.testemunha2.nome', 'contrato.testemunha2.cpf', 'contrato.titulo', 'contrato.familia_texto', 'contrato.vigencia_texto']),
  ...de('Partes', 'Entidade (T02.05)', ['entidade.tipo', 'entidade.nome', 'entidade.marca_comercial', 'entidade.razao_social', 'entidade.cnpj', 'entidade.endereco', 'entidade.representante.nome', 'entidade.representante.cargo', 'entidade.representante.cpf']),
  ...de('Partes', 'Contraparte (T02.06)', ['contraparte.tipo', 'contraparte.nome', 'contraparte.razao_social', 'contraparte.cpf', 'contraparte.cnpj', 'contraparte.endereco', 'contraparte.email', 'contraparte.representante.nome', 'contraparte.representante.cpf', 'contraparte.nome_ou_razao', 'contraparte.documento']),
  ...de('Produto', 'Produto (T07.10)', ['produto.nome', 'produto.nome_maiusculo', 'produto.descricao_contratual', 'produto.funcoes_de_apoio', 'produto.plano_apos_teste', 'produto.url_termos', 'produto.url_privacidade', 'produto.url_ajuda', ...PRODUTO_CONTRATO]),
  ...de('Oferta', 'Oferta (T07.04)', ['oferta.nome', 'oferta.descricao', 'oferta.exclusoes', 'oferta.regras_uso', 'oferta.suporte.canal', 'oferta.suporte.horario', 'oferta.suporte.prazo_critico', 'oferta.suporte.prazo_normal', 'oferta.disponibilidade_meta', 'oferta.disponibilidade_compensacao']),
  ...de('Organização', 'Configurações (T02.01)', ['organizacao.encarregado_texto']),
  ...de('Proposta', 'Proposta (T10.05)', ['proposta.codigo', 'proposta.versao', 'proposta.validade', 'proposta.escopo_incluido', 'proposta.escopo_excluido', 'proposta.premissas', 'proposta.dependencias', 'proposta.forma_pagamento', 'proposta.vencimentos', 'proposta.prazo_entrega', 'proposta.reajuste', 'proposta.observacoes', 'proposta.recursos_previstos']),
  ...de('Documento', 'Calculado', ['totais_texto', 'hoje_extenso']),
]);

/** O que o sistema preenche em cada listas de `[PARA CADA]`. */
export const LISTAS_DO_DICIONARIO: Readonly<Record<string, readonly string[]>> = {
  itens: ['descricao', 'quantidade', 'valor_formatado', 'periodicidade_texto'],
  assinaturas: ['nome', 'papel'],
  'contrato.adicionais': ['nome', 'quantidade', 'valor_formatado'],
  'contrato.signatarios_licenciante': ['nome', 'cpf', 'papel'],
  'entidade.licenciantes': ['nome_civil', 'nacionalidade', 'cpf', 'endereco', 'email', 'responsabilidade_pct'],
  'oferta.recursos': ['nome', 'incluido_texto', 'limite_texto'],
  'produto.contrato.suboperadores': ['nome', 'finalidade', 'pais'],
};

export function variavelConhecida(nome: string): boolean {
  return Object.hasOwn(DICIONARIO_VARIAVEIS, nome);
}

export const GRUPOS_DE_VARIAVEIS = [...new Set(Object.values(DICIONARIO_VARIAVEIS).map((variavel) => variavel.grupo))];

export function variaveisDoGrupo(grupo: string): string[] {
  return Object.entries(DICIONARIO_VARIAVEIS)
    .filter(([, variavel]) => variavel.grupo === grupo)
    .map(([nome]) => nome);
}
