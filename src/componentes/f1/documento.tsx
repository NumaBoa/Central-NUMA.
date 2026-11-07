import { Fragment } from 'react';
import type { NoDocumento, Trecho } from '@/dominio/modelo-texto';
import { cn } from '@/lib/utils';

function Trechos({ trechos, aoClicarVariavel }: { trechos: readonly Trecho[]; aoClicarVariavel?: (nome: string) => void }) {
  return (
    <>
      {trechos.map((trecho, indice) => {
        if (trecho.variavelVazia) {
          const rotulo = `Falta: ${trecho.variavelVazia}`;
          return aoClicarVariavel ? (
            <button key={indice} type="button" onClick={() => aoClicarVariavel(trecho.variavelVazia as string)} className="rounded-sm bg-warn-wash px-1 font-mono text-[0.85em] text-warn underline">
              {rotulo}
            </button>
          ) : (
            <span key={indice} className="rounded-sm bg-warn-wash px-1 font-mono text-[0.85em] text-warn">
              {rotulo}
            </span>
          );
        }
        return (
          <span key={indice} className={cn(trecho.negrito && 'font-bold', trecho.italico && 'italic')}>
            {trecho.texto}
          </span>
        );
      })}
    </>
  );
}

/**
 * O documento: tudo é texto do React, nunca HTML, então nada digitado vira script. No corpo, 12pt ou mais
 * (RN-11.40). Rascunho leva a marca d'água, e o documento emitido com modelo não validado leva o aviso (RN-09.13).
 */
export function DocumentoRenderizadoVista({ nos, rascunho = false, aviso, aoClicarVariavel, className }: { nos: readonly NoDocumento[]; rascunho?: boolean; aviso?: string | null; aoClicarVariavel?: (nome: string) => void; className?: string }) {
  return (
    <article className={cn('relative overflow-hidden rounded-md border border-line bg-white px-4 py-5 text-[12pt] leading-[1.55] break-words text-ink md:px-8 md:py-7 print:border-0 print:p-0', className)}>
      {rascunho && (
        <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[clamp(48px,12vw,120px)] font-bold tracking-[.08em] text-ink/[.07] select-none print:text-ink/[.1]">
          <span className="-rotate-[28deg]">RASCUNHO</span>
        </span>
      )}
      {rascunho && <p className="mb-3 text-[12pt] font-bold">RASCUNHO: sem validade como documento final.</p>}
      {aviso && <p className="mb-3 rounded-sm bg-warn-wash p-2 text-[12pt] font-semibold text-warn">{aviso}</p>}
      {nos.map((no, indice) => {
        switch (no.tipo) {
          case 'titulo':
            return no.nivel === 1 ? (
              <h1 key={indice} className="mb-3 text-[16pt] leading-tight font-bold">
                <Trechos trechos={no.trechos} aoClicarVariavel={aoClicarVariavel} />
              </h1>
            ) : (
              <h2 key={indice} className="mt-5 mb-2 text-[13pt] leading-tight font-bold">
                <Trechos trechos={no.trechos} aoClicarVariavel={aoClicarVariavel} />
              </h2>
            );
          case 'regra':
            return <hr key={indice} className="my-5 border-line" />;
          case 'item':
            return (
              <p key={indice} className="mb-1 pl-5 -indent-3">
                <span aria-hidden>• </span>
                <Trechos trechos={no.trechos} aoClicarVariavel={aoClicarVariavel} />
              </p>
            );
          case 'tabela':
            return (
              <div key={indice} className="faixa-rolagem my-3">
                <table className="w-full border-collapse text-[12pt]">
                  <tbody>
                    {no.linhas.map((linha, l) => (
                      <tr key={l} className={cn(no.comCabecalho && l === 0 && 'bg-mist font-semibold')}>
                        {linha.map((celula, c) => (
                          <td key={c} className="border border-line px-2 py-1 align-top">
                            <Trechos trechos={celula} aoClicarVariavel={aoClicarVariavel} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <Fragment key={indice}>
                <p className={cn('mb-2', no.destaque && 'font-bold', no.naoAplicavel && 'text-ink-soft')}>
                  <Trechos trechos={no.trechos} aoClicarVariavel={aoClicarVariavel} />
                </p>
              </Fragment>
            );
        }
      })}
    </article>
  );
}
