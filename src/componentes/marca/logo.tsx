import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  pontoClassName?: string;
  /** No menu de 76px, a palavra vira só "n" + ponto. */
  compactavel?: boolean;
};

/** Logotipo "numa" + ponto índigo (18 §2.1): o ponto sobe com mola ao passar o mouse. */
export function Logo({ className, pontoClassName, compactavel = false }: LogoProps) {
  return (
    <span className={cn('group/logo inline-flex items-baseline gap-px font-display leading-none font-bold tracking-[-.045em] text-ink', className)}>
      {compactavel ? (
        <>
          <span className="trilho:hidden">numa</span>
          <span className="hidden trilho:inline">n</span>
        </>
      ) : (
        <span>numa</span>
      )}
      <i className={cn('inline-block size-[.32em] rounded-full bg-indigo transition-transform duration-500 ease-mola group-hover/logo:-translate-y-[.25em]', pontoClassName)} />
    </span>
  );
}
