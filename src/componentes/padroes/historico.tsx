'use client';

import { useMemo, useState } from 'react';
import { Selecao } from '@/componentes/campos/selecao';
import type { ResultadoConsulta } from '@/dados/use-consulta';
import type { LinhaHistorico } from '@/dominio/historico';
import { formatarDataHora } from '@/lib/formatacao';
import { Skeleton } from '@/componentes/ui/skeleton';

/** Histórico legível (02 §6), usado na tela de Dados e nas fichas, com filtros por campo e pessoa. */
export function ListaHistorico({ consulta, comFiltros = false }: { consulta: ResultadoConsulta<LinhaHistorico[]>; comFiltros?: boolean }) {
  const [campo, setCampo] = useState('');
  const [pessoa, setPessoa] = useState('');
  const linhas = consulta.estado === 'pronto' ? consulta.dados : undefined;
  const campos = useMemo(() => [...new Set((linhas ?? []).flatMap((linha) => linha.campos))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [linhas]);
  const pessoas = useMemo(() => [...new Set((linhas ?? []).map((linha) => linha.quem))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [linhas]);

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

  const filtradas = consulta.dados.filter((linha) => (!campo || linha.campos.includes(campo)) && (!pessoa || linha.quem === pessoa));
  const mostrarFiltros = comFiltros && (campos.length > 1 || pessoas.length > 1);

  return (
    <>
      {mostrarFiltros && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtros do histórico">
          {campos.length > 1 && (
            <span className="min-w-40 flex-1 md:max-w-56">
              <Selecao aria-label="Filtrar por campo" value={campo} onChange={(evento) => setCampo(evento.target.value)}>
                <option value="">Todos os campos</option>
                {campos.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </Selecao>
            </span>
          )}
          {pessoas.length > 1 && (
            <span className="min-w-40 flex-1 md:max-w-56">
              <Selecao aria-label="Filtrar por pessoa" value={pessoa} onChange={(evento) => setPessoa(evento.target.value)}>
                <option value="">Todas as pessoas</option>
                {pessoas.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </Selecao>
            </span>
          )}
        </div>
      )}
      {!filtradas.length && <p className="text-sm text-ink-soft">Nada com esses filtros.</p>}
    <ul>
      {filtradas.map((linha) => (
        <li key={linha.id} className="flex gap-3 border-t border-line py-3.5 text-[13px] first:border-t-0 first:pt-0 last:pb-0">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-indigo" />
          <span className="min-w-0">
            <span className="block">{linha.texto}</span>
            <span className="mt-0.5 block text-xs text-ink-soft tabular-nums">{formatarDataHora(linha.em)}</span>
          </span>
        </li>
      ))}
    </ul>
    </>
  );
}
