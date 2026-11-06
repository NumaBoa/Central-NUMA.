'use client';

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
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
  /** Números à direita, tabulares (18 §9.6). */
  numerica?: boolean;
  /** Para alinhar as colunas de listas vizinhas, como os grupos de categorias. */
  largura?: string;
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
  estado?: 'pronto' | 'carregando' | 'erro';
  aoTentarDeNovo?: () => void;
  /** Há filtros aplicados: a lista vazia vira "Nada com esses filtros". */
  filtrando?: boolean;
  aoLimparFiltros?: () => void;
  vazio: ReactNode;
  rodape?: ReactNode;
};

/** Lista (P1 e 18 §9.6): tabela em papel; no celular, cartões. */
export function Lista<T>({ rotulo, linhas, colunas, chave, cartao, aoAbrir, cartaoInterativo = false, acoesDaLinha, estado = 'pronto', aoTentarDeNovo, filtrando = false, aoLimparFiltros, vazio, rodape }: ListaProps<T>) {
  const [ordem, setOrdem] = useState<{ id: string; sentido: 1 | -1 } | null>(null);
  const [limite, setLimite] = useState(TAMANHO_PAGINA);

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas;
    const comparar = colunas.find((c) => c.id === ordem.id)?.ordenar;
    if (!comparar) return linhas;
    const { sentido } = ordem;
    return [...linhas].sort((a, b) => comparar(a, b) * sentido);
  }, [linhas, colunas, ordem]);
  const visiveis = ordenadas.slice(0, limite);

  if (estado === 'carregando') return <EstadoCarregando />;
  if (estado === 'erro') return <EstadoErro aoTentarDeNovo={aoTentarDeNovo} />;
  if (!linhas.length) return filtrando ? <EstadoVazioFiltro aoLimpar={aoLimparFiltros} /> : <>{vazio}</>;

  function alternarOrdem(id: string) {
    setOrdem((atual) => (atual?.id === id ? (atual.sentido === 1 ? { id, sentido: -1 } : null) : { id, sentido: 1 }));
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
      <div className="faixa-rolagem relative hidden rounded-lg border border-line bg-paper md:block">
        <table aria-label={rotulo} className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {colunas.map((coluna, i) => {
                const ordenada = ordem?.id === coluna.id;
                return (
                  <th
                    key={coluna.id}
                    scope="col"
                    aria-sort={ordenada ? (ordem?.sentido === 1 ? 'ascending' : 'descending') : undefined}
                    style={coluna.largura ? { width: coluna.largura } : undefined}
                    className={cn(
                      'bg-mist px-3.5 py-2.5 text-left font-semibold whitespace-nowrap text-ink-soft first:rounded-tl-lg last:rounded-tr-lg',
                      coluna.numerica && 'text-right',
                      !coluna.essencial && 'hidden lg:table-cell',
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
                {colunas.map((coluna, i) => (
                  <td
                    key={coluna.id}
                    className={cn(
                      'h-[52px] border-t border-line px-3.5 py-1.5',
                      coluna.numerica && 'text-right tabular-nums',
                      !coluna.essencial && 'hidden lg:table-cell',
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
                <td colSpan={colunas.length + (acoesDaLinha ? 1 : 0)} className="border-t border-line bg-linen px-3.5 py-3 text-[13px] font-semibold first:rounded-b-lg">
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

      {ordenadas.length > limite && (
        <div className="mt-4 flex justify-center">
          <Button variante="secundario" onClick={() => setLimite((atual) => atual + TAMANHO_PAGINA)}>
            Ver mais {Math.min(TAMANHO_PAGINA, ordenadas.length - limite)}
          </Button>
        </div>
      )}
    </div>
  );
}
