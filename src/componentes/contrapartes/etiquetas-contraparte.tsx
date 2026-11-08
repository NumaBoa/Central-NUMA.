import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import type { Contraparte } from '@/dados/tipos/contraparte';
import { ROTULOS_PAPEL_CONTRAPARTE } from '@/dominio/contrapartes';

/** Desde 07/11/2026 a lista é a do Comercial; o cadastro completo fica em `/comercial/contrapartes/[id]/cadastro`. */
export const CAMINHO_DE_CONTRAPARTES = '/comercial/contrapartes';
export const caminhoDoCadastroDaContraparte = (id: string) => `${CAMINHO_DE_CONTRAPARTES}/${id}/cadastro`;

export function SituacaoDaContraparte({ situacao }: { situacao: Contraparte['situacao'] }) {
  return <EtiquetaSituacao tipo={situacao === 'ativa' ? 'sucesso' : 'neutro'}>{situacao === 'ativa' ? 'Ativa' : 'Inativa'}</EtiquetaSituacao>;
}

export function PapeisDaContraparte({ papeis }: { papeis: Contraparte['papeis'] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {papeis.map((papel) => (
        <EtiquetaLivre key={papel}>{ROTULOS_PAPEL_CONTRAPARTE[papel]}</EtiquetaLivre>
      ))}
    </span>
  );
}
