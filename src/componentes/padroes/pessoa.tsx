import { cn } from '@/lib/utils';

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function Avatar({ nome, className }: { nome: string; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-grid size-[34px] shrink-0 place-items-center rounded-full bg-oat font-display text-xs font-[650] text-ink', className)}>
      {iniciaisDe(nome)}
    </span>
  );
}

/** Iniciais sempre ao lado do nome completo (18 §9.13). */
export function Pessoa({ nome, className }: { nome: string; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <Avatar nome={nome} className="size-7 text-[12px]" />
      <span className="truncate">{nome}</span>
    </span>
  );
}
