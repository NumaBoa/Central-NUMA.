'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CartaoDeResumo<I extends string = string> = {
  id: I;
  rotulo: string;
  valor: number;
  icone?: LucideIcon;
  /** O número pede atenção, como atrasadas e bloqueadas. */
  atencao?: boolean;
};

type CartoesDeResumoProps<I extends string> = {
  rotulo: string;
  cartoes: readonly CartaoDeResumo<I>[];
  ativo: (id: I) => boolean;
  aoEscolher: (id: I) => void;
  /** As colunas, a partir do tablet. */
  className?: string;
};

/** Contadores que aplicam filtro (T03.01). No celular, pílulas com rolagem (18 §10.6). */
export function CartoesDeResumo<I extends string>({ rotulo, cartoes, ativo, aoEscolher, className }: CartoesDeResumoProps<I>) {
  return (
    <div role="group" aria-label={rotulo} className={cn('faixa-rolagem flex gap-1.5 py-0.5 md:grid md:gap-2', className)}>
      {cartoes.map(({ id, rotulo: nome, valor, icone: Icone, atencao = false }) => {
        const marcado = ativo(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={marcado}
            onClick={() => aoEscolher(id)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-3.5 text-left text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 md:min-h-0 md:gap-3 md:rounded-lg md:px-4 md:py-3 md:whitespace-normal',
              marcado ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper text-ink hover:border-ink-soft',
            )}
          >
            {Icone && (
              <span aria-hidden className={cn('hidden size-10 shrink-0 place-items-center rounded-full md:grid [&_svg]:size-5', marcado ? 'bg-[var(--sobre-espresso)]' : 'bg-mist text-ink-soft')}>
                <Icone />
              </span>
            )}
            <span className="flex min-w-0 items-center gap-2 md:h-full md:flex-col md:items-start md:justify-between md:gap-1">
              <span className={cn('md:text-[13px] md:font-medium', !marcado && 'md:text-ink')}>{nome}</span>
              <span className={cn('tabular-nums md:texto-kpi', atencao && !marcado && 'text-err')}>{valor}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
