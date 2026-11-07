import type { ComponentProps, ReactNode } from 'react';
import { Avatar } from '@/componentes/padroes/pessoa';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { cn } from '@/lib/utils';
import { Selecao } from './selecao';

type SelecaoPessoaProps = Omit<ComponentProps<'select'>, 'children'> & {
  pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[];
  /** O texto quando ninguém está escolhido. */
  vazio?: string;
  /** Opções além das pessoas, como "Outra: escrever o nome". */
  extra?: ReactNode;
};

/** Escolher uma pessoa: as iniciais ao lado do nome (18 §9.13). No celular, abre o seletor do aparelho. */
export function SelecaoPessoa({ pessoas, vazio, extra, className, ...props }: SelecaoPessoaProps) {
  const escolhida = pessoas.find((pessoa) => pessoa.id === props.value);
  return (
    <span className="relative block">
      {escolhida && <Avatar nome={escolhida.nome_completo} className="pointer-events-none absolute top-1/2 left-2 z-[1] size-7 -translate-y-1/2 text-[12px]" />}
      <Selecao {...props} className={cn(escolhida && 'pl-11', className)}>
        {vazio && !props.value && <option value="">{vazio}</option>}
        {pessoas.map((pessoa) => (
          <option key={pessoa.id} value={pessoa.id}>
            {pessoa.nome_completo}
          </option>
        ))}
        {extra}
      </Selecao>
    </span>
  );
}
