'use client';

import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ItemNestaPagina = { id: string; rotulo: string; icone: LucideIcon };

/** Enquanto a página rola até a seção clicada, as que passam pelo caminho não contam. */
const TEMPO_DA_ROLAGEM_MS = 1000;

/** Índice lateral de uma página longa (T02.01 aprovada): acompanha a rolagem; some abaixo de 1024px. */
export function NestaPagina({ itens }: { itens: readonly ItemNestaPagina[] }) {
  const [atual, setAtual] = useState(itens[0]?.id);
  const ultimoClique = useRef(0);

  useEffect(() => {
    const rolandoAteOClique = () => Date.now() - ultimoClique.current < TEMPO_DA_ROLAGEM_MS;
    const noFimDaPagina = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (rolandoAteOClique() || noFimDaPagina()) return;
        for (const entrada of entradas) if (entrada.isIntersecting) setAtual(entrada.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const { id } of itens) {
      const secao = document.getElementById(id);
      if (secao) observador.observe(secao);
    }
    // A última seção pode nunca chegar à faixa observada: no fim da página, é ela a atual.
    const aoRolar = () => {
      if (noFimDaPagina() && !rolandoAteOClique()) setAtual(itens.at(-1)?.id);
    };
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      observador.disconnect();
      window.removeEventListener('scroll', aoRolar);
    };
  }, [itens]);

  return (
    <nav aria-label="Nesta página" className="sticky top-[94px] hidden pt-1 lg:block">
      <p className="mt-[3px] mb-3 text-xs font-semibold tracking-[.13em] text-ink-soft uppercase">Nesta página</p>
      <ul className="grid gap-1">
        {itens.map(({ id, rotulo, icone: Icone }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={atual === id ? 'location' : undefined}
              onClick={() => {
                ultimoClique.current = Date.now();
                setAtual(id);
              }}
              className={cn('flex min-h-[42px] items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px]', atual === id ? 'bg-active text-ink' : 'text-ink-soft hover:bg-hover')}
            >
              <Icone className="size-3.5 shrink-0" aria-hidden />
              {rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
