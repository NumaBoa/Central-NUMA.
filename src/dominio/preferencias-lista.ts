/**
 * Preferências das listas (02 §5, P1): colunas e visões salvas, por pessoa. Ficam em `meta`, que é
 * deste navegador; na etapa com servidor, vão para `pessoa.preferencias`.
 */
import { ErroDeRegra } from '@/dados/erros';
import { gravarMeta, lerMeta, type Meta, type PreferenciaDaLista, type VisaoSalva } from '@/dados/meta';
import { gerarUuid } from '@/lib/ids';
import { normalizarTexto } from './duplicidade';

export type { VisaoSalva };

const chave = (pessoaId: string, lista: string) => `${pessoaId}:${lista}`;
const VAZIA: PreferenciaDaLista = { colunas: null, visoes: [] };

export const colunasDaPreferencia = (meta: Pick<Meta, 'listas'>, pessoaId: string, lista: string): readonly string[] | null => meta.listas[chave(pessoaId, lista)]?.colunas ?? null;
export const visoesDaPreferencia = (meta: Pick<Meta, 'listas'>, pessoaId: string, lista: string): readonly VisaoSalva[] => meta.listas[chave(pessoaId, lista)]?.visoes ?? [];

function mudar(pessoaId: string, lista: string, parcial: Partial<PreferenciaDaLista>) {
  const { listas } = lerMeta();
  const atual = listas[chave(pessoaId, lista)] ?? VAZIA;
  gravarMeta({ listas: { ...listas, [chave(pessoaId, lista)]: { ...atual, ...parcial } } });
}

export function salvarColunas(pessoaId: string, lista: string, colunas: readonly string[]) {
  mudar(pessoaId, lista, { colunas: [...colunas] });
}

export function salvarVisao(pessoaId: string, lista: string, { nome, filtros, colunas }: Pick<VisaoSalva, 'nome' | 'filtros' | 'colunas'>): VisaoSalva {
  const limpo = nome.trim();
  if (!limpo) throw new ErroDeRegra('Dê um nome para a visão.');
  const visoes = visoesDaPreferencia(lerMeta(), pessoaId, lista);
  if (visoes.some((visao) => normalizarTexto(visao.nome) === normalizarTexto(limpo))) throw new ErroDeRegra('Já existe uma visão com esse nome.');
  const nova: VisaoSalva = { id: gerarUuid(), nome: limpo, filtros, colunas };
  mudar(pessoaId, lista, { visoes: [...visoes, nova] });
  return nova;
}

export function removerVisao(pessoaId: string, lista: string, id: string) {
  mudar(pessoaId, lista, { visoes: visoesDaPreferencia(lerMeta(), pessoaId, lista).filter((visao) => visao.id !== id) });
}
