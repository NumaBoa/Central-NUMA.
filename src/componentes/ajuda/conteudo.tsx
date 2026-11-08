import type { ReactNode } from 'react';
import { CircleCheck, CircleDashed, Clock3, Compass, Info, Lightbulb, ListChecks, MapPin, Target, TriangleAlert } from 'lucide-react';
import { ROTULOS_DISPONIBILIDADE, trechos } from '@/ajuda/texto';
import type { Artigo, Bloco, Disponibilidade, Procedimento } from '@/ajuda/tipos';
import { cn } from '@/lib/utils';

/*
 * O corpo dos artigos, igual na tela e no PDF: uma fonte só (pedido de Kimberly em 08/11/2026).
 * Sem estado e sem dados do navegador, para servir também à página de impressão.
 */

/** Texto com os nomes de botões e campos em destaque (`**assim**`). */
export function TextoMarcado({ texto }: { texto: string }) {
  return (
    <>
      {trechos(texto).map((trecho, indice) =>
        trecho.destaque ? (
          <strong key={indice} className="font-semibold text-ink">
            {trecho.texto}
          </strong>
        ) : (
          <span key={indice}>{trecho.texto}</span>
        ),
      )}
    </>
  );
}

const SELOS: Readonly<Record<Disponibilidade['tipo'], { classe: string; icone: typeof CircleCheck }>> = {
  disponivel: { classe: 'bg-ok-wash text-ok', icone: CircleCheck },
  condicao: { classe: 'bg-warn-wash text-warn', icone: CircleDashed },
  futuro: { classe: 'bg-mist text-ink-soft', icone: Clock3 },
};

/** Disponível, mediante condição ou ainda não implementado: sempre com ícone e texto, nunca só cor (CA-18.07). */
export function SeloDisponibilidade({ disponibilidade, className }: { disponibilidade: Disponibilidade; className?: string }) {
  const { classe, icone: Icone } = SELOS[disponibilidade.tipo];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs leading-4 font-semibold [&_svg]:size-[13px] [&_svg]:shrink-0', classe, className)}>
      <Icone aria-hidden />
      {ROTULOS_DISPONIBILIDADE[disponibilidade.tipo]}
    </span>
  );
}

/** A explicação da disponibilidade, quando há o que explicar. */
export function AvisoDeDisponibilidade({ disponibilidade }: { disponibilidade: Disponibilidade }) {
  if (disponibilidade.tipo === 'disponivel') return null;
  return (
    <Caixa tom={disponibilidade.tipo === 'condicao' ? 'atencao' : 'neutro'} icone={disponibilidade.tipo === 'condicao' ? CircleDashed : Clock3} rotulo={disponibilidade.tipo === 'condicao' ? 'Condição' : 'Planejamento'}>
      {disponibilidade.tipo === 'condicao' ? disponibilidade.condicao : `Este artigo explica um recurso que ainda não funciona na Central. Previsto para: ${disponibilidade.quando}.`}
    </Caixa>
  );
}

type Tom = 'info' | 'atencao' | 'sucesso' | 'neutro';
const TONS: Readonly<Record<Tom, string>> = {
  info: 'bg-indigo-wash text-ink [&_.rotulo-caixa]:text-indigo-dk [&_svg]:text-indigo-dk',
  atencao: 'bg-warn-wash text-ink [&_.rotulo-caixa]:text-warn [&_svg]:text-warn',
  sucesso: 'bg-ok-wash text-ink [&_.rotulo-caixa]:text-ok [&_svg]:text-ok',
  neutro: 'bg-mist text-ink [&_.rotulo-caixa]:text-ink-soft [&_svg]:text-ink-soft',
};

/** Caixa de orientação: tom da situação, ícone de traço e um rótulo curto. */
export function Caixa({ tom, icone: Icone, rotulo, children }: { tom: Tom; icone: typeof Info; rotulo: string; children: ReactNode }) {
  return (
    <div className={cn('caixa-de-orientacao flex gap-3 rounded-campo px-4 py-3 text-[14px] leading-6', TONS[tom])}>
      <Icone className="mt-[3px] size-[18px] shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="rotulo-caixa text-[12px] leading-4 font-semibold tracking-[.02em] uppercase">{rotulo}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function ItemDoProcedimento({ icone: Icone, rotulo, longo = false, children }: { icone: typeof Info; rotulo: string; longo?: boolean; children: ReactNode }) {
  return (
    <div className={cn('item-procedimento', longo && 'item-procedimento-longo', 'grid gap-1.5 md:grid-cols-[168px_minmax(0,1fr)] md:gap-4 print:grid-cols-[150px_minmax(0,1fr)] print:gap-4')}>
      <p className="flex items-center self-start gap-2 text-[13px] leading-6 font-semibold text-ink-soft [&_svg]:size-4 [&_svg]:shrink-0">
        <Icone aria-hidden />
        {rotulo}
      </p>
      <div className="min-w-0 text-[15px] leading-6">{children}</div>
    </div>
  );
}

/** Objetivo, o que é preciso antes, caminho, passos, resultado e cuidados: sempre nesta ordem. */
export function BlocoProcedimento({ bloco }: { bloco: Procedimento }) {
  return (
    <section className="procedimento grid gap-4 rounded-lg border border-line bg-paper p-4 md:p-5">
      {bloco.titulo && <h3 className="text-[17px] leading-6">{bloco.titulo}</h3>}
      <ItemDoProcedimento icone={Target} rotulo="Objetivo">
        <TextoMarcado texto={bloco.objetivo} />
      </ItemDoProcedimento>
      {bloco.antes.length > 0 && (
        <ItemDoProcedimento icone={ListChecks} rotulo="Antes de começar">
          <ul className="grid gap-1 pl-5 [list-style:disc] marker:text-ink-soft">
            {bloco.antes.map((item) => (
              <li key={item}>
                <TextoMarcado texto={item} />
              </li>
            ))}
          </ul>
        </ItemDoProcedimento>
      )}
      <ItemDoProcedimento icone={MapPin} rotulo="Onde fica">
        <TextoMarcado texto={bloco.caminho} />
      </ItemDoProcedimento>
      <ItemDoProcedimento icone={Compass} rotulo="Passo a passo" longo>
        <ol className="grid gap-2.5">
          {bloco.passos.map((passo, indice) => (
            <li key={passo} className="passo flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-wash text-[12px] font-semibold text-indigo-dk tabular-nums">{indice + 1}</span>
              <span className="min-w-0 pt-px">
                <TextoMarcado texto={passo} />
              </span>
            </li>
          ))}
        </ol>
      </ItemDoProcedimento>
      <Caixa tom="sucesso" icone={CircleCheck} rotulo="Resultado esperado">
        <TextoMarcado texto={bloco.resultado} />
      </Caixa>
      {bloco.cuidados && bloco.cuidados.length > 0 && (
        <Caixa tom="atencao" icone={TriangleAlert} rotulo="Cuidados e exceções">
          <ul className="grid gap-1 pl-5 [list-style:disc]">
            {bloco.cuidados.map((cuidado) => (
              <li key={cuidado}>
                <TextoMarcado texto={cuidado} />
              </li>
            ))}
          </ul>
        </Caixa>
      )}
    </section>
  );
}

export function BlocoDoArtigo({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case 'paragrafo':
      return (
        <p className="text-[15px] leading-7 text-pretty">
          <TextoMarcado texto={bloco.texto} />
        </p>
      );
    case 'subtitulo':
      return <h3 className="mt-2 text-[17px] leading-6">{bloco.texto}</h3>;
    case 'lista':
      return (
        <ul className="grid gap-1.5 pl-5 text-[15px] leading-7 [list-style:disc] marker:text-indigo">
          {bloco.itens.map((item) => (
            <li key={item}>
              <TextoMarcado texto={item} />
            </li>
          ))}
        </ul>
      );
    case 'termos':
      return (
        <div className="termos">
          {bloco.titulo && <h3 className="mb-2 text-[17px] leading-6">{bloco.titulo}</h3>}
          <dl className="overflow-hidden rounded-lg border border-line bg-paper">
            {bloco.itens.map((item) => (
              <div key={item.termo} className="termo grid gap-0.5 border-t border-line px-4 py-3 first:border-t-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-4 print:grid-cols-[170px_minmax(0,1fr)] print:gap-4">
                <dt className="text-[14px] leading-6 font-semibold">
                  <TextoMarcado texto={item.termo} />
                </dt>
                <dd className="text-[15px] leading-6 text-ink">
                  <TextoMarcado texto={item.significado} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case 'procedimento':
      return <BlocoProcedimento bloco={bloco} />;
    case 'exemplo':
      return (
        <Caixa tom="neutro" icone={Lightbulb} rotulo="Exemplo ilustrativo, com dados fictícios">
          <TextoMarcado texto={bloco.texto} />
        </Caixa>
      );
    case 'atencao':
      return (
        <Caixa tom="info" icone={Info} rotulo="Importante">
          <TextoMarcado texto={bloco.texto} />
        </Caixa>
      );
    case 'perguntas':
      return (
        <dl className="grid gap-3">
          {bloco.itens.map((item) => (
            <div key={item.pergunta} className="pergunta rounded-lg border border-line bg-paper px-4 py-3">
              <dt className="font-display text-[16px] leading-6 font-semibold">{item.pergunta}</dt>
              <dd className="mt-1 text-[15px] leading-6">
                <TextoMarcado texto={item.resposta} />
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}

/** O corpo inteiro: aviso de disponibilidade e blocos. */
export function CorpoDoArtigo({ artigo }: { artigo: Pick<Artigo, 'blocos' | 'disponibilidade'> }) {
  return (
    <div className="corpo-do-artigo grid gap-5">
      <AvisoDeDisponibilidade disponibilidade={artigo.disponibilidade} />
      {artigo.blocos.map((bloco, indice) => (
        <BlocoDoArtigo key={indice} bloco={bloco} />
      ))}
    </div>
  );
}
