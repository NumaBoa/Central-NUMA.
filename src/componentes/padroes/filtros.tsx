'use client';

import type { ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { cn } from '@/lib/utils';
import { MenuSobreposto } from './menu-sobreposto';

export type FiltroRapido = { id: string; rotulo: string; contador?: number };
export type FiltroAtivo = { id: string; rotulo: string };

type BarraFiltrosProps = {
  busca?: string;
  aoBuscar?: (texto: string) => void;
  rotuloBusca?: string;
  rapidos?: readonly FiltroRapido[];
  rapidoAtivo?: string;
  aoEscolherRapido?: (id: string) => void;
  /** Filtros aplicados, como etiquetas removíveis (P1). */
  ativos?: readonly FiltroAtivo[];
  aoRemoverAtivo?: (id: string) => void;
  aoLimpar?: () => void;
  /** Conteúdo do botão "Filtros": menu no computador e folha inferior no celular (18 §10.4). */
  filtrosDetalhados?: ReactNode;
};

/** Filtro em pílula (18 §9.3): selecionado em espresso, com contador em pílula menor. */
export function PilulaFiltro({ filtro, ativa, aoClicar }: { filtro: FiltroRapido; ativa: boolean; aoClicar: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      onClick={aoClicar}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 md:min-h-9',
        ativa ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper text-ink hover:border-ink-soft',
      )}
    >
      {filtro.rotulo}
      {filtro.contador !== undefined && (
        <span className={cn('rounded-pill px-1.5 text-xs leading-[18px] tabular-nums', ativa ? 'bg-[var(--sobre-espresso)]' : 'bg-hover')}>{filtro.contador}</span>
      )}
    </button>
  );
}

export function BarraFiltros({ busca, aoBuscar, rotuloBusca = 'Buscar', rapidos = [], rapidoAtivo, aoEscolherRapido, ativos = [], aoRemoverAtivo, aoLimpar, filtrosDetalhados }: BarraFiltrosProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {aoBuscar && (
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <Input type="search" aria-label={rotuloBusca} placeholder="Buscar…" value={busca ?? ''} onChange={(evento) => aoBuscar(evento.target.value)} className="rounded-pill bg-paper pl-10" />
          </div>
        )}
        {filtrosDetalhados && (
          <MenuSobreposto
            titulo="Filtros"
            gatilho={
              <Button variante="secundario" className="shrink-0">
                <SlidersHorizontal aria-hidden />
                {ativos.length ? `Filtros (${ativos.length})` : 'Filtros'}
              </Button>
            }
          >
            {filtrosDetalhados}
          </MenuSobreposto>
        )}
      </div>

      {rapidos.length > 0 && (
        <div className="faixa-rolagem flex items-center gap-1.5 py-1">
          {rapidos.map((filtro) => (
            <PilulaFiltro key={filtro.id} filtro={filtro} ativa={filtro.id === rapidoAtivo} aoClicar={() => aoEscolherRapido?.(filtro.id)} />
          ))}
        </div>
      )}

      {ativos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {ativos.map((ativo) => (
            <button
              key={ativo.id}
              type="button"
              onClick={() => aoRemoverAtivo?.(ativo.id)}
              aria-label={`Remover filtro: ${ativo.rotulo}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-pill bg-mist px-3 text-xs font-semibold text-ink-soft md:min-h-8 [&_svg]:size-3.5"
            >
              {ativo.rotulo}
              <X aria-hidden />
            </button>
          ))}
          {aoLimpar && (
            <Button variante="terciario" tamanho="pequeno" onClick={aoLimpar}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
