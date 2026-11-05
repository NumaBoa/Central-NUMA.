/** Regras da tela de abertura (18 §10.1). */

export const DURACAO_ABERTURA_MS = 1600;
export const DURACAO_ESTATICA_MS = 600;
export const SAIDA_ABERTURA_MS = 400;

/** `forcar` e `manter` servem para rever a abertura: `?abertura=1` e `?abertura=manter`. */
export type ModoAbertura = 'normal' | 'forcar' | 'manter';

export function modoDaAbertura(busca: string): ModoAbertura {
  const valor = new URLSearchParams(busca).get('abertura');
  if (valor === 'manter') return 'manter';
  return valor === null ? 'normal' : 'forcar';
}

/** Exibida uma vez por dia, ao abrir a Central. */
export function deveMostrarAbertura(ultimaAbertura: string | null, hoje: string, modo: ModoAbertura = 'normal'): boolean {
  return modo !== 'normal' || ultimaAbertura !== hoje;
}

/** Quanto tempo a abertura fica na tela; `null` significa até um clique ou tecla. */
export function duracaoDaAbertura(reduzirMovimento: boolean, modo: ModoAbertura = 'normal'): number | null {
  if (modo === 'manter') return null;
  return reduzirMovimento ? DURACAO_ESTATICA_MS : DURACAO_ABERTURA_MS;
}

/** O fio começa embaraçado e chega quase reto ao fim dos 1,6s. */
export function embaracoDoFio(tempoMs: number): number {
  return tempoMs < 150 ? 1 : Math.exp(-(tempoMs - 150) / 450);
}
