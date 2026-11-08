'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BookOpen, CornerDownRight, Search } from 'lucide-react';
import { SeloDisponibilidade } from '@/componentes/ajuda/conteudo';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogTitle } from '@/componentes/ui/dialog';
import { useConsulta } from '@/dados/use-consulta';
import { buscarNaCentral, MINIMO_PARA_BUSCAR } from '@/dominio/busca';
import { buscarNaAjuda } from '@/dominio/busca-ajuda';
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

const TITULO_DA_SECAO = 'px-3 pt-3 pb-0.5 text-xs font-semibold tracking-[.06em] text-ink uppercase';
const ROTULO_DO_GRUPO = 'px-3 pt-2 pb-1 text-xs font-semibold text-ink-soft';

/**
 * T13.03: Ctrl+K ou o ícone. Resultados por tipo, navegação por teclado; código exato vem primeiro, e Enter vai direto.
 * Desde 08/11/2026, duas partes: "Registros" (a busca de sempre) e "Como fazer" (os artigos dos manuais). Abrir um
 * artigo ou o atalho "Ir para essa ação" só leva à tela: nada é feito nem alterado.
 */
export function DialogoBusca({ aberta, aoMudar }: { aberta: boolean; aoMudar: (aberta: boolean) => void }) {
  const [termo, setTermo] = useState('');
  const [ativo, setAtivo] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const consulta = useConsulta(() => (aberta ? buscarNaCentral(termo) : Promise.resolve([])), [termo, aberta]);
  const grupos = useMemo(() => consulta.dados ?? [], [consulta.dados]);
  const curto = termo.trim().length < MINIMO_PARA_BUSCAR;
  const ajuda = useMemo(() => (aberta && !curto ? buscarNaAjuda(termo) : { itens: [], total: 0 }), [aberta, curto, termo]);
  // Uma lista só para as setas: os registros, depois cada artigo seguido do atalho dele, quando há.
  const totalDeOpcoes = useMemo(() => grupos.reduce((soma, grupo) => soma + grupo.itens.length, 0) + ajuda.itens.reduce((soma, item) => soma + (item.acao ? 2 : 1), 0), [grupos, ajuda]);
  const semRegistros = consulta.estado === 'pronto' && !grupos.length;

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

  useEffect(() => setAtivo(0), [grupos, ajuda]);
  useEffect(() => {
    document.getElementById(idDoResultado(ativo))?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);

  function aoTeclarNaBusca(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!totalDeOpcoes) return;
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      setAtivo((atual) => (atual + passo + totalDeOpcoes) % totalDeOpcoes);
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
            aria-expanded={totalDeOpcoes > 0}
            aria-controls={ID_DA_LISTA}
            aria-activedescendant={totalDeOpcoes ? idDoResultado(ativo) : undefined}
            autoComplete="off"
            placeholder="Código, nome ou o que você quer fazer"
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            onKeyDown={aoTeclarNaBusca}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
          />
          <BotaoFechar onClick={() => aoMudar(false)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2" id={ID_DA_LISTA} role="listbox" aria-label="Resultados">
          {curto && (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">
              Busque por código, título ou nome em atividades, contrapartes, pessoas, lançamentos, ferramentas, ativos e produtos. Ou escreva o que quer fazer, como “adiar” ou “criar rotina”, para ver como se faz.
            </p>
          )}
          {!curto && semRegistros && !ajuda.itens.length && (
            <div className="grid justify-items-center gap-2 px-3 py-6 text-center text-sm text-ink-soft">
              <p>Nada encontrado para “{termo.trim()}”, nem nos registros nem nos manuais.</p>
              <p>Tente uma palavra mais curta ou outro jeito de dizer, como “prazo” em vez de “data limite”.</p>
              <LinkCentral href="/ajuda" onClick={() => aoMudar(false)} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline [&_svg]:size-4">
                <BookOpen aria-hidden />
                Ver os manuais da Central
              </LinkCentral>
            </div>
          )}
          {!curto && (grupos.length > 0 || ajuda.itens.length > 0) && (
            <>
              <p className={TITULO_DA_SECAO} role="presentation" data-secao>
                Registros
              </p>
              {semRegistros && (
                <p className="px-3 pt-1 pb-2 text-xs text-ink-soft" role="presentation">
                  Nenhum registro com “{termo.trim()}”.
                </p>
              )}
              {consulta.estado !== 'pronto' && !grupos.length && (
                <p className="px-3 pt-1 pb-2 text-xs text-ink-soft" role="presentation">
                  Procurando…
                </p>
              )}
              {grupos.map((grupo) => (
                <Fragment key={grupo.tipo}>
                  <p className={ROTULO_DO_GRUPO} role="presentation" data-grupo>
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
              <p className={cn(TITULO_DA_SECAO, 'mt-2 border-t border-line pt-4')} role="presentation" data-secao>
                Como fazer
                {ajuda.total > ajuda.itens.length && <span className="font-normal tracking-normal text-ink-soft normal-case">{` · ${ajuda.itens.length} de ${ajuda.total}`}</span>}
              </p>
              {!ajuda.itens.length && (
                <p className="flex flex-wrap items-center gap-x-1.5 px-3 pt-1 pb-2 text-xs text-ink-soft" role="presentation">
                  Nenhum artigo de ajuda sobre “{termo.trim()}”.
                  <LinkCentral href="/ajuda" onClick={() => aoMudar(false)} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2 md:min-h-0">
                    Ver os manuais
                  </LinkCentral>
                </p>
              )}
              {ajuda.itens.map((artigo) => {
                posicao += 1;
                const indiceDoArtigo = posicao;
                const indiceDaAcao = artigo.acao ? (posicao += 1) : -1;
                return (
                  <Fragment key={artigo.id}>
                    <LinkCentral
                      id={idDoResultado(indiceDoArtigo)}
                      role="option"
                      aria-selected={indiceDoArtigo === ativo}
                      href={artigo.href}
                      onMouseEnter={() => setAtivo(indiceDoArtigo)}
                      onClick={() => aoMudar(false)}
                      className={cn('grid min-h-12 content-center gap-1 rounded-sm px-3 py-2 text-left', indiceDoArtigo === ativo && 'bg-hover')}
                    >
                      <span className="flex items-start gap-2 text-sm font-medium break-words">
                        <BookOpen className="mt-0.5 size-4 shrink-0 text-indigo-dk" aria-hidden />
                        <span className="min-w-0">{artigo.titulo}</span>
                      </span>
                      <span className="line-clamp-2 pl-6 text-xs break-words text-ink-soft">{artigo.resumo}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs text-ink-soft">
                        <span>Manual {artigo.modulo}</span>
                        {artigo.disponibilidade.tipo !== 'disponivel' && <SeloDisponibilidade disponibilidade={artigo.disponibilidade} className="px-2 py-0.5" />}
                      </span>
                    </LinkCentral>
                    {artigo.acao && (
                      <LinkCentral
                        id={idDoResultado(indiceDaAcao)}
                        role="option"
                        aria-selected={indiceDaAcao === ativo}
                        aria-label={`Ir para essa ação: ${artigo.acao.rotulo}. Só abre a tela.`}
                        href={artigo.acao.href}
                        onMouseEnter={() => setAtivo(indiceDaAcao)}
                        onClick={() => aoMudar(false)}
                        className={cn('ml-6 flex min-h-11 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold text-ink-soft md:min-h-9 [&_svg]:size-3.5', indiceDaAcao === ativo && 'bg-hover text-ink')}
                      >
                        <CornerDownRight aria-hidden />
                        Ir para essa ação: {artigo.acao.rotulo}
                      </LinkCentral>
                    )}
                  </Fragment>
                );
              })}
            </>
          )}
        </div>
        <p className="hidden shrink-0 border-t border-line px-4 py-2 text-xs text-ink-soft md:block">↑ ↓ para navegar · Enter para abrir · Esc para fechar</p>
      </DialogContent>
    </Dialog>
  );
}
