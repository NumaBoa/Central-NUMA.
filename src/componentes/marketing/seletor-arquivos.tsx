'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Input } from '@/componentes/ui/input';
import type { Arquivo } from '@/dados/tipos/marketing';
import { ROTULOS_TIPO_ARQUIVO } from '@/dominio/biblioteca';
import { normalizarTexto } from '@/dominio/duplicidade';
import { EtiquetaClasse, IconeDoTipo } from './apoio';

/** Arquivos são escolhidos na biblioteca (T08.05): nada de colar outro link aqui, nem duplicar o item. */
export function SeletorDeArquivos({ arquivos, valores, aoMudar }: { arquivos: readonly Arquivo[]; valores: readonly string[]; aoMudar: (ids: string[]) => void }) {
  const [busca, setBusca] = useState('');
  const texto = normalizarTexto(busca);
  const achados = useMemo(() => arquivos.filter((arquivo) => !texto || normalizarTexto(`${arquivo.titulo} ${arquivo.codigo}`).includes(texto)).slice(0, 30), [arquivos, texto]);
  if (!arquivos.length) {
    return (
      <p className="text-[13px] text-ink-soft">
        A biblioteca ainda está vazia.{' '}
        <LinkCentral href="/marketing?novo=1" className="inline-flex min-h-11 items-center underline md:min-h-0">
          Adicionar arquivo
        </LinkCentral>
      </p>
    );
  }
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-[7px] texto-rotulo">Arquivos da biblioteca {valores.length ? `(${valores.length} ${valores.length === 1 ? 'escolhido' : 'escolhidos'})` : ''}</legend>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <Input type="search" aria-label="Buscar arquivo na biblioteca" placeholder="Buscar arquivo…" value={busca} onChange={(evento) => setBusca(evento.target.value)} className="pl-10" />
      </div>
      <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-line p-1.5">
        {achados.map((arquivo) => (
          <li key={arquivo.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1 text-[13px] hover:bg-hover">
              <input type="checkbox" className="size-[18px] shrink-0" checked={valores.includes(arquivo.id)} onChange={(evento) => aoMudar(evento.target.checked ? [...valores, arquivo.id] : valores.filter((id) => id !== arquivo.id))} />
              <IconeDoTipo tipo={arquivo.tipo} className="size-4 shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{arquivo.titulo}</span>
                <span className="text-xs text-ink-soft">{ROTULOS_TIPO_ARQUIVO[arquivo.tipo]}</span>
              </span>
              <EtiquetaClasse classe={arquivo.classe} />
            </label>
          </li>
        ))}
        {!achados.length && <li className="px-2 py-3 text-[13px] text-ink-soft">Nada com essa busca.</li>}
      </ul>
    </fieldset>
  );
}
