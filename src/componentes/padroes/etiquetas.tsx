import type { CSSProperties, ReactNode } from 'react';
import { CheckCircle2, ChevronUp, ChevronsUp, CircleAlert, CircleDot, Minus, TriangleAlert, type LucideIcon } from 'lucide-react';
import { acharContexto } from '@/dados/exemplos/base';
import { cn } from '@/lib/utils';

const BASE = 'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs leading-4 font-semibold whitespace-nowrap [&_svg]:size-[13px] [&_svg]:shrink-0';

export type TipoSituacao = 'sucesso' | 'atencao' | 'erro' | 'info' | 'neutro';

const SITUACOES: Record<TipoSituacao, { classe: string; icone: LucideIcon }> = {
  sucesso: { classe: 'bg-ok-wash text-ok', icone: CheckCircle2 },
  atencao: { classe: 'bg-warn-wash text-warn', icone: TriangleAlert },
  erro: { classe: 'bg-err-wash text-err', icone: CircleAlert },
  info: { classe: 'bg-info-wash text-info', icone: CircleDot },
  neutro: { classe: 'bg-mist text-ink-soft', icone: Minus },
};

/** Situação: sempre texto + ícone + cor, nunca só cor (CA-18.07). */
export function EtiquetaSituacao({ tipo, icone, children }: { tipo: TipoSituacao; icone?: LucideIcon; children: ReactNode }) {
  const { classe, icone: padrao } = SITUACOES[tipo];
  const Icone = icone ?? padrao;
  return (
    <span className={cn(BASE, classe)}>
      <Icone aria-hidden />
      {children}
    </span>
  );
}

/** Produto ou contexto: fundo na tinta, ponto na cor, nome em espresso (18 §9.4). */
export function EtiquetaContexto({ contextoId, className }: { contextoId: string; className?: string }) {
  const contexto = acharContexto(contextoId);
  const cores = { '--tinta': contexto.tinta, '--ponto': contexto.cor } as CSSProperties;
  return (
    <span style={cores} className={cn(BASE, 'bg-[var(--tinta)] text-ink', className)}>
      <span className="size-2 shrink-0 rounded-full bg-[var(--ponto)]" aria-hidden />
      {contexto.nome}
    </span>
  );
}

export type Prioridade = 'urgente' | 'alta' | 'normal' | 'baixa';

const PRIORIDADES: Record<Prioridade, { rotulo: string; icone?: LucideIcon; classe: string }> = {
  urgente: { rotulo: 'Urgente', icone: ChevronsUp, classe: 'text-err' },
  alta: { rotulo: 'Alta', icone: ChevronUp, classe: 'text-warn' },
  normal: { rotulo: 'Normal', classe: 'text-ink-soft' },
  baixa: { rotulo: 'Baixa', classe: 'text-ink-soft' },
};

/** Prioridade: Urgente e Alta com ícone e texto; Normal e Baixa só aparecem na lista (18 §9.4). */
export function EtiquetaPrioridade({ prioridade }: { prioridade: Prioridade }) {
  const { rotulo, icone: Icone, classe } = PRIORIDADES[prioridade];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs leading-4 font-semibold whitespace-nowrap [&_svg]:size-[14px]', classe)}>
      {Icone && <Icone aria-hidden />}
      {rotulo}
    </span>
  );
}

/** Etiqueta livre: pílula linho, texto cinza (18 §9.4). */
export function EtiquetaLivre({ children }: { children: ReactNode }) {
  return <span className={cn(BASE, 'bg-linen text-ink-soft')}>{children}</span>;
}

/** Marca de módulo ou recurso ainda não construído. */
export function EmBreve({ className }: { className?: string }) {
  return <span className={cn('texto-micro font-medium text-ink-soft', className)}>Em breve</span>;
}

/** Etiqueta discreta enquanto houver dados de exemplo (02 §0.3). */
export function EtiquetaDadosExemplo({ className }: { className?: string }) {
  return <span className={cn(BASE, 'bg-mist text-ink-soft', className)}>Dados de exemplo</span>;
}
