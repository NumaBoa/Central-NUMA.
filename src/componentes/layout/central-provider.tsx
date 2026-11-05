'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { acharContexto, acharPessoaInterna, type Contexto, type PessoaInterna } from '@/dados/exemplos/base';
import { assinarMeta, gravarMeta, lerMeta, metaDoServidor } from '@/dados/meta';
import type { Fase } from '@/dominio/navegacao';

type ValorCentral = {
  /** "Você é" (02 §0.4): não é controle de segurança, só define a pessoa atual. */
  pessoa: PessoaInterna;
  escolherPessoa: (id: string) => void;
  contexto: Contexto;
  escolherContexto: (id: string) => void;
  /** Vem de T02.01 quando a tela existir; até lá, a fase inicial da especificação. */
  faseAtiva: Fase;
  /** A etiqueta passa a depender dos dados reais na entrega 2 (02 §0.3). */
  temDadosDeExemplo: boolean;
  alternarMenu: () => void;
};

const ContextoCentral = createContext<ValorCentral | null>(null);

export function CentralProvider({ children }: { children: ReactNode }) {
  const meta = useSyncExternalStore(assinarMeta, lerMeta, metaDoServidor);
  const [menuAbertoNoTablet, setMenuAbertoNoTablet] = useState(false);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu-recolhido', meta.menu_recolhido);
  }, [meta.menu_recolhido]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu-aberto', menuAbertoNoTablet);
    if (!menuAbertoNoTablet) return;
    const aoClicarFora = (evento: MouseEvent) => {
      if (!(evento.target as Element).closest('[data-menu-lateral]')) setMenuAbertoNoTablet(false);
    };
    document.addEventListener('click', aoClicarFora);
    return () => document.removeEventListener('click', aoClicarFora);
  }, [menuAbertoNoTablet]);

  const alternarMenu = useCallback(() => {
    if (window.matchMedia('(max-width: 1023.98px)').matches) setMenuAbertoNoTablet((aberto) => !aberto);
    else gravarMeta({ menu_recolhido: !lerMeta().menu_recolhido });
  }, []);

  const valor = useMemo<ValorCentral>(
    () => ({
      pessoa: acharPessoaInterna(meta.pessoa_atual_id),
      escolherPessoa: (id) => gravarMeta({ pessoa_atual_id: id }),
      contexto: acharContexto(meta.contexto_id),
      escolherContexto: (id) => gravarMeta({ contexto_id: id }),
      faseAtiva: 'f0a',
      temDadosDeExemplo: true,
      alternarMenu,
    }),
    [meta.pessoa_atual_id, meta.contexto_id, alternarMenu],
  );

  return <ContextoCentral value={valor}>{children}</ContextoCentral>;
}

export function useCentral(): ValorCentral {
  const valor = use(ContextoCentral);
  if (!valor) throw new Error('useCentral precisa estar dentro de CentralProvider.');
  return valor;
}
