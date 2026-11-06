import { Fragment, type ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EmBreve } from '@/componentes/padroes/etiquetas';
import { cn } from '@/lib/utils';

type CabecalhoPaginaProps = {
  migalhas?: readonly string[];
  /** Módulo (18 §2.2). */
  kicker: string;
  titulo: string;
  resumo?: ReactNode;
  acoes?: ReactNode;
  className?: string;
};

/** Cabeçalho da página (18 §10.2): kicker, título, linha de resumo e ações à direita. */
export function CabecalhoPagina({ migalhas, kicker, titulo, resumo, acoes, className }: CabecalhoPaginaProps) {
  return (
    <div className={className}>
      {migalhas && (
        <nav aria-label="Caminho" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft md:mb-7">
          {migalhas.map((migalha, i) => (
            <Fragment key={migalha}>
              {i > 0 && <ChevronRight className="size-[13px]" aria-hidden />}
              <span aria-current={i === migalhas.length - 1 ? 'page' : undefined}>{migalha}</span>
            </Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2 text-[13px] leading-[18px] font-semibold text-ink-soft before:size-2 before:shrink-0 before:rounded-full before:bg-indigo">{kicker}</div>
          <h1>{titulo}</h1>
          {resumo && <div className="mt-2.5 text-[13px] leading-[1.6] text-ink-soft md:text-sm">{resumo}</div>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </div>
  );
}

export type AbaPagina = { rotulo: string; icone: LucideIcon; href?: string; ativa?: boolean };

/** Abas da página: pílula espresso na ativa; o que não existe ainda fica "Em breve", sem link. */
export function AbasPagina({ abas, rotulo, className }: { abas: readonly AbaPagina[]; rotulo: string; className?: string }) {
  return (
    <nav aria-label={rotulo} className={cn('faixa-rolagem mt-6 flex items-center gap-1.5 border-b border-line pb-3.5 md:mt-7', className)}>
      {abas.map(({ rotulo: nome, icone: Icone, href, ativa }) =>
        href ? (
          <LinkCentral
            key={nome}
            href={href}
            aria-current={ativa ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-[7px] rounded-pill px-3 text-[13px] font-medium md:min-h-10 md:px-[17px] [&_svg]:size-[15px]',
              ativa ? 'bg-espresso text-linen' : 'text-ink-soft hover:bg-hover',
            )}
          >
            <Icone aria-hidden />
            {nome}
          </LinkCentral>
        ) : (
          <div key={nome} className="inline-flex min-h-11 shrink-0 cursor-default items-center gap-[7px] rounded-pill px-[17px] text-[13px] leading-[1.25] font-medium text-ink-soft md:min-h-10 [&_svg]:size-[15px] [&_svg]:text-ink-faint">
            <Icone aria-hidden />
            <span className="flex flex-col">
              <span className="opacity-80">{nome}</span>
              <EmBreve />
            </span>
          </div>
        ),
      )}
    </nav>
  );
}
