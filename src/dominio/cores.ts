/** Cores de marca (18 §3.2): a etiqueta de contexto usa a cor no ponto e a tinta no fundo. */

/** O fundo linho de 18 §11, para as contas de contraste e de tinta. */
const LINHO = '#F8F6F2';

/** As tintas oficiais de 18 §3.2, pelos tokens. Para as demais cores, a tinta é calculada. */
const TINTAS_OFICIAIS: Readonly<Record<string, string>> = {
  '#D9962B': 'var(--t-urb)',
  '#A8693A': 'var(--t-kipi)',
  '#4E9A72': 'var(--t-zupi)',
  '#3478B8': 'var(--t-zarpa)',
  '#C2668A': 'var(--t-mimo)',
  '#6366F1': 'var(--t-numa)',
};

/** "a tinta é a cor a ~12–15% sobre linho" (18 §3.2). */
const OPACIDADE_DA_TINTA = 0.14;

/** Abaixo disso, o ponto colorido some sobre o linho. As cores oficiais ficam todas acima. */
const CONTRASTE_MINIMO = 2;

function canais(hex: string): [number, number, number] {
  const valor = Number.parseInt(hex.slice(1), 16);
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((canal) => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrasteEntre(primeira: string, segunda: string): number {
  const a = luminancia(primeira);
  const b = luminancia(segunda);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function contrasteComLinho(hex: string): number {
  return contrasteEntre(hex, LINHO);
}

/** "Validar contraste" (T02.04): a cor precisa aparecer no ponto das etiquetas. */
export function corVisivel(hex: string): boolean {
  return contrasteComLinho(hex) >= CONTRASTE_MINIMO;
}

export function tintaDaCor(hex: string): string {
  const oficial = TINTAS_OFICIAIS[hex.toUpperCase()];
  if (oficial) return oficial;
  const fundo = canais(LINHO);
  const misturados = canais(hex).map((canal, i) => Math.round(canal * OPACIDADE_DA_TINTA + fundo[i]! * (1 - OPACIDADE_DA_TINTA)));
  return `#${misturados.map((canal) => canal.toString(16).padStart(2, '0')).join('')}`;
}
