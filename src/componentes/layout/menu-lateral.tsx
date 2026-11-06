'use client';

import { usePathname } from 'next/navigation';
import { PanelLeft } from 'lucide-react';
import { Logo } from '@/componentes/marca/logo';
import { MarcaDagua } from '@/componentes/marca/marca-dagua';
import { EmBreve } from '@/componentes/padroes/etiquetas';
import { MODULO_CONFIGURACOES, moduloAtivo, moduloDisponivel, MODULOS_EMPRESA, MODULOS_TOPO, TELA_INICIAL, type Modulo } from '@/dominio/navegacao';
import { cn } from '@/lib/utils';
import { useCentral } from './central-provider';
import { ICONES_MODULO } from './icones-modulo';
import { LinkCentral } from './protecao-saida';
import { SeletorPessoaLateral } from './seletor-pessoa';

function ItemMenu({ modulo }: { modulo: Modulo }) {
  const { faseAtiva } = useCentral();
  const caminho = usePathname();
  const Icone = ICONES_MODULO[modulo.id];

  if (!modulo.href || !moduloDisponivel(modulo, faseAtiva)) {
    return (
      <div
        role="link"
        aria-disabled="true"
        title={`${modulo.nome} · Em breve`}
        className="flex min-h-10 cursor-default items-center gap-2 rounded-pill px-2.5 py-2 text-sm leading-5 font-medium text-ink-soft baixo:min-h-[33px] baixo:py-1 trilho:min-h-11 trilho:justify-center trilho:p-[13px] [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-ink-faint"
      >
        <Icone aria-hidden />
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-1.5 trilho:hidden">
          <span className="tracking-[-.01em] opacity-80">{modulo.nome}</span>
          <EmBreve />
        </span>
      </div>
    );
  }

  const ativo = moduloAtivo(modulo, caminho);
  return (
    <LinkCentral
      href={modulo.href}
      aria-current={ativo ? 'page' : undefined}
      title={modulo.nome}
      className={cn(
        "relative flex min-h-11 items-center gap-2 rounded-pill px-2.5 py-2 text-sm font-medium baixo:min-h-[38px] baixo:py-1.5 trilho:justify-center trilho:p-[13px] [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-ink-soft",
        ativo ? "bg-active font-semibold after:ml-auto after:size-1.5 after:rounded-full after:bg-indigo after:content-[''] trilho:after:absolute trilho:after:right-1" : 'hover:bg-hover',
      )}
    >
      <Icone aria-hidden />
      <span className="trilho:hidden">{modulo.nome}</span>
    </LinkCentral>
  );
}

/** Menu lateral (18 §10.2): 260px, recolhível para 76px; no tablet, expande sobre o conteúdo. */
export function MenuLateral() {
  const { alternarMenu } = useCentral();
  return (
    <aside
      data-menu-lateral
      aria-label="Menu da Central"
      className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col overflow-hidden border-r border-line bg-mist px-2.5 pt-6 pb-3 transition-[width] duration-250 ease-suave max-lg:shadow-e2 baixo:pt-3 baixo:pb-1 md:flex trilho:w-[76px] trilho:shadow-none"
    >
      <LinkCentral href={TELA_INICIAL} aria-label="Central Numa" className="block shrink-0 px-2.5 pt-[3px] pb-3.5 baixo:pb-1 trilho:px-2 trilho:pb-5">
        <Logo compactavel className="text-[28px] trilho:text-[25px]" />
        <p className="mt-2 text-xs tracking-[.08em] text-ink-soft baixo:hidden trilho:hidden">CENTRAL NUMA</p>
      </LinkCentral>

      <nav aria-label="Módulos" className="menu-rolagem relative z-[1] min-h-0 flex-1">
        <ul className="grid gap-0.5 baixo:gap-0">
          {MODULOS_TOPO.map((modulo) => (
            <li key={modulo.id}>
              <ItemMenu modulo={modulo} />
            </li>
          ))}
        </ul>
        <p className="mx-2.5 mt-3 mb-1.5 text-xs font-semibold tracking-[.12em] text-ink-soft baixo:mt-1.5 baixo:mb-0.5 trilho:hidden">EMPRESA</p>
        <ul className="grid gap-0.5 baixo:gap-0">
          {MODULOS_EMPRESA.map((modulo) => (
            <li key={modulo.id}>
              <ItemMenu modulo={modulo} />
            </li>
          ))}
        </ul>
      </nav>

      <MarcaDagua className="absolute -bottom-3.5 left-3.5 z-0 text-[88px] trilho:hidden" />

      <div className="relative z-[1] mt-2 shrink-0 border-t border-line pt-2.5 baixo:mt-1 baixo:pt-1.5">
        <SeletorPessoaLateral />
        <div className="mt-1 baixo:mt-0.5">
          <ItemMenu modulo={MODULO_CONFIGURACOES} />
        </div>
        <button
          type="button"
          onClick={alternarMenu}
          title="Recolher ou expandir o menu"
          aria-label="Recolher ou expandir o menu"
          className="mt-0.5 flex min-h-10 w-full items-center gap-2 rounded-sm p-2.5 text-xs text-ink-soft baixo:min-h-[34px] baixo:py-1.5 trilho:justify-center [&>svg]:size-[18px]"
        >
          <PanelLeft aria-hidden />
          <span className="trilho:hidden">Recolher menu</span>
        </button>
      </div>
    </aside>
  );
}
