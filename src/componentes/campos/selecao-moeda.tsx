import { useMemo, type ComponentProps } from 'react';
import { listarMoedas, type OpcaoMoeda } from '@/dominio/moedas';
import { Selecao } from './selecao';

type SelecaoMoedaProps = Omit<ComponentProps<'select'>, 'value' | 'children'> & {
  value: string;
  /** No câmbio de referência, a cotação já é em reais. */
  semReal?: boolean;
};

function Opcoes({ moedas }: { moedas: readonly OpcaoMoeda[] }) {
  return moedas.map(({ codigo, nome }) => (
    <option key={codigo} value={codigo}>
      {codigo} · {nome}
    </option>
  ));
}

/** Moedas do próprio navegador, com nome em português e BRL, USD e EUR no topo. */
export function SelecaoMoeda({ value, semReal = false, ...props }: SelecaoMoedaProps) {
  const { maisUsadas, demais } = useMemo(() => listarMoedas({ atual: value, semReal }), [value, semReal]);
  return (
    <Selecao value={value} {...props}>
      <optgroup label="Mais usadas">
        <Opcoes moedas={maisUsadas} />
      </optgroup>
      {demais.length > 0 && (
        <optgroup label="Todas as moedas">
          <Opcoes moedas={demais} />
        </optgroup>
      )}
    </Selecao>
  );
}
