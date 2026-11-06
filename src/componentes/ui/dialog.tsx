'use client';

import { useRef, type ComponentProps } from 'react';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** Menu que abre um painel ao fechar: o botão clicado vai sumir, e o foco volta para o gatilho do menu. */
function quemAbriu(): HTMLElement | null {
  const ativo = document.activeElement;
  if (!(ativo instanceof HTMLElement)) return null;
  const menu = ativo.closest<HTMLElement>('[data-menu]');
  return (menu && document.querySelector<HTMLElement>(`[data-gatilho-do-menu="${menu.dataset.menu}"]`)) ?? ativo;
}

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
          origemDoFoco.current = quemAbriu();
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
          // Se este menu abriu outro painel, o foco já está lá: tirá-lo do campo acusaria erro à toa.
          if (document.activeElement?.closest('[role="dialog"],[role="alertdialog"]')) return;
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
