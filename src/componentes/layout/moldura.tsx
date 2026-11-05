import type { ReactNode } from 'react';
import { BarraInferior } from './barra-inferior';
import { BarraSuperior } from './barra-superior';
import { MenuLateral } from './menu-lateral';

/** Estrutura da Central em computador, tablet e celular (18 §10.2 e §10.4). */
export function Moldura({ children }: { children: ReactNode }) {
  return (
    <div id="moldura" className="min-h-dvh md:pl-[76px] lg:pl-[260px] recolhido:pl-[76px]">
      <a href="#conteudo" className="fixed top-[-100px] left-4 z-[200] rounded-pill bg-espresso px-5 py-3 text-linen focus:top-3">
        Ir para o conteúdo
      </a>
      <MenuLateral />
      <BarraSuperior />
      <main id="conteudo" className="mx-auto w-full max-w-[var(--maxw)] px-4 pt-6 pb-[calc(108px+var(--area-segura-baixo))] md:px-6 md:pt-9 md:pb-[100px] lg:px-[var(--gutter)]">
        {children}
      </main>
      <BarraInferior />
    </div>
  );
}
