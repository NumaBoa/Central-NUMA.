/** Erros da camada de dados, com mensagens em português que dizem o que fazer (RT-18). */
export type TipoErroDados = 'armazenamento' | 'leitura' | 'nao_encontrado' | 'validacao';

const MENSAGENS: Record<TipoErroDados, string> = {
  armazenamento: 'Não deu para salvar: o armazenamento deste navegador está cheio ou bloqueado. Seus dados continuam como estavam.',
  leitura: 'Não deu para ler os dados deste navegador. Importe um backup ou restaure os exemplos em Configurações › Dados.',
  nao_encontrado: 'Esse registro não existe mais.',
  validacao: 'Há dados inválidos neste registro. Confira os campos e tente de novo.',
};

export class ErroDeDados extends Error {
  readonly tipo: TipoErroDados;
  /** Detalhes técnicos para quem depura; nunca são mostrados na tela. */
  readonly detalhes: readonly string[];

  constructor(tipo: TipoErroDados, opcoes: { detalhes?: readonly string[]; cause?: unknown } = {}) {
    super(MENSAGENS[tipo], { cause: opcoes.cause });
    this.name = 'ErroDeDados';
    this.tipo = tipo;
    this.detalhes = opcoes.detalhes ?? [];
  }
}

/** Regra de negócio que barrou a ação. A mensagem já diz o que fazer e vai direto para a tela. */
export class ErroDeRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeRegra';
  }
}

/** Mensagem segura para a tela, seja qual for o erro (RT-18: nunca o erro técnico cru). */
export function mensagemDoErro(erro: unknown): string {
  return erro instanceof ErroDeDados || erro instanceof ErroDeRegra ? erro.message : 'Não deu para concluir agora. Seus dados continuam aqui; tente de novo.';
}
