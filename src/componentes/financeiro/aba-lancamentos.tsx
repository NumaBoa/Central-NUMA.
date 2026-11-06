'use client';

import { Receipt } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import type { Titulo } from '@/dados/tipos/titulo';
import { useConsulta } from '@/dados/use-consulta';
import { ROTULOS_SITUACAO_TITULO } from '@/dominio/titulos';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

/** O mesmo título, sem cópia, onde ele faz sentido: na ficha da contraparte. */
export function AbaLancamentos({ consultar, dependencia, vazio }: { consultar: () => Promise<Titulo[]>; dependencia: string; vazio: string }) {
  const consulta = useConsulta(consultar, [dependencia]);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler os lançamentos." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados.length) return <EstadoVazio icone={Receipt} titulo="Nenhum lançamento ainda." texto={vazio} />;
  return (
    <ul className="grid gap-2">
      {consulta.dados.map((titulo) => (
        <li key={titulo.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-paper p-4">
          <span className="grid min-w-0 gap-0.5">
            <LinkCentral href={`/financeiro/${titulo.id}`} className="inline-flex min-h-11 items-center font-medium break-words underline-offset-2 hover:underline md:min-h-0">
              {titulo.descricao}
            </LinkCentral>
            <span className="text-[13px] text-ink-soft tabular-nums">
              {titulo.codigo} · {formatarDiaISO(titulo.vencimento)} · {ROTULOS_SITUACAO_TITULO[titulo.situacao]}
            </span>
          </span>
          <span className="font-medium tabular-nums">{formatarDinheiro(titulo.valor, titulo.moeda)}</span>
        </li>
      ))}
    </ul>
  );
}
