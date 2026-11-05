'use client';

import { ChevronDown } from 'lucide-react';
import { Selecao } from '@/componentes/campos/selecao';
import { Avatar } from '@/componentes/padroes/pessoa';
import { PESSOAS_INTERNAS } from '@/dados/exemplos/base';
import { useCentral } from './central-provider';

function Opcoes() {
  return PESSOAS_INTERNAS.map((pessoa) => (
    <option key={pessoa.id} value={pessoa.id}>
      {pessoa.nome}
    </option>
  ));
}

/** "Você é" no rodapé do menu lateral. No menu de 76px, ficam só as iniciais. */
export function SeletorPessoaLateral() {
  const { pessoa, escolherPessoa } = useCentral();
  return (
    <div>
      <p className="mx-2.5 text-xs text-ink-soft trilho:hidden">Você é</p>
      <div className="flex items-center gap-2 px-2 trilho:justify-center trilho:px-0">
        <Avatar nome={pessoa.nome} />
        <span className="relative min-w-0 flex-1 trilho:hidden">
          <select
            aria-label="Você é"
            value={pessoa.id}
            onChange={(evento) => escolherPessoa(evento.target.value)}
            className="h-11 w-full cursor-pointer appearance-none truncate bg-transparent pr-7 text-[13px] font-semibold baixo:h-9"
          >
            <Opcoes />
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-1 size-4 -translate-y-1/2 text-ink" aria-hidden />
        </span>
      </div>
    </div>
  );
}

/** "Você é" no menu "Mais" do celular (02 §0.4). */
export function SeletorPessoaCelular() {
  const { pessoa, escolherPessoa } = useCentral();
  return (
    <div>
      <label htmlFor="voce-e-celular" className="mb-[7px] block texto-rotulo">
        Você é
      </label>
      <Selecao id="voce-e-celular" value={pessoa.id} onChange={(evento) => escolherPessoa(evento.target.value)}>
        <Opcoes />
      </Selecao>
    </div>
  );
}
