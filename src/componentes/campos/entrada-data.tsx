'use client';

import { useRef, type ComponentProps, type Ref } from 'react';
import { Input } from '@/componentes/ui/input';
import { atalhosDeData } from '@/dominio/atalhos-data';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';

type EntradaDataProps = Omit<ComponentProps<'input'>, 'type'> & { ref?: Ref<HTMLInputElement> };

/**
 * Campo de data (02): o calendário do navegador e os atalhos "Hoje", "+7 dias" e "Fim do mês", no fuso
 * configurado. O atalho preenche o campo como se a pessoa tivesse digitado: vale com `register` e com estado.
 */
export function EntradaData({ ref, min, max, disabled, ...props }: EntradaDataProps) {
  const campo = useRef<HTMLInputElement | null>(null);
  const atalhos = atalhosDeData(hojeISO(), { min: min ? String(min) : undefined, max: max ? String(max) : undefined });

  function ligar(elemento: HTMLInputElement | null) {
    campo.current = elemento;
    if (typeof ref === 'function') ref(elemento);
    else if (ref) ref.current = elemento;
  }

  function aplicar(dia: string) {
    const elemento = campo.current;
    if (!elemento) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(elemento, dia);
    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    elemento.focus();
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <Input type="date" ref={ligar} min={min} max={max} disabled={disabled} {...props} />
      {!disabled && atalhos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 md:gap-1" role="group" aria-label="Atalhos de data">
          {atalhos.map((atalho) => (
            <button
              key={atalho.rotulo}
              type="button"
              title={formatarDiaISO(atalho.dia)}
              onClick={() => aplicar(atalho.dia)}
              className="inline-flex min-h-11 items-center rounded-pill border border-line bg-paper px-3 text-xs font-medium text-ink-soft transition-colors duration-150 hover:border-ink-soft hover:text-ink md:min-h-7 md:px-2"
            >
              {atalho.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
