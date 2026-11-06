import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type IndicadorProps = {
  titulo: string;
  valor: string;
  contexto?: string;
  situacao?: ReactNode;
  className?: string;
};

/** Indicador (18 §9.7): cartão papel, kicker com ponto, número em Bricolage e contexto. */
export function Indicador({ titulo, valor, contexto, situacao, className }: IndicadorProps) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-line bg-paper p-4 md:px-5 md:py-[18px]', className)}>
      <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft before:size-2 before:shrink-0 before:rounded-full before:bg-indigo">{titulo}</p>
      <strong className="mt-2 block texto-kpi tabular-nums md:max-lg:text-[26px] md:max-lg:leading-[30px]">{valor}</strong>
      {contexto && <p className="mt-1 text-[13px] leading-[18px] text-ink-soft">{contexto}</p>}
      {situacao && <div className="mt-2">{situacao}</div>}
    </div>
  );
}
