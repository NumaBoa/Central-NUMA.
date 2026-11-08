'use client';

import type { LucideIcon } from 'lucide-react';
import { Ellipsis } from 'lucide-react';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';

export type AcaoDoMenu = { rotulo: string; icone: LucideIcon; aoClicar: () => void; perigo?: boolean };

/** O "…" das linhas e das fichas: um menu sobreposto no computador e uma folha inferior no celular. */
export function MenuDeAcoes({ rotulo, acoes }: { rotulo: string; acoes: readonly AcaoDoMenu[] }) {
  if (!acoes.length) return null;
  return (
    <MenuSobreposto
      titulo="Mais ações"
      largura={240}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label={rotulo} className="!flex-none">
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <ul className="grid gap-0.5">
          {acoes.map(({ rotulo: nome, icone: Icone, aoClicar, perigo }) => (
            <li key={nome}>
              <button
                type="button"
                className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover', perigo && 'text-err')}
                onClick={() => {
                  fechar();
                  aoClicar();
                }}
              >
                <Icone aria-hidden />
                {nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </MenuSobreposto>
  );
}
