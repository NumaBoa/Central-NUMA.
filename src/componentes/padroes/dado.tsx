import type { ReactNode } from 'react';

/** Uma linha de dado na aba Resumo das fichas (P2): o vazio diz que não foi informado (RT-08). */
export function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[200px_1fr] md:gap-4">
      <dt className="text-[13px] text-ink-soft">{rotulo}</dt>
      <dd className="min-w-0 text-sm break-words">{children ?? <span className="text-ink-soft">Não informado</span>}</dd>
    </div>
  );
}

/** O cartão que reúne os dados de uma ficha. */
export function ListaDeDados({ children }: { children: ReactNode }) {
  return <dl className="rounded-lg border border-line bg-paper p-4 md:p-5">{children}</dl>;
}
