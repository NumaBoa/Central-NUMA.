'use client';

import { useSyncExternalStore } from 'react';

const CONSULTA = '(max-width: 767.98px)';

function assinar(aviso: () => void) {
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener('change', aviso);
  return () => consulta.removeEventListener('change', aviso);
}

/** Verdadeiro nos pontos de quebra de celular (18 §10.3). No servidor, começa como falso. */
export function useEhCelular(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}
