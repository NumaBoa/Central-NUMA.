/**
 * O conteúdo dos manuais: uma fonte só, lida pela tela de ajuda, pela busca e pelo PDF. Texto de quem usa a
 * Central, sem nomes de tabelas, componentes ou bibliotecas. Nos textos, `**assim**` marca o nome de um botão,
 * campo ou tela, do jeito que aparece no sistema.
 */

/** O que a pessoa pode fazer hoje com o que o artigo explica. */
export type Disponibilidade =
  | { tipo: 'disponivel' }
  /** Funciona, desde que algo seja verdade; `condicao` diz o quê, em uma frase. */
  | { tipo: 'condicao'; condicao: string }
  /** Ainda não existe. `quando` diz em que fase ou etapa está previsto. Nunca oferece ação. */
  | { tipo: 'futuro'; quando: string };

/** Um procedimento sempre com a mesma estrutura (pedido de Kimberly em 08/11/2026). */
export type Procedimento = {
  tipo: 'procedimento';
  titulo?: string;
  objetivo: string;
  antes: readonly string[];
  caminho: string;
  passos: readonly string[];
  resultado: string;
  cuidados?: readonly string[];
};

export type Bloco =
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'lista'; itens: readonly string[] }
  /** Significado de campos, situações e indicadores. */
  | { tipo: 'termos'; titulo?: string; itens: readonly { termo: string; significado: string }[] }
  | Procedimento
  /** Sempre identificado como ilustrativo, com dados fictícios. */
  | { tipo: 'exemplo'; texto: string }
  | { tipo: 'atencao'; texto: string }
  | { tipo: 'perguntas'; itens: readonly { pergunta: string; resposta: string }[] };

export type Artigo = {
  /** Vai no endereço: só letras minúsculas, números e hífen. Não muda depois de publicado, para não quebrar links. */
  id: string;
  titulo: string;
  /** Uma ou duas frases: aparece na lista do manual e na busca. */
  resumo: string;
  /** O assunto do manual onde o artigo fica. */
  assunto: string;
  /** Palavras que a pessoa pode usar para procurar, inclusive as que não aparecem no texto. */
  palavrasChave: readonly string[];
  disponibilidade: Disponibilidade;
  /** "Ir para essa ação": só quando a ação existe. Abrir o atalho não executa nada. */
  acao?: { rotulo: string; href: string };
  blocos: readonly Bloco[];
};

export type Assunto = { id: string; titulo: string };

export type Manual = {
  /** Vai no endereço (`/ajuda/meu-dia`). */
  slug: string;
  /** "Meu dia", como no menu. */
  nome: string;
  /** "do Meu dia", "da Operação": para "Manual do Meu dia". */
  doModulo: string;
  /** "ao Meu dia", "à Operação": para "Voltar ao Meu dia". */
  aoModulo: string;
  /** Nome do arquivo para download, sem a extensão: `Manual-Meu-Dia-Numa`. */
  arquivo: string;
  versao: string;
  /** aaaa-mm-dd. */
  atualizadoEm: string;
  /** Onde fica o módulo, para "Voltar ao módulo". */
  telaDoModulo: string;
  introducao: string;
  assuntos: readonly Assunto[];
  artigos: readonly Artigo[];
};
