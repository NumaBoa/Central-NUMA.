'use client';

import type { CSSProperties } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { cn } from '@/lib/utils';
import { useCentral } from './central-provider';

const PONTO = 'size-2 shrink-0 rounded-full bg-[var(--ponto)]';

/** Seletor de contexto (02 §4 e CA-02.03). No celular, usa o nome curto quando houver. */
export function SeletorContexto() {
  const { contexto, contextos, escolherContexto } = useCentral();
  const sufixo = contexto.provisorio ? ' · provisório' : '';
  return (
    <MenuSobreposto
      titulo="Contexto"
      gatilho={
        <button
          type="button"
          aria-label={`Contexto: ${contexto.nome}`}
          style={{ '--ponto': contexto.cor } as CSSProperties}
          className="inline-flex h-11 max-w-60 min-w-0 flex-[0_1_auto] items-center gap-[5px] rounded-pill border border-line bg-paper pr-1.5 pl-2.5 text-[13px] font-medium whitespace-nowrap hover:border-ink-soft md:h-10 md:shrink-0 md:gap-2 md:pr-3 md:pl-3.5"
        >
          <span className={PONTO} />
          <span className="min-w-0 truncate md:hidden">
            {contexto.curto ?? contexto.nome}
            {sufixo}
          </span>
          <span className="hidden md:inline">
            {contexto.nome}
            {sufixo}
          </span>
          <ChevronDown className="size-3 shrink-0 text-ink-soft md:size-[15px]" aria-hidden />
        </button>
      }
    >
      {(fechar) => (
        <ul className="grid gap-0.5">
          {contextos.map((opcao) => {
            const atual = opcao.id === contexto.id;
            return (
              <li key={opcao.id}>
                <button
                  type="button"
                  aria-current={atual || undefined}
                  style={{ '--ponto': opcao.cor } as CSSProperties}
                  onClick={() => {
                    escolherContexto(opcao.id);
                    fechar();
                  }}
                  className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}
                >
                  <span className={PONTO} />
                  <span>
                    {opcao.nome}
                    {opcao.provisorio && <span className="texto-micro font-medium text-ink-soft"> · provisório</span>}
                  </span>
                  {atual && <Check className="ml-auto text-indigo-dk" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </MenuSobreposto>
  );
}
