/** Seletor global de contexto (02 §4 e CA-02.03): os produtos ativos, mais as duas visões da Numa. */
import { repositorios } from '@/dados/repositorios';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { tintaDaCor } from './cores';

export type Contexto = {
  id: string;
  nome: string;
  /** Forma curta para a pílula do celular (18 §10.4). */
  curto?: string;
  provisorio?: boolean;
  cor: string;
  tinta: string;
};

export const ID_CONSOLIDADA = 'consolidada';
export const ID_INSTITUCIONAL = 'institucional';

const COR_DA_NUMA = 'var(--c-numa)';
const TINTA_DA_NUMA = 'var(--t-numa)';

function visoesDaNuma(marca?: Marca): Contexto[] {
  const cor = marca?.cor_hex ?? COR_DA_NUMA;
  const tinta = marca ? tintaDaCor(marca.cor_hex) : TINTA_DA_NUMA;
  return [
    { id: ID_CONSOLIDADA, nome: 'Numa consolidada', cor, tinta },
    { id: ID_INSTITUCIONAL, nome: 'Numa institucional', cor, tinta },
  ];
}

/** Enquanto os dados carregam, ou se estiverem danificados. */
export const CONTEXTOS_SEM_DADOS: readonly Contexto[] = visoesDaNuma();

/** "Sobrevivência Urbana" vira "S. Urbana" na pílula do celular; nome de uma palavra fica igual. */
export function nomeCurto(nome: string): string | undefined {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 1 ? `${partes.slice(0, -1).map((parte) => `${parte[0]}.`).join(' ')} ${partes.at(-1)}` : undefined;
}

export function montarContextos(marcas: readonly Marca[], produtos: readonly Produto[]): Contexto[] {
  const porId = new Map(marcas.map((marca) => [marca.id, marca]));
  const ativos = produtos.filter((produto) => produto.situacao === 'ativo' && !produto.arquivado_em);
  return [
    ...visoesDaNuma(marcas.find((marca) => marca.institucional)),
    ...ativos.flatMap((produto) => {
      const marca = porId.get(produto.marca_id);
      if (!marca) return [];
      return [{ id: produto.id, nome: produto.nome, curto: nomeCurto(produto.nome), provisorio: marca.provisorio, cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }];
    }),
  ];
}

export function acharContexto(contextos: readonly Contexto[], id: string): Contexto {
  return contextos.find((contexto) => contexto.id === id) ?? contextos[0] ?? CONTEXTOS_SEM_DADOS[0]!;
}

export async function carregarContextos(): Promise<Contexto[]> {
  const [marcas, produtos] = await Promise.all([repositorios.marca.listar(), repositorios.produto.listar()]);
  return montarContextos(marcas, produtos);
}
