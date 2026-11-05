import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

/** Botões de 18 §9.1. Altura: 40px no computador e 44px no celular. */
export const variantesBotao = cva(
  'inline-flex items-center justify-center gap-2 rounded-pill border border-transparent font-semibold whitespace-nowrap transition-[transform,background-color,border-color] duration-150 ease-suave active:scale-[.97] disabled:opacity-50 [&_svg]:size-[17px] [&_svg]:shrink-0',
  {
    variants: {
      variante: {
        primario: 'bg-indigo-dk text-white shadow-btn not-disabled:hover:-translate-y-0.5 not-disabled:hover:bg-indigo-press',
        secundario: 'border-line bg-paper text-ink not-disabled:hover:-translate-y-0.5 not-disabled:hover:border-ink',
        terciario: 'bg-transparent text-indigo-dk not-disabled:hover:bg-indigo-wash',
        perigo: 'bg-err text-white not-disabled:hover:-translate-y-0.5',
        icone: 'rounded-full bg-transparent text-ink-soft not-disabled:hover:bg-hover',
      },
      tamanho: {
        padrao: 'min-h-11 px-[18px] py-[9px] text-[13px] leading-[1.3] md:min-h-10',
        pequeno: 'min-h-11 px-[13px] py-[7px] text-xs md:min-h-9',
        icone: 'size-11 p-0 md:size-10 [&_svg]:size-[19px]',
      },
    },
    defaultVariants: { variante: 'primario', tamanho: 'padrao' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof variantesBotao> & {
    asChild?: boolean;
    /** Mostra o indicador circular e desativa o botão durante o envio. */
    carregando?: boolean;
  };

export function Button({ className, variante, tamanho, asChild = false, carregando = false, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(variantesBotao({ variante, tamanho }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button type="button" className={cn(variantesBotao({ variante, tamanho }), className)} disabled={disabled || carregando} {...props}>
      {children}
      {carregando && <LoaderCircle className="animate-spin" aria-hidden />}
    </button>
  );
}
