/**
 * O que o M06 acrescenta aos registros do Meu dia (M03). Sem importações de propósito, como `meu-dia-f1.ts`: é lido por
 * `atividades.ts` e `atividades-painel.ts`, e qualquer importação aqui criaria um ciclo.
 */

export const ORIGEM_TRANSFERENCIA = 'transferencia';
export const ORIGEM_MARCA_PRAZO = 'marca_prazo';
export const ORIGEM_ACORDO = 'acordo_societario';
export const ORIGEM_OCORRENCIA = 'obrigacao_ocorrencia';
export const ORIGEM_CONSTITUICAO = 'constituicao_item';
export const ORIGEM_REUNIAO = 'reuniao';

/** Ações dos alertas (RN-03.12 e 05-M03 §5, linhas do M06). */
export const ACOES_DE_ALERTA_M06: Readonly<Record<string, { rotulo: string; caminho: (origemId: string) => string }>> = {
  registrar_transferencia: { rotulo: 'Registrar transferência', caminho: (id) => `/ferramentas/ativos/${id}?acao=transferir` },
  transferir_ferramenta: { rotulo: 'Abrir ferramenta', caminho: (id) => `/ferramentas/${id}` },
  abrir_processo_marca: { rotulo: 'Abrir processo', caminho: (id) => `/empresa/marcas?prazo=${id}` },
  abrir_acordo: { rotulo: 'Abrir acordo', caminho: (id) => `/empresa/acordos/${id}` },
  abrir_obrigacao: { rotulo: 'Abrir obrigação', caminho: (id) => `/empresa/obrigacoes?ocorrencia=${id}` },
};

/** Filtro "Origem" do Meu dia. */
export const ROTULOS_ORIGEM_ALERTA_M06: Readonly<Record<string, string>> = {
  [ORIGEM_TRANSFERENCIA]: 'Ativos a transferir',
  [ORIGEM_MARCA_PRAZO]: 'Marcas',
  [ORIGEM_ACORDO]: 'Acordos',
  [ORIGEM_OCORRENCIA]: 'Obrigações corporativas',
  [ORIGEM_CONSTITUICAO]: 'Constituição',
  [ORIGEM_REUNIAO]: 'Reuniões',
};

/** Registros que uma atividade pode vincular (T03.02). */
export const REGISTROS_VINCULAVEIS_M06: Readonly<Record<string, { rotulo: string; href: (id: string) => string }>> = {
  reuniao: { rotulo: 'Reunião', href: (id) => `/empresa/reunioes/${id}` },
  decisao: { rotulo: 'Decisão', href: (id) => `/empresa/decisoes/${id}` },
  acordo_societario: { rotulo: 'Acordo societário', href: (id) => `/empresa/acordos/${id}` },
  constituicao_item: { rotulo: 'Item da constituição', href: (id) => `/empresa/constituicao?item=${id}` },
  obrigacao_corporativa: { rotulo: 'Obrigação corporativa', href: (id) => `/empresa/obrigacoes/${id}` },
};

/** Tipo do registro → origem dos alertas dele, para a aba Atividades das fichas. */
export const ORIGEM_DO_ALERTA_M06: Readonly<Record<string, string>> = { acordo_societario: ORIGEM_ACORDO };
