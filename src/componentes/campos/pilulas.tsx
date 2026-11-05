'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export type OpcaoPilula = { valor: string; rotulo: string };

type PilulasProps = {
  rotulo: string;
  obrigatorio?: boolean;
  opcoes: readonly OpcaoPilula[];
  valor: string;
  aoMudar: (valor: string) => void;
  className?: string;
};

/** Escolha única com poucas opções (18 §9.2): rádios de verdade, com teclado funcionando. */
export function Pilulas({ rotulo, obrigatorio = false, opcoes, valor, aoMudar, className }: PilulasProps) {
  const nome = useId();
  return (
    <fieldset className={className}>
      <legend className="mb-[7px] texto-rotulo">
        {rotulo}
        {obrigatorio && ' *'}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-line bg-paper px-3.5 text-[13px] font-semibold transition-colors duration-150 has-checked:border-espresso has-checked:bg-espresso has-checked:text-linen has-focus-visible:outline-[3px] has-focus-visible:outline-offset-[3px] has-focus-visible:outline-indigo md:min-h-9',
            )}
          >
            <input type="radio" name={nome} value={opcao.valor} checked={valor === opcao.valor} onChange={() => aoMudar(opcao.valor)} className="sr-only" />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
