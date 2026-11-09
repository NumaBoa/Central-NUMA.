'use client';

import { ExternalLink, History, Pencil, TrendingUp } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { CartaoDaFicha, textoDoPrecoComPeriodo } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { textoDoPrazo } from '@/dominio/atividades';
import { CAMINHO_DA_ATIVIDADE } from '@/dominio/atividades-painel';
import { decisoesDoProduto } from '@/dominio/decisoes';
import { DEFINICAO_PENDENTE } from '@/dominio/kpis';
import { estagiosDoProduto, ROTULOS_ESTAGIO, textoDoCusto, type LinhaDoPortfolio } from '@/dominio/portfolio';
import { NAO_DEFINIDO, ofertasDoProduto } from '@/dominio/precificacao';
import { ROTULOS_ASSUNTO_DECISAO } from '@/dominio/decisoes';
import { rotuloDaCompetencia } from '@/dominio/titulos';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';

function Bloco({ titulo, children }: { titulo: string; children: string | null | undefined }) {
  return (
    <CartaoDaFicha titulo={titulo}>
      {children ? <p className="break-words whitespace-pre-line">{children}</p> : <p className="text-ink-soft">Não informado.</p>}
    </CartaoDaFicha>
  );
}

function Resumo({ titulo, valor, contexto }: { titulo: string; valor: string; contexto?: string }) {
  return (
    <section className="rounded-lg border border-line bg-paper p-4">
      <h3 className="text-[13px] font-semibold text-ink-soft">{titulo}</h3>
      <p className="mt-1 font-display text-lg leading-6 font-semibold break-words">{valor}</p>
      {contexto && <p className="mt-1 text-xs text-ink-soft">{contexto}</p>}
    </section>
  );
}

/** Visão geral: a parte do produto à esquerda; à direita, o que vem das outras áreas, sem cópia. */
export function AbaVisaoGeral({ linha, aoEditar, hoje }: { linha: LinhaDoPortfolio; aoEditar: () => void; hoje: string }) {
  const ofertas = useConsulta(() => ofertasDoProduto(linha.id, hoje), [linha.id, hoje]);
  const vigentes = ofertas.dados?.ofertas.flatMap((oferta) => oferta.vigentes.map((preco) => ({ oferta: oferta.nome, preco }))) ?? [];
  const custo = linha.custo;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid content-start gap-3">
        <div className="flex justify-end">
          <Button variante="terciario" tamanho="pequeno" onClick={aoEditar}>
            <Pencil aria-hidden />
            Completar a ficha
          </Button>
        </div>
        <Bloco titulo="Descrição">{linha.descricao ?? linha.descricao_curta}</Bloco>
        <Bloco titulo="Proposta de valor">{linha.proposta_valor}</Bloco>
        <Bloco titulo="Público">{linha.publico}</Bloco>
        <Bloco titulo="Problema que resolve">{linha.problema}</Bloco>
        <Bloco titulo="Como nasceu">{linha.como_nasceu}</Bloco>
        <CartaoDaFicha titulo="Links">
          {linha.links?.length ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {linha.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 underline md:min-h-0 [&_svg]:size-3.5">
                    {link.rotulo}
                    <ExternalLink aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">Não informado.</p>
          )}
        </CartaoDaFicha>
      </div>
      <aside className="grid content-start gap-3" aria-label="Resumo do produto">
        <CartaoDaFicha titulo="Próximas atividades">
          {linha.proximasAtividades.length ? (
            <ul className="grid gap-2">
              {linha.proximasAtividades.map((atividade) => {
                const prazo = textoDoPrazo(atividade, hoje);
                return (
                  <li key={atividade.id} className="text-[13px]">
                    <LinkCentral href={CAMINHO_DA_ATIVIDADE(atividade.id)} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline md:min-h-0">
                      {atividade.titulo}
                    </LinkCentral>
                    <p className={`text-xs ${prazo.atrasada ? 'font-semibold text-err' : 'text-ink-soft'}`}>{prazo.texto}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-soft">Nenhuma atividade aberta.</p>
          )}
        </CartaoDaFicha>
        <Resumo titulo="Custo do produto" valor={textoDoCusto(custo, (valor) => formatarDinheiro(valor, 'BRL'))} contexto={custo.situacao === 'calculado' ? `Média de ${custo.mesesComCusto} de 3 meses com lançamento, sem investimento.` : 'Média dos últimos 3 meses, quando houver lançamentos rateados.'} />
        <Resumo titulo="Preços" valor={vigentes.length === 1 ? textoDoPrecoComPeriodo(vigentes[0]?.preco) : vigentes.length ? `${vigentes.length} preços vigentes` : NAO_DEFINIDO} contexto={vigentes.length ? 'Veja em Ofertas e preços.' : 'Ainda não há preço aprovado vigente.'} />
        <Resumo titulo="Usuários ativos" valor={linha.usuariosAtivos ? formatarNumero(linha.usuariosAtivos.valor) : 'Não informado'} contexto={`${linha.usuariosAtivos ? `${rotuloDaCompetencia(linha.usuariosAtivos.competencia)}. ` : ''}${linha.definicao_usuario_ativo ?? `${DEFINICAO_PENDENTE}.`}`} />
      </aside>
    </div>
  );
}

/** Estágio e decisões: a linha do tempo, com o critério e a decisão de cada mudança. */
export function AbaEstagio({ produtoId, aoMudar }: { produtoId: string; aoMudar: () => void }) {
  const consulta = useConsulta(async () => {
    const [estagios, decisoes] = await Promise.all([estagiosDoProduto(produtoId), decisoesDoProduto(produtoId)]);
    return { estagios, decisoes };
  }, [produtoId]);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler os estágios." aoTentarDeNovo={consulta.recarregar} />;
  const { estagios, decisoes } = consulta.dados;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CartaoDaFicha
        titulo="Linha do tempo"
        acao={
          <Button variante="terciario" tamanho="pequeno" onClick={aoMudar}>
            <TrendingUp aria-hidden />
            Mudar estágio
          </Button>
        }
      >
        {estagios.length ? (
          <ol className="grid gap-3">
            {estagios.map((linha) => (
              <li key={linha.id} className="border-l-2 border-line pl-3 text-[13px]">
                <p className="font-semibold">
                  {linha.estagio_anterior ? `${ROTULOS_ESTAGIO[linha.estagio_anterior]} → ` : ''}
                  {ROTULOS_ESTAGIO[linha.estagio_novo]}
                  <span className="ml-2 font-normal text-ink-soft">{formatarDiaISO(linha.data)}</span>
                </p>
                <p className="mt-0.5 break-words">Critério: {linha.criterio}</p>
                {(linha.metrica || linha.resultado) && (
                  <p className="break-words text-ink-soft">
                    {linha.metrica ?? 'Métrica'}
                    {linha.resultado ? `: ${linha.resultado}` : ''}
                  </p>
                )}
                <p className="text-ink-soft">
                  Decisão: {linha.codigoDaDecisao} · {linha.tituloDaDecisao}
                </p>
                {linha.tituloDoPlano && linha.atividade_encerramento_id && (
                  <p className="text-ink-soft">
                    Plano de encerramento:{' '}
                    <LinkCentral href={CAMINHO_DA_ATIVIDADE(linha.atividade_encerramento_id)} className="underline">
                      {linha.tituloDoPlano}
                    </LinkCentral>
                  </p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <EstadoVazio className="border-0 !py-6" icone={History} titulo="Nenhuma mudança ainda." texto="A primeira mudança de estágio aparece aqui, com o critério e a decisão. O estágio de partida vem do cadastro." />
        )}
      </CartaoDaFicha>
      <CartaoDaFicha titulo="Decisões do produto">
        {decisoes.length ? (
          <ul className="grid gap-3">
            {decisoes.map((decisao) => (
              <li key={decisao.id} className="text-[13px]">
                <p className="font-semibold break-words">
                  <span className="tabular-nums">{decisao.codigo}</span> · {decisao.titulo}
                </p>
                <p className="break-words">{decisao.descricao}</p>
                <p className="text-ink-soft">
                  {ROTULOS_ASSUNTO_DECISAO[decisao.assunto]} · {formatarDiaISO(decisao.data)}
                  {decisao.decisores.length ? ` · ${decisao.decisores.join(', ')}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhuma decisão ligada a este produto.</p>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Reuniões e todas as decisões ficam em{' '}
          <LinkCentral href="/empresa/reunioes" className="underline underline-offset-2">
            Empresa › Reuniões e decisões
          </LinkCentral>
          . Decisão registrada não muda.
        </p>
      </CartaoDaFicha>
    </div>
  );
}
