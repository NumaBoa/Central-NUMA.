'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Coins, FilePen, FileSignature, Send, TriangleAlert } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { CartaoDePainel, executar } from '@/componentes/f1/apoio';
import { carregarTelaDoContrato, type TelaDoContrato } from '@/componentes/f1/dados-contrato';
import { ListaDeEmissoes } from '@/componentes/f1/emissao';
import { SituacoesDoContrato } from '@/componentes/f1/situacoes-contrato';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { linhasDosTotais, ROTULOS_PERIODICIDADE_VALOR, totaisDosItens } from '@/dominio/comercial';
import { calcularPrazo, cancelarContrato, corrigirEvento, cumprirObrigacao, dataLimiteDaRenovacao, diferencasDoAssinado, dispensarObrigacao, fimDaVigencia, inicioDaVigencia, prazoDaObrigacao, registrarRecusaDoContrato, retomarContrato, ROTULOS_DOCUMENTAL, ROTULOS_EVENTO, ROTULOS_FORMA_PAGAMENTO, ROTULOS_PARTE, ROTULOS_RENOVACAO_TIPO, ROTULOS_TIPO_CONTRATO, situacaoDaObrigacao, situacaoDaVigencia, situacaoFinanceira, textoDaRegra } from '@/dominio/contratos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { nomeDaEntidade } from '@/dominio/entidades';
import { historicoDoRegistro } from '@/dominio/historico';
import { ROTULOS_FAMILIA } from '@/dominio/modelos';
import { ROTULOS_SITUACAO_TITULO } from '@/dominio/titulos';
import { repositorios } from '@/dados/repositorios';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { DialogoAssinatura, DialogoEncerramento, DialogoEnvioAssinatura, DialogoEvento, DialogoMudanca, DialogoProgramacao, DialogoSuspensao } from './dialogos-contrato';
import { AbaOperacaoDoContrato } from '@/componentes/operacao/aba-operacao-contrato';
import { JanelaCriarImplantacao } from '@/componentes/operacao/criar-implantacao';

async function carregar(id: string) {
  const [tela, baixas] = await Promise.all([carregarTelaDoContrato(id), repositorios.baixa.listar()]);
  return tela ? { tela, baixas } : null;
}

type Janela = '' | 'envio' | 'assinatura' | 'programacao' | 'evento' | 'mudanca' | 'suspensao' | 'encerramento' | 'recusa' | 'cancelar' | 'retomar' | 'implantacao';

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro('contrato', id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

function LinhaComAcao({ children, acoes }: { children: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
      <span className="min-w-0">{children}</span>
      {acoes && <span className="flex flex-wrap gap-1">{acoes}</span>}
    </li>
  );
}

/** T11.02: painel-resumo com as quatro situações e as ações por situação; abas sem filtros de lista. */
export function FichaContrato() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregar(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler o contrato." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados) return <EstadoVazio icone={TriangleAlert} titulo="Contrato não encontrado." texto="Ele pode ter sido removido." acao={<LinkCentral href="/contratos">Voltar</LinkCentral>} />;
  return <Conteudo tela={consulta.dados.tela} baixas={consulta.dados.baixas} />;
}

function Conteudo({ tela, baixas }: { tela: TelaDoContrato; baixas: Awaited<ReturnType<typeof repositorios.baixa.listar>> }) {
  const roteador = useRouter();
  const [janela, setJanela] = useState<Janela>('');
  const [obrigacaoEmAcao, setObrigacaoEmAcao] = useState<{ id: string; tipo: 'cumprir' | 'dispensar' } | null>(null);
  const [eventoEmCorrecao, setEventoEmCorrecao] = useState<{ id: string; data: string } | null>(null);
  const [evidencia, setEvidencia] = useState('');
  const hoje = hojeISO();
  const { ficha } = tela;
  const { contrato, atual, vigente } = ficha;
  const base = vigente ?? atual;
  const vigencia = situacaoDaVigencia(contrato, vigente, ficha.eventos, hoje);
  const financeira = situacaoFinanceira(ficha.titulos, baixas, hoje);
  const inicio = inicioDaVigencia(base, ficha.eventos);
  const fim = fimDaVigencia(contrato, base, inicio);
  const limite = dataLimiteDaRenovacao(contrato, vigente, ficha.eventos);
  const contraparte = tela.contrapartes.find((linha) => linha.id === contrato.contraparte_id) ?? null;
  const entidade = tela.entidades.find((linha) => linha.id === contrato.entidade_id) ?? null;
  const nome = (pessoaId: string) => tela.pessoas.find((pessoa) => pessoa.id === pessoaId)?.nome_completo ?? 'Pessoa removida';
  const diferencas = diferencasDoAssinado(vigente, contraparte, entidade);
  const emElaboracao = atual.situacao === 'em_elaboracao' ? atual : null;
  const documental = vigente ? 'assinado' : (emElaboracao?.fluxo ?? contrato.situacao_documental);
  const itensBase = ficha.itens;
  const totais = totaisDosItens(itensBase);
  const proximoTitulo = ficha.titulos.find((titulo) => titulo.situacao !== 'cancelado' && titulo.situacao !== 'quitado' && titulo.vencimento >= hoje);
  const obrigacoesComPrazo = ficha.obrigacoes.map((obrigacao) => ({ obrigacao, prazo: prazoDaObrigacao(obrigacao, ficha.regras, ficha.eventos, tela.feriados) }));
  const proximaObrigacao = obrigacoesComPrazo.filter(({ obrigacao, prazo }) => obrigacao.situacao === 'pendente' && !prazo.pendente).sort((a, b) => (a.prazo.data as string).localeCompare(b.prazo.data as string))[0];
  const encerrado = Boolean(contrato.encerrado_em);
  const editar = () => roteador.push(`/contratos/${contrato.id}/editar`);

  const recebidos = ficha.titulos.filter((titulo) => titulo.situacao !== 'cancelado').reduce((total, titulo) => total + baixas.filter((baixa) => baixa.titulo_id === titulo.id && !baixa.arquivado_em).reduce((soma, baixa) => soma + (baixa.tipo === 'pagamento' ? baixa.valor_moeda : baixa.tipo === 'estorno' ? -baixa.valor_moeda : 0), 0), 0);
  const previsto = ficha.titulos.filter((titulo) => titulo.situacao !== 'cancelado').reduce((total, titulo) => total + titulo.valor, 0);

  const acaoPrincipal = (() => {
    if (emElaboracao?.fluxo === 'aprovado_envio') return <Button onClick={() => setJanela('envio')}><Send aria-hidden />Registrar envio</Button>;
    if (emElaboracao?.fluxo === 'enviado_assinatura') return <Button onClick={() => setJanela('assinatura')}><FileSignature aria-hidden />Registrar assinatura</Button>;
    if (emElaboracao) return <Button onClick={editar}><FilePen aria-hidden />{emElaboracao.fluxo === 'rascunho' ? 'Editar rascunho' : 'Revisar e emitir'}</Button>;
    if (vigente && !encerrado) return <Button onClick={() => setJanela('evento')}><CalendarPlus aria-hidden />Registrar evento</Button>;
    return null;
  })();

  const maisAcoes = (
    <MenuSobreposto titulo="Mais ações" largura={300} alinhar="end" gatilho={<Button variante="secundario">Mais ações</Button>}>
      {(fechar) => {
        const item = (rotulo: string, acao: () => void, perigo = false) => (
          <button key={rotulo} type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover', perigo && 'text-err')} onClick={() => { fechar(); acao(); }}>
            {rotulo}
          </button>
        );
        return (
          <div className="grid gap-0.5">
            {emElaboracao && item('Abrir o assistente', editar)}
            {emElaboracao?.fluxo === 'enviado_assinatura' && item('Registrar recusa', () => setJanela('recusa'))}
            {vigente && !encerrado && item('Ativar programação financeira', () => setJanela('programacao'))}
            {vigente && !encerrado && item('Criar implantação', () => setJanela('implantacao'))}
            {vigente && !encerrado && !contrato.versao_elaboracao_id && item('Nova versão, aditivo ou correção', () => setJanela('mudanca'))}
            {vigente && !encerrado && item('Renovação', () => roteador.push('/contratos/renovacao'))}
            {vigente && !encerrado && !contrato.suspensao && item('Suspender', () => setJanela('suspensao'))}
            {contrato.suspensao && item('Retomar', () => setJanela('retomar'))}
            {vigente && !encerrado && item('Encerrar', () => setJanela('encerramento'), true)}
            {!vigente && documental !== 'cancelado' && item('Cancelar contrato', () => setJanela('cancelar'), true)}
          </div>
        );
      }}
    </MenuSobreposto>
  );

  const painel = (
    <div className="mb-5 grid gap-3">
      <SituacoesDoContrato documental={documental} vigencia={vigencia} financeira={financeira} renovacao={contrato.renovacao_situacao} />
      <div className="grid gap-3 md:grid-cols-3">
        <ListaDeDados>
          <Dado rotulo="Contraparte">{contraparte && <LinkCentral className="underline" href={`/comercial/contrapartes/${contraparte.id}`}>{nomeDaContraparte(contraparte)}</LinkCentral>}</Dado>
          <Dado rotulo="Entidade">{entidade && nomeDaEntidade(entidade)}</Dado>
          <Dado rotulo="Família">{`${ROTULOS_FAMILIA[contrato.familia]} · ${ROTULOS_TIPO_CONTRATO[contrato.tipo]}`}</Dado>
          <Dado rotulo="Responsável">{nome(contrato.responsavel_id)}</Dado>
        </ListaDeDados>
        <ListaDeDados>
          <Dado rotulo="Vigência">{inicio ? `${formatarDiaISO(inicio)} – ${fim ? formatarDiaISO(fim) : 'indeterminado'}` : base.vigencia_inicio_evento === 'assinatura' ? 'Pendente: aguardando Assinatura' : 'Pendente: aguardando o início'}</Dado>
          <Dado rotulo="Valores">{linhasDosTotais(totais).join(' · ') || null}</Dado>
          <Dado rotulo="Próximo vencimento">{proximoTitulo ? `${formatarDiaISO(proximoTitulo.vencimento)} · ${formatarDinheiro(proximoTitulo.valor, proximoTitulo.moeda)}` : null}</Dado>
        </ListaDeDados>
        <ListaDeDados>
          <Dado rotulo="Próxima obrigação">{proximaObrigacao ? `${proximaObrigacao.obrigacao.descricao} · ${formatarDiaISO(proximaObrigacao.prazo.data as string)}` : null}</Dado>
          <Dado rotulo="Decidir renovação até">{limite ? formatarDiaISO(limite) : 'Não se aplica'}</Dado>
          <Dado rotulo="Reajuste">{base.condicoes.reajuste_indice ? `${base.condicoes.reajuste_indice}: aplicação na F2` : null}</Dado>
        </ListaDeDados>
      </div>
      {diferencas.length > 0 && <Faixa>Dado atual difere do assinado: {diferencas.join(', ')}. O documento assinado e o retrato da assinatura continuam como estavam.</Faixa>}
      {contrato.suspensao && <Faixa tipo="atencao">Suspenso desde {formatarDiaISO(contrato.suspensao.inicio)}{contrato.suspensao.fim ? ` até ${formatarDiaISO(contrato.suspensao.fim)}` : ''}: {contrato.suspensao.motivo}</Faixa>}
      {vigente && contrato.versao_elaboracao_id && emElaboracao && <Faixa>V{emElaboracao.numero} ({emElaboracao.tipo === 'renovacao' ? 'renovação' : 'aditivo'}) em {ROTULOS_DOCUMENTAL[emElaboracao.fluxo].toLowerCase()}, em paralelo à V{vigente.numero} vigente.</Faixa>}
      {vigente && !tela.programacoes.length && !encerrado && <Faixa acao={<Button variante="secundario" tamanho="pequeno" onClick={() => setJanela('programacao')}>Ativar programação</Button>}>Assinado: o próximo passo é ativar a programação financeira.</Faixa>}
      {documental === 'recusado' && <Faixa tipo="erro">Recusado: {atual.recusa_motivo}. Devolva para rascunho no assistente para ajustar e enviar de novo.</Faixa>}
      {documental === 'cancelado' && <Faixa>Cancelado: {contrato.cancelado_motivo}</Faixa>}
      {encerrado && <Faixa>Encerrado em {formatarDiaISO(contrato.encerrado_em as string)}. Títulos quitados e saldos anteriores ficaram preservados.</Faixa>}
    </div>
  );

  return (
    <>
      <LinkCentral href="/contratos" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Contratos
      </LinkCentral>
      <Ficha
        tituloDePagina
        codigo={`${contrato.codigo}${vigente ? ` · V${vigente.numero} vigente` : ''}`}
        titulo={contrato.titulo}
        acoes={<>{maisAcoes}{acaoPrincipal}</>}
        acoesCelular={acaoPrincipal ?? undefined}
        abas={[
          {
            id: 'resumo',
            rotulo: 'Resumo',
            conteudo: painel,
          },
          {
            id: 'itens',
            rotulo: 'Itens',
            conteudo: (
              <ul className="grid gap-2">
                {itensBase.map((item) => (
                  <LinhaComAcao key={item.id}>
                    <strong>{item.descricao}</strong> · {item.quantidade.toLocaleString('pt-BR')} × {item.valor_unitario === null ? 'sem valor' : formatarDinheiro(item.valor_unitario, contrato.moeda)} = {item.valor_total === null ? 'sem valor' : formatarDinheiro(item.valor_total, contrato.moeda)} · {item.periodicidade ? ROTULOS_PERIODICIDADE_VALOR[item.periodicidade] : ''}
                    {(item.desconto || item.desconto_percentual) && <span className="block text-xs text-ink-soft">Desconto: {item.desconto_justificativa}</span>}
                    {tela.diferencas[item.id] && <span className="block text-xs text-warn">{tela.diferencas[item.id]}</span>}
                  </LinhaComAcao>
                ))}
                {!itensBase.length && <p className="text-sm text-ink-soft">Nenhum item.</p>}
              </ul>
            ),
          },
          {
            id: 'condicoes',
            rotulo: 'Condições',
            conteudo: (
              <ListaDeDados>
                <Dado rotulo="Pagamento">{base.condicoes.forma_pagamento ? `${ROTULOS_FORMA_PAGAMENTO[base.condicoes.forma_pagamento]}${base.condicoes.dia_vencimento ? `, todo dia ${base.condicoes.dia_vencimento}` : ''}` : null}</Dado>
                <Dado rotulo="Parcelas">{base.condicoes.parcelas.length ? base.condicoes.parcelas.map((parcela) => `${parcela.percentual}% ${parcela.gatilho === 'data' ? `em ${formatarDiaISO(parcela.data as string)}` : `no evento ${parcela.evento}`}`).join('; ') : null}</Dado>
                <Dado rotulo="Multa e juros">{base.condicoes.multa_atraso !== null || base.condicoes.juros_mes !== null ? `${base.condicoes.multa_atraso ?? '—'}% e ${base.condicoes.juros_mes ?? '—'}% ao mês` : null}</Dado>
                <Dado rotulo="Fidelidade">{base.condicoes.fidelidade_meses ? `${base.condicoes.fidelidade_meses} meses: ${base.condicoes.fidelidade_motivo ?? ''}` : null}</Dado>
                <Dado rotulo="Renovação">{base.condicoes.renovacao_tipo ? `${ROTULOS_RENOVACAO_TIPO[base.condicoes.renovacao_tipo]}${base.condicoes.aviso_previo_dias !== null ? `, aviso prévio de ${base.condicoes.aviso_previo_dias} dias` : ''}` : null}</Dado>
                <Dado rotulo="Correção administrativa">{[contrato.administrativo.endereco_correspondencia, contrato.administrativo.dados_bancarios, contrato.administrativo.observacoes].filter(Boolean).join(' · ') || null}</Dado>
              </ListaDeDados>
            ),
          },
          {
            id: 'prazos',
            rotulo: 'Prazos e eventos',
            conteudo: (
              <div className="grid gap-4">
                <CartaoDePainel titulo="Prazos">
                  <ul className="grid gap-1.5">
                    {ficha.regras.map((regra) => {
                      const data = calcularPrazo(regra, ficha.eventos, tela.feriados);
                      return <LinhaComAcao key={regra.id}><strong>{regra.nome}</strong> · {textoDaRegra(regra)} · {data.pendente ? data.texto : formatarDiaISO(data.data)}</LinhaComAcao>;
                    })}
                    {!ficha.regras.length && <p className="text-sm text-ink-soft">Nenhuma regra de prazo.</p>}
                  </ul>
                </CartaoDePainel>
                <CartaoDePainel titulo="Eventos" acao={vigente && !encerrado ? <Button variante="secundario" tamanho="pequeno" onClick={() => setJanela('evento')}>Registrar evento</Button> : undefined}>
                  <ul className="grid gap-1.5">
                    {[...ficha.eventos].sort((a, b) => a.data.localeCompare(b.data)).map((evento) => (
                      <LinhaComAcao key={evento.id} acoes={evento.tipo !== 'assinatura' && !encerrado ? (eventoEmCorrecao?.id === evento.id ? undefined : <Button variante="terciario" tamanho="pequeno" onClick={() => setEventoEmCorrecao({ id: evento.id, data: evento.data })}>Corrigir data</Button>) : undefined}>
                        <strong>{evento.tipo === 'outro' ? evento.nome : ROTULOS_EVENTO[evento.tipo]}</strong> · {formatarDiaISO(evento.data)} · {nome(evento.confirmado_por)}
                        {evento.corrigido_de && <span className="block text-xs text-ink-soft">Corrigido de {formatarDiaISO(evento.corrigido_de)}: {evento.correcao_motivo}</span>}
                        {eventoEmCorrecao?.id === evento.id && (
                          <span className="mt-2 flex flex-wrap items-center gap-2">
                            <Input type="date" aria-label="Nova data" className="w-44" value={eventoEmCorrecao.data} onChange={(entrada) => setEventoEmCorrecao({ id: evento.id, data: entrada.target.value })} />
                            <Input aria-label="Motivo da correção" placeholder="Motivo" className="w-56" value={evidencia} onChange={(entrada) => setEvidencia(entrada.target.value)} />
                            <Button tamanho="pequeno" onClick={() => void executar(() => corrigirEvento(evento.id, eventoEmCorrecao.data, evidencia), 'Data corrigida. Os prazos foram recalculados.').then((ok) => ok && (setEventoEmCorrecao(null), setEvidencia('')))}>Salvar</Button>
                            <Button variante="terciario" tamanho="pequeno" onClick={() => setEventoEmCorrecao(null)}>Voltar</Button>
                          </span>
                        )}
                      </LinhaComAcao>
                    ))}
                    {!ficha.eventos.length && <p className="text-sm text-ink-soft">Nenhum evento registrado.</p>}
                  </ul>
                </CartaoDePainel>
              </div>
            ),
          },
          {
            id: 'obrigacoes',
            rotulo: 'Obrigações',
            conteudo: (
              <ul className="grid gap-1.5">
                {obrigacoesComPrazo.map(({ obrigacao, prazo }) => {
                  const situacao = situacaoDaObrigacao(obrigacao, prazo, hoje);
                  return (
                    <LinhaComAcao key={obrigacao.id} acoes={vigente && obrigacao.situacao === 'pendente' && obrigacao.versao_id === vigente.id ? <><Button variante="secundario" tamanho="pequeno" onClick={() => setObrigacaoEmAcao({ id: obrigacao.id, tipo: 'cumprir' })}>Cumprida</Button><Button variante="terciario" tamanho="pequeno" onClick={() => setObrigacaoEmAcao({ id: obrigacao.id, tipo: 'dispensar' })}>Dispensar</Button></> : undefined}>
                      <strong>{ROTULOS_PARTE[obrigacao.parte]}</strong>: {obrigacao.descricao} · {prazo.pendente ? prazo.texto : formatarDiaISO(prazo.data)} · {nome(obrigacao.responsavel_id)}{' '}
                      <EtiquetaSituacao tipo={situacao === 'atrasada' ? 'erro' : situacao === 'cumprida' ? 'sucesso' : 'neutro'}>{situacao === 'atrasada' ? 'Atrasada' : situacao === 'cumprida' ? 'Cumprida' : situacao === 'dispensada' ? 'Dispensada' : 'Pendente'}</EtiquetaSituacao>
                      {obrigacao.depende_de.length > 0 && <span className="block text-xs text-ink-soft">Depende de: {obrigacao.depende_de.map((dependencia) => ficha.obrigacoes.find((linha) => linha.id === dependencia)?.descricao ?? 'obrigação removida').join(', ')}</span>}
                    </LinhaComAcao>
                  );
                })}
                {!ficha.obrigacoes.length && <p className="text-sm text-ink-soft">Nenhuma obrigação.</p>}
              </ul>
            ),
          },
          {
            id: 'financeiro',
            rotulo: 'Financeiro',
            conteudo: (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-[13px]">
                  <CartaoDePainel><p className="text-ink-soft">Contratado</p><p className="font-semibold">{linhasDosTotais(totais).join(' · ') || 'Não definido'}</p></CartaoDePainel>
                  <CartaoDePainel><p className="text-ink-soft">Previsto em títulos</p><p className="font-semibold">{formatarDinheiro(previsto, contrato.moeda)}</p></CartaoDePainel>
                  <CartaoDePainel><p className="text-ink-soft">Realizado</p><p className="font-semibold">{formatarDinheiro(recebidos, contrato.moeda)}</p></CartaoDePainel>
                  <CartaoDePainel><p className="text-ink-soft">Saldo</p><p className="font-semibold">{formatarDinheiro(previsto - recebidos, contrato.moeda)}</p></CartaoDePainel>
                </div>
                <p className="text-[13px]">Programação: {tela.programacoes.some((linha) => linha.situacao === 'ativa') ? `ativa até ${formatarDiaISO(tela.programacoes[0]!.janela_ate)}` : 'inativa'}. Reajustes: F2.</p>
                {vigente && !encerrado && <Button variante="secundario" className="justify-self-start" onClick={() => setJanela('programacao')}><Coins aria-hidden />Ativar programação financeira</Button>}
                <ul className="grid gap-1.5">
                  {ficha.titulos.map((titulo) => (
                    <LinhaComAcao key={titulo.id}>
                      <LinkCentral className="font-semibold underline" href={`/financeiro/${titulo.id}`}>{titulo.codigo}</LinkCentral> · {formatarDiaISO(titulo.vencimento)} · {formatarDinheiro(titulo.valor, titulo.moeda)} · {ROTULOS_SITUACAO_TITULO[titulo.situacao]}{titulo.suspenso ? ' · suspenso' : ''}
                    </LinhaComAcao>
                  ))}
                </ul>
              </div>
            ),
          },
          {
            id: 'documentos',
            rotulo: 'Documentos',
            conteudo: (
              <div className="grid gap-3">
                <ListaDeEmissoes documentos={tela.documentos} />
                {vigente?.assinado_arquivo_url && <p className="text-[13px]">Arquivo assinado: <a className="underline" href={vigente.assinado_arquivo_url} target="_blank" rel="noopener noreferrer">abrir no Drive</a>. Evidência: {vigente.assinatura_evidencia_url && <a className="underline" href={vigente.assinatura_evidencia_url} target="_blank" rel="noopener noreferrer">abrir</a>}</p>}
              </div>
            ),
          },
          {
            id: 'versoes',
            rotulo: 'Versões',
            conteudo: (
              <ul className="grid gap-1.5">
                {ficha.versoes.map((versao) => (
                  <LinhaComAcao key={versao.id}>
                    <strong>V{versao.numero}</strong> · {versao.tipo === 'original' ? 'Original' : versao.tipo === 'aditivo' ? 'Aditivo' : 'Renovação'} · {versao.situacao === 'publicada' ? `Publicada${versao.data_efeito ? `, efeito em ${formatarDiaISO(versao.data_efeito)}` : ''}` : versao.situacao === 'cancelada' ? 'Cancelada' : ROTULOS_DOCUMENTAL[versao.fluxo]}
                    {versao.resumo_mudancas && <span className="block text-xs text-ink-soft">{versao.resumo_mudancas}</span>}
                  </LinhaComAcao>
                ))}
                <p className="text-xs text-ink-soft">A comparação detalhada entre versões é da F2.</p>
              </ul>
            ),
          },
          { id: 'operacao', rotulo: 'Operação', conteudo: <AbaOperacaoDoContrato contratoId={contrato.id} aoCriar={vigente && !encerrado ? () => setJanela('implantacao') : undefined} /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('contrato', contrato.id)} dependencia={contrato.id} vazio="Os alertas e as tarefas deste contrato aparecem aqui." /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={contrato.id} /> },
        ]}
      />
      {janela === 'envio' && <DialogoEnvioAssinatura tela={tela} aoFechar={() => setJanela('')} />}
      {janela === 'assinatura' && <DialogoAssinatura tela={tela} aoFechar={() => setJanela('')} />}
      {janela === 'programacao' && <DialogoProgramacao tela={tela} aoFechar={() => setJanela('')} />}
      {janela === 'evento' && <DialogoEvento tela={tela} aoFechar={() => setJanela('')} />}
      {janela === 'mudanca' && <DialogoMudanca tela={tela} aoFechar={() => setJanela('')} aoCriarAditivo={editar} />}
      {janela === 'suspensao' && <DialogoSuspensao tela={tela} aoFechar={() => setJanela('')} />}
      {janela === 'encerramento' && <DialogoEncerramento tela={tela} aoFechar={() => setJanela('')} />}
      {janela === 'implantacao' && <JanelaCriarImplantacao contratoId={contrato.id} aoFechar={() => setJanela('')} aoCriar={(implantacaoId) => roteador.push(`/operacao/${implantacaoId}`)} />}
      <Confirmacao aberto={janela === 'recusa'} aoFechar={() => setJanela('')} titulo="Registrar recusa da assinatura?" texto="A versão fica Recusada. Nada é apagado." rotuloConfirmar="Registrar recusa" pedirMotivo aoConfirmar={(motivo) => { setJanela(''); void executar(() => registrarRecusaDoContrato(contrato.id, motivo), 'Recusa registrada.'); }} />
      <Confirmacao aberto={janela === 'cancelar'} aoFechar={() => setJanela('')} titulo="Cancelar este contrato?" texto="Só contrato não assinado é cancelado. Ele fica no histórico." rotuloConfirmar="Cancelar contrato" rotuloCancelar="Voltar" perigo pedirMotivo aoConfirmar={(motivo) => { setJanela(''); void executar(() => cancelarContrato(contrato.id, motivo), 'Contrato cancelado.'); }} />
      <Confirmacao aberto={janela === 'retomar'} aoFechar={() => setJanela('')} titulo="Retomar o contrato?" texto="Os títulos marcados como suspensos voltam ao normal." rotuloConfirmar="Retomar" pedirMotivo aoConfirmar={(motivo) => { setJanela(''); void executar(() => retomarContrato(contrato.id, motivo), 'Contrato retomado.'); }} />
      <Confirmacao
        aberto={obrigacaoEmAcao !== null}
        aoFechar={() => setObrigacaoEmAcao(null)}
        titulo={obrigacaoEmAcao?.tipo === 'cumprir' ? 'Registrar cumprimento' : 'Dispensar a obrigação?'}
        texto={obrigacaoEmAcao?.tipo === 'cumprir' ? 'Cumprida hoje. Se houver, cole a evidência no motivo, como link do Drive.' : 'A obrigação fica Dispensada, com o motivo.'}
        rotuloConfirmar={obrigacaoEmAcao?.tipo === 'cumprir' ? 'Cumprida' : 'Dispensar'}
        pedirMotivo={obrigacaoEmAcao?.tipo === 'dispensar'}
        aoConfirmar={(motivo) => {
          const alvo = obrigacaoEmAcao;
          setObrigacaoEmAcao(null);
          if (!alvo) return;
          void executar(() => (alvo.tipo === 'cumprir' ? cumprirObrigacao(alvo.id, { data: hoje, evidencia: '' }) : dispensarObrigacao(alvo.id, motivo)), alvo.tipo === 'cumprir' ? 'Cumprimento registrado.' : 'Obrigação dispensada.');
        }}
      />
    </>
  );
}

