'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Logo } from '@/componentes/marca/logo';
import { EtiquetaDadosExemplo } from '@/componentes/padroes/etiquetas';
import { Button } from '@/componentes/ui/button';
import { BotaoBuscaIcone, DialogoBusca, MenuAlertas, MenuNovo, PilulaBusca } from './acoes-globais';
import { useCentral } from './central-provider';
import { SeletorContexto } from './seletor-contexto';

/** Barra superior "vidro" (18 §5.3 e §10.2). No celular: logotipo, contexto, busca e sino. */
export function BarraSuperior() {
  const { temDadosDeExemplo } = useCentral();
  const [buscaAberta, setBuscaAberta] = useState(false);
  const abrirBusca = () => setBuscaAberta(true);
  return (
    <header className="sticky top-0 z-30 flex h-[calc(var(--topbar)+var(--area-segura-topo))] items-center justify-between border-b border-line bg-glass px-4 pt-[var(--area-segura-topo)] backdrop-blur-[14px] md:gap-3 md:px-6 lg:gap-4 lg:px-[var(--gutter)]">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-3">
        <Logo className="shrink-0 text-2xl md:hidden" />
        <SeletorContexto />
        <PilulaBusca aoAbrir={abrirBusca} />
      </div>
      <div className="flex shrink-0 items-center md:gap-2 lg:gap-3">
        {temDadosDeExemplo && <EtiquetaDadosExemplo className="hidden md:inline-flex" />}
        <BotaoBuscaIcone aoAbrir={abrirBusca} />
        <MenuNovo
          gatilho={
            <Button className="hidden md:inline-flex">
              <Plus aria-hidden />
              Novo
            </Button>
          }
        />
        <MenuAlertas />
      </div>
      <DialogoBusca aberta={buscaAberta} aoMudar={setBuscaAberta} />
    </header>
  );
}
