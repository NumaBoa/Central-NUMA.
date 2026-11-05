import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Faixa } from '@/componentes/padroes/faixa';
import { Vitrine } from './vitrine';

export const metadata: Metadata = { title: 'Padrões' };

/** Vitrine dos padrões da Etapa 0, para validar nos três tamanhos. Não entra no menu. */
export default function Padroes() {
  return (
    <>
      <CabecalhoPagina migalhas={['Central Numa', 'Padrões']} kicker="Etapa 0" titulo="Padrões da Central" resumo="As peças que todas as telas vão usar." />
      <Faixa className="mt-6">Tudo aqui é exemplo, inspirado nos casos da especificação. Nada é gravado.</Faixa>
      <Vitrine />
    </>
  );
}
