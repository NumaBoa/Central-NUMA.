import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CircleCheck, CircleDashed, Clock3 } from 'lucide-react';
import { manuaisPublicados, manualPorSlug } from '@/ajuda/modulos';
import { assinaturaDoManual, dataPorExtenso, ROTULOS_DISPONIBILIDADE } from '@/ajuda/texto';
import type { Manual } from '@/ajuda/tipos';
import { CorpoDoArtigo, SeloDisponibilidade, TextoMarcado } from '@/componentes/ajuda/conteudo';
import { Logo } from '@/componentes/marca/logo';
import './impressao.css';

/*
 * A versão para impressão de um manual: é dela que sai o PDF (`scripts/gerar-manuais.mjs`), com o mesmo conteúdo
 * da tela. Fica fora da moldura da Central e não lê nada do navegador: só textos escritos e exemplos fictícios.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return manuaisPublicados().map((manual) => ({ modulo: manual.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }): Promise<Metadata> {
  const manual = manualPorSlug((await params).modulo);
  // É o título do PDF, o que o leitor de PDF mostra na janela.
  return { title: { absolute: manual ? `Manual ${manual.doModulo} · Central Numa` : 'Manual' }, robots: { index: false } };
}

/** As ondas da marca, em versão larga para a capa. */
function OndasDaCapa() {
  return (
    <svg aria-hidden className="ondas-da-capa" viewBox="0 0 800 220" preserveAspectRatio="none" fill="none">
      {[48, 74, 100, 126, 152, 178].map((base, i) => (
        <path key={base} d={`M0 ${base} C 160 ${base - 26 + i * 4}, 330 ${base + 30 - i * 5}, 500 ${base - 8} S 720 ${base + 18 - i * 3}, 800 ${base - 14}`} stroke="#2B2421" strokeOpacity=".13" strokeWidth="1" />
      ))}
      <path d="M0 118 C 170 66, 300 176, 470 110 S 700 60, 800 92" stroke="#6366F1" strokeOpacity=".7" strokeWidth="1.8" />
    </svg>
  );
}

function Capa({ manual }: { manual: Manual }) {
  return (
    <section className="capa">
      <div className="capa-topo">
        <Logo className="text-[46px]" />
        <p className="capa-kicker">Central Numa · Manual de uso</p>
      </div>
      <div className="capa-meio">
        <h1>Manual {manual.doModulo}</h1>
        <p className="capa-intro">{manual.introducao}</p>
      </div>
      <OndasDaCapa />
      <div className="capa-rodape">
        <dl className="capa-dados">
          <div>
            <dt>Versão</dt>
            <dd>{manual.versao}</dd>
          </div>
          <div>
            <dt>Atualizado em</dt>
            <dd>{dataPorExtenso(manual.atualizadoEm)}</dd>
          </div>
          <div>
            <dt>Artigos</dt>
            <dd>{manual.artigos.length}</dd>
          </div>
        </dl>
        <div className="capa-legenda">
          <p className="capa-legenda-titulo">Como ler este manual</p>
          <ul>
            <li>
              <CircleCheck aria-hidden />
              <span>
                <strong>{ROTULOS_DISPONIBILIDADE.disponivel}</strong>: funciona hoje na Central.
              </span>
            </li>
            <li>
              <CircleDashed aria-hidden />
              <span>
                <strong>{ROTULOS_DISPONIBILIDADE.condicao}</strong>: funciona, com a condição explicada no artigo.
              </span>
            </li>
            <li>
              <Clock3 aria-hidden />
              <span>
                <strong>{ROTULOS_DISPONIBILIDADE.futuro}</strong>: previsto para outra fase, indicada no artigo; ainda não funciona.
              </span>
            </li>
          </ul>
          <p>Os exemplos são ilustrativos, com dados fictícios. Os nomes em destaque são os de botões, campos e telas.</p>
        </div>
      </div>
    </section>
  );
}

/** O sumário: os números das páginas entram na segunda passada do gerador. */
function Sumario({ manual }: { manual: Manual }) {
  return (
    <section className="sumario" aria-labelledby="titulo-sumario">
      <h2 id="titulo-sumario">Sumário</h2>
      {manual.assuntos.map((assunto) => (
        <div key={assunto.id} className="sumario-assunto">
          <p className="sumario-assunto-titulo">{assunto.titulo}</p>
          <ol>
            {manual.artigos
              .filter((artigo) => artigo.assunto === assunto.id)
              .map((artigo) => (
                <li key={artigo.id}>
                  <a href={`#artigo-${artigo.id}`} data-sumario={artigo.id}>
                    <span className="sumario-titulo">{artigo.titulo}</span>
                    <span className="sumario-pontos" aria-hidden />
                    <span className="sumario-pagina" data-pagina-de={artigo.id}>
                      00
                    </span>
                  </a>
                </li>
              ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

export default async function ManualParaImpressao({ params }: { params: Promise<{ modulo: string }> }) {
  const manual = manualPorSlug((await params).modulo);
  if (!manual) notFound();
  return (
    <main className="manual-impressao" data-arquivo={manual.arquivo} data-assinatura={assinaturaDoManual(manual)} data-manual={manual.slug} data-rotulo={`Manual ${manual.doModulo}`} data-versao={`Versão ${manual.versao} · ${dataPorExtenso(manual.atualizadoEm)}`}>
      {/* O rodapé de cada folha diz de que manual ela é: o texto muda por módulo, então vem daqui. */}
      <style>{`@page { @bottom-left { content: ${JSON.stringify(`Manual ${manual.doModulo} · versão ${manual.versao}`)}; } }`}</style>
      <Capa manual={manual} />
      <Sumario manual={manual} />
      {manual.assuntos.map((assunto) => (
        <section key={assunto.id} className="assunto" aria-labelledby={`assunto-${assunto.id}`}>
          <p className="assunto-kicker">{manual.nome}</p>
          <h2 id={`assunto-${assunto.id}`} className="assunto-titulo">
            {assunto.titulo}
          </h2>
          {manual.artigos
            .filter((artigo) => artigo.assunto === assunto.id)
            .map((artigo) => (
              <article key={artigo.id} id={`artigo-${artigo.id}`} className="artigo">
                <header className="artigo-cabecalho">
                  <h3>{artigo.titulo}</h3>
                  <p className="artigo-resumo">
                    <TextoMarcado texto={artigo.resumo} />
                  </p>
                  <div className="artigo-selos">
                    <SeloDisponibilidade disponibilidade={artigo.disponibilidade} />
                    {artigo.acao && artigo.disponibilidade.tipo !== 'futuro' && (
                      <span className="artigo-onde">
                        Na Central: <strong>{artigo.acao.rotulo}</strong> ({artigo.acao.href})
                      </span>
                    )}
                  </div>
                </header>
                <CorpoDoArtigo artigo={artigo} />
              </article>
            ))}
        </section>
      ))}
    </main>
  );
}
