'use client';

import type { CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { contextosDaAtividade } from '@/dominio/atividades';
import { cn } from '@/lib/utils';

const NUMA = 'Numa institucional';

const Ponto = ({ cor }: { cor: string }) => <span aria-hidden style={{ '--ponto': cor } as CSSProperties} className="size-2.5 shrink-0 rounded-full bg-[var(--ponto)]" />;

type SeletorContextosProps = {
  id?: string;
  /** Os produtos escolhidos. Sem nenhum, é da Numa. */
  valores: readonly string[];
  aoMudar: (valores: string[]) => void;
  /** Os produtos que dá para escolher. Os que já estão no registro continuam, mesmo fora da lista. */
  produtos: readonly Produto[];
  todosOsProdutos: readonly Produto[];
  marcas: readonly Marca[];
  desativado?: boolean;
  /** Campo estreito: "Numa", em vez de "Numa institucional". */
  curto?: boolean;
};

/** Contexto (T03.03): parece uma lista, com o ponto da cor, e continua aceitando mais de um produto (`atividade_produto`). */
export function SeletorContextos({ id, valores, aoMudar, produtos, todosOsProdutos, marcas, desativado = false, curto = false }: SeletorContextosProps) {
  const contextos = contextosDaAtividade({ produtos: [...valores] }, { produtos: todosOsProdutos, marcas });
  const institucional = contextosDaAtividade({ produtos: [] }, { produtos: todosOsProdutos, marcas })[0];
  const primeiro = contextos[0];
  const opcoes = [...todosOsProdutos.filter((produto) => valores.includes(produto.id) && !produtos.some((item) => item.id === produto.id)), ...produtos];
  const nomeDaNuma = curto ? 'Numa' : NUMA;
  const rotulo = primeiro && valores.length ? `${primeiro.nome}${contextos.length > 1 ? ` +${contextos.length - 1}` : ''}` : nomeDaNuma;
  const gatilho = (
    <button id={id} type="button" disabled={desativado} aria-label={`Contexto: ${rotulo}`} className={cn('campo relative flex items-center gap-2 pr-[38px] text-left', desativado ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <Ponto cor={(valores.length ? primeiro?.cor : institucional?.cor) ?? 'var(--c-numa)'} />
      <span className="min-w-0 truncate">{rotulo}</span>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
    </button>
  );
  if (desativado) return gatilho;
  return (
    <MenuSobreposto titulo="Contexto" largura={280} gatilho={gatilho}>
      <ul className="grid gap-0.5">
        <li>
          <label className={cn(CLASSE_LINHA_MENU, 'cursor-pointer hover:bg-hover md:min-h-9 md:py-1.5')}>
            <input type="checkbox" className="size-[18px] shrink-0 accent-[var(--ok)]" checked={!valores.length} onChange={() => aoMudar([])} />
            <Ponto cor={institucional?.cor ?? 'var(--c-numa)'} />
            {NUMA}
          </label>
        </li>
        {opcoes.map((produto) => {
          const contexto = contextosDaAtividade({ produtos: [produto.id] }, { produtos: todosOsProdutos, marcas })[0];
          return (
            <li key={produto.id}>
              <label className={cn(CLASSE_LINHA_MENU, 'cursor-pointer hover:bg-hover md:min-h-9 md:py-1.5')}>
                <input
                  type="checkbox"
                  className="size-[18px] shrink-0 accent-[var(--ok)]"
                  checked={valores.includes(produto.id)}
                  onChange={(evento) => aoMudar(evento.target.checked ? [...valores, produto.id] : valores.filter((valor) => valor !== produto.id))}
                />
                <Ponto cor={contexto?.cor ?? 'var(--ink-soft)'} />
                {produto.nome}
              </label>
            </li>
          );
        })}
      </ul>
    </MenuSobreposto>
  );
}
