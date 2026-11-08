/**
 * O que o M12 acrescenta aos registros do Meu dia (M03). Sem importações de propósito, como `meu-dia-f1.ts`:
 * é lido por `atividades.ts` e `atividades-painel.ts`, e qualquer importação aqui criaria um ciclo.
 */

/** Ações dos alertas (RN-03.12): o botão leva ao registro de origem. */
export const ACOES_DE_ALERTA_M12: Readonly<Record<string, { rotulo: string; caminho: (origemId: string) => string }>> = {
  abrir_implantacao: { rotulo: 'Abrir implantação', caminho: (id) => `/operacao/${id}` },
  abrir_solicitacao: { rotulo: 'Abrir solicitação', caminho: (id) => `/operacao/suporte/${id}` },
};

/** Filtro "Origem" do Meu dia. */
export const ROTULOS_ORIGEM_ALERTA_M12: Readonly<Record<string, string>> = { implantacao: 'Operação', solicitacao_suporte: 'Operação' };

/** Registros que uma atividade pode vincular (T03.02): as tarefas da implantação são atividades com esse vínculo (RN-12.04). */
export const REGISTROS_VINCULAVEIS_M12: Readonly<Record<string, { rotulo: string; href: (id: string) => string }>> = {
  implantacao: { rotulo: 'Implantação', href: (id) => `/operacao/${id}` },
  solicitacao_suporte: { rotulo: 'Solicitação de suporte', href: (id) => `/operacao/suporte/${id}` },
};

/** Tipo do registro → origem dos alertas dele, para a aba de atividades das fichas. */
export const ORIGEM_DO_ALERTA_M12: Readonly<Record<string, string>> = { implantacao: 'implantacao', solicitacao_suporte: 'solicitacao_suporte' };
