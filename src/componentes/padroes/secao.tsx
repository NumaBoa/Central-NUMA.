import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Cartão de seção de página (T02.01 aprovada): chip de ícone, título e descrição curta. */
export function Secao({ id, icone: Icone, titulo, descricao, className, children }: { id?: string; icone: LucideIcon; titulo: string; descricao?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn('scroll-mt-[88px] rounded-lg border border-line bg-paper px-[18px] py-5 md:p-[25px]', className)}>
      <div className="mb-5 flex items-center gap-2.5 md:mb-[23px] md:gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-mist text-ink-soft md:size-[38px]">
          <Icone className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2>{titulo}</h2>
          {descricao && <p className="mt-[3px] text-xs text-ink-soft">{descricao}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
