'use client';

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OpcaoPilula = { valor: string; rotulo: string; icone?: LucideIcon };

type PilulasProps = {
  rotulo: string;
  obrigatorio?: boolean;
  opcoes: readonly OpcaoPilula[];
  valor: string;
  aoMudar: (valor: string) => void;
  /** Só para leitura: mostra o que está escolhido, sem deixar mudar. */
  desativado?: boolean;
  /** O rótulo fica só para o leitor de tela, quando as próprias opções já dizem o que é. */
  rotuloOculto?: boolean;
  className?: string;
};

const CLASSE_PILULA =
  'inline-flex min-h-11 cursor-pointer has-disabled:cursor-default items-center rounded-pill border border-line bg-paper px-3.5 text-[13px] font-semibold transition-colors duration-150 has-checked:border-espresso has-checked:bg-espresso has-checked:text-linen has-focus-visible:outline-[3px] has-focus-visible:outline-offset-[3px] has-focus-visible:outline-indigo md:min-h-9';

/** Escolha única com poucas opções (18 §9.2): rádios de verdade, com teclado funcionando. */
export function Pilulas({ rotulo, obrigatorio = false, opcoes, valor, aoMudar, desativado = false, rotuloOculto = false, className }: PilulasProps) {
  const nome = useId();
  return (
    <fieldset disabled={desativado} className={cn(desativado && 'opacity-60', className)}>
      <legend className={rotuloOculto ? 'sr-only' : 'mb-[7px] texto-rotulo'}>
        {rotulo}
        {obrigatorio && ' *'}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map(({ valor: valorDaOpcao, rotulo: rotuloDaOpcao, icone: Icone }) => (
          <label key={valorDaOpcao} className={cn(CLASSE_PILULA, Icone && 'gap-1.5 md:gap-2 md:px-5 [&_svg]:size-4 md:[&_svg]:size-[17px]')}>
            <input type="radio" name={nome} value={valorDaOpcao} checked={valor === valorDaOpcao} onChange={() => aoMudar(valorDaOpcao)} className="sr-only" />
            {Icone && <Icone aria-hidden />}
            {rotuloDaOpcao}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type PilulasMultiplasProps = Omit<PilulasProps, 'valor' | 'aoMudar'> & {
  valores: readonly string[];
  aoMudar: (valores: string[]) => void;
};

/** Várias escolhas com poucas opções: caixas de marcar de verdade, com a mesma aparência. */
export function PilulasMultiplas({ rotulo, obrigatorio = false, opcoes, valores, aoMudar, desativado = false, className }: PilulasMultiplasProps) {
  return (
    <fieldset disabled={desativado} className={cn(desativado && 'opacity-60', className)}>
      <legend className="mb-[7px] texto-rotulo">
        {rotulo}
        {obrigatorio && ' *'}
      </legend>
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
