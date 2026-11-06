'use client';

import { useId, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { BotaoFechar, Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/componentes/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/componentes/ui/popover';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';

type MenuSobrepostoProps = {
  gatilho: ReactElement;
  titulo: string;
  acaoCabecalho?: ReactNode;
  largura?: number;
  alinhar?: 'start' | 'center' | 'end';
  children: ReactNode | ((fechar: () => void) => ReactNode);
};

/** Menu suspenso (18 §9.9): papel com raio de 18px; no celular, folha inferior. */
export function MenuSobreposto({ gatilho, titulo, acaoCabecalho, largura = 320, alinhar = 'start', children }: MenuSobrepostoProps) {
  const celular = useEhCelular();
  const [aberto, setAberto] = useState(false);
  const idDoMenu = useId();
  const fechar = () => setAberto(false);
  const conteudo = typeof children === 'function' ? children(fechar) : children;

  if (celular) {
    return (
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogTrigger asChild data-gatilho-do-menu={idDoMenu}>
          {gatilho}
        </DialogTrigger>
        <DialogContent semFechar data-menu={idDoMenu}>
          <div className="flex items-center justify-between gap-3 pb-2">
            <DialogTitle className="text-[17px] leading-6 tracking-[-.01em] md:text-[17px] md:leading-6">{titulo}</DialogTitle>
            <div className="flex items-center gap-1">
              {acaoCabecalho}
              <BotaoFechar onClick={fechar} />
            </div>
          </div>
          {conteudo}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild data-gatilho-do-menu={idDoMenu}>
        {gatilho}
      </PopoverTrigger>
      <PopoverContent align={alinhar} aria-label={titulo} data-menu={idDoMenu} style={{ '--largura-menu': `${largura}px` } as CSSProperties}>
        <div className="flex items-center justify-between gap-3 pt-1 pr-1 pb-2 pl-3">
          <h2 className="text-[17px] leading-6 tracking-[-.01em]">{titulo}</h2>
          <div className="flex items-center gap-1">
            {acaoCabecalho}
            <BotaoFechar onClick={fechar} />
          </div>
        </div>
        {conteudo}
      </PopoverContent>
    </Popover>
  );
}

/** Classes de uma linha de menu: 48px no celular (18 §9.9). */
export const CLASSE_LINHA_MENU = 'flex min-h-12 w-full items-center gap-3 rounded-sm px-1 py-2 text-left text-base leading-[1.4] md:min-h-11 md:px-3 md:text-sm [&_svg]:size-[18px] [&_svg]:shrink-0';

export function LinhaEmBreve({ icone, rotulo, className }: { icone: ReactNode; rotulo: string; className?: string }) {
  return (
    <li className={cn(CLASSE_LINHA_MENU, 'cursor-default text-ink-soft [&_svg]:text-ink-faint', className)}>
      {icone}
      <span className="opacity-80">{rotulo}</span>
      <span className="ml-auto texto-micro font-medium">Em breve</span>
    </li>
  );
}
