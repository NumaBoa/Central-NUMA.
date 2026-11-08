/**
 * A busca nos manuais ("Como fazer"), ao lado da busca de registros (T13.03). Procura no título, nas palavras-chave,
 * no resumo e no texto, e entende termos equivalentes ("pagar conta", "registrar pagamento", "dar baixa").
 * Conteúdo escrito e revisado: não há IA gerando respostas.
 */
import { MODULOS_DOS_MANUAIS } from '@/ajuda/modulos';
import { caminhoDoArtigo, semMarcas, textoDoArtigo } from '@/ajuda/texto';
import type { Artigo, Disponibilidade, Manual } from '@/ajuda/tipos';
import { normalizarTexto } from './duplicidade';

/**
 * Grupos de termos que querem dizer a mesma coisa para quem procura. Cada grupo vale nos dois sentidos.
 * Para acrescentar um termo, basta pô-lo no grupo: todos os manuais passam a responder por ele.
 */
export const TERMOS_EQUIVALENTES: readonly (readonly string[])[] = [
  ['pagar', 'pagamento', 'pagar conta', 'registrar pagamento', 'dar baixa', 'baixa', 'quitar', 'quitado'],
  ['reembolso', 'reembolsar', 'devolver dinheiro', 'ressarcir'],
  ['aporte', 'colocar dinheiro', 'investir na empresa'],
  ['atividade', 'tarefa', 'afazer', 'pendencia', 'to-do', 'todo'],
  ['adiar', 'remarcar', 'mudar prazo', 'postergar', 'prorrogar', 'nova data'],
  ['concluir', 'finalizar', 'terminar', 'fechar', 'feito', 'pronto'],
  ['cancelar', 'excluir', 'apagar', 'remover', 'deletar'],
  ['lembrete', 'lembrar', 'alarme', 'aviso'],
  ['rotina', 'recorrencia', 'recorrente', 'repetir', 'repeticao', 'periodica'],
  ['bloquear', 'bloqueada', 'travada', 'impedida', 'impedimento'],
  ['aguardando', 'esperando', 'retorno', 'resposta', 'cobrar'],
  ['responsavel', 'dono', 'atribuir', 'delegar', 'passar para'],
  ['historico', 'concluidas', 'canceladas', 'antigas'],
  ['filtrar', 'filtro', 'procurar', 'buscar', 'achar', 'encontrar'],
  ['comentario', 'comentar', 'mencionar', 'mencao', 'arroba'],
  ['checklist', 'subtarefas', 'itens', 'lista de verificacao'],
  ['vincular', 'vinculo', 'relacionar', 'ligar'],
  ['reabrir', 'desfazer', 'voltar atras', 'restaurar'],
  ['resumo diario', 'e-mail', 'email'],
  ['alerta', 'aviso automatico', 'notificacao'],
  ['login', 'entrar', 'senha', 'usuario', 'voce e'],
  ['arquivo', 'anexo', 'drive', 'documento'],
];

export type ResultadoDaAjuda = {
  id: string;
  titulo: string;
  resumo: string;
  modulo: string;
  href: string;
  disponibilidade: Disponibilidade;
  acao: Artigo['acao'] | null;
};

const POR_BUSCA = 6;

type Indexado = { manual: Manual; artigo: Artigo; titulo: string; chaves: string; resumo: string; corpo: string };

let indice: Indexado[] | null = null;

/** O índice é montado uma vez: o conteúdo só muda com uma versão nova da Central. */
function indiceDosManuais(): Indexado[] {
  indice ??= MODULOS_DOS_MANUAIS.flatMap(({ manual }) =>
    manual
      ? manual.artigos.map((artigo) => ({
          manual,
          artigo,
          titulo: normalizarTexto(semMarcas(artigo.titulo)),
          chaves: normalizarTexto(artigo.palavrasChave.join(' | ')),
          resumo: normalizarTexto(semMarcas(artigo.resumo)),
          corpo: normalizarTexto(textoDoArtigo(artigo)),
        }))
      : [],
  );
  return indice;
}

const GRUPOS = TERMOS_EQUIVALENTES.map((grupo) => grupo.map(normalizarTexto));

/** O termo e os equivalentes dele. Vale para palavras soltas e para expressões que estão na busca. */
function variantes(termo: string): string[] {
  const iguais = GRUPOS.filter((grupo) => grupo.includes(termo)).flat();
  return [...new Set([termo, ...iguais])];
}

/** Expressões de várias palavras que aparecem na busca ("dar baixa") valem como um termo só. */
function termosDaBusca(busca: string): string[] {
  let resto = ` ${busca} `;
  const expressoes: string[] = [];
  for (const expressao of GRUPOS.flat().filter((termo) => termo.includes(' ')).sort((a, b) => b.length - a.length)) {
    if (resto.includes(` ${expressao} `)) {
      expressoes.push(expressao);
      resto = resto.replace(` ${expressao} `, ' ');
    }
  }
  const palavras = resto.split(/\s+/).filter((palavra) => palavra.length >= 2 && !PALAVRAS_VAZIAS.has(palavra));
  return [...expressoes, ...palavras];
}

const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'um', 'uma', 'o', 'a', 'os', 'as', 'e', 'em', 'no', 'na', 'como', 'para', 'por', 'que', 'com', 'meu', 'minha', 'eu']);

/** Raiz curta para pegar plural e flexões simples: "atividades" acha "atividade". */
const contem = (alvo: string, termo: string) => alvo.includes(termo) || (termo.length > 5 && alvo.includes(termo.slice(0, -1)));

function pontuar(item: Indexado, termos: readonly string[]): number {
  let total = 0;
  for (const termo of termos) {
    let melhor = 0;
    for (const variante of variantes(termo)) {
      const peso = variante === termo ? 1 : 0.8;
      if (contem(item.titulo, variante)) melhor = Math.max(melhor, 5 * peso);
      else if (contem(item.chaves, variante)) melhor = Math.max(melhor, 4 * peso);
      else if (contem(item.resumo, variante)) melhor = Math.max(melhor, 3 * peso);
      else if (contem(item.corpo, variante)) melhor = Math.max(melhor, 1 * peso);
    }
    // Todo termo precisa aparecer de algum jeito: busca com duas palavras não traz o que só tem uma.
    if (!melhor) return 0;
    total += melhor;
  }
  return total;
}

/** "Como fazer": os artigos que respondem à busca, do mais certeiro para o menos. */
export function buscarNaAjuda(busca: string, limite = POR_BUSCA): { itens: ResultadoDaAjuda[]; total: number } {
  const termos = termosDaBusca(normalizarTexto(busca).trim());
  if (!termos.length) return { itens: [], total: 0 };
  const achados = indiceDosManuais()
    .map((item) => ({ item, pontos: pontuar(item, termos) }))
    .filter(({ pontos }) => pontos > 0)
    // Os disponíveis antes do planejamento, com a mesma pontuação.
    .sort((a, b) => b.pontos - a.pontos || Number(a.item.artigo.disponibilidade.tipo === 'futuro') - Number(b.item.artigo.disponibilidade.tipo === 'futuro'));
  return {
    total: achados.length,
    itens: achados.slice(0, limite).map(({ item: { manual, artigo } }) => ({
      id: `${manual.slug}/${artigo.id}`,
      titulo: artigo.titulo,
      resumo: semMarcas(artigo.resumo),
      modulo: manual.nome,
      href: caminhoDoArtigo(manual, artigo),
      disponibilidade: artigo.disponibilidade,
      // Recurso futuro nunca oferece ação (pedido de 08/11/2026).
      acao: artigo.disponibilidade.tipo === 'futuro' ? null : (artigo.acao ?? null),
    })),
  };
}
