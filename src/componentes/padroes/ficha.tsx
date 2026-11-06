'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Faixa } from './faixa';

export type AbaFicha = { id: string; rotulo: string; conteudo: ReactNode };

type FichaProps = {
  codigo?: string;
  titulo: string;
  /** A ficha é a página inteira: o título é o `h1` dela. */
  tituloDePagina?: boolean;
  /** Situação e contexto. */
  etiquetas?: ReactNode;
  responsavel?: ReactNode;
  /** Ações principais: à direita no computador. */
  acoes?: ReactNode;
  /** Ações em barra fixa inferior no celular (18 §10.4). */
  acoesCelular?: ReactNode;
  abas: readonly AbaFicha[];
  /** Vínculos, arquivos e próximos eventos: à direita em telas largas, abaixo nas demais. */
  lateral?: ReactNode;
  /** Registro arquivado: faixa no topo com a ação de restaurar (02 §5). */
  arquivado?: { texto: string; acao?: ReactNode };
};

/** Ficha de um registro (P2). */
export function Ficha({ codigo, titulo, tituloDePagina = false, etiquetas, responsavel, acoes, acoesCelular, abas, lateral, arquivado }: FichaProps) {
  const Titulo = tituloDePagina ? 'h1' : 'h2';
  return (
    <article className={acoesCelular ? 'pb-20 md:pb-0' : undefined}>
      {arquivado && (
        <Faixa tipo="atencao" acao={arquivado.acao} className="mb-4">
          {arquivado.texto}
        </Faixa>
      )}
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          {codigo && <p className="text-xs font-semibold text-ink-soft tabular-nums">{codigo}</p>}
          <Titulo className="mt-1">{titulo}</Titulo>
          {etiquetas && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{etiquetas}</div>}
          {responsavel && <div className="mt-2.5 text-[13px] text-ink-soft">{responsavel}</div>}
        </div>
        {acoes && <div className="hidden flex-wrap items-center gap-2 md:flex">{acoes}</div>}
      </header>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Tabs defaultValue={abas[0]?.id} className="min-w-0">
          <TabsList aria-label={`Seções de ${titulo}`}>
            {abas.map((aba) => (
              <TabsTrigger key={aba.id} value={aba.id}>
                {aba.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
          {abas.map((aba) => (
            <TabsContent key={aba.id} value={aba.id} className="mt-4 text-sm">
              {aba.conteudo}
            </TabsContent>
          ))}
        </Tabs>
        {lateral && <aside className="min-w-0 space-y-3 text-[13px]">{lateral}</aside>}
      </div>

      {acoesCelular && (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottombar)+var(--area-segura-baixo))] z-20 flex gap-2 border-t border-line bg-glass p-3 backdrop-blur-[14px] md:hidden [&>*]:flex-1">{acoesCelular}</div>
      )}
    </article>
  );
}
