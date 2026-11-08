'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CircleCheck, Clock, MessageSquare, Target, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { CartaoDePainel, executar, paraOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbaArquivosDoRegistro } from '@/componentes/operacao/abas-comuns';
import { JanelaHoras } from '@/componentes/operacao/formulario-horas';
import { EtiquetaDoPrazo, SituacaoDaSolicitacao } from '@/componentes/operacao/situacoes';
import { useAvisoDeCredencial } from '@/componentes/produtos/aviso-credencial-m07';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { SolicitacaoSuporte } from '@/dados/tipos/operacao';
import { useConsulta } from '@/dados/use-consulta';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { carregarVinculos, formatarHoras, formularioHorasVazio, somarHoras } from '@/dominio/horas';
import { ROTULOS_PRIORIDADE, ROTULOS_CONTAGEM } from '@/dominio/sla';
import { cancelarSolicitacao, carregarSolicitacao, clienteRespondeu, criarOportunidadeDeNovoEscopo, ENCERRADAS, fecharSolicitacao, historicoDaSolicitacao, reabrirSolicitacao, reclassificarSolicitacao, registrarNotaInterna, registrarResposta, resolverSolicitacao, ROTULOS_CANAL_SUPORTE, ROTULOS_TIPO_SUPORTE, vincularIncidente } from '@/dominio/suporte';
import { hojeISO } from '@/lib/datas';
import { formatarDataHora } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

async function carregar(id: string) {
  const [ficha, pessoas, produtos, contrapartes, contratos, vinculos] = await Promise.all([carregarSolicitacao(id), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.contrato.listar({ incluirArquivados: true }), carregarVinculos()]);
  return ficha ? { ...ficha, pessoas, produtos, contrapartes, contratos, vinculos } : null;
}
type Dados = NonNullable<Awaited<ReturnType<typeof carregar>>>;
type Janela = '' | 'responder' | 'cliente' | 'nota' | 'resolver' | 'reclassificar' | 'horas' | 'incidente' | 'reabrir' | 'cancelar' | 'fechar';

/** T12.03, ficha: linha do tempo, respostas, solução, horas e vínculos. */
export function FichaSolicitacao() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregar(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler a solicitação." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados) return <EstadoVazio icone={TriangleAlert} titulo="Solicitação não encontrada." texto="Ela pode ter sido removida." acao={<LinkCentral href="/operacao/suporte">Voltar</LinkCentral>} />;
  return <Conteudo dados={consulta.dados} aoMudar={consulta.recarregar} />;
}

function Conteudo({ dados, aoMudar }: { dados: Dados; aoMudar: () => void }) {
  const roteador = useRouter();
  const { pessoa } = useCentral();
  const { solicitacao, sla } = dados;
  const [janela, setJanela] = useState<Janela>('');
  const fechar = () => setJanela('');
  const depois = () => {
    fechar();
    aoMudar();
  };
  const nome = (id: string) => dados.pessoas.find((linha) => linha.id === id)?.nome_completo ?? (id === 'sistema' ? 'Sistema' : 'Pessoa removida');
  const produto = dados.produtos.find((linha) => linha.id === solicitacao.produto_id);
  const contraparte = solicitacao.contraparte_id ? dados.contrapartes.find((linha) => linha.id === solicitacao.contraparte_id) : null;
  const contrato = solicitacao.contrato_id ? dados.contratos.find((linha) => linha.id === solicitacao.contrato_id) : null;
  const contato = solicitacao.contato_pessoa_id ? dados.pessoas.find((linha) => linha.id === solicitacao.contato_pessoa_id) : null;
  const encerrada = ENCERRADAS.has(solicitacao.situacao);
  const incidente = solicitacao.incidente_id ? dados.incidentes.find((linha) => linha.id === solicitacao.incidente_id) : null;

  const criarOportunidade = async () => {
    try {
      const id = await criarOportunidadeDeNovoEscopo(solicitacao.id, hojeISO());
      aviso('Oportunidade criada, para a proposta de aditivo. O contrato não muda.');
      roteador.push(`/comercial/oportunidades/${id}`);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  };

  const acaoPrincipal = (() => {
    if (solicitacao.situacao === 'aguardando_proposta') return solicitacao.oportunidade_id ? <Button onClick={() => roteador.push(`/comercial/oportunidades/${solicitacao.oportunidade_id}`)}><Target aria-hidden />Abrir oportunidade</Button> : <Button onClick={() => void criarOportunidade()}><Target aria-hidden />Criar oportunidade</Button>;
    if (solicitacao.situacao === 'aguardando_cliente') return <Button onClick={() => setJanela('cliente')}>Cliente respondeu</Button>;
    if (solicitacao.situacao === 'resolvida') return <Button onClick={() => setJanela('fechar')}>Fechar</Button>;
    if (encerrada) return null;
    return <Button onClick={() => setJanela('responder')}><MessageSquare aria-hidden />Responder</Button>;
  })();

  const maisAcoes = solicitacao.situacao !== 'fechada' && solicitacao.situacao !== 'cancelada' && (
    <MenuSobreposto titulo="Mais ações" largura={280} alinhar="end" gatilho={<Button variante="secundario" aria-label="Mais ações da solicitação">Mais ações</Button>}>
      {(fecharMenu) => {
        const item = (rotulo: string, acao: () => void, perigo = false) => (
          <button key={rotulo} type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover', perigo && 'text-err')} onClick={() => { fecharMenu(); acao(); }}>
            {rotulo}
          </button>
        );
        return (
          <div className="grid gap-0.5">
            {!encerrada && solicitacao.situacao !== 'aguardando_proposta' && item('Resolver', () => setJanela('resolver'))}
            {item('Nota interna', () => setJanela('nota'))}
            {!encerrada && item('Reclassificar', () => setJanela('reclassificar'))}
            {item('Apontar horas', () => setJanela('horas'))}
            {item(incidente ? 'Trocar o incidente' : 'Vincular incidente', () => setJanela('incidente'))}
            {solicitacao.situacao === 'resolvida' && item('Reabrir', () => setJanela('reabrir'))}
            {!encerrada && item('Cancelar solicitação', () => setJanela('cancelar'), true)}
          </div>
        );
      }}
    </MenuSobreposto>
  );

  const ROTULO_INTERACAO = { resposta: 'Resposta ao cliente', nota_interna: 'Nota interna', mudanca: 'Situação' } as const;
  const horasApontadas = somarHoras(dados.apontamentos);
  const abas = [
    {
      id: 'linha',
      rotulo: 'Linha do tempo',
      conteudo: (
        <ol aria-label="Linha do tempo da solicitação" className="grid gap-2">
          {dados.interacoes.map((interacao) => (
            <li key={interacao.id} className={cn('rounded-lg border border-line p-3.5 text-[13px]', interacao.tipo === 'resposta' ? 'bg-paper' : interacao.tipo === 'nota_interna' ? 'bg-hover' : 'border-dashed bg-transparent')}>
              <p className="flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">{ROTULO_INTERACAO[interacao.tipo]}</span>
                <span>{formatarDataHora(interacao.ocorrido_em)} · {nome(interacao.autor_id)}</span>
              </p>
              {interacao.texto && <p className="mt-1 whitespace-pre-wrap">{interacao.texto}</p>}
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: 'solucao',
      rotulo: 'Solução',
      conteudo: solicitacao.solucao ? (
        <CartaoDePainel titulo="Solução">
          <p className="text-[13px] whitespace-pre-wrap">{solicitacao.solucao}</p>
          {solicitacao.resolvida_em && <p className="mt-2 text-xs text-ink-soft">Resolvida em {formatarDataHora(solicitacao.resolvida_em)}</p>}
        </CartaoDePainel>
      ) : (
        <p className="text-[13px] text-ink-soft">{solicitacao.situacao === 'aguardando_proposta' ? 'Novo escopo segue pela proposta de aditivo, e não tem solução de suporte.' : 'Ainda sem solução. Use “Resolver”, em Mais ações.'}</p>
      ),
    },
    {
      id: 'horas',
      rotulo: 'Horas',
      conteudo: (
        <CartaoDePainel titulo={`Horas apontadas: ${formatarHoras(horasApontadas)}`} acao={<Button variante="secundario" tamanho="pequeno" onClick={() => setJanela('horas')}><Clock aria-hidden />Apontar horas</Button>}>
          {dados.apontamentos.length ? (
            <ul aria-label="Horas apontadas na solicitação" className="grid gap-1 text-[13px]">
              {dados.apontamentos.map((linha) => <li key={linha.id} className="flex justify-between gap-3"><span>{linha.data.split('-').reverse().join('/')} · {nome(linha.pessoa_id)}{linha.descricao ? ` · ${linha.descricao}` : ''}</span><span className="font-semibold tabular-nums">{formatarHoras(linha.horas)}</span></li>)}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-soft">Nenhuma hora apontada nesta solicitação.</p>
          )}
        </CartaoDePainel>
      ),
    },
    {
      id: 'vinculos',
      rotulo: 'Vínculos',
      conteudo: (
        <CartaoDePainel titulo="Vínculos">
          <ListaDeDados>
            <Dado rotulo="Incidente">{incidente ? <LinkCentral className="inline-flex min-h-11 items-center underline md:min-h-0" href={`/operacao/incidentes/${incidente.id}`}>{incidente.codigo} · {incidente.titulo}</LinkCentral> : null}</Dado>
            <Dado rotulo="Nota de liberação">{dados.nota ? <LinkCentral className="inline-flex min-h-11 items-center underline md:min-h-0" href={`/operacao/notas/${dados.nota.id}`}>{dados.nota.codigo} · versão {dados.nota.versao}</LinkCentral> : null}</Dado>
            <Dado rotulo="Oportunidade de novo escopo">{dados.oportunidade ? <LinkCentral className="inline-flex min-h-11 items-center underline md:min-h-0" href={`/comercial/oportunidades/${dados.oportunidade.id}`}>{dados.oportunidade.codigo} · {dados.oportunidade.titulo}</LinkCentral> : null}</Dado>
          </ListaDeDados>
        </CartaoDePainel>
      ),
    },
    { id: 'arquivos', rotulo: 'Arquivos', conteudo: <AbaArquivosDoRegistro tipo="solicitacao_suporte" id={solicitacao.id} somenteLeitura={solicitacao.situacao === 'fechada' || solicitacao.situacao === 'cancelada'} /> },
    { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={solicitacao.id} /> },
  ];

  return (
    <>
      <LinkCentral href="/operacao/suporte" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Suporte
      </LinkCentral>
      <Ficha
        tituloDePagina
        codigo={solicitacao.codigo}
        titulo={solicitacao.titulo}
        etiquetas={<><SituacaoDaSolicitacao situacao={solicitacao.situacao} /><EtiquetaLivre>{ROTULOS_TIPO_SUPORTE[solicitacao.tipo]}</EtiquetaLivre><EtiquetaLivre>Prioridade {ROTULOS_PRIORIDADE[solicitacao.prioridade].toLowerCase()}</EtiquetaLivre>{produto && <EtiquetaLivre>{produto.nome}</EtiquetaLivre>}</>}
        responsavel={<>Responsável: {nome(solicitacao.responsavel_id)}</>}
        acoes={<>{maisAcoes}{acaoPrincipal}</>}
        acoesCelular={acaoPrincipal || maisAcoes ? <>{maisAcoes}{acaoPrincipal}</> : undefined}
        lateral={
          <>
            <CartaoDePainel titulo="SLA">
              {solicitacao.sla ? (
                <div className="grid gap-2.5">
                  <div><p className="text-xs text-ink-soft">1ª resposta{sla.resposta.prazo ? `, até ${formatarDataHora(sla.resposta.prazo)}` : ''}</p><EtiquetaDoPrazo situacao={sla.resposta} /></div>
                  <div><p className="text-xs text-ink-soft">Resolução{sla.resolucao.prazo ? `, até ${formatarDataHora(sla.resolucao.prazo)}` : ''}</p><EtiquetaDoPrazo situacao={sla.resolucao} /></div>
                  <p className="text-xs text-ink-soft">{solicitacao.sla.origem === 'contrato' ? 'Exceção do contrato' : 'Regra da oferta'} · {ROTULOS_CONTAGEM[solicitacao.sla.contagem].toLowerCase()}{solicitacao.sla.contagem === 'horas_uteis' ? `, ${solicitacao.sla.horario_inicio}–${solicitacao.sla.horario_fim}` : ''}. Calculado na abertura.</p>
                </div>
              ) : (
                <p className="text-[13px] text-ink-soft">Sem SLA: só acompanhamento (RN-12.09).</p>
              )}
            </CartaoDePainel>
            <CartaoDePainel titulo="Quem pediu">
              <ListaDeDados>
                <Dado rotulo="Contraparte">{contraparte ? nomeDaContraparte(contraparte) : solicitacao.solicitante_texto}</Dado>
                <Dado rotulo="Contato">{contato?.nome_completo}</Dado>
                <Dado rotulo="Contrato">{contrato && <LinkCentral className="inline-flex min-h-11 items-center underline md:min-h-0" href={`/contratos/${contrato.id}`}>{contrato.codigo}</LinkCentral>}</Dado>
                <Dado rotulo="Canal">{solicitacao.canal ? ROTULOS_CANAL_SUPORTE[solicitacao.canal] : null}</Dado>
                <Dado rotulo="Aberta em">{formatarDataHora(solicitacao.aberta_em)}</Dado>
              </ListaDeDados>
            </CartaoDePainel>
          </>
        }
        abas={abas}
      />
      {solicitacao.descricao && <CartaoDePainel titulo="Descrição" className="mt-4"><p className="text-[13px] whitespace-pre-wrap">{solicitacao.descricao}</p></CartaoDePainel>}
      {solicitacao.situacao === 'aguardando_proposta' && <Faixa tipo="atencao" className="mt-4">Novo escopo não é executado como suporte (RN-12.07): ele segue por oportunidade e proposta de aditivo. O contrato não muda.</Faixa>}
      {solicitacao.situacao === 'cancelada' && <Faixa className="mt-4">Cancelada: {solicitacao.cancelada_motivo}</Faixa>}

      {janela === 'responder' && <JanelaTexto titulo="Responder ao cliente" rotulo="Resposta" rotuloSalvar="Registrar resposta" comAguardar descricao={solicitacao.primeira_resposta_em ? undefined : 'É a primeira resposta: ela fecha o prazo de primeira resposta.'} aoFechar={fechar} aoSalvar={async (texto, aguardar) => { await registrarResposta(solicitacao.id, { texto, aguardarCliente: aguardar }); aviso(aguardar ? 'Resposta registrada. O prazo fica pausado até o cliente responder.' : 'Resposta registrada.'); depois(); }} />}
      {janela === 'cliente' && <JanelaTexto titulo="O cliente respondeu" rotulo="O que o cliente disse (opcional)" rotuloSalvar="Retomar o atendimento" opcional aoFechar={fechar} aoSalvar={async (texto) => { await clienteRespondeu(solicitacao.id, texto); aviso('Atendimento retomado: o prazo volta a contar.'); depois(); }} />}
      {janela === 'nota' && <JanelaTexto titulo="Nota interna" rotulo="Nota" rotuloSalvar="Registrar nota" descricao="Só para a Numa: não conta como resposta." aoFechar={fechar} aoSalvar={async (texto) => { await registrarNotaInterna(solicitacao.id, texto); aviso('Nota registrada.'); depois(); }} />}
      {janela === 'resolver' && <JanelaTexto titulo="Resolver a solicitação" rotulo="Solução" rotuloSalvar="Resolver" iconeSalvar={<CircleCheck aria-hidden />} aoFechar={fechar} aoSalvar={async (texto) => { await resolverSolicitacao(solicitacao.id, texto); aviso('Solicitação resolvida.'); depois(); }} />}
      {janela === 'reclassificar' && <JanelaReclassificar solicitacao={solicitacao} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'incidente' && <JanelaIncidente dados={dados} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'horas' && <JanelaHoras dados={dados.vinculos} pessoaId={pessoa.id} inicial={formularioHorasVazio(hojeISO(), `solicitacao_suporte:${solicitacao.id}`, solicitacao.produto_id)} titulo={`Apontar horas em ${solicitacao.codigo}`} aoFechar={fechar} aoSalvar={aoMudar} />}
      <Confirmacao aberto={janela === 'fechar'} aoFechar={fechar} titulo="Fechar a solicitação?" texto="Ela fica só para consulta. Se o cliente voltar com o mesmo problema, abra uma nova." rotuloConfirmar="Fechar" aoConfirmar={async () => { if (await executar(() => fecharSolicitacao(solicitacao.id), 'Solicitação fechada.')) depois(); }} />
      <Confirmacao aberto={janela === 'reabrir'} aoFechar={fechar} titulo="Reabrir a solicitação?" texto="Volta ao atendimento. O prazo de resolução continua o da abertura." rotuloConfirmar="Reabrir" pedirMotivo mensagemSemMotivo="Reabrir exige motivo." aoConfirmar={async (motivo) => { if (await executar(() => reabrirSolicitacao(solicitacao.id, motivo), 'Solicitação reaberta.')) depois(); }} />
      <Confirmacao aberto={janela === 'cancelar'} aoFechar={fechar} titulo="Cancelar a solicitação?" texto="Ela fica no histórico, fora do cumprimento de SLA." rotuloConfirmar="Cancelar solicitação" perigo pedirMotivo mensagemSemMotivo="Cancelar exige motivo." aoConfirmar={async (motivo) => { if (await executar(() => cancelarSolicitacao(solicitacao.id, motivo), 'Solicitação cancelada.')) depois(); }} />
    </>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaSolicitacao(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

function JanelaTexto({ titulo, rotulo, rotuloSalvar, descricao, comAguardar = false, opcional = false, iconeSalvar, aoFechar, aoSalvar }: { titulo: string; rotulo: string; rotuloSalvar: string; descricao?: string; comAguardar?: boolean; opcional?: boolean; iconeSalvar?: React.ReactNode; aoFechar: () => void; aoSalvar: (texto: string, aguardar: boolean) => Promise<void> }) {
  const [texto, setTexto] = useState('');
  const [aguardar, setAguardar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const credencial = useAvisoDeCredencial();
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!credencial.conferir([texto])) return;
    setSalvando(true);
    try {
      await aoSalvar(texto, aguardar);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={titulo} descricao={descricao} alterado={Boolean(texto)} aoEnviar={enviar} salvando={salvando} rotuloSalvar={rotuloSalvar} iconeSalvar={iconeSalvar}>
      <div className="grid gap-[18px]">
        {credencial.faixa}
        <Campo id="sup-texto" rotulo={rotulo} obrigatorio={!opcional}>
          {(controle) => <Textarea {...controle} rows={5} value={texto} onChange={(evento) => setTexto(evento.target.value)} />}
        </Campo>
        {comAguardar && (
          <label className="flex min-h-11 items-center gap-2.5 text-[13px] font-semibold md:min-h-8">
            <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" checked={aguardar} onChange={(evento) => setAguardar(evento.target.checked)} />
            Aguardar o cliente: pausa o prazo até ele responder
          </label>
        )}
      </div>
    </JanelaFormulario>
  );
}

function JanelaReclassificar({ solicitacao, aoFechar, aoSalvar }: { solicitacao: SolicitacaoSuporte; aoFechar: () => void; aoSalvar: () => void }) {
  const [tipo, setTipo] = useState(solicitacao.tipo);
  const [prioridade, setPrioridade] = useState(solicitacao.prioridade);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await reclassificarSolicitacao(solicitacao.id, { tipo, prioridade, motivo });
      aviso(tipo === 'novo_escopo' && solicitacao.tipo !== 'novo_escopo' ? 'Reclassificada como Novo escopo: aguardando proposta. Crie a oportunidade pela ficha.' : 'Solicitação reclassificada.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Reclassificar" descricao="Mudar a prioridade recalcula os prazos a partir da abertura, pela regra da nova prioridade." alterado={tipo !== solicitacao.tipo || prioridade !== solicitacao.prioridade || Boolean(motivo)} aoEnviar={enviar} salvando={salvando} rotuloSalvar="Reclassificar">
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="sup-novo-tipo" rotulo="Tipo" obrigatorio>
          {(controle) => <Selecao {...controle} value={tipo} onChange={(evento) => setTipo(evento.target.value as SolicitacaoSuporte['tipo'])}>{paraOpcoes(ROTULOS_TIPO_SUPORTE).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Selecao>}
        </Campo>
        <Campo id="sup-nova-prioridade" rotulo="Prioridade" obrigatorio>
          {(controle) => <Selecao {...controle} value={prioridade} onChange={(evento) => setPrioridade(evento.target.value as SolicitacaoSuporte['prioridade'])}>{paraOpcoes(ROTULOS_PRIORIDADE).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Selecao>}
        </Campo>
        {tipo === 'novo_escopo' && solicitacao.tipo !== 'novo_escopo' && <Faixa tipo="atencao" className="md:col-span-2">Novo escopo não é suporte: a solicitação fica “Aguardando proposta”, e a ficha oferece criar a oportunidade. O contrato não muda.</Faixa>}
        <Campo id="sup-motivo" rotulo="Motivo" obrigatorio className="md:col-span-2">
          {(controle) => <Textarea {...controle} rows={2} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaIncidente({ dados, aoFechar, aoSalvar }: { dados: Dados; aoFechar: () => void; aoSalvar: () => void }) {
  const [incidenteId, setIncidenteId] = useState(dados.solicitacao.incidente_id ?? '');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await vincularIncidente(dados.solicitacao.id, incidenteId || null);
      aviso(incidenteId ? 'Incidente vinculado.' : 'Vínculo com o incidente tirado.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Incidente de disponibilidade" descricao="Os incidentes do mesmo produto." aoEnviar={enviar} salvando={salvando} rotuloSalvar="Salvar vínculo">
      {dados.incidentes.length ? (
        <Campo id="sup-incidente" rotulo="Incidente">
          {(controle) => (
            <Selecao {...controle} value={incidenteId} onChange={(evento) => setIncidenteId(evento.target.value)}>
              <option value="">Sem incidente</option>
              {dados.incidentes.map((linha) => <option key={linha.id} value={linha.id}>{linha.codigo} · {linha.titulo}</option>)}
            </Selecao>
          )}
        </Campo>
      ) : (
        <p className="text-[13px] text-ink-soft">Nenhum incidente registrado para este produto. Os incidentes ficam em Operação › Incidentes.</p>
      )}
    </JanelaFormulario>
  );
}
