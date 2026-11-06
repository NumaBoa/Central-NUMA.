'use client';

import { useId } from 'react';
export type OpcaoPilula = { valor: string; rotulo: string };

type PilulasProps = {
  rotulo: string;
  obrigatorio?: boolean;
  opcoes: readonly OpcaoPilula[];
  valor: string;
  aoMudar: (valor: string) => void;
  className?: string;
};

const CLASSE_PILULA =
  'inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-line bg-paper px-3.5 text-[13px] font-semibold transition-colors duration-150 has-checked:border-espresso has-checked:bg-espresso has-checked:text-linen has-focus-visible:outline-[3px] has-focus-visible:outline-offset-[3px] has-focus-visible:outline-indigo md:min-h-9';

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
            className={CLASSE_PILULA}
          >
            <input type="radio" name={nome} value={opcao.valor} checked={valor === opcao.valor} onChange={() => aoMudar(opcao.valor)} className="sr-only" />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type PilulasMultiplasProps = Omit<PilulasProps, 'valor' | 'aoMudar' | 'obrigatorio'> & {
  valores: readonly string[];
  aoMudar: (valores: string[]) => void;
};

/** Várias escolhas com poucas opções: caixas de marcar de verdade, com a mesma aparência. */
export function PilulasMultiplas({ rotulo, opcoes, valores, aoMudar, className }: PilulasMultiplasProps) {
  return (
    <fieldset className={className}>
      <legend className="mb-[7px] texto-rotulo">{rotulo}</legend>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className={CLASSE_PILULA}>
            <input
              type="checkbox"
              checked={valores.includes(opcao.valor)}
              onChange={(evento) => aoMudar(evento.target.checked ? [...valores, opcao.valor] : valores.filter((valor) => valor !== opcao.valor))}
              className="sr-only"
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
