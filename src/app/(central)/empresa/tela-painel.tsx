'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, Circle, CircleDot } from 'lucide-react';
import { MolduraDaEmpresa, SituacaoDaEntidadeDaEmpresa, SituacaoDaVersaoDoAcordo, SituacaoDoProcesso } from '@/componentes/empresa/aparencia';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Avatar } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { versaoAtual, versaoVigente } from '@/dominio/acordos';
import { ROTULOS_TIPO_ATIVO } from '@/dominio/ativos';
import { criticosPendentes } from '@/dominio/ativos-a-transferir';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { formatarDocumentoDaEntidade } from '@/dominio/entidades';
import { rotuloDaFase } from '@/dominio/fases';
import { marcosAtingidos, proximoMarco, type Marco, type SituacaoDoMarco } from '@/dominio/jornada';
import { AVISO_NOME_PROVISORIO, ROTULOS_RESULTADO_PESQUISA } from '@/dominio/marcas-inpi';
import { faseLiberada } from '@/dominio/navegacao';
import { carregarPainelDaEmpresa } from '@/dominio/painel-empresa';
import { nomeDaPessoa, textoDaParticipacao } from '@/dominio/sociedade';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const ROTULOS_DO_MARCO: Readonly<Record<SituacaoDoMarco, string>> = { atingido: 'Atingido', em_andamento: 'Em andamento', nao_iniciado: 'Não iniciado' };

function IconeDoMarco({ situacao, className }: { situacao: SituacaoDoMarco; className?: string }) {
  const Icone = situacao === 'atingido' ? Check : situacao === 'em_andamento' ? CircleDot : Circle;
  return <Icone aria-hidden className={className} />;
}

function textoDoMarco(marco: Marco): string {
  if (marco.situacao === 'atingido') return marco.atingidoEm ? `Atingido em ${formatarDiaISO(marco.atingidoEm)}` : 'Atingido';
  return ROTULOS_DO_MARCO[marco.situacao];
}

function JanelaDaJornada({ marcos, aoFechar }: { marcos: readonly Marco[]; aoFechar: () => void }) {
  return (
    <JanelaFormulario soLeitura larga aberto aoFechar={aoFechar} titulo="Jornada da empresa" descricao="Cada marco é verificado pelos dados da Central." aoEnviar={(evento) => evento.preventDefault()}>
      <ol className="grid gap-2">
        {marcos.map((marco) => (
          <li key={marco.codigo} className="rounded-lg border border-line bg-paper p-3.5 text-[13px]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold tabular-nums">{marco.codigo}</span>
              <span className="font-semibold">{marco.nome}</span>
              <EtiquetaSituacao tipo={marco.situacao === 'atingido' ? 'sucesso' : marco.situacao === 'em_andamento' ? 'info' : 'neutro'}>{textoDoMarco(marco)}</EtiquetaSituacao>
              <EtiquetaLivre>{rotuloDaFase(marco.fase)}</EtiquetaLivre>
            </div>
            <p className="mt-1 text-ink-soft">{marco.criterio}</p>
            <p className="mt-1">{marco.detalhe}</p>
            {marco.href && marco.situacao !== 'atingido' && (
              <LinkCentral href={marco.href} className="mt-1 inline-flex min-h-11 items-center gap-1 underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
                Ver o que falta
                <ArrowRight aria-hidden />
              </LinkCentral>
            )}
          </li>
        ))}
      </ol>
    </JanelaFormulario>
  );
}

function Cartao({ titulo, href, rotuloDoLink, className, children }: { titulo: string; href?: string; rotuloDoLink?: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-lg border border-line bg-paper p-4 md:p-5', className)} aria-label={titulo}>
      <h2 className="text-[17px] leading-6">{titulo}</h2>
      <div className="mt-3 min-w-0 flex-1 text-[13px]">{children}</div>
      {href && (
        <LinkCentral href={href} className="mt-3 inline-flex min-h-11 items-center gap-1 self-start text-[13px] font-medium underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
          {rotuloDoLink ?? 'Abrir'}
          <ArrowRight aria-hidden />
        </LinkCentral>
      )}
    </section>
  );
}

/** T06.01: o painel da empresa. A jornada é o resumo dos 12 marcos, que abrem por inteiro em uma janela. */
export function TelaPainelDaEmpresa() {
  const { faseAtiva } = useCentral();
  const consulta = useConsulta(() => carregarPainelDaEmpresa());
  const [jornada, setJornada] = useState(false);

  const moldura = (conteudo: ReactNode) => (
    <MolduraDaEmpresa ativa="painel" titulo="A Numa, por inteiro" resumo="Sociedade, patrimônio e próximos passos.">
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro') return moldura(<EstadoErro titulo="Não deu para ler o painel." aoTentarDeNovo={consulta.recarregar} />);

  const dados = consulta.dados;
  const { sociedade } = dados;
  const atingidos = marcosAtingidos(dados.marcos);
  const proximo = proximoMarco(dados.marcos);
  const vigente = dados.principal ? versaoVigente(dados.principal.id, sociedade.versoes) : undefined;
  const atual = dados.principal ? versaoAtual(dados.principal.id, sociedade.versoes) : undefined;
  const contador = dados.contrapartes.find((item) => item.id === dados.entidade?.contador_id);
  const criticos = criticosPendentes(dados.pendentes);
  const porTipo = new Map<string, number>();
  for (const item of dados.pendentes) {
    const rotulo = item.tipoAtivo ? ROTULOS_TIPO_ATIVO[item.tipoAtivo] : 'Ferramenta';
    porTipo.set(rotulo, (porTipo.get(rotulo) ?? 0) + 1);
  }
  const comAviso = dados.marcas.filter((linha) => linha.aviso);
  const prazosDeMarca = dados.marcas.flatMap((linha) => (linha.proximoPrazo ? [{ marca: linha.marca.nome, prazo: linha.proximoPrazo }] : [])).sort((a, b) => a.prazo.data_limite.localeCompare(b.prazo.data_limite));
  const percentual = dados.progresso.total ? Math.round((dados.progresso.concluidos / dados.progresso.total) * 100) : 0;
  const f1 = faseLiberada('f1', faseAtiva);

  return moldura(
    <>
      <section aria-label="Jornada da empresa" className="grid gap-4 rounded-lg bg-espresso p-5 text-linen md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-7 text-linen">Jornada da empresa</h2>
          <p className="mt-1 text-[13px] opacity-85">
            {atingidos} de {dados.marcos.length} marcos atingidos{proximo ? ` · próximo: ${proximo.nome}` : ''}
          </p>
          <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Marcos da jornada">
            {dados.marcos.map((marco) => (
              <li key={marco.codigo} title={`${marco.codigo} · ${marco.nome}: ${textoDoMarco(marco)}`} className={cn('inline-flex items-center gap-1 rounded-pill px-2 py-1 text-xs font-semibold tabular-nums [&_svg]:size-3', marco.situacao === 'atingido' ? 'bg-ok-wash text-ok' : marco.situacao === 'em_andamento' ? 'bg-paper text-indigo-dk' : 'bg-linen/15 text-linen')}>
                <IconeDoMarco situacao={marco.situacao} />
                <span>{marco.codigo.replace('ME-', '')}</span>
                <span className="sr-only">
                  {marco.nome}: {textoDoMarco(marco)}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <Button onClick={() => setJornada(true)}>
          Ver jornada completa
          <ArrowRight aria-hidden />
        </Button>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <Cartao titulo="Sociedade" href="/empresa/socias" rotuloDoLink="Ver sócias">
          <ul className="grid gap-2">
            {dados.socias.map((socia) => {
              const nome = nomeDaPessoa(sociedade.pessoas, socia.pessoa_id);
              return (
                <li key={socia.id} className="flex items-center gap-2.5">
                  <Avatar nome={nome} className="size-8 text-[12px]" />
                  <span className="min-w-0 flex-1 truncate">{nome}</span>
                  <span className="font-semibold tabular-nums">{textoDaParticipacao(socia.participacao)}</span>
                </li>
              );
            })}
          </ul>
        </Cartao>
        <Cartao titulo="Acordos" href="/empresa/acordos" rotuloDoLink="Ver acordos">
          {dados.principal && atual ? (
            <div className="grid gap-2">
              <p className="font-medium">{dados.principal.titulo}</p>
              <p className="flex flex-wrap items-center gap-1.5">
                <EtiquetaLivre>V{(vigente ?? atual).numero}</EtiquetaLivre>
                <SituacaoDaVersaoDoAcordo situacao={(vigente ?? atual).situacao} />
                {vigente?.data_assinatura && <span className="text-ink-soft">em {formatarDiaISO(vigente.data_assinatura)}</span>}
              </p>
            </div>
          ) : (
            <p className="text-ink-soft">Nenhum memorando ainda.</p>
          )}
          {dados.alertaDeTitularidade && (
            <Faixa tipo="atencao" className="mt-2.5">
              Titularidade de ativos e PI ainda não formalizada em acordo vigente.
            </Faixa>
          )}
        </Cartao>
        <Cartao titulo="Entidade" href="/empresa/entidade" rotuloDoLink="Ver entidade">
          {dados.entidade ? (
            <dl className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">Situação</dt>
                <dd>
                  <SituacaoDaEntidadeDaEmpresa situacao={dados.entidade.situacao} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">CNPJ</dt>
                <dd className="tabular-nums">{dados.entidade.documento ? formatarDocumentoDaEntidade(dados.entidade.tipo_pessoa, dados.entidade.documento) : 'Não definido'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">Regime</dt>
                <dd>{dados.entidade.regime_tributario ?? 'Não definido'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-soft">Contador</dt>
                <dd>{contador ? nomeDaContraparte(contador) : 'Não escolhido'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-ink-soft">Nenhuma entidade cadastrada.</p>
          )}
        </Cartao>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Cartao titulo="Ativos a transferir" href="/empresa/ativos" rotuloDoLink="Ver ativos">
          <p className="flex flex-wrap items-center gap-1.5">
            <strong className="text-[22px] leading-7 font-semibold tabular-nums">{dados.pendentes.length}</strong>
            {criticos > 0 && <EtiquetaSituacao tipo="erro">{criticos === 1 ? '1 crítico' : `${criticos} críticos`}</EtiquetaSituacao>}
          </p>
          {porTipo.size > 0 && <p className="mt-1.5 text-ink-soft">{[...porTipo.entries()].map(([rotulo, quantos]) => `${rotulo}: ${quantos}`).join(' · ')}</p>}
        </Cartao>
        <Cartao titulo="Constituição" href="/empresa/constituicao" rotuloDoLink="Ver checklist">
          <p className="font-semibold tabular-nums">
            {dados.progresso.concluidos} de {dados.progresso.total} itens concluídos
          </p>
          <div role="progressbar" aria-label="Progresso da constituição" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} className="mt-2 h-2 overflow-hidden rounded-pill bg-mist">
            <div className="h-full rounded-pill bg-indigo-dk" style={{ width: `${percentual}%` }} />
          </div>
          <p className="mt-2 text-ink-soft">{dados.progresso.bloqueados === 1 ? '1 bloqueado' : `${dados.progresso.bloqueados} bloqueados`}</p>
          {dados.progresso.proximos.length > 0 && (
            <ul className="mt-1.5 grid gap-1">
              {dados.progresso.proximos.slice(0, 2).map((item) => (
                <li key={item.id} className="break-words">
                  Próximo: {item.titulo}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Marcas" href="/empresa/marcas" rotuloDoLink="Ver marcas">
          <ul className="grid gap-1.5">
            {dados.marcas.map(({ marca, pesquisa, processos, aviso }) => (
              <li key={marca.id} className="grid gap-0.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{marca.nome}</span>
                  {processos[0] && <SituacaoDoProcesso situacao={processos[0].situacao} />}
                </span>
                <span className={aviso ? 'font-medium text-warn' : 'text-ink-soft'}>{pesquisa ? `Pesquisa: ${ROTULOS_RESULTADO_PESQUISA[pesquisa.resultado]}` : 'Sem pesquisa'}</span>
              </li>
            ))}
          </ul>
          {comAviso.length > 0 && <p className="mt-2 font-medium text-warn">{AVISO_NOME_PROVISORIO}.</p>}
          {prazosDeMarca[0] && (
            <p className="mt-2 text-ink-soft">
              Próximo prazo: {formatarDiaISO(prazosDeMarca[0].prazo.data_limite)} ({prazosDeMarca[0].marca})
            </p>
          )}
        </Cartao>
        <Cartao titulo="Investimento das sócias" href="/financeiro/socias" rotuloDoLink="Ver no Financeiro">
          <ul className="grid gap-1.5">
            {dados.investimentos.map(({ socia, investimentoLiquido }) => (
              <li key={socia.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{socia.nome_completo}</span>
                <span className="font-semibold tabular-nums">{formatarDinheiro(investimentoLiquido, 'BRL')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-ink-soft">Investimento líquido, vindo do Financeiro.</p>
        </Cartao>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Cartao titulo="Decisões recentes" href="/empresa/decisoes" rotuloDoLink="Ver decisões">
          {dados.decisoes.length ? (
            <ul className="grid gap-1.5">
              {dados.decisoes.map((decisao) => (
                <li key={decisao.id}>
                  <LinkCentral href={`/empresa/decisoes/${decisao.id}`} className="inline-flex min-h-11 items-baseline gap-1.5 underline-offset-2 hover:underline md:min-h-0">
                    <span className="text-ink-soft tabular-nums">{formatarDiaISO(decisao.data)}</span>
                    <span className="break-words">{decisao.titulo}</span>
                  </LinkCentral>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">Nenhuma decisão registrada.</p>
          )}
        </Cartao>
        <Cartao titulo="Obrigações" {...(f1 ? { href: '/empresa/obrigacoes', rotuloDoLink: 'Ver obrigações' } : {})}>
          {!f1 ? (
            <p className="text-ink-soft">As obrigações corporativas chegam com a {rotuloDaFase('f1')}.</p>
          ) : dados.obrigacoes.length ? (
            <ul className="grid gap-1.5">
              {dados.obrigacoes.map(({ obrigacao, proximo: vencimento }) => (
                <li key={obrigacao.id} className="flex items-baseline justify-between gap-2">
                  <LinkCentral href={`/empresa/obrigacoes/${obrigacao.id}`} className="inline-flex min-h-11 min-w-0 items-center underline-offset-2 hover:underline md:min-h-0">
                    <span className="truncate">{obrigacao.nome}</span>
                  </LinkCentral>
                  {vencimento && <span className="shrink-0 text-ink-soft tabular-nums">{formatarDiaISO(vencimento)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">Nenhuma obrigação ativa. O cadastro é definido com o contador.</p>
          )}
        </Cartao>
      </div>

      {jornada && <JanelaDaJornada marcos={dados.marcos} aoFechar={() => setJornada(false)} />}
    </>,
  );
}
