'use client';

import { PilulasMultiplas } from '@/componentes/campos/pilulas';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EtiquetaColorida } from '@/componentes/padroes/etiquetas';
import type { Etiqueta } from '@/dados/tipos/etiqueta';
import { etiquetasDoModulo, type ModuloEtiqueta } from '@/dominio/etiquetas';

const CADASTRO = '/configuracoes/cadastros/etiquetas';

/** As etiquetas livres de um registro (T02.10): as do módulo, ativas, mais as que ele já tem. */
export function CampoEtiquetas({ etiquetas, modulo, valores, aoMudar, desativado = false }: { etiquetas: readonly Etiqueta[]; modulo: ModuloEtiqueta; valores: readonly string[]; aoMudar: (ids: string[]) => void; desativado?: boolean }) {
  const opcoes = [...etiquetasDoModulo(etiquetas, modulo), ...etiquetas.filter((etiqueta) => valores.includes(etiqueta.id) && etiqueta.arquivado_em)];
  if (!opcoes.length) {
    return (
      <div>
        <p className="mb-[7px] texto-rotulo">Etiquetas</p>
        <p className="text-[13px] text-ink-soft">
          Ainda não há etiquetas para este módulo.{' '}
          <LinkCentral href={CADASTRO} className="inline-flex min-h-11 items-center underline md:min-h-0">
            Cadastrar etiqueta
          </LinkCentral>
        </p>
      </div>
    );
  }
  return <PilulasMultiplas rotulo="Etiquetas" desativado={desativado} valores={valores} aoMudar={aoMudar} opcoes={opcoes.map((etiqueta) => ({ valor: etiqueta.id, rotulo: etiqueta.nome }))} />;
}

/** As etiquetas de um registro, com a cor de cada uma. */
export function EtiquetasDoRegistro({ ids, etiquetas }: { ids: readonly string[]; etiquetas: readonly Etiqueta[] }) {
  const doRegistro = etiquetas.filter((etiqueta) => ids.includes(etiqueta.id));
  if (!doRegistro.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {doRegistro.map((etiqueta) => (
        <EtiquetaColorida key={etiqueta.id} nome={etiqueta.nome} cor={etiqueta.cor} />
      ))}
    </span>
  );
}
