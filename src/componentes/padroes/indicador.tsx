import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type IndicadorProps = {
  titulo: string;
  valor: string;
  contexto?: ReactNode;
  situacao?: ReactNode;
  /** Chip de ícone à esquerda, no lugar do ponto do kicker. O ícone nunca é a única informação. */
  icone?: LucideIcon;
  tom?: 'indigo' | 'erro' | 'sucesso' | 'neutro';
  className?: string;
};

const TONS: Readonly<Record<NonNullable<IndicadorProps['tom']>, string>> = { indigo: 'bg-indigo-wash text-primary', erro: 'bg-err-wash text-err', sucesso: 'bg-ok-wash text-ok', neutro: 'bg-mist text-ink-soft' };

/** Indicador (18 §9.7): cartão papel, kicker com ponto, número em Bricolage e contexto. */
export function Indicador({ titulo, valor, contexto, situacao, icone: Icone, tom = 'neutro', className }: IndicadorProps) {
  if (Icone) {
    return (
      <div className={cn('flex min-w-0 items-start gap-3 rounded-lg border border-line bg-paper p-4 md:px-5 md:py-4', className)}>
        <span aria-hidden className={cn('hidden size-10 shrink-0 place-items-center rounded-md min-[1200px]:grid [&_svg]:size-5', TONS[tom])}>
          <Icone />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] leading-[18px] font-medium text-ink">{titulo}</p>
          <strong className="mt-0.5 block font-display text-[22px] leading-7 font-[650] tracking-[-.01em] tabular-nums md:text-2xl md:leading-8">{valor}</strong>
          {contexto && <div className="mt-0.5 text-[13px] leading-[18px] text-ink-soft">{contexto}</div>}
          {situacao && <div className="mt-2">{situacao}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className={cn('min-w-0 rounded-lg border border-line bg-paper p-4 md:px-5 md:py-[18px]', className)}>
      <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft before:size-2 before:shrink-0 before:rounded-full before:bg-indigo">{titulo}</p>
      <strong className="mt-2 block texto-kpi tabular-nums md:max-lg:text-[26px] md:max-lg:leading-[30px]">{valor}</strong>
      {contexto && <div className="mt-1 text-[13px] leading-[18px] text-ink-soft">{contexto}</div>}
      {situacao && <div className="mt-2">{situacao}</div>}
    </div>
  );
}
