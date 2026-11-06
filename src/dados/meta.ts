/**
 * `numa-central:v1:meta` (02 §0.3): versão dos dados, última rotina, pessoa atual, contadores de
 * código e preferências deste navegador.
 */
import { CHAVE_META, driver } from './armazenamento';

export { CHAVE_META };

export type Meta = {
  /** `null` até a primeira carga dos dados. */
  versao_dados: number | null;
  ultima_rotina_em: string | null;
  /** Último número usado por prefixo e ano: `{ 'ATV-2026': 42 }` (RT-01). */
  contadores: Readonly<Record<string, number>>;
  pessoa_atual_id: string | null;
  contexto_id: string;
  ultima_abertura: string | null;
  menu_recolhido: boolean;
};

export const META_INICIAL: Meta = {
  versao_dados: null,
  ultima_rotina_em: null,
  contadores: {},
  pessoa_atual_id: null,
  contexto_id: 'consolidada',
  ultima_abertura: null,
  menu_recolhido: false,
};

let atual: Meta | null = null;
const ouvintes = new Set<() => void>();

function carregar(): Meta {
  try {
    const texto = driver().getItem(CHAVE_META);
    const lido: unknown = texto ? JSON.parse(texto) : null;
    return lido && typeof lido === 'object' ? { ...META_INICIAL, ...(lido as Partial<Meta>) } : META_INICIAL;
  } catch {
    return META_INICIAL;
  }
}

export function lerMeta(): Meta {
  if (!atual) atual = carregar();
  return atual;
}

export function gravarMeta(parcial: Partial<Meta>): Meta {
  atual = { ...lerMeta(), ...parcial };
  try {
    driver().setItem(CHAVE_META, JSON.stringify(atual));
  } catch {
    // sem espaço ou bloqueado: a preferência vale até fechar a página
  }
  ouvintes.forEach((avisar) => avisar());
  return atual;
}

/** Só para os testes: esquece o que está em memória e lê de novo do armazenamento. */
export function esquecerMetaEmMemoria() {
  atual = null;
}

/** Avisa sobre mudanças nesta aba e nas outras abas do mesmo navegador. */
export function assinarMeta(avisar: () => void): () => void {
  const aoMudarEmOutraAba = (evento: StorageEvent) => {
    if (evento.key !== CHAVE_META) return;
    atual = carregar();
    avisar();
  };
  ouvintes.add(avisar);
  window.addEventListener('storage', aoMudarEmOutraAba);
  return () => {
    ouvintes.delete(avisar);
    window.removeEventListener('storage', aoMudarEmOutraAba);
  };
}

export function metaDoServidor(): Meta {
  return META_INICIAL;
}
