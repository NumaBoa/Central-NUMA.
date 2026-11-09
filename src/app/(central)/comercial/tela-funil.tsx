'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CalendarClock, CircleAlert, Layers, ListFilter, Plus, Target, UserRound } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { AbasComercial } from '@/componentes/f1/abas-modulos';
import { executar, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { FormularioOportunidade } from '@/componentes/f1/formulario-oportunidade';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { CartoesDeResumo } from '@/componentes/padroes/cartoes-resumo';
import { EstadoErro, EstadoVazio, EstadoVazioFiltro, EstadoCarregando } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/componentes/ui/dialog';
import type { Oportunidade } from '@/dados/tipos/comercial';
import { useConsulta } from '@/dados/use-consulta';
import { acaoAtrasada, avancarEtapa, carregarComercial, diasNaEtapa, ETAPAS_ABERTAS, estaAbertaNoFunil, filtrarOportunidades, FILTROS_FUNIL_INICIAIS, relatorioDoFunil, ROTULOS_ETAPA, ROTULOS_MOTIVO_PERDA, semProximaAcao, textoDosValores, totaisDaColuna, type FiltrosFunil, type LinhaDaOportunidade } from '@/dominio/comercial';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { carregarContextos } from '@/dominio/contextos';
import { ROTULOS_ORIGEM } from '@/dominio/contrapartes';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';

type Visao = 'quadro' | 'lista';
type Destaque = '' | 'atrasadas' | 'sem_proxima';
const COLUNAS = [...ETAPAS_ABERTAS, 'encerradas'] as const;

async function carregar() {
  const [dados, contextos] = await Promise.all([carregarComercial(), carregarContextos()]);
  return { ...dados, contextos };
}

function ValorDaOportunidade({ linha }: { linha: LinhaDaOportunidade }) {
  if (linha.valor_estimado === null) return <span className="text-ink-soft">Valor não informado</span>;
  return <span>{textoDosValores([{ periodicidade: linha.valor_periodicidade ?? 'unica', valor: linha.valor_estimado }])}</span>;
}

function ProximaAcao({ linha, hoje }: { linha: LinhaDaOportunidade; hoje: string }) {
  if (!estaAbertaNoFunil(linha)) return <span className="text-ink-soft">Encerrada em {formatarDiaISO((linha.ganha_em ?? linha.perdida_em) as string)}</span>;
  if (!linha.proxima)
    return (
      <EtiquetaSituacao tipo="atencao" icone={CircleAlert}>
        Sem próxima ação
      </EtiquetaSituacao>
    );
  const atrasada = acaoAtrasada(linha, hoje);
  return (
    <span className={cn('inline-flex items-center gap-1.5', atrasada ? 'font-semibold text-err' : 'text-indigo-dk')}>
      {atrasada && <CircleAlert className="size-3.5" aria-hidden />}
      {linha.proxima.titulo} · {formatarDiaISO(linha.proxima.prazo as string)}
      {atrasada && <span className="sr-only">(atrasada)</span>}
    </span>
  );
}

/** T10.02: quadro por etapa e lista. Mover é um comando do cartão: funciona sem mouse e sem arrastar (P4). */
export function TelaFunil() {
  const roteador = useRouter();
  const celular = useEhCelular();
  const consulta = useConsulta(carregar);
  const dados = consulta.dados;
  const hoje = hojeISO();
  const [filtros, setFiltros] = useState<FiltrosFunil>(FILTROS_FUNIL_INICIAIS);
  const [visao, setVisao] = useState<Visao>('quadro');
  const [destaque, setDestaque] = useState<Destaque>('');
  const [colunaCelular, setColunaCelular] = useState<(typeof COLUNAS)[number]>('novo');
  const [nova, setNova] = useState(false);
  const [relatorio, setRelatorio] = useState(false);

  const nomeContraparte = (id: string) => {
    const contraparte = dados?.contrapartes.find((item) => item.id === id);
    return contraparte ? nomeDaContraparte(contraparte) : 'Contraparte removida';
  };
  const nomePessoa = (id: string) => dados?.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  const base = useMemo(() => filtrarOportunidades(dados?.oportunidades ?? [], filtros, nomeContraparte), [dados, filtros]); // eslint-disable-line react-hooks/exhaustive-deps -- `nomeContraparte` lê `dados`
  const visiveis = base.filter((linha) => (destaque === 'atrasadas' ? acaoAtrasada(linha, hoje) && estaAbertaNoFunil(linha) : destaque === 'sem_proxima' ? semProximaAcao(linha) : true));
  const abertas = base.filter(estaAbertaNoFunil);
  const totaisAbertas = totaisDaColuna(abertas);
  const filtrando = Boolean(filtros.busca.trim() || filtros.produto || filtros.responsavel || filtros.origem || filtros.semProxima || filtros.criadaDe || filtros.criadaAte || destaque);
  const limpar = () => {
    setFiltros(FILTROS_FUNIL_INICIAIS);
    setDestaque('');
  };
  const contexto = (id: string) => dados?.contextos.find((item) => item.id === id);
  const opcoesProduto = (dados?.produtos ?? []).filter((produto) => !produto.arquivado_em).map((produto) => ({ valor: produto.id, rotulo: produto.nome }));
  const opcoesResponsavel = (dados?.pessoas ?? []).filter((pessoa) => pessoa.tipo === 'interna' && !pessoa.arquivado_em).map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }));
  const opcoesOrigem = Object.entries(ROTULOS_ORIGEM).map(([valor, rotulo]) => ({ valor, rotulo }));

  const Cartao = ({ linha }: { linha: LinhaDaOportunidade }) => (
    <article className="rounded-lg border border-line bg-paper p-3.5 text-[13px]">
      <div className="flex items-start justify-between gap-2">
        <LinkCentral href={`/comercial/oportunidades/${linha.id}`} className="min-h-11 min-w-0 font-semibold break-words hover:underline md:min-h-0">
          {linha.titulo}
        </LinkCentral>
        {linha.etapa === 'ganha' && <EtiquetaSituacao tipo="sucesso">Ganha</EtiquetaSituacao>}
        {linha.etapa === 'perdida' && <EtiquetaSituacao tipo="erro">Perdida</EtiquetaSituacao>}
        {estaAbertaNoFunil(linha) && (
          <MenuSobreposto titulo="Mover para" largura={240} alinhar="end" gatilho={<Button variante="icone" tamanho="icone" aria-label={`Mover ${linha.titulo}`}><ListFilter aria-hidden /></Button>}>
            {(fechar) => (
              <div className="grid gap-0.5">
                {ETAPAS_ABERTAS.filter((etapa) => etapa !== linha.etapa).map((etapa) => (
                  <button key={etapa} type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); void executar(() => avancarEtapa(linha.id, etapa), `Movida para ${ROTULOS_ETAPA[etapa]}.`); }}>
                    {ROTULOS_ETAPA[etapa]}
                  </button>
                ))}
                <LinkCentral href={`/comercial/oportunidades/${linha.id}?encerrar=1`} className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}>
                  Ganha ou perdida…
                </LinkCentral>
              </div>
            )}
          </MenuSobreposto>
        )}
      </div>
      <p className="mt-1 text-ink-soft">{nomeContraparte(linha.contraparte_id)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {linha.produtos.map((id) => {
          const item = contexto(id);
          return item ? <EtiquetaContexto key={id} contexto={item} /> : null;
        })}
      </div>
      <div className="mt-2 grid gap-1">
        <ValorDaOportunidade linha={linha} />
        <span className="flex items-center gap-1.5 text-ink-soft">
          <UserRound className="size-3.5" aria-hidden />
          {nomePessoa(linha.responsavel_id)}
        </span>
        <ProximaAcao linha={linha} hoje={hoje} />
      </div>
      {estaAbertaNoFunil(linha) && <p className="mt-2 rounded-sm bg-linen px-2 py-1 text-xs text-ink-soft">Na etapa há {diasNaEtapa(linha, hoje)} dias</p>}
    </article>
  );

  const linhasDaColuna = (coluna: (typeof COLUNAS)[number]) => visiveis.filter((linha) => (coluna === 'encerradas' ? !estaAbertaNoFunil(linha) : linha.etapa === coluna));

  const ColunaDoQuadro = ({ coluna }: { coluna: (typeof COLUNAS)[number] }) => {
    const linhas = linhasDaColuna(coluna);
    const totais = totaisDaColuna(linhas.filter(estaAbertaNoFunil));
    return (
      <section aria-label={coluna === 'encerradas' ? 'Encerradas' : ROTULOS_ETAPA[coluna]} className="flex min-w-0 flex-col gap-2 rounded-lg bg-mist p-2.5">
        <header className="px-1">
          <h2 className="flex items-center gap-2 text-[15px] leading-6">
            {coluna === 'encerradas' ? 'Encerradas' : ROTULOS_ETAPA[coluna]} <span className="rounded-pill bg-paper px-2 text-xs tabular-nums">{linhas.length}</span>
          </h2>
          {coluna !== 'encerradas' && <p className="text-xs text-ink-soft">{totais.valores.length ? textoDosValores(totais.valores) : 'Sem valor informado'}{totais.semValor ? ` · ${totais.semValor} sem valor` : ''}</p>}
        </header>
        {linhas.map((linha) => (
          <Cartao key={linha.id} linha={linha} />
        ))}
        {!linhas.length && <p className="px-1 py-3 text-xs text-ink-soft">Nada aqui.</p>}
      </section>
    );
  };

  const colunasLista: readonly Coluna<LinhaDaOportunidade>[] = [
    { id: 'titulo', titulo: 'Oportunidade', essencial: true, ordenar: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'), celula: (linha) => <span className="grid"><span className="font-medium">{linha.titulo}</span><span className="text-xs text-ink-soft">{linha.codigo}</span></span> },
    { id: 'contraparte', titulo: 'Contraparte', celula: (linha) => nomeContraparte(linha.contraparte_id) },
    { id: 'etapa', titulo: 'Etapa', essencial: true, celula: (linha) => ROTULOS_ETAPA[linha.etapa] },
    { id: 'valor', titulo: 'Valor estimado', celula: (linha) => <ValorDaOportunidade linha={linha} /> },
    { id: 'responsavel', titulo: 'Responsável', celula: (linha) => nomePessoa(linha.responsavel_id) },
    { id: 'proxima', titulo: 'Próxima ação', essencial: true, celula: (linha) => <ProximaAcao linha={linha} hoje={hoje} /> },
    { id: 'dias', titulo: 'Dias na etapa', numerica: true, ordenar: (a, b) => diasNaEtapa(a, hoje) - diasNaEtapa(b, hoje), celula: (linha) => (estaAbertaNoFunil(linha) ? diasNaEtapa(linha, hoje) : '—') },
  ];

  const alternarVisao = (
    <div role="group" aria-label="Visão" className="inline-flex rounded-pill border border-line bg-paper p-0.5">
      {(['quadro', 'lista'] as const).map((opcao) => (
        <button key={opcao} type="button" aria-pressed={visao === opcao} onClick={() => setVisao(opcao)} className={cn('min-h-10 rounded-pill px-4 text-[13px] font-semibold', visao === opcao ? 'bg-espresso text-linen' : 'text-ink')}>
          {opcao === 'quadro' ? 'Quadro' : 'Lista'}
        </button>
      ))}
    </div>
  );
  const dadosRelatorio = relatorioDoFunil(dados?.oportunidades ?? []);

  return (
    <>
      <CabecalhoPagina
        comoUsar="/ajuda/comercial"
        kicker="Comercial"
        titulo="Funil comercial"
        resumo="Do primeiro contato ao encerramento. Ganhar não cria receita: ela vem do contrato."
        acoes={
          <>
            <Button variante="secundario" disabled={!dados} onClick={() => setRelatorio(true)}>
              <BarChart3 aria-hidden />
              Relatório do funil
            </Button>
            <Button disabled={!dados} onClick={() => setNova(true)}>
              <Plus aria-hidden />
              Nova oportunidade
            </Button>
          </>
        }
      />
      <AbasComercial ativa="funil" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler o funil." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {dados && (
          <>
            <CartoesDeResumo
              rotulo="Resumo do funil"
              className="md:grid-cols-3"
              cartoes={[
                { id: '' as Destaque, rotulo: 'Abertas', valor: abertas.length, icone: Target },
                { id: 'atrasadas' as Destaque, rotulo: 'Ações atrasadas', valor: abertas.filter((linha) => acaoAtrasada(linha, hoje)).length, icone: CircleAlert, atencao: true },
                { id: 'sem_proxima' as Destaque, rotulo: 'Sem próxima ação', valor: abertas.filter(semProximaAcao).length, icone: CalendarClock, tom: 'atencao' },
              ]}
              ativo={(id) => destaque === id}
              aoEscolher={(id) => setDestaque((atual) => (atual === id ? '' : id))}
            />
            <p className="text-[13px] text-ink-soft">Valores das abertas: {totaisAbertas.valores.length ? textoDosValores(totaisAbertas.valores) : 'nenhum informado'}{totaisAbertas.semValor ? `. ${totaisAbertas.semValor} sem valor informado.` : '.'}</p>
            <FiltrosEmLinha
              filtros={filtros}
              aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
              aoLimpar={limpar}
              rotuloBusca="Buscar oportunidade, contraparte ou código"
              seletores={[seletorDeOpcoes<FiltrosFunil>({ id: 'produto', rotulo: 'Produto', icone: Layers, campo: 'produto', opcoes: opcoesProduto }), seletorDeOpcoes<FiltrosFunil>({ id: 'responsavel', rotulo: 'Responsável', icone: UserRound, campo: 'responsavel', opcoes: opcoesResponsavel, todos: 'Todas' })]}
              avancados={(valor, mudar) => (
                <>
                  <fieldset>
                    <legend className="mb-[7px] texto-rotulo">Origem</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ valor: '', rotulo: 'Todas' }, ...opcoesOrigem].map((opcao) => (
                        <button key={opcao.valor} type="button" aria-pressed={valor.origem === opcao.valor} onClick={() => mudar({ origem: opcao.valor })} className={cn('min-h-11 rounded-pill border px-3 text-[13px] font-semibold md:min-h-9', valor.origem === opcao.valor ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper')}>
                          {opcao.rotulo}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo id="funil-de" rotulo="Criada de">{(controle) => <EntradaData {...controle} value={valor.criadaDe} onChange={(evento) => mudar({ criadaDe: evento.target.value })} />}</Campo>
                    <Campo id="funil-ate" rotulo="Criada até">{(controle) => <EntradaData {...controle} value={valor.criadaAte} onChange={(evento) => mudar({ criadaAte: evento.target.value })} />}</Campo>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold">
                    <input type="checkbox" checked={valor.semProxima} onChange={(evento) => mudar({ semProxima: evento.target.checked })} />
                    Só sem próxima ação
                  </label>
                </>
              )}
              quantosAvancados={(valor) => [valor.origem, valor.criadaDe || valor.criadaAte, valor.semProxima].filter(Boolean).length}
              direita={alternarVisao}
              larguraDireita={180}
              soNaFolha={() => alternarVisao}
              ativos={[
                ...(filtros.produto ? [{ id: 'produto', rotulo: `Produto: ${opcoesProduto.find((opcao) => opcao.valor === filtros.produto)?.rotulo ?? ''}` }] : []),
                ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomePessoa(filtros.responsavel)}` }] : []),
                ...(filtros.origem ? [{ id: 'origem', rotulo: `Origem: ${ROTULOS_ORIGEM[filtros.origem as keyof typeof ROTULOS_ORIGEM]}` }] : []),
                ...(filtros.criadaDe || filtros.criadaAte ? [{ id: 'periodo', rotulo: `Criada: ${filtros.criadaDe ? formatarDiaISO(filtros.criadaDe) : '…'} a ${filtros.criadaAte ? formatarDiaISO(filtros.criadaAte) : '…'}` }] : []),
                ...(filtros.semProxima ? [{ id: 'semProxima', rotulo: 'Sem próxima ação' }] : []),
                ...(destaque ? [{ id: 'destaque', rotulo: destaque === 'atrasadas' ? 'Ações atrasadas' : 'Sem próxima ação' }] : []),
              ]}
              aoRemoverAtivo={(id) => (id === 'destaque' ? setDestaque('') : id === 'periodo' ? setFiltros((atuais) => ({ ...atuais, criadaDe: '', criadaAte: '' })) : id === 'semProxima' ? setFiltros((atuais) => ({ ...atuais, semProxima: false })) : setFiltros((atuais) => ({ ...atuais, [id]: '' })))}
            />
            {!dados.oportunidades.length ? (
              <EstadoVazio icone={Target} titulo="Nenhuma oportunidade ainda." texto="Registre a primeira conversa com um possível cliente ou parceiro." acao={<Button onClick={() => setNova(true)}>Nova oportunidade</Button>} />
            ) : visao === 'lista' || !visiveis.length ? (
              !visiveis.length ? (
                <EstadoVazioFiltro aoLimpar={limpar} />
              ) : (
                <Lista rotulo="Oportunidades" linhas={visiveis} colunas={colunasLista} chave={(linha) => linha.id} aoAbrir={(linha) => roteador.push(`/comercial/oportunidades/${linha.id}`)} cartao={(linha) => <Cartao linha={linha} />} cartaoInterativo filtrando={filtrando} aoLimparFiltros={limpar} vazio={null} />
              )
            ) : celular ? (
              <>
                <div role="tablist" aria-label="Etapas" className="faixa-rolagem flex gap-1.5">
                  {COLUNAS.map((coluna) => (
                    <button key={coluna} type="button" role="tab" aria-selected={colunaCelular === coluna} onClick={() => setColunaCelular(coluna)} className={cn('min-h-11 shrink-0 rounded-pill border px-3.5 text-[13px] font-semibold', colunaCelular === coluna ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper')}>
                      {coluna === 'encerradas' ? 'Encerradas' : ROTULOS_ETAPA[coluna]} {linhasDaColuna(coluna).length}
                    </button>
                  ))}
                </div>
                <ColunaDoQuadro coluna={colunaCelular} />
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
                {COLUNAS.map((coluna) => (
                  <ColunaDoQuadro key={coluna} coluna={coluna} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {nova && dados && <FormularioOportunidade dados={dados} aoFechar={() => setNova(false)} />}
      <Dialog open={relatorio} onOpenChange={setRelatorio}>
        <DialogContent>
          <DialogTitle>Relatório do funil</DialogTitle>
          <div className="mt-4 grid gap-4 text-[13px]">
            <ul className="grid gap-1">
              {dadosRelatorio.porEtapa.map((linha) => (
                <li key={linha.etapa} className="flex justify-between border-t border-line py-1.5 first:border-t-0">
                  <span>{ROTULOS_ETAPA[linha.etapa as Oportunidade['etapa']]}</span>
                  <span className="tabular-nums">{linha.quantidade}</span>
                </li>
              ))}
            </ul>
            <p>Conversão das encerradas: {dadosRelatorio.conversao === null ? 'sem encerradas ainda' : `${dadosRelatorio.conversao}% ganhas`}.</p>
            <p>Tempo médio até encerrar: {dadosRelatorio.tempoMedioDias === null ? 'sem encerradas ainda' : `${dadosRelatorio.tempoMedioDias} dias`}.</p>
            <p>Motivos de perda: {dadosRelatorio.motivos.length ? dadosRelatorio.motivos.map((linha) => `${ROTULOS_MOTIVO_PERDA[linha.motivo]} (${linha.quantidade})`).join(', ') : 'nenhuma perdida'}.</p>
          </div>
          <div className="acoes-dialogo">
            <Button variante="secundario" onClick={() => setRelatorio(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
