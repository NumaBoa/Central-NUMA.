import type { ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type TipoFaixa = 'info' | 'atencao' | 'erro' | 'sucesso';

const TIPOS: Record<TipoFaixa, { classe: string; icone: LucideIcon }> = {
  info: { classe: 'bg-info-wash text-info', icone: Info },
  atencao: { classe: 'bg-warn-wash text-warn', icone: TriangleAlert },
  erro: { classe: 'bg-err-wash text-err', icone: CircleAlert },
  sucesso: { classe: 'bg-ok-wash text-ok', icone: CheckCircle2 },
};

/** Faixa de aviso na página (18 §9.10): fundo da situação, ícone, texto e ação. */
export function Faixa({ tipo = 'info', acao, className, children }: { tipo?: TipoFaixa; acao?: ReactNode; className?: string; children: ReactNode }) {
  const { classe, icone: Icone } = TIPOS[tipo];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-campo px-3.5 py-3 text-xs leading-normal', classe, className)}>
      <Icone className="mt-px size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
