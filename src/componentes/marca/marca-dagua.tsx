import { cn } from '@/lib/utils';

/** Marca d'água "numa." (18 §2.1): 6% de opacidade, ponto índigo a 25%. */
export function MarcaDagua({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none flex items-baseline gap-0.5 font-display leading-none font-bold tracking-[-.07em] text-[color:var(--marca-dagua)] select-none', className)}>
      <span>numa</span>
      <i className="inline-block size-[.2em] rounded-full bg-[var(--marca-dagua-ponto)]" />
    </div>
  );
}
