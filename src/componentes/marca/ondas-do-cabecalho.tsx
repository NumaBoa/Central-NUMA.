import { cn } from '@/lib/utils';

/**
 * Assinatura visual dos cabeçalhos (18 §2.2, ampliado em 08/11/2026): fios finos em espresso e um fio índigo.
 * Estática, sem animação. Fica numa área livre do cabeçalho: quem usa reserva o espaço com `flex-1`, entre o
 * texto e as ações, e as ondas somem sozinhas quando sobra menos de 88px, ou abaixo do computador.
 * Não recebe clique, não recebe foco e não é lida pelo leitor de tela.
 */
export function OndasDoCabecalho({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none hidden min-w-0 flex-1 basis-0 self-stretch select-none @container [mask-image:linear-gradient(90deg,transparent,#000_16%,#000_84%,transparent)] lg:block', className)}>
      <svg focusable="false" className="hidden h-full max-h-36 min-h-16 w-full @min-[88px]:block" viewBox="0 0 520 140" preserveAspectRatio="none" fill="none">
        {[34, 52, 70, 88, 106].map((base, i) => (
          <path key={base} d={`M0 ${base} C 110 ${base - 18 + i * 3}, 210 ${base + 22 - i * 4}, 330 ${base - 6} S 470 ${base + 14 - i * 2}, 520 ${base - 10}`} stroke="var(--espresso)" strokeOpacity=".12" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d="M0 78 C 120 44, 190 118, 300 74 S 460 40, 520 62" stroke="var(--indigo)" strokeOpacity=".55" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
