/**
 * Preferências deste navegador (`numa-central:v1:meta`, 02 §0.3).
 * Único ponto da entrega 1 que toca o localStorage; telas nunca acessam o armazenamento direto.
 * A entrega 2 acrescenta aqui a versão dos dados, a última rotina e os contadores de código.
 */
export const CHAVE_META = 'numa-central:v1:meta';

export type Meta = {
  pessoa_atual_id: string | null;
  contexto_id: string;
  ultima_abertura: string | null;
  menu_recolhido: boolean;
};

export const META_INICIAL: Meta = {
  pessoa_atual_id: null,
  contexto_id: 'consolidada',
  ultima_abertura: null,
  menu_recolhido: false,
};

let atual: Meta | null = null;
const ouvintes = new Set<() => void>();

function armazenamento(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // navegador com o armazenamento bloqueado: segue só em memória
  }
}

function carregar(): Meta {
  try {
    const texto = armazenamento()?.getItem(CHAVE_META);
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
    armazenamento()?.setItem(CHAVE_META, JSON.stringify(atual));
  } catch {
    // sem espaço ou bloqueado: a preferência vale até fechar a página
  }
  ouvintes.forEach((avisar) => avisar());
  return atual;
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
