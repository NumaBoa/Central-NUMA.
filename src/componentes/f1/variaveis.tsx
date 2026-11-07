'use client';

import { useState } from 'react';
import { Selecao } from '@/componentes/campos/selecao';
import { GRUPOS_DE_VARIAVEIS, LISTAS_DO_DICIONARIO, variaveisDoGrupo } from '@/dominio/modelo-variaveis';

/** A lista de variáveis ao lado do editor, com inserção por clique (T09.06). Também as formas de condição e repetição. */
export function InsercaoDeVariaveis({ aoInserir }: { aoInserir: (trecho: string) => void }) {
  const [grupo, setGrupo] = useState(GRUPOS_DE_VARIAVEIS[0] ?? '');
  const botao = 'inline-flex min-h-11 items-center rounded-pill border border-line bg-paper px-2.5 font-mono text-xs break-all text-left hover:border-ink-soft md:min-h-8';
  return (
    <details className="rounded-md border border-line bg-linen p-3 text-[13px]">
      <summary className="min-h-6 cursor-pointer font-semibold">Variáveis, condições e repetições</summary>
      <div className="mt-3 grid gap-3">
        <Selecao aria-label="Grupo de variáveis" value={grupo} onChange={(evento) => setGrupo(evento.target.value)}>
          {GRUPOS_DE_VARIAVEIS.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </Selecao>
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {variaveisDoGrupo(grupo).map((nome) => (
            <button key={nome} type="button" className={botao} onClick={() => aoInserir(`{{${nome}}}`)}>
              {`{{${nome}}}`}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-soft">Repetições disponíveis: {Object.keys(LISTAS_DO_DICIONARIO).join(', ')}.</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={botao} onClick={() => aoInserir('[SE contrato.periodicidade = "anual"]\n\n[FIM SE]')}>
            [SE …] … [FIM SE]
          </button>
          <button type="button" className={botao} onClick={() => aoInserir('[PARA CADA itens]\n{{item.descricao}}\n[FIM PARA]')}>
            [PARA CADA …]
          </button>
          <button type="button" className={botao} onClick={() => aoInserir('**[DESTAQUE]** ')}>
            [DESTAQUE]
          </button>
        </div>
        <p className="text-xs text-ink-soft">Condições aceitas: um campo preenchido, ou campo = &quot;valor&quot;, ≠, &gt;, &lt;, contém. Nada é executado como código.</p>
      </div>
    </details>
  );
}
