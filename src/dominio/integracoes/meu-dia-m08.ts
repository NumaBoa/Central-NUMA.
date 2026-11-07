/**
 * O que o M08 acrescenta aos registros do Meu dia (M03). Sem importações de propósito, como `meu-dia-f1.ts`:
 * é lido por `atividades.ts` e `atividades-painel.ts`, e uma importação aqui criaria um ciclo.
 * Detalhes em `frente-m08/INTEGRACAO.md`.
 */

/** Ações dos alertas (RN-03.12): o botão leva ao registro de origem. */
export const ACOES_DE_ALERTA_M08: Readonly<Record<string, { rotulo: string; caminho: (origemId: string) => string }>> = {
  abrir_arquivo: { rotulo: 'Abrir na biblioteca', caminho: (id) => `/marketing/arquivos/${id}` },
  abrir_peca: { rotulo: 'Abrir a peça', caminho: (id) => `/marketing/conteudo?peca=${id}` },
};

/** Filtro "Origem" do Meu dia. */
export const ROTULOS_ORIGEM_ALERTA_M08: Readonly<Record<string, string>> = { arquivo: 'Biblioteca', peca_conteudo: 'Conteúdo' };

/** Registros que uma atividade pode vincular (T03.02). */
export const REGISTROS_VINCULAVEIS_M08: Readonly<Record<string, { rotulo: string; href: (id: string) => string }>> = {
  arquivo: { rotulo: 'Arquivo da biblioteca', href: (id) => `/marketing/arquivos/${id}` },
  campanha: { rotulo: 'Campanha', href: (id) => `/marketing/campanhas/${id}` },
  peca_conteudo: { rotulo: 'Peça de conteúdo', href: (id) => `/marketing/conteudo?peca=${id}` },
};

/** Tipo do registro → origem dos alertas dele, para a aba Atividades das fichas. */
export const ORIGEM_DO_ALERTA_M08: Readonly<Record<string, string>> = { arquivo: 'arquivo', peca_conteudo: 'peca_conteudo' };
