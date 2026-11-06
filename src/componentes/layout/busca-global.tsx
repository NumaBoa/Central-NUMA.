'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogTitle } from '@/componentes/ui/dialog';
import { useConsulta } from '@/dados/use-consulta';
import { buscarNaCentral, MINIMO_PARA_BUSCAR } from '@/dominio/busca';
import { cn } from '@/lib/utils';
import { LinkCentral } from './protecao-saida';

/** Busca: pílula no computador, ícone no tablet e no celular (18 §10.4). */
export function PilulaBusca({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="hidden h-10 max-w-[340px] min-w-0 flex-1 items-center gap-2 rounded-pill border border-line bg-paper pr-2 pl-3.5 text-[13px] font-medium whitespace-nowrap text-ink-soft transition-colors duration-150 hover:border-ink-soft lg:flex"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="rounded-pill bg-mist px-2 py-0.5 font-body text-xs font-semibold">Ctrl K</kbd>
    </button>
  );
}

export function BotaoBuscaIcone({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <Button variante="icone" tamanho="icone" aria-label="Buscar" className="lg:hidden" onClick={aoAbrir}>
      <Search aria-hidden />
    </Button>
  );
}

const ID_DA_LISTA = 'resultados-da-busca';
const idDoResultado = (indice: number) => `resultado-da-busca-${indice}`;

/** T13.03: Ctrl+K ou o ícone. Resultados por tipo, navegação por teclado; código exato vem primeiro, e Enter vai direto. */
export function DialogoBusca({ aberta, aoMudar }: { aberta: boolean; aoMudar: (aberta: boolean) => void }) {
  const [termo, setTermo] = useState('');
  const [ativo, setAtivo] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const consulta = useConsulta(() => (aberta ? buscarNaCentral(termo) : Promise.resolve([])), [termo, aberta]);
  const grupos = useMemo(() => consulta.dados ?? [], [consulta.dados]);
  const itens = useMemo(() => grupos.flatMap((grupo) => grupo.itens), [grupos]);
  const curto = termo.trim().length < MINIMO_PARA_BUSCAR;

  useEffect(() => {
    const aoTeclar = (evento: globalThis.KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        aoMudar(true);
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoMudar]);

  // Abre sempre em branco.
  useEffect(() => {
    if (aberta) return;
    setTermo('');
    setAtivo(0);
  }, [aberta]);

  useEffect(() => setAtivo(0), [grupos]);
  useEffect(() => {
    document.getElementById(idDoResultado(ativo))?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);

  function aoTeclarNaBusca(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!itens.length) return;
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      setAtivo((atual) => (atual + passo + itens.length) % itens.length);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      document.getElementById(idDoResultado(ativo))?.click();
    }
  }

  let posicao = -1;
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent
        semFechar
        className="busca-global"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          campo.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Busca</DialogTitle>
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 md:px-4">
          <Search className="size-[18px] shrink-0 text-ink-soft" aria-hidden />
          <input
            ref={campo}
            type="search"
            role="combobox"
            aria-label="Buscar"
            aria-expanded={itens.length > 0}
            aria-controls={ID_DA_LISTA}
            aria-activedescendant={itens.length ? idDoResultado(ativo) : undefined}
            autoComplete="off"
            placeholder="Código, título ou nome"
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            onKeyDown={aoTeclarNaBusca}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
          />
          <BotaoFechar onClick={() => aoMudar(false)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2" id={ID_DA_LISTA} role="listbox" aria-label="Resultados">
          {curto && <p className="px-3 py-6 text-center text-sm text-ink-soft">Busque por código, título ou nome em atividades, contrapartes, pessoas e produtos.</p>}
          {!curto && consulta.estado === 'pronto' && !grupos.length && <p className="px-3 py-6 text-center text-sm text-ink-soft">Nada encontrado para “{termo.trim()}”.</p>}
          {grupos.map((grupo) => (
            <Fragment key={grupo.tipo}>
              <p className="px-3 pt-3 pb-1 text-xs font-semibold text-ink-soft" role="presentation">
                {grupo.rotulo}
                {grupo.total > grupo.itens.length ? ` · ${grupo.itens.length} de ${grupo.total}` : ''}
              </p>
              {grupo.itens.map((item) => {
                posicao += 1;
                const indice = posicao;
                return (
                  <LinkCentral
                    key={item.id}
                    id={idDoResultado(indice)}
                    role="option"
                    aria-selected={indice === ativo}
                    href={item.href}
                    onMouseEnter={() => setAtivo(indice)}
                    onClick={() => aoMudar(false)}
                    className={cn('grid min-h-12 content-center gap-0.5 rounded-sm px-3 py-1.5 text-left', indice === ativo && 'bg-hover')}
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium break-words">
                      {item.titulo}
                      {item.codigo && <span className="text-xs font-normal text-ink-soft tabular-nums">{item.codigo}</span>}
                    </span>
                    <span className="text-xs break-words text-ink-soft">{item.detalhe}</span>
                  </LinkCentral>
                );
              })}
            </Fragment>
          ))}
        </div>
        <p className="hidden shrink-0 border-t border-line px-4 py-2 text-xs text-ink-soft md:block">↑ ↓ para navegar · Enter para abrir · Esc para fechar</p>
      </DialogContent>
    </Dialog>
  );
}
