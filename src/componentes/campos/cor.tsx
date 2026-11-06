import type { ComponentProps } from 'react';
import { Input } from '@/componentes/ui/input';

const HEX_VALIDO = /^#[0-9A-Fa-f]{6}$/;

type EntradaCorProps = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  valor: string;
  aoMudar: (valor: string) => void;
};

/** Cor hex (T02.04): o quadradinho abre o seletor do aparelho; o campo aceita digitar o código. */
export function EntradaCor({ valor, aoMudar, ...props }: EntradaCorProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Escolher a cor no seletor"
        value={HEX_VALIDO.test(valor) ? valor.toLowerCase() : '#000000'}
        onChange={(evento) => aoMudar(evento.target.value.toUpperCase())}
        className="size-11 shrink-0 cursor-pointer rounded-campo border border-line bg-paper p-1"
      />
      <Input autoComplete="off" spellCheck={false} placeholder="#RRGGBB" maxLength={7} className="min-w-0 flex-1 uppercase" value={valor} onChange={(evento) => aoMudar(evento.target.value)} {...props} />
    </div>
  );
}
