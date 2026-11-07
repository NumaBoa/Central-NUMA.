/** Pendência navegável (T10.05 e T11.04): o que falta, o que bloqueia e a etapa onde corrigir. */
export type Pendencia = {
  id: string;
  mensagem: string;
  tipo: 'bloqueia' | 'aviso';
  /** O que fica bloqueado: "emissão final", "aprovação", "assinatura". */
  bloqueia?: string;
  /** Etapa do assistente onde corrigir. */
  etapa?: string;
  /** Fora do assistente, como a configuração do produto ou a entidade. */
  href?: string;
};
