'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Clock3, Info, MessageSquare, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Logo } from '@/componentes/marca/logo';
import { BotaoComoUsar } from '@/componentes/ajuda/botao-como-usar';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { EtiquetaContexto } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { dataPorExtenso, saudacao } from '@/dominio/atividades';
import { carregarResumoDiario, type ItemDoResumo, type SecaoDoResumo } from '@/dominio/resumo-diario';
import { hojeISO, rotuloDoFuso } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

function BlocoDoEmail({ icone: Icone, titulo, contador, direita, children, atencao = false }: { icone: LucideIcon; titulo: string; contador?: number; direita?: ReactNode; children: ReactNode; atencao?: boolean }) {
  return (
    <section className="overflow-hidden rounded-md border border-line">
      <header className="flex flex-wrap items-center gap-2.5 bg-mist px-4 py-2.5 [&_svg]:size-5 [&_svg]:shrink-0">
        <Icone aria-hidden className={atencao ? 'text-err' : 'text-ink'} />
        <h2 className="text-[17px] leading-6">{titulo}</h2>
        {contador !== undefined && <span className="rounded-pill bg-paper px-2 text-xs leading-[18px] font-semibold text-ink-soft tabular-nums">{contador}</span>}
        {direita && <span className="ml-auto text-[13px] text-ink-soft">{direita}</span>}
      </header>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

const LinkDoEmail = ({ href, children }: { href: string; children: ReactNode }) => (
  <Button asChild variante="secundario" tamanho="pequeno" className="shrink-0">
    <LinkCentral href={href}>
      {children}
      <ArrowUpRight aria-hidden />
    </LinkCentral>
  </Button>
);

function LinhaDeAtividade({ item, atencao = false, rotulo = 'Abrir' }: { item: ItemDoResumo; atencao?: boolean; rotulo?: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5">
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-semibold break-words">{item.titulo}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-soft">
          {item.contextos.map((contexto) => (
            <EtiquetaContexto key={contexto.id} contexto={contexto} />
          ))}
        </p>
      </div>
      <p className={cn('flex items-center gap-1.5 text-[13px] [&_svg]:size-[15px] [&_svg]:shrink-0', atencao ? 'font-semibold text-err' : 'text-ink-soft')}>
        {atencao ? <TriangleAlert aria-hidden /> : <Clock3 aria-hidden />}
        {item.detalhe}
      </p>
      <LinkDoEmail href={item.href}>{rotulo}</LinkDoEmail>
    </li>
  );
}

const faltam = ({ total, itens }: SecaoDoResumo) => total - itens.length;

const QuantasMais = ({ secao }: { secao: SecaoDoResumo }) => (faltam(secao) > 0 ? <li className="px-4 py-2 text-[13px] text-ink-soft">E mais {faltam(secao)} no Meu dia.</li> : null);

const Numero = ({ icone: Icone, rotulo, valor, classe }: { icone: LucideIcon; rotulo: string; valor: number; classe: string }) => (
  <div className="flex items-center gap-3 rounded-md border border-line px-3.5 py-3">
    <span aria-hidden className={cn('grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5', classe)}>
      <Icone />
    </span>
    <span className="min-w-0">
      <span className="block text-[13px]">{rotulo}</span>
      <strong className="block texto-kpi tabular-nums">{valor}</strong>
    </span>
  </div>
);

/** T03.06: a prévia do e-mail, com os dados deste navegador. Nada é enviado: o envio depende do servidor. */
export function TelaResumoDiario() {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarResumoDiario(pessoa.id, pessoa.nome, hoje), [pessoa.id, pessoa.nome, hoje]);
  const resumo = consulta.dados;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !resumo) {
    return (
      <>
        <h1 className="mb-5">Resumo diário por e-mail</h1>
        <EstadoErro titulo="Não deu para montar a prévia." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const nadaAVer = !resumo.atrasadas.total && !resumo.paraHoje.total && !resumo.aguardando.total && !resumo.proximos.length;
  const totalDeHoje = resumo.paraHoje.total + resumo.aguardando.total;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        ondas
        migalhas={['Meu dia', 'Rotinas', 'Resumo diário']}
        kicker="Meu dia"
        titulo="Resumo diário por e-mail"
        resumo="Como o e-mail vai ficar. É só uma prévia, com os dados deste navegador."
        acoes={
          <>
            <BotaoComoUsar href="/ajuda/meu-dia/previa-resumo-diario" />
            <Button asChild variante="secundario">
              <LinkCentral href="/meu-dia/rotinas">
                <ArrowLeft aria-hidden />
                Voltar às Rotinas
              </LinkCentral>
            </Button>
          </>
        }
      />
      <Faixa className="mx-auto max-w-[720px]">Nenhum e-mail é enviado nesta etapa. O envio chega com o servidor. Para ver o de outra pessoa, troque em “Você é”.</Faixa>

      <article aria-label="Prévia do e-mail" className="mx-auto max-w-[720px]">
        <dl className="mb-3 grid gap-0.5 px-1 text-[13px]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">Assunto</dt>
            <dd data-assunto>{resumo.assunto}</dd>
          </div>
          <div className="flex flex-wrap gap-x-5">
            <div className="flex gap-1.5">
              <dt className="font-semibold">De:</dt>
              <dd>Central Numa</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold">Para:</dt>
              <dd>{pessoa.nome}</dd>
            </div>
          </div>
        </dl>

        <div className="space-y-4 rounded-lg border border-line bg-paper p-4 md:p-7">
          <header>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Logo className="text-[28px]" />
                <p className="mt-1 text-xs font-medium tracking-[.14em] text-ink-soft uppercase">Central Numa</p>
              </div>
              <p className="text-[13px] text-ink-soft first-letter:uppercase">{dataPorExtenso()}</p>
            </div>
            <p className="mt-5 texto-display">
              {saudacao()}, {resumo.nome}.
            </p>
            <p className="mt-2 text-base">
              Hoje você tem <mark>{resumo.itens}</mark> para acompanhar{resumo.atrasadas.total ? ` e ${resumo.atrasadas.total === 1 ? '1 atrasado' : `${resumo.atrasadas.total} atrasados`}` : ''}.
            </p>
            <p className="text-sm text-ink-soft">Um passo de cada vez, numa boa.</p>
          </header>

          <div className="grid gap-2 md:grid-cols-3">
            <Numero icone={TriangleAlert} rotulo="Atrasadas" valor={resumo.atrasadas.total} classe="bg-err-wash text-err" />
            <Numero icone={CalendarDays} rotulo="Para hoje" valor={totalDeHoje} classe="bg-ok-wash text-ok" />
            <Numero icone={MessageSquare} rotulo="Aguardando retorno" valor={resumo.aguardando.total} classe="bg-warn-wash text-warn" />
          </div>
          {resumo.aguardando.total > 0 && (
            <p className="flex items-center gap-1.5 text-[13px] text-ink-soft [&_svg]:size-4 [&_svg]:shrink-0">
              <Info aria-hidden />O acompanhamento de retorno está incluído nos itens de hoje.
            </p>
          )}

          {resumo.atrasadas.total > 0 && (
            <BlocoDoEmail icone={TriangleAlert} titulo="Atrasadas" contador={resumo.atrasadas.total} atencao>
              {resumo.atrasadas.itens.map((item) => (
                <LinhaDeAtividade key={item.id} item={item} atencao />
              ))}
              <QuantasMais secao={resumo.atrasadas} />
            </BlocoDoEmail>
          )}
          {resumo.paraHoje.total > 0 && (
            <BlocoDoEmail icone={CalendarDays} titulo="Para hoje">
              {resumo.paraHoje.itens.map((item) => (
                <LinhaDeAtividade key={item.id} item={item} />
              ))}
              <QuantasMais secao={resumo.paraHoje} />
            </BlocoDoEmail>
          )}
          {resumo.aguardando.total > 0 && (
            <BlocoDoEmail icone={MessageSquare} titulo="Aguardando retorno">
              {resumo.aguardando.itens.map((item) => (
                <LinhaDeAtividade key={item.id} item={item} rotulo="Acompanhar" />
              ))}
              <QuantasMais secao={resumo.aguardando} />
            </BlocoDoEmail>
          )}
          {resumo.proximos.length > 0 && (
            <BlocoDoEmail icone={Clock3} titulo="Próximos 7 dias" direita={resumo.periodoDosProximos}>
              {resumo.proximos.map((evento) => (
                <li key={evento.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-semibold break-words">
                      {formatarDiaISO(evento.dia).slice(0, 5)} · {evento.titulo}
                    </p>
                    <p className="text-[13px] text-ink-soft">{evento.detalhe}</p>
                  </div>
                  <LinkDoEmail href={evento.href}>{evento.acao}</LinkDoEmail>
                </li>
              ))}
            </BlocoDoEmail>
          )}
          {nadaAVer && <p className="rounded-md bg-mist px-4 py-6 text-center text-sm text-ink-soft">Tudo em dia por aqui. Nada para hoje nem nos próximos 7 dias.</p>}

          <div className="flex flex-col items-center gap-2 pt-1">
            <Button asChild>
              <LinkCentral href="/meu-dia">
                Abrir Meu dia
                <ArrowRight aria-hidden />
              </LinkCentral>
            </Button>
            <p className="text-center text-[13px] text-ink-soft">Veja os detalhes e atualize suas atividades na Central.</p>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
            <span className="font-semibold">Tecnologia que simplifica a vida.</span>
            <span className="text-ink-soft">
              Resumo de {formatarDiaISO(hoje)} · {rotuloDoFuso()}
            </span>
          </footer>
        </div>
      </article>
    </div>
  );
}
