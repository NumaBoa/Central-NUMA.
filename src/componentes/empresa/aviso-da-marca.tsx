'use client';

import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Faixa } from '@/componentes/padroes/faixa';
import { useConsulta } from '@/dados/use-consulta';
import { avisoDaMarcaDoProduto } from '@/dominio/marcas-inpi';

/** CA-06.04: marca com nome provisório e sem pesquisa registrada, na ficha do produto. */
export function AvisoDaMarcaProvisoria({ marcaId }: { marcaId: string | null | undefined }) {
  const consulta = useConsulta(() => avisoDaMarcaDoProduto(marcaId), [marcaId]);
  if (!consulta.dados || !marcaId) return null;
  return (
    <Faixa
      tipo="atencao"
      acao={
        <LinkCentral href={`/empresa/marcas/${marcaId}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
          Ver marca
        </LinkCentral>
      }
    >
      Nome provisório, sem pesquisa registrada. {consulta.dados}.
    </Faixa>
  );
}
