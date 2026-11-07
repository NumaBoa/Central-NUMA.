'use client';

import { useRef, useState, type TouchEvent } from 'react';
import { ChevronRight, Ellipsis } from 'lucide-react';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { COLUNAS_DO_QUADRO, ROTULOS_SITUACAO_ATIVIDADE, type AtividadeDoDia, type ColunaDoQuadro, type DadosMeuDia } from '@/dominio/atividades';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';
import type { AcoesDaAtividade } from './acoes-atividade';
import { CartaoDoQuadro } from './cartao-atividade';

/** T03.01: carregamento progressivo de 30 cartões por coluna. */
const CARTOES_POR_VEZ = 30;

const ROTULOS_COLUNA: Readonly<Record<ColunaDoQuadro, string>> = { a_fazer: ROTULOS_SITUACAO_ATIVIDADE.a_fazer, em_andamento: ROTULOS_SITUACAO_ATIVIDADE.em_andamento, aguardando: ROTULOS_SITUACAO_ATIVIDADE.aguardando, concluida: 'Concluída hoje' };
const ROTULOS_ABA: Readonly<Record<ColunaDoQuadro, string>> = { a_fazer: 'A fazer', em_andamento: 'Em andamento', aguardando: 'Aguardando', concluida: 'Concluídas' };

type QuadroProps = {
  colunas: Record<ColunaDoQuadro, AtividadeDoDia[]>;
  dados: DadosMeuDia;
  hoje: string;
  acoes: AcoesDaAtividade;
  recenteId: string | null;
};

function CartoesDaColuna({ coluna, linhas, dados, hoje, acoes, recenteId, arrastandoId, setArrastandoId }: { coluna: ColunaDoQuadro; linhas: readonly AtividadeDoDia[]; arrastandoId: string | null; setArrastandoId: (id: string | null) => void } & Omit<QuadroProps, 'colunas'>) {
  const [limite, setLimite] = useState(CARTOES_POR_VEZ);
  if (!linhas.length) return <p className="px-2 py-3 text-center text-[13px] text-ink-soft">{coluna === 'concluida' ? 'Nada concluído hoje ainda.' : 'Nada aqui.'}</p>;
  return (
    <>
      <ul className="grid gap-2">
        {linhas.slice(0, limite).map((atividade) => (
          <li key={atividade.id}>
            <CartaoDoQuadro atividade={atividade} dados={dados} hoje={hoje} acoes={acoes} arrastando={arrastandoId === atividade.id} recente={recenteId === atividade.id} aoComecarArrasto={setArrastandoId} aoTerminarArrasto={() => setArrastandoId(null)} />
          </li>
        ))}
      </ul>
      {linhas.length > limite && (
        <div className="mt-2 flex justify-center">
          <Button variante="terciario" tamanho="pequeno" onClick={() => setLimite((atual) => atual + CARTOES_POR_VEZ)}>
            Ver mais {Math.min(CARTOES_POR_VEZ, linhas.length - limite)}
          </Button>
        </div>
      )}
    </>
  );
}

/** Abas por situação no celular, com uma coluna por vez; deslizar troca de aba (18 §10.4). */
function QuadroNoCelular({ colunas, dados, hoje, acoes, recenteId }: QuadroProps) {
  const [aba, setAba] = useState<ColunaDoQuadro>('a_fazer');
  const inicio = useRef<{ x: number; y: number } | null>(null);

  function aoSoltar(evento: TouchEvent) {
    const toque = evento.changedTouches[0];
    if (!toque || !inicio.current) return;
    const dx = toque.clientX - inicio.current.x;
    const dy = toque.clientY - inicio.current.y;
    inicio.current = null;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const atual = COLUNAS_DO_QUADRO.indexOf(aba);
    const proxima = COLUNAS_DO_QUADRO[atual + (dx < 0 ? 1 : -1)];
    if (proxima) setAba(proxima);
  }

  return (
    <Tabs value={aba} onValueChange={(valor) => setAba(valor as ColunaDoQuadro)}>
      <TabsList aria-label="Situações">
        {COLUNAS_DO_QUADRO.map((coluna) => (
          <TabsTrigger key={coluna} value={coluna}>
            {ROTULOS_ABA[coluna]} {colunas[coluna].length}
          </TabsTrigger>
        ))}
      </TabsList>
      {COLUNAS_DO_QUADRO.map((coluna) => (
        <TabsContent
          key={coluna}
          value={coluna}
          className="mt-3 min-h-40"
          onTouchStart={(evento) => {
            const toque = evento.touches[0];
            if (toque) inicio.current = { x: toque.clientX, y: toque.clientY };
          }}
          onTouchEnd={aoSoltar}
        >
          <CartoesDaColuna coluna={coluna} linhas={colunas[coluna]} dados={dados} hoje={hoje} acoes={acoes} recenteId={recenteId} arrastandoId={null} setArrastandoId={() => {}} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function QuadroNoComputador({ colunas, dados, hoje, acoes, recenteId }: QuadroProps) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [sobre, setSobre] = useState<ColunaDoQuadro | null>(null);
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<ColunaDoQuadro>>(new Set());

  const alternar = (coluna: ColunaDoQuadro) =>
    setRecolhidas((atuais) => {
      const novas = new Set(atuais);
      if (!novas.delete(coluna)) novas.add(coluna);
      return novas;
    });

  function soltar(coluna: ColunaDoQuadro) {
    const atividade = Object.values(colunas)
      .flat()
      .find((item) => item.id === arrastandoId);
    setArrastandoId(null);
    setSobre(null);
    if (atividade) acoes.mover(atividade, coluna);
  }

  return (
    <div className="faixa-rolagem flex items-start gap-3 pb-2">
      {COLUNAS_DO_QUADRO.map((coluna) => {
        const recolhida = recolhidas.has(coluna);
        const rotulo = ROTULOS_COLUNA[coluna];
        return (
          <section
            key={coluna}
            aria-label={rotulo}
            data-coluna={coluna}
            onDragOver={(evento) => {
              if (!arrastandoId) return;
              evento.preventDefault();
              evento.dataTransfer.dropEffect = 'move';
              setSobre(coluna);
            }}
            onDragLeave={(evento) => {
              if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setSobre((atual) => (atual === coluna ? null : atual));
            }}
            onDrop={(evento) => {
              evento.preventDefault();
              soltar(coluna);
            }}
            className={cn('rounded-lg border border-line bg-mist/70 p-2 outline-offset-[-2px]', recolhida ? 'w-14 shrink-0' : 'min-w-[240px] flex-1 basis-0', sobre === coluna && 'outline-2 outline-indigo outline-dashed')}
          >
            <div className={cn('flex items-center gap-2 px-1.5 py-1', recolhida && 'flex-col')}>
              {recolhida ? (
                <Button variante="icone" tamanho="icone" aria-expanded={false} aria-label={`Expandir ${rotulo}`} onClick={() => alternar(coluna)}>
                  <ChevronRight aria-hidden />
                </Button>
              ) : (
                <div className="order-last ml-auto">
                  <MenuSobreposto
                    titulo={rotulo}
                    largura={220}
                    alinhar="end"
                    gatilho={
                      <Button variante="icone" tamanho="icone" aria-label={`Ações da coluna ${rotulo}`} className="md:size-8">
                        <Ellipsis aria-hidden />
                      </Button>
                    }
                  >
                    {(fechar) => (
                      <button
                        type="button"
                        className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')}
                        onClick={() => {
                          fechar();
                          alternar(coluna);
                        }}
                      >
                        Recolher coluna
                      </button>
                    )}
                  </MenuSobreposto>
                </div>
              )}
              <h2 className={cn('font-display text-[15px] leading-[22px] font-semibold tracking-[-.01em] whitespace-nowrap', recolhida && '[writing-mode:vertical-rl]')}>{rotulo}</h2>
              <span className="rounded-pill bg-paper px-2 text-xs leading-[18px] font-semibold text-ink-soft tabular-nums">{colunas[coluna].length}</span>
            </div>
            {!recolhida && (
              <div className="mt-1">
                <CartoesDaColuna coluna={coluna} linhas={colunas[coluna]} dados={dados} hoje={hoje} acoes={acoes} recenteId={recenteId} arrastandoId={arrastandoId} setArrastandoId={setArrastandoId} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Quadro (P4 e 18 §9.8). Arrastar muda a situação, e o menu do cartão faz o mesmo sem arrastar (CA-03.03). */
export function QuadroAtividades(props: QuadroProps) {
  const celular = useEhCelular();
  return celular ? <QuadroNoCelular {...props} /> : <QuadroNoComputador {...props} />;
}
