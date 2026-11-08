'use client';

import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarCheck, CircleCheck, Clock, Flag, ListPlus, Pencil, TriangleAlert } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { CartaoDePainel, executar } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbaArquivosDoRegistro } from '@/componentes/operacao/abas-comuns';
import { JanelaHoras } from '@/componentes/operacao/formulario-horas';
import { SituacaoDaImplantacao, TextoDoDesvio } from '@/componentes/operacao/situacoes';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { ImplantacaoMarco } from '@/dados/tipos/operacao';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { textoDaRegra } from '@/dominio/contratos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { estimadoRealizado, textoDoPercentual } from '@/dominio/estimado';
import { carregarVinculos, formatarHoras, formularioHorasVazio } from '@/dominio/horas';
import { carregarImplantacao, concluirImplantacao, gerarTarefas, historicoDaImplantacao, interromperImplantacao, registrarAceiteDaEntrega, retomarImplantacao, ROTULOS_MARCO, salvarDadosDaImplantacao, salvarMarco, tarefasPorGerar, type FichaDaImplantacao, type Marco } from '@/dominio/implantacoes';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

async function carregar(id: string) {
  const [ficha, pessoas, produtos, contrapartes, vinculos] = await Promise.all([carregarImplantacao(id), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.contraparte.listar({ incluirArquivados: true }), carregarVinculos()]);
  return ficha ? { ficha, pessoas, produtos, contrapartes, vinculos } : null;
}
type Dados = NonNullable<Awaited<ReturnType<typeof carregar>>>;

type Janela = '' | 'dados' | 'aceite' | 'horas' | 'tarefas' | 'suspender' | 'cancelar' | 'retomar' | 'concluir';

/** T12.02: a ficha da implantação, com o que vem do contrato só para leitura. */
export function FichaImplantacao() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregar(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler a implantação." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados) return <EstadoVazio icone={TriangleAlert} titulo="Implantação não encontrada." texto="Ela pode ter sido removida." acao={<LinkCentral href="/operacao">Voltar</LinkCentral>} />;
  return <Conteudo dados={consulta.dados} aoMudar={consulta.recarregar} />;
}

function situacaoDoMarco(marco: ImplantacaoMarco, hoje: string): { texto: string; tipo: 'sucesso' | 'atencao' | 'erro' | 'info' | 'neutro' } {
  if (marco.nao_se_aplica) return { texto: 'Não se aplica', tipo: 'neutro' };
  if (marco.realizado_em) return { texto: 'Realizado', tipo: 'sucesso' };
  if (marco.planejado_em) return marco.planejado_em < hoje ? { texto: 'Planejado, já passou', tipo: 'erro' } : { texto: 'Planejado', tipo: 'info' };
  return { texto: 'Não planejado', tipo: 'neutro' };
}

function Conteudo({ dados, aoMudar }: { dados: Dados; aoMudar: () => void }) {
  const { ficha } = dados;
  const { pessoa } = useCentral();
  const [janela, setJanela] = useState<Janela>('');
  const [marcoEmEdicao, setMarcoEmEdicao] = useState<ImplantacaoMarco | null>(null);
  const hoje = hojeISO();
  const nome = (id: string) => dados.pessoas.find((linha) => linha.id === id)?.nome_completo ?? 'Pessoa removida';
  const produto = dados.produtos.find((linha) => linha.id === ficha.produto_id);
  const contraparte = dados.contrapartes.find((linha) => linha.id === ficha.contraparte_id);
  const encerrada = ficha.situacao === 'concluida' || ficha.situacao === 'cancelada';
  const suspensa = ficha.situacao === 'suspensa';
  const marcosFeitos = ficha.marcos.every((marco) => marco.nao_se_aplica || marco.realizado_em);
  const estimado = estimadoRealizado(ficha, ficha.marcos, ficha.horasApontadas);
  const fechar = () => setJanela('');
  const depois = () => {
    fechar();
    aoMudar();
  };

  const acaoPrincipal = (() => {
    if (encerrada) return null;
    if (suspensa) return <Button onClick={() => setJanela('retomar')}>Retomar</Button>;
    if (ficha.entrega_realizada && !ficha.aceite_em) return <Button onClick={() => setJanela('aceite')}><CircleCheck aria-hidden />Registrar aceite</Button>;
    if (marcosFeitos) return <Button onClick={() => setJanela('concluir')}><Flag aria-hidden />Concluir</Button>;
    return <Button onClick={() => setJanela('horas')}><Clock aria-hidden />Apontar horas</Button>;
  })();

  const maisAcoes = !encerrada && (
    <MenuSobreposto titulo="Mais ações" largura={280} alinhar="end" gatilho={<Button variante="secundario" aria-label="Mais ações da implantação">Mais ações</Button>}>
      {(fecharMenu) => {
        const item = (rotulo: string, acao: () => void, perigo = false) => (
          <button key={rotulo} type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover', perigo && 'text-err')} onClick={() => { fecharMenu(); acao(); }}>
            {rotulo}
          </button>
        );
        return (
          <div className="grid gap-0.5">
            {item('Editar responsável e estimativas', () => setJanela('dados'))}
            {item('Apontar horas', () => setJanela('horas'))}
            {item('Gerar tarefas do escopo', () => setJanela('tarefas'))}
            {ficha.entrega_realizada && !ficha.aceite_em && item('Registrar aceite', () => setJanela('aceite'))}
            {!suspensa && item('Suspender', () => setJanela('suspender'))}
            {item('Cancelar implantação', () => setJanela('cancelar'), true)}
          </div>
        );
      }}
    </MenuSobreposto>
  );

  const contratual = ficha.contratual;
  const marcosOrdenados = ficha.marcos;
  // A linha do tempo: os marcos com data e o prazo contratual em destaque, na ordem das datas.
  const tempo = [
    ...marcosOrdenados.filter((marco) => !marco.nao_se_aplica && (marco.realizado_em || marco.planejado_em)).map((marco) => ({ chave: marco.id, data: (marco.realizado_em ?? marco.planejado_em) as string, rotulo: ROTULOS_MARCO[marco.marco], detalhe: marco.realizado_em ? 'realizado' : 'planejado', contratual: false })),
    ...(contratual && !contratual.pendente ? [{ chave: 'contratual', data: contratual.data, rotulo: 'Prazo contratual de entrega', detalhe: 'do contrato, só leitura', contratual: true }] : []),
  ].sort((a, b) => a.data.localeCompare(b.data) || Number(b.contratual) - Number(a.contratual));

  const abas = [
    {
      id: 'marcos',
      rotulo: 'Marcos',
      conteudo: (
        <div className="grid gap-4">
          <ul aria-label="Marcos da implantação" className="grid gap-2">
            {marcosOrdenados.map((marco) => {
              const situacao = situacaoDoMarco(marco, hoje);
              return (
                <li key={marco.id} className="grid gap-2 rounded-lg border border-line bg-paper p-4 md:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(0,1fr))_auto] md:items-center">
                  <span className="grid gap-1">
                    <span className="font-semibold">{ROTULOS_MARCO[marco.marco]}</span>
                    <EtiquetaSituacao tipo={situacao.tipo}>{situacao.texto}</EtiquetaSituacao>
                  </span>
                  <span className="text-[13px]"><span className="block text-xs text-ink-soft">Planejado</span>{marco.planejado_em ? formatarDiaISO(marco.planejado_em) : '—'}</span>
                  <span className="text-[13px]"><span className="block text-xs text-ink-soft">Realizado</span>{marco.realizado_em ? formatarDiaISO(marco.realizado_em) : '—'}</span>
                  {!encerrada && (
                    <Button variante="secundario" tamanho="pequeno" aria-label={`Editar ${ROTULOS_MARCO[marco.marco]}`} onClick={() => setMarcoEmEdicao(marco)}>
                      <Pencil aria-hidden />
                      Editar
                    </Button>
                  )}
                  {marco.observacao && <p className="text-[13px] text-ink-soft md:col-span-4">{marco.observacao}</p>}
                </li>
              );
            })}
          </ul>
          <CartaoDePainel titulo="Linha do tempo">
            {tempo.length ? (
              <ol aria-label="Linha do tempo" className="grid gap-0 border-l-2 border-line pl-4">
                {tempo.map((evento) => (
                  <li key={evento.chave} className={cn('relative py-2 text-[13px] before:absolute before:top-3.5 before:-left-[23px] before:size-3 before:rounded-full before:border-2 before:border-paper', evento.contratual ? 'font-semibold text-err before:bg-err' : 'before:bg-indigo')} data-contratual={evento.contratual || undefined}>
                    <span className="tabular-nums">{formatarDiaISO(evento.data)}</span> · {evento.rotulo} <span className="font-normal text-ink-soft">({evento.detalhe})</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-ink-soft">Nenhum marco com data ainda. O sistema não inventa datas: planeje cada marco em “Editar”.</p>
            )}
          </CartaoDePainel>
        </div>
      ),
    },
    { id: 'tarefas', rotulo: 'Tarefas', conteudo: <div className="grid gap-3">{!encerrada && <Button variante="secundario" className="justify-self-start" onClick={() => setJanela('tarefas')}><ListPlus aria-hidden />Gerar tarefas do escopo</Button>}<AbaAtividades consultar={() => atividadesDoRegistro('implantacao', ficha.id)} dependencia={`${ficha.id}:${ficha.atualizado_em}`} vazio="As tarefas da implantação são atividades do Meu dia vinculadas a ela. O alerta de prazo também aparece aqui." /></div> },
    {
      id: 'escopo',
      rotulo: 'Escopo',
      conteudo: (
        <div className="grid gap-3">
          <Faixa>Do contrato {ficha.contrato?.codigo}{ficha.versao ? `, V${ficha.versao.numero}` : ''}: só leitura. Mudar o escopo é aditivo (RN-11.12).</Faixa>
          <CartaoDePainel titulo="Itens do contrato">
            {ficha.itens.length ? (
              <ul className="grid gap-1 text-[13px]">
                {ficha.itens.map((item) => <li key={item.id}>{item.descricao}{item.quantidade !== 1 ? ` × ${item.quantidade}` : ''}</li>)}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-soft">Nenhum item deste produto na versão vigente.</p>
            )}
          </CartaoDePainel>
          <CartaoDePainel titulo="Escopo da proposta aceita">
            <ListaDeDados>
              <Dado rotulo="Incluído">{ficha.escopo?.incluido}</Dado>
              <Dado rotulo="Fora do escopo">{ficha.escopo?.excluido}</Dado>
              <Dado rotulo="Premissas">{ficha.escopo?.premissas}</Dado>
            </ListaDeDados>
          </CartaoDePainel>
          <CartaoDePainel titulo="Critérios de aceite">
            <ListaDeDados>
              <Dado rotulo="Critérios">{ficha.aceiteCriterios}</Dado>
              <Dado rotulo="Prazo para o aceite">{ficha.aceitePrazoDias === null ? null : `${ficha.aceitePrazoDias} dias`}</Dado>
            </ListaDeDados>
          </CartaoDePainel>
        </div>
      ),
    },
    {
      id: 'estimado',
      rotulo: 'Estimado × realizado',
      conteudo: (
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <CartaoDePainel titulo="Horas">
              <ListaDeDados>
                <Dado rotulo="Estimadas">{estimado.horasEstimadas === null ? 'Não estimadas' : formatarHoras(estimado.horasEstimadas)}</Dado>
                <Dado rotulo="Apontadas">{formatarHoras(estimado.horasApontadas)}</Dado>
                <Dado rotulo="Desvio">{textoDoPercentual(estimado.desvioHoras)}</Dado>
              </ListaDeDados>
            </CartaoDePainel>
            <CartaoDePainel titulo="Prazo">
              <ListaDeDados>
                <Dado rotulo="Estimado">{estimado.prazoEstimadoDias === null ? 'Não estimado' : `${estimado.prazoEstimadoDias} dias`}</Dado>
                <Dado rotulo="Realizado">{estimado.prazoRealizadoDias === null ? 'Do Início à Entrega realizados' : `${estimado.prazoRealizadoDias} dias`}</Dado>
                <Dado rotulo="Desvio">{textoDoPercentual(estimado.desvioPrazo)}</Dado>
              </ListaDeDados>
            </CartaoDePainel>
          </div>
          <CartaoDePainel titulo="Horas apontadas" acao={!encerrada ? <Button variante="secundario" tamanho="pequeno" onClick={() => setJanela('horas')}><Clock aria-hidden />Apontar horas</Button> : undefined}>
            {ficha.apontamentosDaImplantacao.length ? (
              <ul aria-label="Horas apontadas na implantação" className="grid gap-1 text-[13px]">
                {[...ficha.apontamentosDaImplantacao].sort((a, b) => b.data.localeCompare(a.data)).map((linha) => (
                  <li key={linha.id} className="flex justify-between gap-3">
                    <span>{formatarDiaISO(linha.data)} · {nome(linha.pessoa_id)}{linha.descricao ? ` · ${linha.descricao}` : ''}</span>
                    <span className="font-semibold tabular-nums">{formatarHoras(linha.horas)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-soft">Nenhuma hora apontada nesta implantação.</p>
            )}
          </CartaoDePainel>
          <p className="text-xs text-ink-soft">Ao concluir, o resultado entra na referência histórica do produto (RN-12.06), em Estimado × realizado.</p>
        </div>
      ),
    },
    {
      id: 'aceite',
      rotulo: 'Aceite',
      conteudo: ficha.aceite_em ? (
        <CartaoDePainel titulo="Aceite registrado">
          <ListaDeDados>
            <Dado rotulo="Data">{formatarDiaISO(ficha.aceite_em)}</Dado>
            <Dado rotulo="Aceito por (cliente)">{ficha.aceite_por_texto}</Dado>
            <Dado rotulo="Evidência">{ficha.aceite_evidencia_url && <a className="underline" href={ficha.aceite_evidencia_url} target="_blank" rel="noopener noreferrer">Abrir no Drive</a>}</Dado>
            <Dado rotulo="Evento no contrato">{ficha.eventoAceite ? `Aceite em ${formatarDiaISO(ficha.eventoAceite.data)}` : null}</Dado>
          </ListaDeDados>
        </CartaoDePainel>
      ) : (
        <CartaoDePainel titulo="Aceite da entrega">
          <p className="text-[13px]">O aceite vira o evento “Aceite” do contrato: prazos e parcelas relativos ao aceite passam a ter data, e a parcela que esperava o aceite é lançada se a programação financeira estiver ativa.</p>
          {ficha.eventoAceite && <p className="mt-2 text-[13px] text-ink-soft">O contrato já tem o evento Aceite em {formatarDiaISO(ficha.eventoAceite.data)}, de outra entrega: as regras do contrato usam essa data.</p>}
          {!encerrada && (
            <Button className="mt-3" disabled={!ficha.entrega_realizada} onClick={() => setJanela('aceite')}>
              <CircleCheck aria-hidden />
              Registrar aceite
            </Button>
          )}
          {!ficha.entrega_realizada && <p className="mt-2 text-xs text-ink-soft">Primeiro, registre a Entrega (Go Live) realizada, em Marcos.</p>}
        </CartaoDePainel>
      ),
    },
    { id: 'arquivos', rotulo: 'Arquivos', conteudo: <AbaArquivosDoRegistro tipo="implantacao" id={ficha.id} somenteLeitura={encerrada} /> },
    { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={ficha.id} /> },
  ];

  return (
    <>
      <LinkCentral href="/operacao" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Implantações
      </LinkCentral>
      <Ficha
        tituloDePagina
        codigo={ficha.codigo}
        titulo={contraparte ? nomeDaContraparte(contraparte) : 'Contraparte removida'}
        etiquetas={<><SituacaoDaImplantacao situacao={ficha.situacao} />{produto && <EtiquetaLivre>{produto.nome}</EtiquetaLivre>}</>}
        responsavel={<>Responsável: {nome(ficha.responsavel_id)}</>}
        acoes={<>{maisAcoes}{acaoPrincipal}</>}
        acoesCelular={acaoPrincipal || maisAcoes ? <>{maisAcoes}{acaoPrincipal}</> : undefined}
        lateral={
          <>
            <CartaoDePainel titulo="Entrega">
              <ListaDeDados>
                <Dado rotulo="Contratual (do contrato)">{contratual ? (contratual.pendente ? contratual.texto : formatarDiaISO(contratual.data)) : 'Sem prazo contratual'}</Dado>
                {ficha.regraDeEntrega && <Dado rotulo="Regra">{textoDaRegra(ficha.regraDeEntrega)}</Dado>}
                <Dado rotulo="Planejada">{ficha.entrega_planejada ? formatarDiaISO(ficha.entrega_planejada) : 'Não planejada'}</Dado>
                <Dado rotulo="Realizada">{ficha.entrega_realizada ? formatarDiaISO(ficha.entrega_realizada) : 'Ainda não'}</Dado>
              </ListaDeDados>
              <p className="mt-2 text-[13px]">
                <TextoDoDesvio desvio={ficha.entrega_realizada ? ficha.desvioRealizado : ficha.desvioPlanejado} />
              </p>
            </CartaoDePainel>
            <CartaoDePainel titulo="Contrato">
              <ListaDeDados>
                <Dado rotulo="Contrato">{ficha.contrato && <LinkCentral className="inline-flex min-h-11 items-center underline md:min-h-0" href={`/contratos/${ficha.contrato.id}`}>{ficha.contrato.codigo}</LinkCentral>}</Dado>
                <Dado rotulo="Horas">{`${ficha.horas_estimadas === null ? 'Não estimadas' : formatarHoras(ficha.horas_estimadas)} × ${formatarHoras(ficha.horasApontadas)} apontadas`}</Dado>
              </ListaDeDados>
            </CartaoDePainel>
          </>
        }
        abas={abas}
      />
      {(ficha.desvioPlanejado.dias ?? 0) > 0 && !ficha.entrega_realizada && !encerrada && (
        <Faixa tipo="atencao" className="mt-4">
          A entrega planejada está {ficha.desvioPlanejado.texto}. O contrato não muda: a responsável recebeu um alerta no Meu dia.
        </Faixa>
      )}
      {ficha.interrupcao && <Faixa tipo={ficha.interrupcao.tipo === 'cancelada' ? 'erro' : 'atencao'} className="mt-4">{ficha.interrupcao.tipo === 'cancelada' ? 'Cancelada' : 'Suspensa'} em {formatarDiaISO(ficha.interrupcao.em)}: {ficha.interrupcao.motivo}</Faixa>}
      {ficha.concluida_em && <Faixa tipo="sucesso" className="mt-4">Concluída em {formatarDiaISO(ficha.concluida_em)}. Fica só para consulta.</Faixa>}

      {marcoEmEdicao && <JanelaMarco ficha={ficha} marco={marcoEmEdicao} aoFechar={() => setMarcoEmEdicao(null)} aoSalvar={() => { setMarcoEmEdicao(null); aoMudar(); }} />}
      {janela === 'dados' && <JanelaDados dados={dados} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'aceite' && <JanelaAceite ficha={ficha} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'tarefas' && <JanelaTarefas id={ficha.id} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'horas' && <JanelaHoras dados={dados.vinculos} pessoaId={pessoa.id} inicial={formularioHorasVazio(hoje, `implantacao:${ficha.id}`, ficha.produto_id)} titulo={`Apontar horas em ${ficha.codigo}`} aoFechar={fechar} aoSalvar={aoMudar} />}
      <Confirmacao aberto={janela === 'suspender'} aoFechar={fechar} titulo="Suspender a implantação?" texto="Os marcos e as datas ficam como estão. O alerta de prazo fica parado até retomar." rotuloConfirmar="Suspender" pedirMotivo mensagemSemMotivo="Suspender exige motivo." aoConfirmar={async (motivo) => { if (await executar(() => interromperImplantacao(ficha.id, 'suspensa', motivo), 'Implantação suspensa.')) depois(); }} />
      <Confirmacao aberto={janela === 'cancelar'} aoFechar={fechar} titulo="Cancelar a implantação?" texto="Ela fica só para consulta, com o histórico. O contrato não muda." rotuloConfirmar="Cancelar implantação" perigo pedirMotivo mensagemSemMotivo="Cancelar exige motivo." aoConfirmar={async (motivo) => { if (await executar(() => interromperImplantacao(ficha.id, 'cancelada', motivo), 'Implantação cancelada.')) depois(); }} />
      <Confirmacao aberto={janela === 'retomar'} aoFechar={fechar} titulo="Retomar a implantação?" texto="A situação volta a seguir os marcos." rotuloConfirmar="Retomar" aoConfirmar={async () => { if (await executar(() => retomarImplantacao(ficha.id), 'Implantação retomada.')) depois(); }} />
      <Confirmacao aberto={janela === 'concluir'} aoFechar={fechar} titulo="Concluir a implantação?" texto={<>Ela fica só para consulta, e o estimado × realizado entra na referência histórica do produto.{!ficha.aceite_em && <span className="mt-2 block font-semibold">O aceite da entrega não foi registrado.</span>}</>} rotuloConfirmar="Concluir" aoConfirmar={async () => { if (await executar(() => concluirImplantacao(ficha.id), 'Implantação concluída.')) depois(); }} />
    </>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaImplantacao(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

function JanelaMarco({ ficha, marco, aoFechar, aoSalvar }: { ficha: FichaDaImplantacao; marco: ImplantacaoMarco; aoFechar: () => void; aoSalvar: () => void }) {
  const [planejado, setPlanejado] = useState(marco.planejado_em ?? '');
  const [realizado, setRealizado] = useState(marco.realizado_em ?? '');
  const [naoSeAplica, setNaoSeAplica] = useState(marco.nao_se_aplica);
  const [observacao, setObservacao] = useState(marco.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const hoje = hojeISO();
  const contratual = ficha.contratual && !ficha.contratual.pendente ? ficha.contratual.data : null;
  const podeNaoSeAplicar = marco.marco !== 'inicio' && marco.marco !== 'entrega';
  const alterado = planejado !== (marco.planejado_em ?? '') || realizado !== (marco.realizado_em ?? '') || naoSeAplica !== marco.nao_se_aplica || observacao !== (marco.observacao ?? '');
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await salvarMarco(ficha.id, marco.marco as Marco, { planejado_em: planejado, realizado_em: realizado, nao_se_aplica: naoSeAplica, observacao });
      aviso('Marco salvo.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={ROTULOS_MARCO[marco.marco]} descricao="As datas são da operação e não mudam o contrato." alterado={alterado} aoEnviar={enviar} salvando={salvando} rotuloSalvar="Salvar marco">
      <div className="grid gap-[18px]">
        {podeNaoSeAplicar && (
          <label className="flex min-h-11 items-center gap-2.5 text-[13px] font-semibold md:min-h-8">
            <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" checked={naoSeAplica} onChange={(evento) => setNaoSeAplica(evento.target.checked)} />
            Não se aplica a esta implantação
          </label>
        )}
        {!naoSeAplica && (
          <div className="grid gap-[18px] md:grid-cols-2">
            <Campo id="marco-planejado" rotulo="Data planejada" ajuda={marco.marco === 'entrega' && contratual ? `Prazo contratual: ${formatarDiaISO(contratual)}.` : undefined}>
              {(controle) => <EntradaData {...controle} value={planejado} onChange={(evento) => setPlanejado(evento.target.value)} />}
            </Campo>
            <Campo id="marco-realizado" rotulo="Data realizada" ajuda="Até hoje.">
              {(controle) => <EntradaData {...controle} max={hoje} value={realizado} onChange={(evento) => setRealizado(evento.target.value)} />}
            </Campo>
          </div>
        )}
        {marco.marco === 'entrega' && contratual && planejado > contratual && !realizado && <Faixa tipo="atencao">Planejada depois do prazo contratual. Dá para salvar: a responsável recebe um alerta, e o contrato não muda.</Faixa>}
        <Campo id="marco-observacao" rotulo="Observação">
          {(controle) => <Textarea {...controle} rows={3} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaDados({ dados, aoFechar, aoSalvar }: { dados: Dados; aoFechar: () => void; aoSalvar: () => void }) {
  const { ficha } = dados;
  const numero = (valor: number | null) => (valor === null ? '' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
  const [valores, setValores] = useState({ responsavel_id: ficha.responsavel_id, horas_estimadas: numero(ficha.horas_estimadas), prazo_estimado_dias: ficha.prazo_estimado_dias === null ? '' : String(ficha.prazo_estimado_dias), observacoes: ficha.observacoes ?? '' });
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await salvarDadosDaImplantacao(ficha.id, valores);
      aviso('Implantação atualizada.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  const mudar = (parcial: Partial<typeof valores>) => setValores((atuais) => ({ ...atuais, ...parcial }));
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Responsável e estimativas" descricao="As estimativas vieram da proposta e da viabilidade; ajuste só se mudou o combinado." aoEnviar={enviar} salvando={salvando} rotuloSalvar="Salvar alterações">
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="imp-responsavel" rotulo="Responsável" obrigatorio className="md:col-span-2">
          {(controle) => <SelecaoPessoa {...controle} pessoas={pessoasDoSeletor(dados.pessoas)} vazio="Escolha" value={valores.responsavel_id} onChange={(evento) => mudar({ responsavel_id: evento.target.value })} />}
        </Campo>
        <Campo id="imp-horas" rotulo="Horas estimadas" ajuda="Vazio fica “Não estimadas”, nunca zero.">
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={valores.horas_estimadas} onChange={(evento) => mudar({ horas_estimadas: evento.target.value })} />}
        </Campo>
        <Campo id="imp-prazo" rotulo="Prazo estimado (dias)">
          {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" value={valores.prazo_estimado_dias} onChange={(evento) => mudar({ prazo_estimado_dias: evento.target.value })} />}
        </Campo>
        <Campo id="imp-observacoes" rotulo="Observações" className="md:col-span-2">
          {(controle) => <Textarea {...controle} rows={3} value={valores.observacoes} onChange={(evento) => mudar({ observacoes: evento.target.value })} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaAceite({ ficha, aoFechar, aoSalvar }: { ficha: FichaDaImplantacao; aoFechar: () => void; aoSalvar: () => void }) {
  const hoje = hojeISO();
  const [data, setData] = useState(hoje);
  const [porTexto, setPorTexto] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      const resultado = await registrarAceiteDaEntrega(ficha.id, { data, porTexto, evidenciaUrl: evidencia });
      aviso(resultado.titulosGerados ? `Aceite registrado. ${resultado.titulosGerados === 1 ? '1 parcela lançada' : `${resultado.titulosGerados} parcelas lançadas`} no Financeiro.` : resultado.programacaoAtiva ? 'Aceite registrado. Nenhuma parcela esperava o aceite.' : 'Aceite registrado. A programação financeira do contrato não está ativa: as parcelas do aceite aparecem ao ativá-la.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Registrar aceite da entrega" descricao="Vira o evento “Aceite” do contrato, que dispara as regras de prazo e de pagamento relativas ao aceite." alterado={Boolean(porTexto || evidencia)} aoEnviar={enviar} salvando={salvando} rotuloSalvar="Registrar aceite" iconeSalvar={<CalendarCheck aria-hidden />}>
      <div className="grid gap-[18px]">
        {ficha.eventoAceite && <Faixa>O contrato já tem o evento Aceite em {formatarDiaISO(ficha.eventoAceite.data)}. Este aceite fica na implantação, e as regras do contrato continuam com aquela data.</Faixa>}
        <Campo id="aceite-data" rotulo="Data do aceite" obrigatorio ajuda={ficha.entrega_realizada ? `Entrega realizada em ${formatarDiaISO(ficha.entrega_realizada)}.` : undefined}>
          {(controle) => <EntradaData {...controle} min={ficha.entrega_realizada ?? undefined} max={hoje} value={data} onChange={(evento) => setData(evento.target.value)} />}
        </Campo>
        <Campo id="aceite-por" rotulo="Quem aceitou pelo cliente" obrigatorio>
          {(controle) => <Input {...controle} autoComplete="off" value={porTexto} onChange={(evento) => setPorTexto(evento.target.value)} />}
        </Campo>
        <Campo id="aceite-evidencia" rotulo="Evidência do aceite" obrigatorio ajuda="Link do Drive: o e-mail, a mensagem ou o termo assinado.">
          {(controle) => <EntradaLinkDrive {...controle} link={evidencia} value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaTarefas({ id, aoFechar, aoSalvar }: { id: string; aoFechar: () => void; aoSalvar: () => void }) {
  const consulta = useConsulta(() => tarefasPorGerar(id), [id]);
  const [escolhidas, setEscolhidas] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const lista = consulta.dados ?? [];
  const marcadas = escolhidas ?? lista.map((tarefa) => tarefa.titulo);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!marcadas.length) {
      aoFechar();
      return;
    }
    setSalvando(true);
    try {
      const criadas = await gerarTarefas(id, marcadas);
      aviso(criadas ? `${criadas === 1 ? '1 tarefa criada' : `${criadas} tarefas criadas`} no Meu dia.` : 'Nada novo: essas tarefas já existiam.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Gerar tarefas do escopo" descricao="Uma por entrega da viabilidade e por item sob medida. Gerar de novo não duplica." aoEnviar={enviar} salvando={salvando} rotuloSalvar={lista.length ? 'Gerar tarefas' : 'Fechar'}>
      {consulta.estado === 'carregando' ? (
        <EstadoCarregando linhas={2} />
      ) : lista.length ? (
        <ul aria-label="Tarefas por gerar" className="grid gap-1">
          {lista.map((tarefa) => (
            <li key={tarefa.titulo}>
              <label className="flex min-h-11 items-center gap-2.5 text-[13px] md:min-h-8">
                <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" checked={marcadas.includes(tarefa.titulo)} onChange={(evento) => setEscolhidas(evento.target.checked ? [...marcadas, tarefa.titulo] : marcadas.filter((titulo) => titulo !== tarefa.titulo))} />
                {tarefa.titulo}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft">Todas as tarefas sugeridas já existem. Outras tarefas se criam no Meu dia, com o vínculo desta implantação.</p>
      )}
    </JanelaFormulario>
  );
}
