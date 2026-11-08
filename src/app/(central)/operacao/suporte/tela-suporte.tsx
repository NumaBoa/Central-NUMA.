'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleDot, Layers, LifeBuoy, Plus, Tag } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { AbasOperacao } from '@/componentes/operacao/abas-operacao';
import { JanelaNovaSolicitacao } from '@/componentes/operacao/formulario-solicitacao';
import { EtiquetaDoPrazo, SituacaoDaSolicitacao } from '@/componentes/operacao/situacoes';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { PilulaFiltro } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Indicador } from '@/componentes/padroes/indicador';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA } from '@/dominio/contextos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { ROTULOS_PRIORIDADE } from '@/dominio/sla';
import { carregarSuporte, cumprimentoDoSla, ENCERRADAS, percentualDoCumprimento, ROTULOS_SITUACAO_SUPORTE, ROTULOS_TIPO_SUPORTE, type LinhaDaSolicitacao } from '@/dominio/suporte';
import { formatarDataHora } from '@/lib/formatacao';

type Filtros = { busca: string; produto: string; situacao: string; tipo: string; prioridade: string; responsavel: string };
const INICIAIS: Filtros = { busca: '', produto: '', situacao: '', tipo: '', prioridade: '', responsavel: '' };
type Recorte = 'abertas' | 'risco' | 'todas';

const emRisco = (linha: LinhaDaSolicitacao) => ['em_risco', 'violado'].includes(linha.sla_situacao.resposta.estado) || ['em_risco', 'violado'].includes(linha.sla_situacao.resolucao.estado);
const NOMES_DOS_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** T12.03: a lista, com o SLA de resposta e de resolução, e o relatório de cumprimento. */
export function TelaSuporte() {
  const roteador = useRouter();
  const { pessoa, contexto } = useCentral();
  const consulta = useConsulta(() => carregarSuporte());
  const dados = consulta.dados;
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const [recorte, setRecorte] = useState<Recorte>('abertas');
  const [criando, setCriando] = useState(false);
  const nomeDaPessoa = (id: string) => dados?.pessoas.find((linha) => linha.id === id)?.nome_completo ?? 'Pessoa removida';
  const produto = (id: string) => dados?.produtos.find((linha) => linha.id === id)?.nome ?? 'Produto removido';
  const quem = (linha: LinhaDaSolicitacao) => {
    if (!linha.contraparte_id) return linha.solicitante_texto ?? 'Sem identificação';
    const contraparte = dados?.contrapartes.find((item) => item.id === linha.contraparte_id);
    return contraparte ? nomeDaContraparte(contraparte) : 'Contraparte removida';
  };

  const doContexto = useMemo(() => (dados?.linhas ?? []).filter((linha) => !linha.arquivado_em && (contexto.id === ID_CONSOLIDADA || linha.produto_id === contexto.id)), [dados, contexto.id]);
  const semRecorte = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return doContexto.filter((linha) => (!filtros.produto || linha.produto_id === filtros.produto) && (!filtros.situacao || linha.situacao === filtros.situacao) && (!filtros.tipo || linha.tipo === filtros.tipo) && (!filtros.prioridade || linha.prioridade === filtros.prioridade) && (!filtros.responsavel || linha.responsavel_id === filtros.responsavel) && (!termo || `${linha.codigo} ${linha.titulo} ${quem(linha)}`.toLowerCase().includes(termo)));
  }, [doContexto, filtros]); // eslint-disable-line react-hooks/exhaustive-deps -- `quem` lê `dados`
  const noRecorte = (linha: LinhaDaSolicitacao, qual: Recorte) => (qual === 'todas' ? true : qual === 'abertas' ? !ENCERRADAS.has(linha.situacao) : !ENCERRADAS.has(linha.situacao) && emRisco(linha));
  const linhas = semRecorte.filter((linha) => noRecorte(linha, recorte)).sort((a, b) => b.aberta_em.localeCompare(a.aberta_em));
  const abertas = doContexto.filter((linha) => !ENCERRADAS.has(linha.situacao));
  const filtrando = recorte !== 'abertas' || Object.entries(filtros).some(([campo, valor]) => (campo === 'busca' ? Boolean(valor.trim()) : Boolean(valor)));

  const colunas: readonly Coluna<LinhaDaSolicitacao>[] = [
    { id: 'titulo', titulo: 'Solicitação', essencial: true, celula: (linha) => <span className="grid"><span className="font-medium">{linha.titulo}</span><span className="text-xs text-ink-soft">{linha.codigo} · {quem(linha)}</span></span>, texto: (linha) => `${linha.codigo} ${linha.titulo}` },
    { id: 'produto', titulo: 'Produto', celula: (linha) => produto(linha.produto_id) },
    { id: 'tipo', titulo: 'Tipo e prioridade', celula: (linha) => <span className="grid"><span>{ROTULOS_TIPO_SUPORTE[linha.tipo]}</span><span className="text-xs text-ink-soft">{ROTULOS_PRIORIDADE[linha.prioridade]}</span></span> },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => <SituacaoDaSolicitacao situacao={linha.situacao} /> },
    { id: 'resposta', titulo: '1ª resposta', essencial: true, celula: (linha) => <EtiquetaDoPrazo situacao={linha.sla_situacao.resposta} /> },
    { id: 'resolucao', titulo: 'Resolução', celula: (linha) => <EtiquetaDoPrazo situacao={linha.sla_situacao.resolucao} /> },
    { id: 'responsavel', titulo: 'Responsável', celula: (linha) => nomeDaPessoa(linha.responsavel_id) },
  ];

  const botaoNovo = (
    <Button onClick={() => setCriando(true)}>
      <Plus aria-hidden />
      Nova solicitação
    </Button>
  );
  const relatorio = (agrupar: (linha: LinhaDaSolicitacao) => { chave: string; rotulo: string }) => cumprimentoDoSla(doContexto, agrupar);
  const porMes = relatorio((linha) => ({ chave: linha.aberta_em.slice(0, 7), rotulo: `${NOMES_DOS_MESES[Number(linha.aberta_em.slice(5, 7)) - 1]}/${linha.aberta_em.slice(0, 4)}` }));
  const porProduto = relatorio((linha) => ({ chave: linha.produto_id, rotulo: produto(linha.produto_id) }));
  const porTipo = relatorio((linha) => ({ chave: linha.tipo, rotulo: ROTULOS_TIPO_SUPORTE[linha.tipo] }));
  const semSla = doContexto.filter((linha) => !linha.sla && linha.situacao !== 'cancelada').length;

  return (
    <>
      <CabecalhoPagina kicker="Operação" titulo="Solicitações de suporte" resumo="Atender dentro do combinado. Novo escopo não é suporte: vira proposta de aditivo." acoes={botaoNovo} />
      <AbasOperacao ativa="suporte" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as solicitações." aoTentarDeNovo={consulta.recarregar} />}
        {dados && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <Indicador titulo="Abertas" valor={String(abertas.length)} contexto="Nem resolvidas, nem fechadas, nem canceladas" />
            <Indicador titulo="Em risco ou violadas" valor={String(abertas.filter(emRisco).length)} tom={abertas.some(emRisco) ? 'erro' : 'neutro'} contexto="80% do prazo ou mais" />
            <Indicador titulo="Aguardando proposta" valor={String(abertas.filter((linha) => linha.situacao === 'aguardando_proposta').length)} className="max-lg:col-span-2" />
          </div>
        )}
        <Tabs defaultValue="lista">
          <TabsList aria-label="Suporte">
            <TabsTrigger value="lista">Solicitações</TabsTrigger>
            <TabsTrigger value="relatorio">Cumprimento de SLA</TabsTrigger>
          </TabsList>
          <TabsContent value="lista" className="mt-4 space-y-4">
            <FiltrosEmLinha
              filtros={filtros}
              aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
              aoLimpar={() => {
                setFiltros(INICIAIS);
                setRecorte('abertas');
              }}
              rotuloBusca="Buscar código, título ou quem pediu"
              seletores={[
                seletorDeOpcoes<Filtros>({ id: 'produto', rotulo: 'Produto', icone: Layers, campo: 'produto', opcoes: (dados?.produtos ?? []).filter((linha) => doContexto.some((item) => item.produto_id === linha.id)).map((linha) => ({ valor: linha.id, rotulo: linha.nome })) }),
                seletorDeOpcoes<Filtros>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes: paraOpcoes(ROTULOS_SITUACAO_SUPORTE), todos: 'Todas' }),
                seletorDeOpcoes<Filtros>({ id: 'tipo', rotulo: 'Tipo', icone: Tag, campo: 'tipo', opcoes: paraOpcoes(ROTULOS_TIPO_SUPORTE) }),
              ]}
              avancados={(valor, mudar) => (
                <>
                  <Campo id="sup-filtro-prioridade" rotulo="Prioridade">
                    {(controle) => (
                      <select {...controle} className="campo" value={valor.prioridade} onChange={(evento) => mudar({ prioridade: evento.target.value })}>
                        <option value="">Todas</option>
                        {paraOpcoes(ROTULOS_PRIORIDADE).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                      </select>
                    )}
                  </Campo>
                  <Campo id="sup-filtro-responsavel" rotulo="Responsável">
                    {(controle) => (
                      <select {...controle} className="campo" value={valor.responsavel} onChange={(evento) => mudar({ responsavel: evento.target.value })}>
                        <option value="">Todas</option>
                        {(dados?.pessoas ?? []).filter((linha) => doContexto.some((item) => item.responsavel_id === linha.id)).map((linha) => <option key={linha.id} value={linha.id}>{linha.nome_completo}</option>)}
                      </select>
                    )}
                  </Campo>
                </>
              )}
              quantosAvancados={(valor) => [valor.prioridade, valor.responsavel].filter(Boolean).length}
              ativos={[
                ...(filtros.produto ? [{ id: 'produto', rotulo: `Produto: ${produto(filtros.produto)}` }] : []),
                ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_SUPORTE[filtros.situacao as keyof typeof ROTULOS_SITUACAO_SUPORTE]}` }] : []),
                ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_SUPORTE[filtros.tipo as keyof typeof ROTULOS_TIPO_SUPORTE]}` }] : []),
                ...(filtros.prioridade ? [{ id: 'prioridade', rotulo: `Prioridade: ${ROTULOS_PRIORIDADE[filtros.prioridade as keyof typeof ROTULOS_PRIORIDADE]}` }] : []),
                ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomeDaPessoa(filtros.responsavel)}` }] : []),
              ]}
              aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
            />
            <div role="group" aria-label="Recortes" className="faixa-rolagem flex gap-1.5 py-0.5">
              {([['abertas', 'Abertas'], ['risco', 'Em risco ou violadas'], ['todas', 'Todas']] as const).map(([id, rotulo]) => <PilulaFiltro key={id} filtro={{ id, rotulo, contador: semRecorte.filter((linha) => noRecorte(linha, id)).length }} ativa={recorte === id} aoClicar={() => setRecorte(id)} />)}
            </div>
            <Lista
              rotulo="Solicitações de suporte"
              linhas={linhas}
              colunas={colunas}
              chave={(linha) => linha.id}
              estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
              filtrando={filtrando}
              aoLimparFiltros={() => {
                setFiltros(INICIAIS);
                setRecorte('abertas');
              }}
              aoAbrir={(linha) => roteador.push(`/operacao/suporte/${linha.id}`)}
              cartao={(linha) => (
                <span className="grid gap-1.5">
                  <span className="font-semibold">{linha.titulo}</span>
                  <span className="text-[13px] text-ink-soft">{linha.codigo} · {quem(linha)} · {produto(linha.produto_id)}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <SituacaoDaSolicitacao situacao={linha.situacao} />
                    <EtiquetaDoPrazo situacao={linha.sla_situacao.resposta} />
                  </span>
                  <span className="text-xs text-ink-soft">Aberta em {formatarDataHora(linha.aberta_em)}</span>
                </span>
              )}
              vazio={<EstadoVazio icone={LifeBuoy} titulo="Nenhuma solicitação aberta." texto="Registre os pedidos dos clientes aqui: o prazo do SLA é calculado na abertura." acao={botaoNovo} />}
            />
          </TabsContent>
          <TabsContent value="relatorio" className="mt-4 space-y-4">
            <p className="text-[13px] text-ink-soft">Percentual cumprido entre os prazos que já se decidiram: cumpridos, fora do prazo ou violados em aberto. O que ainda corre no prazo não entra.{semSla ? ` ${semSla === 1 ? '1 solicitação está' : `${semSla} solicitações estão`} sem SLA e ficam de fora.` : ''}</p>
            {[['Por mês de abertura', porMes], ['Por produto', porProduto], ['Por tipo', porTipo]].map(([titulo, grupos]) => (
              <section key={titulo as string} aria-label={`Cumprimento ${(titulo as string).toLowerCase()}`} className="rounded-lg border border-line bg-paper p-4 md:p-5">
                <h2 className="mb-3 text-[17px]">{titulo as string}</h2>
                {(grupos as ReturnType<typeof cumprimentoDoSla>).length ? (
                  <ul className="grid gap-1.5 text-[13px]">
                    {(grupos as ReturnType<typeof cumprimentoDoSla>).map((grupo) => (
                      <li key={grupo.chave} className="grid gap-1 border-b border-line pb-1.5 last:border-0 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] sm:items-center">
                        <span className="font-semibold">{grupo.rotulo}</span>
                        <span className="text-ink-soft">{grupo.comSla} com SLA</span>
                        <span>1ª resposta: <strong className="tabular-nums">{percentualDoCumprimento(grupo.respostaNoPrazo, grupo.respostaMedida)}</strong> <span className="text-ink-soft">({grupo.respostaNoPrazo} de {grupo.respostaMedida})</span></span>
                        <span>Resolução: <strong className="tabular-nums">{percentualDoCumprimento(grupo.resolucaoNoPrazo, grupo.resolucaoMedida)}</strong> <span className="text-ink-soft">({grupo.resolucaoNoPrazo} de {grupo.resolucaoMedida})</span></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-soft">Nenhuma solicitação com SLA ainda.</p>
                )}
              </section>
            ))}
          </TabsContent>
        </Tabs>
      </div>
      {criando && dados && (
        <JanelaNovaSolicitacao
          produtos={dados.produtos}
          pessoas={dados.pessoas}
          contrapartes={dados.contrapartes}
          responsavelInicial={dados.sugerida || pessoa.id}
          aoFechar={() => setCriando(false)}
          aoCriar={(id) => {
            setCriando(false);
            roteador.push(`/operacao/suporte/${id}`);
          }}
        />
      )}
    </>
  );
}
