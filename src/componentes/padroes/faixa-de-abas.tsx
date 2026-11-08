'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A fileira das abas do módulo. No celular, com mais abas do que cabem, ela rola sozinha até a ativa,
 * como as subabas: a aba em que você está nunca fica escondida fora da tela (CA-18.04).
 */
export function FaixaDeAbas({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  const faixa = useRef<HTMLElement>(null);

  useEffect(() => {
    const elemento = faixa.current;
    const ativo = elemento?.querySelector<HTMLElement>('[aria-current="page"]');
    if (elemento && ativo && elemento.scrollWidth > elemento.clientWidth) elemento.scrollLeft = ativo.offsetLeft - (elemento.clientWidth - ativo.offsetWidth) / 2;
  }, []);

  return (
    <nav ref={faixa} aria-label={rotulo} className={className}>
      {children}
    </nav>
  );
}
