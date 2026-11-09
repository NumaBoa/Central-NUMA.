import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Download, ExternalLink, FileText } from 'lucide-react';
import { MODULOS_DOS_MANUAIS, telaDoModulo } from '@/ajuda/modulos';
import { caminhoDoArtigo, caminhoDoPdf, dataPorExtenso, nomeDoPdf, semMarcas } from '@/ajuda/texto';
import type { Artigo, Manual } from '@/ajuda/tipos';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';
import { CorpoDoArtigo, SeloDisponibilidade, TextoMarcado } from './conteudo';

const KICKER = 'Como usar';

function BotaoBaixar({ manual }: { manual: Manual }) {
  return (
    <Button asChild variante="secundario">
      <a href={caminhoDoPdf(manual)} download={nomeDoPdf(manual)}>
        <Download aria-hidden />
        Baixar manual em PDF
      </a>
    </Button>
  );
}

function VoltarAoModulo({ manual }: { manual: Manual }) {
  return (
    <Button asChild variante="terciario">
      <LinkCentral href={manual.telaDoModulo}>
        <ArrowLeft aria-hidden />
        Voltar {manual.aoModulo}
      </LinkCentral>
    </Button>
  );
}

/** Os assuntos do manual, cada um com os artigos dele. No celular, fica recolhido. */
export function NavegacaoDoManual({ manual, atual }: { manual: Manual; atual?: string }) {
  const lista = (
    <nav aria-label={`Assuntos do manual ${manual.nome}`} className="grid gap-4">
      {manual.assuntos.map((assunto) => {
        const artigos = manual.artigos.filter((artigo) => artigo.assunto === assunto.id);
        return (
          <div key={assunto.id}>
            <p className="mb-1 px-3 text-xs font-semibold tracking-[.04em] text-ink-soft uppercase">{assunto.titulo}</p>
            <ul className="grid gap-0.5">
              {artigos.map((artigo) => (
                <li key={artigo.id}>
                  <LinkCentral
                    href={caminhoDoArtigo(manual, artigo)}
                    aria-current={artigo.id === atual ? 'page' : undefined}
                    className={cn('flex min-h-11 items-center rounded-sm px-3 py-1.5 text-[13px] leading-5 md:min-h-9', artigo.id === atual ? 'bg-active font-semibold text-ink' : 'text-ink-soft hover:bg-hover hover:text-ink')}
                  >
                    {artigo.titulo}
                  </LinkCentral>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
  return (
    <>
      <details className="group rounded-lg border border-line bg-paper lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2 [&_svg]:size-4">
            <BookOpen aria-hidden />
            Assuntos deste manual
          </span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-line p-2">{lista}</div>
      </details>
      <aside className="sticky top-[calc(var(--topbar)+20px)] hidden max-h-[calc(100dvh-var(--topbar)-40px)] overflow-y-auto pr-1 lg:block">{lista}</aside>
    </>
  );
}

/** A página inicial do manual: introdução e os artigos por assunto. */
export function InicioDoManual({ manual }: { manual: Manual }) {
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        ondas
        migalhas={['Como usar', manual.nome]}
        kicker={KICKER}
        titulo={`Manual ${manual.doModulo}`}
        resumo={manual.introducao}
        acoes={
          <>
            <BotaoBaixar manual={manual} />
            <VoltarAoModulo manual={manual} />
          </>
        }
      />
      <p className="text-xs text-ink-soft">
        Versão {manual.versao} · atualizada em {dataPorExtenso(manual.atualizadoEm)}
      </p>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <NavegacaoDoManual manual={manual} />
        <div className="grid gap-6">
          {manual.assuntos.map((assunto) => (
            <section key={assunto.id} aria-labelledby={`assunto-${assunto.id}`}>
              <h2 id={`assunto-${assunto.id}`} className="mb-3">
                {assunto.titulo}
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {manual.artigos
                  .filter((artigo) => artigo.assunto === assunto.id)
                  .map((artigo) => (
                    <li key={artigo.id}>
                      <LinkCentral href={caminhoDoArtigo(manual, artigo)} className="grid h-full gap-1.5 rounded-lg border border-line bg-paper p-4 transition-colors duration-150 hover:border-ink-soft">
                        <span className="font-display text-[16px] leading-6 font-semibold">{artigo.titulo}</span>
                        <span className="text-[13px] leading-5 text-ink-soft">{semMarcas(artigo.resumo)}</span>
                        {artigo.disponibilidade.tipo !== 'disponivel' && <SeloDisponibilidade disponibilidade={artigo.disponibilidade} className="justify-self-start" />}
                      </LinkCentral>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Vizinho({ manual, artigo, direcao }: { manual: Manual; artigo: Artigo | undefined; direcao: 'anterior' | 'proximo' }) {
  if (!artigo) return <span />;
  const Icone = direcao === 'anterior' ? ArrowLeft : ArrowRight;
  return (
    <LinkCentral href={caminhoDoArtigo(manual, artigo)} className={cn('grid min-h-11 gap-0.5 rounded-lg border border-line bg-paper px-4 py-3 hover:border-ink-soft', direcao === 'proximo' && 'text-right')}>
      <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-soft [&_svg]:size-3.5', direcao === 'proximo' && 'justify-end')}>
        {direcao === 'anterior' && <Icone aria-hidden />}
        {direcao === 'anterior' ? 'Anterior' : 'Próximo'}
        {direcao === 'proximo' && <Icone aria-hidden />}
      </span>
      <span className="text-[14px] font-semibold">{artigo.titulo}</span>
    </LinkCentral>
  );
}

/** Um artigo: abre direto pelo endereço, sem percorrer o manual. */
export function PaginaDoArtigo({ manual, artigo }: { manual: Manual; artigo: Artigo }) {
  const assunto = manual.assuntos.find((item) => item.id === artigo.assunto);
  const ordem = manual.assuntos.flatMap((item) => manual.artigos.filter((outro) => outro.assunto === item.id));
  const posicao = ordem.findIndex((item) => item.id === artigo.id);
  const acao = artigo.disponibilidade.tipo === 'futuro' ? null : artigo.acao;
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        ondas
        migalhas={['Como usar', manual.nome, assunto?.titulo ?? '']}
        kicker={`${KICKER} · ${manual.nome}`}
        titulo={artigo.titulo}
        resumo={<TextoMarcado texto={artigo.resumo} />}
        acoes={
          <Button asChild variante="terciario">
            <LinkCentral href={`/ajuda/${manual.slug}`}>
              <FileText aria-hidden />
              Manual completo
            </LinkCentral>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <NavegacaoDoManual manual={manual} atual={artigo.id} />
        <article className="grid max-w-[760px] min-w-0 content-start gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <SeloDisponibilidade disponibilidade={artigo.disponibilidade} />
            {acao && (
              <Button asChild>
                <LinkCentral href={acao.href}>
                  <ExternalLink aria-hidden />
                  Ir para essa ação: {acao.rotulo}
                </LinkCentral>
              </Button>
            )}
          </div>
          {acao && <p className="-mt-2 text-xs text-ink-soft">O atalho só abre a tela. Nada é feito nem alterado sozinho.</p>}
          <CorpoDoArtigo artigo={artigo} />
          <div className="mt-4 grid gap-2 border-t border-line pt-5 sm:grid-cols-2">
            <Vizinho manual={manual} artigo={ordem[posicao - 1]} direcao="anterior" />
            <Vizinho manual={manual} artigo={ordem[posicao + 1]} direcao="proximo" />
          </div>
          <p className="text-xs text-ink-soft">
            Manual {manual.doModulo}, versão {manual.versao}, atualizado em {dataPorExtenso(manual.atualizadoEm)}.
          </p>
        </article>
      </div>
    </div>
  );
}

/** Todos os módulos, cada um com o seu manual. Os ainda não escritos aparecem como "em preparação". */
export function IndiceDosManuais() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina ondas kicker={KICKER} titulo="Manuais da Central" resumo="Um manual para cada módulo, com artigos curtos. Abra o assunto que você procura, ou baixe o manual em PDF." />
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MODULOS_DOS_MANUAIS.map((modulo) => {
          const tela = telaDoModulo(modulo);
          const conteudo = (
            <>
              <span className="text-xs font-semibold text-ink-soft tabular-nums">{modulo.codigo}</span>
              <span className="font-display text-[17px] leading-6 font-semibold">{modulo.nome}</span>
              <span className="text-[13px] leading-5 text-ink-soft">
                {modulo.manual ? `${modulo.manual.artigos.length} artigos · versão ${modulo.manual.versao}` : tela ? 'Manual em preparação.' : 'Módulo ainda sem tela própria. Manual em preparação.'}
              </span>
            </>
          );
          return (
            <li key={modulo.codigo}>
              {modulo.manual ? (
                <LinkCentral href={`/ajuda/${modulo.slug}`} className="grid h-full gap-1 rounded-lg border border-line bg-paper p-4 hover:border-ink-soft">
                  {conteudo}
                </LinkCentral>
              ) : (
                <div className="grid h-full gap-1 rounded-lg border border-dashed border-line p-4 text-ink-soft">{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
