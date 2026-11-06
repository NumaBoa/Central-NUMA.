'use client';

import { useRef, type ComponentProps } from 'react';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function BotaoFechar({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button type="button" aria-label="Fechar" className={cn('botao-fechar', className)} {...props}>
      <X className="size-[19px]" aria-hidden />
    </button>
  );
}

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  /** `dialogo`: centralizado, folha inferior no celular. `painel`: lateral, tela inteira no celular. */
  variante?: 'dialogo' | 'painel';
  /** Quem desenha o próprio botão fechar liga esta opção. */
  semFechar?: boolean;
  /** Ligue quando houver um DialogDescription dentro do diálogo. */
  comDescricao?: boolean;
};

export function DialogContent({ className, children, variante = 'dialogo', semFechar = false, comDescricao = false, onOpenAutoFocus, ...props }: DialogContentProps) {
  const descricao = comDescricao ? {} : { 'aria-describedby': undefined };
  const origemDoFoco = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fundo-sobreposicao" />
      <DialogPrimitive.Content
        className={cn(variante === 'painel' ? 'painel-lateral' : 'dialogo', className)}
        onOpenAutoFocus={(evento) => {
          origemDoFoco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          if (onOpenAutoFocus) {
            onOpenAutoFocus(evento);
          } else {
            // o foco fica no próprio diálogo, sem acender o anel num campo
            evento.preventDefault();
            (evento.currentTarget as HTMLElement).focus();
          }
        }}
        // Diálogo aberto por código não tem gatilho: o foco volta para quem o abriu (RT-19).
        onCloseAutoFocus={(evento) => {
          evento.preventDefault();
          if (origemDoFoco.current?.isConnected) origemDoFoco.current.focus();
        }}
        {...descricao}
        {...props}
      >
        {children}
        {!semFechar && (
          <DialogPrimitive.Close asChild>
            <BotaoFechar className="absolute top-4 right-4 md:top-6 md:right-6" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('font-display text-xl leading-[26px] font-semibold tracking-[-.02em] text-balance md:text-[22px] md:leading-7', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-ink-soft', className)} {...props} />;
}
