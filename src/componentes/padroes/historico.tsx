import type { ResultadoConsulta } from '@/dados/use-consulta';
import type { LinhaHistorico } from '@/dominio/historico';
import { formatarDataHora } from '@/lib/formatacao';
import { Skeleton } from '@/componentes/ui/skeleton';

/** Histórico legível (02 §6): usado aqui e, depois, nas abas Histórico das fichas. */
export function ListaHistorico({ consulta }: { consulta: ResultadoConsulta<LinhaHistorico[]> }) {
  if (consulta.estado === 'carregando') {
    return (
      <div role="status" aria-label="Carregando" className="space-y-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }
  if (consulta.estado === 'erro') return <p className="text-sm text-ink-soft">O histórico não pôde ser lido.</p>;
  if (!consulta.dados.length) return <p className="text-sm text-ink-soft">Nada registrado ainda.</p>;

  return (
    <ul>
      {consulta.dados.map((linha) => (
        <li key={linha.id} className="flex gap-3 border-t border-line py-3.5 text-[13px] first:border-t-0 first:pt-0 last:pb-0">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-indigo" />
          <span className="min-w-0">
            <span className="block">{linha.texto}</span>
            <span className="mt-0.5 block text-xs text-ink-soft tabular-nums">{formatarDataHora(linha.em)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
