'use client';

import { useEffect, useRef } from 'react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { cn } from '@/lib/utils';

export type Subaba = { rotulo: string; href: string; ativa?: boolean };

/**
 * Segundo nível de abas, em pílulas discretas. Por mais itens que tenha, a rolagem fica só nesta
 * fileira: a página nunca alarga (CA-18.04), e o item ativo aparece sem precisar procurar.
 */
export function Subabas({ rotulo, itens }: { rotulo: string; itens: readonly Subaba[] }) {
  const faixa = useRef<HTMLElement>(null);

  useEffect(() => {
    const elemento = faixa.current;
    const ativo = elemento?.querySelector<HTMLElement>('[aria-current="page"]');
    if (elemento && ativo) elemento.scrollLeft = ativo.offsetLeft - (elemento.clientWidth - ativo.offsetWidth) / 2;
  }, []);

  return (
    <nav ref={faixa} aria-label={rotulo} className="faixa-rolagem relative mt-3 flex items-center gap-1.5">
      {itens.map(({ rotulo: nome, href, ativa }) => (
        <LinkCentral
          key={href}
          href={href}
          aria-current={ativa ? 'page' : undefined}
          className={cn('inline-flex min-h-11 shrink-0 items-center rounded-pill px-3.5 text-[13px] md:min-h-9', ativa ? 'bg-active font-semibold text-ink' : 'font-medium text-ink-soft hover:bg-hover')}
        >
          {nome}
        </LinkCentral>
      ))}
    </nav>
  );
}
