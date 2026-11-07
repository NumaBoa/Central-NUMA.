'use client';

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';
import { EstadoCarregando, EstadoErro, EstadoVazioFiltro } from './estados';

export const TAMANHO_PAGINA = 50;

export type Coluna<T> = {
  id: string;
  titulo: string;
  celula: (linha: T) => ReactNode;
  /** Sem isso, a coluna não ordena. */
  ordenar?: (a: T, b: T) => number;
  /** As demais colunas somem no tablet (18 §10.4). */
  essencial?: boolean;
  /** Classes da coluna, no cabeçalho e nas células: com `@min-[...]`, ela só aparece se a tabela couber. */
  classe?: string;
  /** Números à direita, tabulares (18 §9.6). */
  numerica?: boolean;
  /** Para alinhar as colunas de listas vizinhas, como os grupos de categorias. */
  largura?: string;
  /** Não sai da lista ao configurar as colunas (P1). */
  fixa?: boolean;
  /** O valor da célula em texto, para exportar. */
  texto?: (linha: T) => string;
};

type ListaProps<T> = {
  /** Nome da tabela para leitores de tela. */
  rotulo: string;
  linhas: readonly T[];
  colunas: readonly Coluna<T>[];
  chave: (linha: T) => string;
  /** Versão em cartão, para o celular. */
  cartao: (linha: T) => ReactNode;
  aoAbrir?: (linha: T) => void;
  /** O cartão do celular já tem botões próprios: não pode ficar dentro de outro botão. */
  cartaoInterativo?: boolean;
  /** Ações sempre disponíveis, sem depender de hover (18 §9.6). */
  acoesDaLinha?: (linha: T) => ReactNode;
  /** Seleção múltipla, para as ações em lote (P1). Só em tabela: no celular, um registro de cada vez. */
  selecao?: { selecionados: ReadonlySet<string>; aoMudar: (selecionados: ReadonlySet<string>) => void; rotuloDaLinha: (linha: T) => string };
  estado?: 'pronto' | 'carregando' | 'erro';
  aoTentarDeNovo?: () => void;
  /** Há filtros aplicados: a lista vazia vira "Nada com esses filtros". */
  filtrando?: boolean;
  aoLimparFiltros?: () => void;
  vazio: ReactNode;
  rodape?: ReactNode;
  /** Menos espaço entre as colunas, para caber mais sem rolar. */
  compacta?: boolean;
  /** Páginas no lugar de "Ver mais", para limitar a altura da lista. */
  paginacao?: {
    porPagina: number;
    /** Quando muda (os filtros, por exemplo), volta à primeira página. */
    reiniciarCom: string;
    /** À esquerda das páginas. `ordenada`: a pessoa escolheu uma coluna para ordenar. */
    resumo?: (ordenada: boolean) => ReactNode;
  };
};

/** ‹ 1 2 3 ›: com muitas páginas, mostra a primeira, a última e as vizinhas da atual. */
function numerosDasPaginas(atual: number, total: number): (number | 'salto')[] {
  const numeros: (number | 'salto')[] = [];
  for (let pagina = 1; pagina <= total; pagina += 1) {
    if (pagina === 1 || pagina === total || Math.abs(pagina - atual) <= 1) numeros.push(pagina);
    else if (numeros[numeros.length - 1] !== 'salto') numeros.push('salto');
  }
  return numeros;
}

function Paginas({ atual, total, aoMudar }: { atual: number; total: number; aoMudar: (pagina: number) => void }) {
  const classe = 'inline-flex size-11 items-center justify-center rounded-md border border-line bg-paper text-[13px] font-semibold tabular-nums hover:border-ink-soft disabled:cursor-default disabled:opacity-40 disabled:hover:border-line md:size-9 [&_svg]:size-4';
  return (
    <nav aria-label="Páginas" className="flex items-center gap-1">
      <button type="button" aria-label="Página anterior" disabled={atual <= 1} onClick={() => aoMudar(atual - 1)} className={classe}>
        <ChevronLeft aria-hidden />
      </button>
      {numerosDasPaginas(atual, total).map((numero, indice) =>
        numero === 'salto' ? (
          <span key={`salto-${indice}`} aria-hidden className="px-1 text-ink-soft">
            …
          </span>
        ) : (
          <button key={numero} type="button" aria-label={`Página ${numero}`} aria-current={numero === atual ? 'page' : undefined} onClick={() => aoMudar(numero)} className={cn(classe, numero === atual && 'border-indigo-wash bg-indigo-wash text-ink hover:border-indigo-wash')}>
            {numero}
          </button>
        ),
      )}
      <button type="button" aria-label="Próxima página" disabled={atual >= total} onClick={() => aoMudar(atual + 1)} className={classe}>
        <ChevronRight aria-hidden />
      </button>
    </nav>
  );
}

/** Lista (P1 e 18 §9.6): tabela em papel; no celular, cartões. */
export function Lista<T>({ rotulo, linhas, colunas, chave, cartao, aoAbrir, cartaoInterativo = false, acoesDaLinha, selecao, estado = 'pronto', aoTentarDeNovo, filtrando = false, aoLimparFiltros, vazio, rodape, compacta = false, paginacao }: ListaProps<T>) {
  const [ordem, setOrdem] = useState<{ id: string; sentido: 1 | -1 } | null>(null);
  const [limite, setLimite] = useState(TAMANHO_PAGINA);
  const [pagina, setPagina] = useState(1);
  const [reiniciarCom, setReiniciarCom] = useState(paginacao?.reiniciarCom);
  if (paginacao && paginacao.reiniciarCom !== reiniciarCom) {
    setReiniciarCom(paginacao.reiniciarCom);
    setPagina(1);
  }

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas;
    const comparar = colunas.find((c) => c.id === ordem.id)?.ordenar;
    if (!comparar) return linhas;
    const { sentido } = ordem;
    return [...linhas].sort((a, b) => comparar(a, b) * sentido);
  }, [linhas, colunas, ordem]);
  // Pagar o último título da última página não pode deixar a tela numa página que não existe mais.
  const totalDePaginas = paginacao ? Math.max(1, Math.ceil(ordenadas.length / paginacao.porPagina)) : 1;
  const paginaAtual = Math.min(pagina, totalDePaginas);
  const visiveis = paginacao ? ordenadas.slice((paginaAtual - 1) * paginacao.porPagina, paginaAtual * paginacao.porPagina) : ordenadas.slice(0, limite);

  if (estado === 'carregando') return <EstadoCarregando />;
  if (estado === 'erro') return <EstadoErro aoTentarDeNovo={aoTentarDeNovo} />;
  if (!linhas.length) return filtrando ? <EstadoVazioFiltro aoLimpar={aoLimparFiltros} /> : <>{vazio}</>;

  function alternarOrdem(id: string) {
    setOrdem((atual) => (atual?.id === id ? (atual.sentido === 1 ? { id, sentido: -1 } : null) : { id, sentido: 1 }));
    setPagina(1);
  }

  function aoTeclarLinha(evento: KeyboardEvent<HTMLTableRowElement>, linha: T) {
    if (evento.target === evento.currentTarget && (evento.key === 'Enter' || evento.key === ' ')) {
      evento.preventDefault();
      aoAbrir?.(linha);
    }
  }

  return (
    <div>
      {/* Computador e tablet */}
      <div className="@container faixa-rolagem relative hidden rounded-lg border border-line bg-paper md:block">
        <table aria-label={rotulo} className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {selecao && (
                <th scope="col" className="w-10 bg-mist py-2.5 pr-0 pl-3.5 first:rounded-tl-lg">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas"
                    className="size-[18px] accent-[var(--ok)] align-middle"
                    checked={visiveis.length > 0 && visiveis.every((linha) => selecao.selecionados.has(chave(linha)))}
                    onChange={(evento) => selecao.aoMudar(new Set(evento.target.checked ? visiveis.map(chave) : []))}
                  />
                </th>
              )}
              {colunas.map((coluna, i) => {
                const ordenada = ordem?.id === coluna.id;
                return (
                  <th
                    key={coluna.id}
                    scope="col"
                    aria-sort={ordenada ? (ordem?.sentido === 1 ? 'ascending' : 'descending') : undefined}
                    style={coluna.largura ? { width: coluna.largura } : undefined}
                    className={cn(
                      'bg-mist py-2.5 text-left font-semibold whitespace-nowrap text-ink-soft first:rounded-tl-lg last:rounded-tr-lg',
                      compacta ? 'px-2.5' : 'px-3.5',
                      coluna.numerica && 'text-right',
                      !coluna.essencial && 'hidden lg:table-cell',
                      coluna.classe,
                      i === 0 && 'sticky left-0 z-[1]',
                    )}
                  >
                    {coluna.ordenar ? (
                      <button type="button" onClick={() => alternarOrdem(coluna.id)} className={cn('inline-flex items-center gap-1 font-semibold [&_svg]:size-3.5', coluna.numerica && 'flex-row-reverse')}>
                        {coluna.titulo}
                        {ordenada ? ordem?.sentido === 1 ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden /> : <ChevronsUpDown className="opacity-50" aria-hidden />}
                      </button>
                    ) : (
                      coluna.titulo
                    )}
                  </th>
                );
              })}
              {acoesDaLinha && (
                <th scope="col" className="bg-mist px-2 py-2.5 last:rounded-tr-lg">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => (
              <tr
                key={chave(linha)}
                tabIndex={aoAbrir ? 0 : undefined}
                onClick={aoAbrir ? () => aoAbrir(linha) : undefined}
                onKeyDown={aoAbrir ? (evento) => aoTeclarLinha(evento, linha) : undefined}
                className={cn('group/linha', aoAbrir && 'cursor-pointer hover:bg-linen')}
              >
                {selecao && (
                  <td className="h-[52px] w-10 border-t border-line py-1.5 pr-0 pl-3.5" onClick={(evento) => evento.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${selecao.rotuloDaLinha(linha)}`}
                      className="size-[18px] accent-[var(--ok)] align-middle"
                      checked={selecao.selecionados.has(chave(linha))}
                      onChange={(evento) => {
                        const proximos = new Set(selecao.selecionados);
                        if (evento.target.checked) proximos.add(chave(linha));
                        else proximos.delete(chave(linha));
                        selecao.aoMudar(proximos);
                      }}
                    />
                  </td>
                )}
                {colunas.map((coluna, i) => (
                  <td
                    key={coluna.id}
                    className={cn(
                      'h-[52px] border-t border-line py-1.5',
                      compacta ? 'px-2.5' : 'px-3.5',
                      coluna.numerica && 'text-right tabular-nums',
                      !coluna.essencial && 'hidden lg:table-cell',
                      coluna.classe,
                      i === 0 && 'sticky left-0 bg-paper group-hover/linha:bg-linen',
                    )}
                  >
                    {coluna.celula(linha)}
                  </td>
                ))}
                {acoesDaLinha && (
                  <td className="h-[52px] w-14 border-t border-line px-1.5 text-right" onClick={(evento) => evento.stopPropagation()}>
                    {acoesDaLinha(linha)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rodape && (
            <tfoot>
              <tr>
                <td colSpan={colunas.length + (acoesDaLinha ? 1 : 0) + (selecao ? 1 : 0)} className="border-t border-line bg-linen px-3.5 py-3 text-[13px] font-semibold first:rounded-b-lg">
                  {rodape}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Celular */}
      <ul className="space-y-2.5 md:hidden" aria-label={rotulo}>
        {visiveis.map((linha) => (
          <li key={chave(linha)} className="rounded-lg border border-line bg-paper">
            {aoAbrir && !cartaoInterativo ? (
              <button type="button" onClick={() => aoAbrir(linha)} className="block w-full p-4 text-left">
                {cartao(linha)}
              </button>
            ) : (
              <div className="p-4">{cartao(linha)}</div>
            )}
          </li>
        ))}
        {rodape && <li className="rounded-lg bg-mist p-4 text-sm font-semibold">{rodape}</li>}
      </ul>

      {paginacao && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
          <div className="min-w-0 text-[13px] text-ink-soft">{paginacao.resumo?.(ordem !== null)}</div>
          {totalDePaginas > 1 && <Paginas atual={paginaAtual} total={totalDePaginas} aoMudar={setPagina} />}
        </div>
      )}

      {!paginacao && ordenadas.length > limite && (
        <div className="mt-4 flex justify-center">
          <Button variante="secundario" onClick={() => setLimite((atual) => atual + TAMANHO_PAGINA)}>
            Ver mais {Math.min(TAMANHO_PAGINA, ordenadas.length - limite)}
          </Button>
        </div>
      )}
    </div>
  );
}
