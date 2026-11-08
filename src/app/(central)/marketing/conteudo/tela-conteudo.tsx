'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Columns3, ExternalLink, FolderOpen, Info, LayoutList, ListFilter, Plus, Radio, Rows3, UserRound } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { executar, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { AbasMarketing, AlternarVisao, EtiquetaDaPeca, EtiquetaDoContexto, KICKER_MARKETING, nomeDoContexto, opcoesDeContexto } from '@/componentes/marketing/apoio';
import { FormularioDePeca } from '@/componentes/marketing/formulario-peca';
import { useCentral } from '@/componentes/layout/central-provider';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { SITUACOES_DE_PECA, type PecaConteudo, type SituacaoDaPeca } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { cancelarPeca, carregarConteudo, DESCRICOES_SITUACAO_PECA, diaNoCalendario, diasDaSemana, filtrarPecas, FILTROS_CONTEUDO_INICIAIS, inicioDaSemana, moverPeca, mudarMes, pecaAtrasada, pecasDoDia, quantosMaisFiltrosDoConteudo, ROTULOS_CANAL, ROTULOS_FORMATO, ROTULOS_SITUACAO_PECA, semanasDoMes, VISOES_DO_CALENDARIO, type DadosDoConteudo, type FiltrosConteudo, type VisaoDoCalendario } from '@/dominio/conteudo';
import { somarDias } from '@/dominio/repeticao';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';

const NOMES_DOS_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const ICONES_DA_VISAO = { mes: CalendarDays, semana: Rows3, lista: LayoutList, quadro: Columns3 } as const;
const nomeDoMes = (mes: string) => new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/^./, (letra) => letra.toUpperCase());
const nomeDaPessoa = (id: string, dados: DadosDoConteudo) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
const nomeCurtoDoContexto = (peca: PecaConteudo, dados: DadosDoConteudo) => (peca.produto_id ? (dados.produtos.find((produto) => produto.id === peca.produto_id)?.nome ?? 'Produto removido') : 'Numa');

/** A peça dentro do calendário: um botão, com texto da situação além da cor. */
function PecaNoDia({ peca, dados, hoje, aoAbrir }: { peca: PecaConteudo; dados: DadosDoConteudo; hoje: string; aoAbrir: (peca: PecaConteudo) => void }) {
  const atrasada = pecaAtrasada(peca, hoje);
  return (
    <button type="button" onClick={() => aoAbrir(peca)} className={cn('grid w-full gap-1 rounded-sm border border-line bg-paper p-1.5 text-left text-xs hover:border-ink-soft', peca.situacao === 'cancelado' && 'opacity-70')}>
      <span className="break-words">
        <strong className="font-semibold">{nomeCurtoDoContexto(peca, dados)}</strong> · {peca.titulo}
      </span>
      <span className="flex flex-wrap items-center gap-1 [&>span]:whitespace-normal">
        <EtiquetaDaPeca situacao={peca.situacao} />
        {atrasada && (
          <EtiquetaSituacao tipo="erro" icone={CircleAlert}>
            Atrasada
          </EtiquetaSituacao>
        )}
      </span>
    </button>
  );
}

function VisaoMes({ mes, pecas, dados, hoje, aoAbrir, aoCriar }: { mes: string; pecas: readonly PecaConteudo[]; dados: DadosDoConteudo; hoje: string; aoAbrir: (peca: PecaConteudo) => void; aoCriar: (dia: string) => void }) {
  const celular = useEhCelular();
  const semanas = semanasDoMes(mes);
  if (celular) {
    // Sete colunas não cabem em 360px: no celular, a agenda dos dias com peças.
    const dias = semanas.flat().filter((dia) => dia.startsWith(mes) && pecasDoDia(dia, pecas).length);
    if (!dias.length) return <p className="rounded-lg border border-line bg-paper p-4 text-sm text-ink-soft">Nenhuma peça neste mês.</p>;
    return (
      <ol aria-label={`Agenda de ${nomeDoMes(mes)}`} className="grid gap-3">
        {dias.map((dia) => (
          <li key={dia} className="rounded-lg border border-line bg-paper p-3">
            <p className={cn('mb-2 text-[13px] font-semibold', dia === hoje && 'text-indigo-dk')}>{formatarDiaISO(dia)}{dia === hoje ? ' · hoje' : ''}</p>
            <div className="grid gap-1.5">
              {pecasDoDia(dia, pecas).map((peca) => (
                <PecaNoDia key={peca.id} peca={peca} dados={dados} hoje={hoje} aoAbrir={aoAbrir} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper">
      <table className="w-full table-fixed border-collapse text-xs">
        <caption className="sr-only">Calendário de {nomeDoMes(mes)}</caption>
        <thead>
          <tr>
            {NOMES_DOS_DIAS.map((nome) => (
              <th key={nome} scope="col" className="border-b border-line bg-mist py-2 text-center font-semibold text-ink-soft">
                {nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana[0]}>
              {semana.map((dia) => {
                const doMes = dia.startsWith(mes);
                return (
                  <td key={dia} className={cn('h-24 border-t border-l border-line p-1 align-top first:border-l-0', !doMes && 'bg-linen')}>
                    <button type="button" aria-label={`Nova peça em ${formatarDiaISO(dia)}`} onClick={() => aoCriar(dia)} className={cn('mb-1 grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums hover:bg-hover', dia === hoje ? 'bg-espresso text-linen hover:bg-espresso' : doMes ? 'text-ink' : 'text-ink-soft')}>
                      {Number(dia.slice(8))}
                    </button>
                    <div className="grid gap-1">
                      {pecasDoDia(dia, pecas).map((peca) => (
                        <PecaNoDia key={peca.id} peca={peca} dados={dados} hoje={hoje} aoAbrir={aoAbrir} />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisaoSemana({ inicio, pecas, dados, hoje, aoAbrir, aoCriar }: { inicio: string; pecas: readonly PecaConteudo[]; dados: DadosDoConteudo; hoje: string; aoAbrir: (peca: PecaConteudo) => void; aoCriar: (dia: string) => void }) {
  return (
    <ol aria-label="Dias da semana" className="grid gap-2 lg:grid-cols-7">
      {diasDaSemana(inicio).map((dia, indice) => (
        <li key={dia} className="min-w-0 rounded-lg border border-line bg-paper p-2.5">
          <div className="mb-2 flex items-center justify-between gap-1">
            <p className={cn('text-[13px] font-semibold', dia === hoje && 'text-indigo-dk')}>
              {NOMES_DOS_DIAS[indice]} {dia.slice(8)}/{dia.slice(5, 7)}
            </p>
            <Button variante="icone" tamanho="icone" aria-label={`Nova peça em ${formatarDiaISO(dia)}`} onClick={() => aoCriar(dia)}>
              <Plus aria-hidden />
            </Button>
          </div>
          <div className="grid gap-1.5">
            {pecasDoDia(dia, pecas).map((peca) => (
              <PecaNoDia key={peca.id} peca={peca} dados={dados} hoje={hoje} aoAbrir={aoAbrir} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

const COLUNAS_DO_QUADRO: readonly SituacaoDaPeca[] = ['ideia', 'producao', 'revisao', 'aprovado', 'publicado'];

/** Mover é um comando do cartão: funciona sem mouse e sem arrastar (P4). */
function MoverPeca({ peca, aoPublicar, aoCancelar }: { peca: PecaConteudo; aoPublicar: (peca: PecaConteudo) => void; aoCancelar: (peca: PecaConteudo) => void }) {
  return (
    <MenuSobreposto
      titulo="Mover para"
      largura={230}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label={`Mover ${peca.titulo}`}>
          <ListFilter aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <div className="grid gap-0.5">
          {SITUACOES_DE_PECA.filter((situacao) => situacao !== peca.situacao).map((situacao) => (
            <button
              key={situacao}
              type="button"
              className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}
              onClick={() => {
                fechar();
                if (situacao === 'publicado') aoPublicar(peca);
                else if (situacao === 'cancelado') aoCancelar(peca);
                else void executar(() => moverPeca(peca.id, situacao), `Movida para ${ROTULOS_SITUACAO_PECA[situacao]}.`);
              }}
            >
              {ROTULOS_SITUACAO_PECA[situacao]}
              {situacao === 'publicado' ? '…' : ''}
              {situacao === 'cancelado' ? '…' : ''}
            </button>
          ))}
        </div>
      )}
    </MenuSobreposto>
  );
}

function VisaoQuadro({ pecas, dados, hoje, incluirCanceladas, aoAbrir, aoPublicar, aoCancelar }: { pecas: readonly PecaConteudo[]; dados: DadosDoConteudo; hoje: string; incluirCanceladas: boolean; aoAbrir: (peca: PecaConteudo) => void; aoPublicar: (peca: PecaConteudo) => void; aoCancelar: (peca: PecaConteudo) => void }) {
  const colunas: readonly SituacaoDaPeca[] = incluirCanceladas ? [...COLUNAS_DO_QUADRO, 'cancelado'] : COLUNAS_DO_QUADRO;
  return (
    <div className="faixa-rolagem flex gap-3 lg:grid lg:grid-flow-col lg:auto-cols-fr">
      {colunas.map((coluna) => {
        const daColuna = pecas.filter((peca) => peca.situacao === coluna);
        return (
          <section key={coluna} aria-label={ROTULOS_SITUACAO_PECA[coluna]} className="w-64 shrink-0 rounded-lg bg-mist p-2.5 lg:w-auto lg:min-w-0">
            <h3 className="mb-2 flex items-center justify-between text-[13px] font-semibold">
              {ROTULOS_SITUACAO_PECA[coluna]}
              <span className="rounded-pill bg-paper px-2 text-xs tabular-nums">{daColuna.length}</span>
            </h3>
            <ul className="grid gap-2">
              {daColuna.map((peca) => (
                <li key={peca.id} className="grid gap-1.5 rounded-md border border-line bg-paper p-2.5 text-[13px]">
                  <div className="flex items-start justify-between gap-1">
                    <button type="button" className="min-h-11 min-w-0 text-left font-semibold break-words hover:underline md:min-h-0" onClick={() => aoAbrir(peca)}>
                      {peca.titulo}
                    </button>
                    <MoverPeca peca={peca} aoPublicar={aoPublicar} aoCancelar={aoCancelar} />
                  </div>
                  <span>
                    <EtiquetaDoContexto id={peca.produto_id} produtos={dados.produtos} marcas={dados.marcas} />
                  </span>
                  <p className="text-xs text-ink-soft">
                    {ROTULOS_CANAL[peca.canal]} · {formatarDiaISO(diaNoCalendario(peca))}
                  </p>
                  {pecaAtrasada(peca, hoje) && (
                    <span>
                      <EtiquetaSituacao tipo="erro" icone={CircleAlert}>
                        Atrasada
                      </EtiquetaSituacao>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DialogoCancelar({ peca, aoFechar }: { peca: PecaConteudo; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Cancelar {peca.titulo}?</DialogTitle>
        <DialogDescription className="mt-3 leading-[1.6]">A peça não vai ao ar, mas continua registrada, com o histórico.</DialogDescription>
        <div className="mt-4">
          <Campo id="cancelar-motivo" rotulo="Motivo">
            {(controle) => <Input autoComplete="off" {...controle} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
          </Campo>
        </div>
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button
            variante="perigo"
            onClick={() => {
              aoFechar();
              void executar(() => cancelarPeca(peca.id, motivo), 'Peça cancelada.');
            }}
          >
            Cancelar peça
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Edicao = { peca: PecaConteudo | null; dia?: string; situacao?: SituacaoDaPeca };

/** T08.05: Mês, Semana, Lista e Quadro sobre os mesmos filtros. */
export function TelaConteudo() {
  const parametros = useSearchParams();
  const { contexto } = useCentral();
  const consulta = useConsulta(carregarConteudo);
  const hoje = hojeISO();
  const [filtros, setFiltros] = useState<FiltrosConteudo>(FILTROS_CONTEUDO_INICIAIS);
  const [visao, setVisao] = useState<VisaoDoCalendario>('mes');
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [semana, setSemana] = useState(inicioDaSemana(hoje));
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [cancelando, setCancelando] = useState<PecaConteudo | null>(null);
  const dados = consulta.dados;
  const pedida = parametros.get('peca');

  // Vindo do Meu dia ou de outra ficha: abre a peça uma vez.
  useEffect(() => {
    if (!pedida || !dados) return;
    const peca = dados.pecas.find((item) => item.id === pedida);
    if (peca) setEdicao({ peca });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao chegar
  }, [pedida, Boolean(dados)]);

  const pecas = useMemo(() => (dados ? filtrarPecas(dados.pecas, filtros, contexto.id) : []), [dados, filtros, contexto.id]);

  const colunas = useMemo<readonly Coluna<PecaConteudo>[]>(() => {
    if (!dados) return [];
    return [
      { id: 'titulo', titulo: 'Título', fixa: true, essencial: true, ordenar: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'), texto: (peca) => peca.titulo, celula: (peca) => <span className="grid min-w-44 gap-0.5"><span className="font-medium break-words">{peca.titulo}</span><span className="text-xs text-ink-soft tabular-nums">{peca.codigo}</span></span> },
      { id: 'contexto', titulo: 'Marca ou produto', essencial: true, texto: (peca) => nomeCurtoDoContexto(peca, dados), celula: (peca) => <EtiquetaDoContexto id={peca.produto_id} produtos={dados.produtos} marcas={dados.marcas} /> },
      { id: 'canal', titulo: 'Canal', ordenar: (a, b) => a.canal.localeCompare(b.canal), texto: (peca) => ROTULOS_CANAL[peca.canal], celula: (peca) => `${ROTULOS_CANAL[peca.canal]}${peca.formato ? ` · ${ROTULOS_FORMATO[peca.formato]}` : ''}` },
      { id: 'prevista', titulo: 'Prevista', essencial: true, ordenar: (a, b) => a.data_prevista.localeCompare(b.data_prevista), texto: (peca) => formatarDiaISO(peca.data_prevista), celula: (peca) => <span className="tabular-nums whitespace-nowrap">{formatarDiaISO(peca.data_prevista)}</span> },
      { id: 'realizada', titulo: 'Realizada', ordenar: (a, b) => (a.publicado_em ?? '').localeCompare(b.publicado_em ?? ''), texto: (peca) => (peca.publicado_em ? formatarDiaISO(peca.publicado_em) : ''), celula: (peca) => (peca.publicado_em ? <span className="tabular-nums whitespace-nowrap">{formatarDiaISO(peca.publicado_em)}</span> : '—') },
      { id: 'situacao', titulo: 'Situação', essencial: true, ordenar: (a, b) => SITUACOES_DE_PECA.indexOf(a.situacao) - SITUACOES_DE_PECA.indexOf(b.situacao), texto: (peca) => ROTULOS_SITUACAO_PECA[peca.situacao], celula: (peca) => <span className="flex flex-wrap gap-1"><EtiquetaDaPeca situacao={peca.situacao} />{pecaAtrasada(peca, hoje) && <EtiquetaSituacao tipo="erro" icone={CircleAlert}>Atrasada</EtiquetaSituacao>}</span> },
      { id: 'responsavel', titulo: 'Responsável', texto: (peca) => nomeDaPessoa(peca.responsavel_id, dados), celula: (peca) => nomeDaPessoa(peca.responsavel_id, dados) },
      { id: 'link', titulo: 'Publicação', celula: (peca) => (peca.link_publicacao ? <a href={peca.link_publicacao} target="_blank" rel="noopener noreferrer" onClick={(evento) => evento.stopPropagation()} className="inline-flex min-h-11 items-center gap-1 underline md:min-h-0 [&_svg]:size-3.5"><ExternalLink aria-hidden />Abrir</a> : '—') },
    ];
  }, [dados, hoje]);

  const cabecalho = (
    <CabecalhoPagina
      comoUsar="/ajuda/marketing/calendario-editorial"
      kicker={KICKER_MARKETING}
      titulo="Calendário editorial"
      resumo="Planeje as peças da Numa e das marcas. A Central registra o que foi ao ar; quem publica é você, na rede."
      acoes={
        <Button disabled={!dados} onClick={() => setEdicao({ peca: null })}>
          <Plus aria-hidden />
          Nova peça
        </Button>
      }
    />
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        {cabecalho}
        <AbasMarketing ativa="conteudo" />
        <EstadoErro className="mt-5" titulo="Não deu para ler o calendário." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const mudar = (parcial: Partial<FiltrosConteudo>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros(FILTROS_CONTEUDO_INICIAIS);
  const responsaveis = [...new Set(dados.pecas.map((peca) => peca.responsavel_id))].map((id) => ({ valor: id, rotulo: nomeDaPessoa(id, dados) }));
  const ativos: FiltroAtivo[] = [
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${nomeDoContexto(filtros.contexto, dados.produtos)}` }] : []),
    ...(filtros.canal ? [{ id: 'canal', rotulo: `Canal: ${ROTULOS_CANAL[filtros.canal as PecaConteudo['canal']]}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomeDaPessoa(filtros.responsavel, dados)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_PECA[filtros.situacao as SituacaoDaPeca]}` }] : []),
    ...(filtros.formato ? [{ id: 'formato', rotulo: `Formato: ${ROTULOS_FORMATO[filtros.formato as NonNullable<PecaConteudo['formato']>]}` }] : []),
    ...(filtros.campanha ? [{ id: 'campanha', rotulo: `Campanha: ${dados.campanhas.find((campanha) => campanha.id === filtros.campanha)?.nome ?? ''}` }] : []),
    ...(filtros.incluirCanceladas ? [{ id: 'incluirCanceladas', rotulo: 'Com canceladas' }] : []),
  ];
  const aoAbrir = (peca: PecaConteudo) => setEdicao({ peca });
  const aoCriar = (dia: string) => setEdicao({ peca: null, dia });
  const aoPublicar = (peca: PecaConteudo) => setEdicao({ peca, situacao: 'publicado' });

  const alternar = (
    <AlternarVisao<VisaoDoCalendario>
      rotulo="Visão do calendário"
      ativa={visao}
      aoMudar={setVisao}
      opcoes={VISOES_DO_CALENDARIO.map(({ id, rotulo }) => ({ id, rotulo, icone: ICONES_DA_VISAO[id] }))}
    />
  );

  return (
    <div>
      {cabecalho}
      <AbasMarketing ativa="conteudo" />
      <div className="mt-5 space-y-4">
        <div className="faixa-rolagem">{alternar}</div>
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={mudar}
          aoLimpar={limpar}
          rotuloBusca="Buscar peça por título, texto ou código"
          rotuloAvancados="Mais filtros"

          seletores={[
            seletorDeOpcoes<FiltrosConteudo>({ id: 'contexto', rotulo: 'Contexto', icone: FolderOpen, campo: 'contexto', opcoes: opcoesDeContexto(dados.produtos), largura: 150 }),
            seletorDeOpcoes<FiltrosConteudo>({ id: 'canal', rotulo: 'Canal', icone: Radio, campo: 'canal', opcoes: paraOpcoes(ROTULOS_CANAL), largura: 120 }),
            seletorDeOpcoes<FiltrosConteudo>({ id: 'responsavel', rotulo: 'Responsável', icone: UserRound, campo: 'responsavel', opcoes: responsaveis, todos: 'Todas', largura: 160 }),
          ]}
          quantosAvancados={quantosMaisFiltrosDoConteudo}
          avancados={(valor, aoMudar) => (
            <>
              <Campo id="conteudo-situacao" rotulo="Situação">
                {(controle) => (
                  <Selecao {...controle} value={valor.situacao} onChange={(evento) => aoMudar({ situacao: evento.target.value })}>
                    <option value="">Todas</option>
                    {SITUACOES_DE_PECA.map((situacao) => (
                      <option key={situacao} value={situacao}>
                        {ROTULOS_SITUACAO_PECA[situacao]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Campo id="conteudo-formato" rotulo="Formato">
                {(controle) => (
                  <Selecao {...controle} value={valor.formato} onChange={(evento) => aoMudar({ formato: evento.target.value })}>
                    <option value="">Todos</option>
                    {Object.entries(ROTULOS_FORMATO).map(([id, rotulo]) => (
                      <option key={id} value={id}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Campo id="conteudo-campanha" rotulo="Campanha">
                {(controle) => (
                  <Selecao {...controle} value={valor.campanha} onChange={(evento) => aoMudar({ campanha: evento.target.value })}>
                    <option value="">Todas</option>
                    {dados.campanhas.map((campanha) => (
                      <option key={campanha.id} value={campanha.id}>
                        {campanha.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <label className="flex min-h-11 items-center gap-2.5 text-[13px] font-semibold">
                <input type="checkbox" className="size-[18px]" checked={valor.incluirCanceladas} onChange={(evento) => aoMudar({ incluirCanceladas: evento.target.checked })} />
                Mostrar as canceladas
              </label>
            </>
          )}
          ativos={ativos}
          aoRemoverAtivo={(id) => mudar(id === 'incluirCanceladas' ? { incluirCanceladas: false } : { [id]: '' })}
        />
        {!dados.pecas.length ? (
          <EstadoVazio icone={CalendarDays} titulo="O calendário ainda está vazio." texto="Planeje a primeira peça: tema, canal, data e responsável." acao={<Button onClick={() => setEdicao({ peca: null })}>Nova peça</Button>} />
        ) : !pecas.length && ativos.length + (filtros.busca.trim() ? 1 : 0) > 0 ? (
          <EstadoVazioFiltro aoLimpar={limpar} />
        ) : (
          <>
            {(visao === 'mes' || visao === 'semana') && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variante="icone" tamanho="icone" aria-label={visao === 'mes' ? 'Mês anterior' : 'Semana anterior'} onClick={() => (visao === 'mes' ? setMes((atual) => mudarMes(atual, -1)) : setSemana((atual) => somarDias(atual, -7)))}>
                  <ChevronLeft aria-hidden />
                </Button>
                <h2 aria-live="polite" className="min-w-0">
                  {visao === 'mes' ? nomeDoMes(mes) : `Semana de ${formatarDiaISO(semana)}`}
                </h2>
                <Button variante="icone" tamanho="icone" aria-label={visao === 'mes' ? 'Próximo mês' : 'Próxima semana'} onClick={() => (visao === 'mes' ? setMes((atual) => mudarMes(atual, 1)) : setSemana((atual) => somarDias(atual, 7)))}>
                  <ChevronRight aria-hidden />
                </Button>
                <Button
                  variante="secundario"
                  tamanho="pequeno"
                  onClick={() => {
                    setMes(hoje.slice(0, 7));
                    setSemana(inicioDaSemana(hoje));
                  }}
                >
                  Hoje
                </Button>
              </div>
            )}
            {visao === 'mes' && <VisaoMes mes={mes} pecas={pecas} dados={dados} hoje={hoje} aoAbrir={aoAbrir} aoCriar={aoCriar} />}
            {visao === 'semana' && <VisaoSemana inicio={semana} pecas={pecas} dados={dados} hoje={hoje} aoAbrir={aoAbrir} aoCriar={aoCriar} />}
            {visao === 'quadro' && <VisaoQuadro pecas={pecas} dados={dados} hoje={hoje} incluirCanceladas={filtros.incluirCanceladas || filtros.situacao === 'cancelado'} aoAbrir={aoAbrir} aoPublicar={aoPublicar} aoCancelar={setCancelando} />}
            {visao === 'lista' && (
              <Lista
                rotulo="Peças de conteúdo"
                linhas={pecas}
                colunas={colunas}
                chave={(peca) => peca.id}
                aoAbrir={aoAbrir}
                vazio={<p className="rounded-lg border border-line bg-paper p-4 text-sm text-ink-soft">Nenhuma peça para mostrar.</p>}
                cartao={(peca) => (
                  <span className="grid gap-1.5">
                    <span className="font-semibold break-words">{peca.titulo}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <EtiquetaDoContexto id={peca.produto_id} produtos={dados.produtos} marcas={dados.marcas} />
                      <EtiquetaDaPeca situacao={peca.situacao} />
                    </span>
                    <span className="text-[13px] text-ink-soft">
                      {ROTULOS_CANAL[peca.canal]} · Prevista: {formatarDiaISO(peca.data_prevista)}
                      {peca.publicado_em ? ` · Realizada: ${formatarDiaISO(peca.publicado_em)}` : ''}
                    </span>
                  </span>
                )}
              />
            )}
            <details className="rounded-lg border border-line bg-paper p-3 text-[13px]">
              <summary className="min-h-11 cursor-pointer content-center font-semibold md:min-h-0">Legenda das situações</summary>
              <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
                {SITUACOES_DE_PECA.map((situacao) => (
                  <li key={situacao} className="flex flex-wrap items-center gap-2">
                    <EtiquetaDaPeca situacao={situacao} />
                    <span className="text-ink-soft">{DESCRICOES_SITUACAO_PECA[situacao]}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          Publicado exige data realizada e link. Resultados são informados à mão, com a data da medição. O lembrete no Meu dia não publica nas redes.
        </p>
      </div>
      {edicao && <FormularioDePeca key={`${edicao.peca?.id ?? 'nova'}-${edicao.situacao ?? ''}`} dados={dados} peca={edicao.peca} diaInicial={edicao.dia} situacaoInicial={edicao.situacao} aoFechar={() => setEdicao(null)} />}
      {cancelando && <DialogoCancelar peca={cancelando} aoFechar={() => setCancelando(null)} />}
    </div>
  );
}
