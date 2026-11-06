'use client';

import { useState } from 'react';
import { LinkCentral } from './protecao-saida';
import { usePathname } from 'next/navigation';
import { MoreHorizontal, Plus } from 'lucide-react';
import { EmBreve, EtiquetaDadosExemplo } from '@/componentes/padroes/etiquetas';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/componentes/ui/dialog';
import { IDS_BARRA_CELULAR, MODULO_CONFIGURACOES, moduloAtivo, moduloDisponivel, MODULOS_EMPRESA, MODULOS_TOPO, type IconeModulo, type Modulo } from '@/dominio/navegacao';
import { cn } from '@/lib/utils';
import { MenuNovo } from './acoes-globais';
import { useCentral } from './central-provider';
import { ICONES_MODULO } from './icones-modulo';
import { SeletorPessoaCelular } from './seletor-pessoa';

const TODOS: readonly Modulo[] = [...MODULOS_TOPO, ...MODULOS_EMPRESA, MODULO_CONFIGURACOES];
const ITEM = 'flex min-h-[60px] min-w-0 flex-col items-center justify-center rounded-sm text-xs leading-[14px] tracking-[-.01em] [&>svg]:mb-0.5 [&>svg]:size-[18px]';

function acharModulo(id: IconeModulo): Modulo {
  return TODOS.find((modulo) => modulo.id === id)!;
}

function ItemBarra({ modulo }: { modulo: Modulo }) {
  const { faseAtiva } = useCentral();
  const caminho = usePathname();
  const Icone = ICONES_MODULO[modulo.id];
  const nome = modulo.curto ?? modulo.nome;

  if (!modulo.href || !moduloDisponivel(modulo, faseAtiva)) {
    return (
      <div className={cn(ITEM, 'font-medium text-ink-soft [&>svg]:text-ink-faint')}>
        <Icone aria-hidden />
        <span className="opacity-85">{nome}</span>
        <span>Em breve</span>
      </div>
    );
  }
  const ativo = moduloAtivo(modulo, caminho);
  return (
    <LinkCentral href={modulo.href} aria-current={ativo ? 'page' : undefined} className={cn(ITEM, 'font-semibold', ativo ? 'bg-indigo-wash text-indigo-dk' : 'text-ink-soft')}>
      <Icone aria-hidden />
      {nome}
    </LinkCentral>
  );
}

function ItemMais({ modulo, aoEscolher }: { modulo: Modulo; aoEscolher: () => void }) {
  const { faseAtiva } = useCentral();
  const caminho = usePathname();
  const Icone = ICONES_MODULO[modulo.id];
  const caixa = 'flex min-h-[60px] items-center gap-2.5 rounded-md border border-line bg-linen px-3 py-2.5 text-[13px] leading-[1.3] [&>svg]:size-[18px] [&>svg]:shrink-0';

  if (!modulo.href || !moduloDisponivel(modulo, faseAtiva)) {
    return (
      <div className={cn(caixa, 'text-ink-soft [&>svg]:text-ink-faint')}>
        <Icone aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="opacity-85">{modulo.nome}</span>
          <EmBreve />
        </span>
      </div>
    );
  }
  const ativo = moduloAtivo(modulo, caminho);
  return (
    <LinkCentral href={modulo.href} onClick={aoEscolher} aria-current={ativo ? 'page' : undefined} className={cn(caixa, ativo && 'border-transparent bg-indigo-wash font-semibold')}>
      <Icone aria-hidden />
      <span>{modulo.nome}</span>
    </LinkCentral>
  );
}

/** Barra inferior do celular (18 §10.5): Meu dia, Financeiro, +, Ferramentas e Mais. */
export function BarraInferior() {
  const { temDadosDeExemplo } = useCentral();
  const caminho = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const naBarra = IDS_BARRA_CELULAR.map(acharModulo);
  const noMais = TODOS.filter((modulo) => !IDS_BARRA_CELULAR.includes(modulo.id));
  const estaNoMais = noMais.some((modulo) => moduloAtivo(modulo, caminho));
  const [primeiro, segundo, terceiro] = naBarra;

  return (
    <nav aria-label="Navegação do celular" className="fixed inset-x-0 bottom-0 z-50 grid h-[calc(var(--bottombar)+var(--area-segura-baixo))] grid-cols-5 items-center border-t border-line bg-paper px-1 pb-[var(--area-segura-baixo)] md:hidden">
      {primeiro && <ItemBarra modulo={primeiro} />}
      {segundo && <ItemBarra modulo={segundo} />}
      <MenuNovo
        gatilho={
          <button type="button" aria-label="Criar" className="-mt-[18px] grid size-14 place-items-center justify-self-center rounded-full bg-indigo-dk text-white shadow-btn">
            <Plus className="size-6" aria-hidden />
          </button>
        }
      />
      {terceiro && <ItemBarra modulo={terceiro} />}
      <Dialog open={maisAberto} onOpenChange={setMaisAberto}>
        <DialogTrigger asChild>
          <button type="button" className={cn(ITEM, 'font-semibold', estaNoMais ? 'bg-indigo-wash text-indigo-dk' : 'text-ink-soft')}>
            <MoreHorizontal aria-hidden />
            Mais
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle className="mb-4 pr-12">Mais</DialogTitle>
          <div className="grid grid-cols-2 gap-2">
            {noMais.map((modulo) => (
              <ItemMais key={modulo.id} modulo={modulo} aoEscolher={() => setMaisAberto(false)} />
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <SeletorPessoaCelular />
            {temDadosDeExemplo && <EtiquetaDadosExemplo className="mt-4" />}
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
