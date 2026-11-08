/**
 * T12.03 Solicitações de suporte (RN-12.07 a RN-12.09). O prazo é calculado na abertura, pela regra de SLA
 * que vale (contrato, depois oferta), e fica congelado na solicitação: mudar a regra depois não muda o prazo.
 * "Aguardando cliente" pausa a contagem; responder retoma. Novo escopo não é suporte: gera oportunidade e a
 * solicitação espera a proposta, sem mudar o contrato (CA-12.03).
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema, idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Feriado } from '@/dados/tipos/calendario';
import { CANAIS_SUPORTE, PRIORIDADES_SUPORTE, TIPOS_SUPORTE, type SolicitacaoSuporte, type SuporteInteracao } from '@/dados/tipos/operacao';
import { sincronizarAlertas, type AlertaDesejado } from './alertas';
import { MAXIMO_NO_TITULO } from './atividades';
import { feriadosQueValem } from './feriados';
import { produtosDoContrato } from './horas';
import { calcularPrazoSla, minutosContaveis, regraParaSolicitacao, situacaoDoPrazo, slaAplicado, type Pausa, type SituacaoDoPrazo } from './sla';

export const ROTULOS_TIPO_SUPORTE: Readonly<Record<SolicitacaoSuporte['tipo'], string>> = { falha: 'Falha', duvida: 'Dúvida ou suporte', melhoria_incluida: 'Melhoria incluída no contrato', novo_escopo: 'Novo escopo' };
export const ROTULOS_SITUACAO_SUPORTE: Readonly<Record<SolicitacaoSuporte['situacao'], string>> = { aberta: 'Aberta', em_atendimento: 'Em atendimento', aguardando_cliente: 'Aguardando cliente', aguardando_proposta: 'Aguardando proposta', resolvida: 'Resolvida', fechada: 'Fechada', cancelada: 'Cancelada' };
export const ROTULOS_CANAL_SUPORTE: Readonly<Record<(typeof CANAIS_SUPORTE)[number], string>> = { email: 'E-mail', whatsapp: 'WhatsApp', loja: 'Loja de apps', formulario: 'Formulário' };

const idDaArea = (nome: string) => AREAS_INICIAIS.find((area) => area.nome === nome)?.id ?? null;
const AREA_TECNOLOGIA = idDaArea('Tecnologia');
const limitar = (texto: string) => (texto.length <= MAXIMO_NO_TITULO ? texto : `${texto.slice(0, MAXIMO_NO_TITULO - 1).trimEnd()}…`);

/** Encerradas: o prazo não conta mais. */
export const ENCERRADAS = new Set<SolicitacaoSuporte['situacao']>(['resolvida', 'fechada', 'cancelada']);

// ---------- Formulário ----------

export const esquemaFormularioSolicitacao = z
  .object({
    contraparte_id: z.string(),
    solicitante_texto: z.string().trim().max(200, 'Até 200 caracteres.'),
    contato_pessoa_id: z.string(),
    produto_id: z.string().min(1, 'Escolha o produto.'),
    contrato_id: z.string(),
    tipo: z.enum(TIPOS_SUPORTE, { error: 'Escolha o tipo.' }),
    prioridade: z.enum(PRIORIDADES_SUPORTE, { error: 'Escolha a prioridade.' }),
    canal: z.union([z.literal(''), z.enum(CANAIS_SUPORTE)]),
    titulo: z.string().trim().min(1, 'Informe o título.').max(140, 'Até 140 caracteres.'),
    descricao: z.string().trim(),
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
  })
  .superRefine((dados, contexto) => {
    if (!dados.contraparte_id && !dados.solicitante_texto) contexto.addIssue({ code: 'custom', path: ['solicitante_texto'], message: 'Escolha a contraparte, ou escreva o nome e o contato de quem pediu.' });
  });
export type FormularioSolicitacao = z.infer<typeof esquemaFormularioSolicitacao>;

export function formularioSolicitacaoVazio(responsavelId: string): FormularioSolicitacao {
  return { contraparte_id: '', solicitante_texto: '', contato_pessoa_id: '', produto_id: '', contrato_id: '', tipo: 'duvida', prioridade: 'normal', canal: '', titulo: '', descricao: '', responsavel_id: responsavelId };
}

/** O contrato sugerido pela contraparte e pelo produto: o único assinado, não encerrado, que tem o produto. */
export async function contratosDaContraparte(contraparteId: string, produtoId: string) {
  if (!contraparteId) return [];
  const [contratos, itens] = await Promise.all([repositorios.contrato.listar({ onde: { contraparte_id: contraparteId } }), repositorios.item_contrato.listar()]);
  return contratos.filter((contrato) => contrato.situacao_documental !== 'cancelado' && !contrato.encerrado_em && (!produtoId || produtosDoContrato(contrato, itens).includes(produtoId)));
}

export async function contratoSugerido(contraparteId: string, produtoId: string): Promise<string> {
  const lista = (await contratosDaContraparte(contraparteId, produtoId)).filter((contrato) => contrato.versao_vigente_id);
  return lista.length === 1 ? lista[0]!.id : '';
}

async function feriadosDoCalendario(): Promise<Feriado[]> {
  const [feriados, configuracao] = await Promise.all([repositorios.feriado.listar(), repositorios.configuracao.ler()]);
  return feriadosQueValem(feriados, { uf: configuracao.uf_padrao, municipio: configuracao.municipio_padrao });
}

async function interagir(solicitacaoId: string, tipo: SuporteInteracao['tipo'], texto: string | null, agora: string) {
  await repositorios.suporte_interacao.criar({ solicitacao_id: solicitacaoId, autor_id: idDaPessoaAtual() ?? 'sistema', tipo, texto, ocorrido_em: agora });
}

async function conferirContrato(formulario: FormularioSolicitacao) {
  if (!formulario.contrato_id) return;
  const contrato = await repositorios.contrato.obter(formulario.contrato_id);
  if (!contrato) throw new ErroDeRegra('O contrato escolhido não existe mais.');
  if (formulario.contraparte_id && contrato.contraparte_id !== formulario.contraparte_id) throw new ErroDeRegra('O contrato escolhido é de outra contraparte.');
  const itens = await repositorios.item_contrato.listar();
  if (!produtosDoContrato(contrato, itens).includes(formulario.produto_id)) throw new ErroDeRegra('O contrato escolhido não tem este produto.');
}

/** Abre a solicitação: o SLA que vale é congelado agora, com os dois prazos (RN-12.08). Sem regra, "Sem SLA". */
export async function abrirSolicitacao(formulario: FormularioSolicitacao, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const dados = esquemaFormularioSolicitacao.parse(formulario);
  await conferirContrato(dados);
  const escolhida = await regraParaSolicitacao({ contratoId: dados.contrato_id || null, produtoId: dados.produto_id, prioridade: dados.prioridade });
  const sla = escolhida ? slaAplicado(escolhida) : null;
  const feriados = await feriadosDoCalendario();
  const solicitacao = await emTransacao(async () => {
    const criada = await repositorios.solicitacao_suporte.criar({
      contraparte_id: dados.contraparte_id || null,
      solicitante_texto: dados.solicitante_texto || null,
      contato_pessoa_id: dados.contato_pessoa_id || null,
      produto_id: dados.produto_id,
      contrato_id: dados.contrato_id || null,
      tipo: dados.tipo,
      prioridade: dados.prioridade,
      canal: dados.canal || null,
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      situacao: dados.tipo === 'novo_escopo' ? 'aguardando_proposta' : 'aberta',
      responsavel_id: dados.responsavel_id,
      aberta_em: agora,
      sla,
      prazo_resposta_em: sla ? calcularPrazoSla(agora, sla.resposta_horas, sla, feriados) : null,
      prazo_resolucao_em: sla ? calcularPrazoSla(agora, sla.resolucao_horas, sla, feriados) : null,
      primeira_resposta_em: null,
      resolvida_em: null,
      fechada_em: null,
      pausas: [],
      solucao: null,
      oportunidade_id: null,
      incidente_id: null,
      nota_id: null,
      cancelada_motivo: null,
    });
    await interagir(criada.id, 'mudanca', sla ? `Aberta com SLA ${sla.origem === 'contrato' ? 'do contrato' : 'da oferta'}.` : 'Aberta sem SLA: só acompanhamento.', agora);
    return criada;
  });
  await sincronizarAlertasDoSuporte(agora);
  return solicitacao;
}

async function aberta(id: string): Promise<SolicitacaoSuporte> {
  const solicitacao = await repositorios.solicitacao_suporte.obter(id);
  if (!solicitacao) throw new ErroDeRegra('Esta solicitação não existe mais.');
  if (ENCERRADAS.has(solicitacao.situacao)) throw new ErroDeRegra(`Solicitação ${ROTULOS_SITUACAO_SUPORTE[solicitacao.situacao].toLowerCase()}: reabra para mudar.`);
  return solicitacao;
}

const fecharPausa = (pausas: SolicitacaoSuporte['pausas'], agora: string) => pausas.map((pausa) => (pausa.fim ? pausa : { ...pausa, fim: agora }));

/**
 * Resposta ao cliente: a primeira marca a primeira resposta (RN-12.08). "Aguardar o cliente" pausa a contagem;
 * responder de novo retoma.
 */
export async function registrarResposta(id: string, { texto, aguardarCliente }: { texto: string; aguardarCliente: boolean }, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const solicitacao = await aberta(id);
  if (!texto.trim()) throw new ErroDeRegra('Escreva a resposta.');
  if (solicitacao.situacao === 'aguardando_proposta') throw new ErroDeRegra('Novo escopo espera a proposta: responda pela oportunidade, ou reclassifique.');
  const pausas = fecharPausa(solicitacao.pausas, agora);
  const atualizada = await emTransacao(async () => {
    await interagir(id, 'resposta', texto.trim(), agora);
    const situacao = aguardarCliente ? 'aguardando_cliente' : 'em_atendimento';
    if (situacao !== solicitacao.situacao) await interagir(id, 'mudanca', `${ROTULOS_SITUACAO_SUPORTE[solicitacao.situacao]} → ${ROTULOS_SITUACAO_SUPORTE[situacao]}`, agora);
    return repositorios.solicitacao_suporte.atualizar(id, { primeira_resposta_em: solicitacao.primeira_resposta_em ?? agora, situacao, pausas: aguardarCliente ? [...pausas, { inicio: agora, fim: null }] : pausas });
  });
  await sincronizarAlertasDoSuporte(agora);
  return atualizada;
}

/** O cliente respondeu: a contagem retoma, sem contar como resposta da Numa. */
export async function clienteRespondeu(id: string, texto: string, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const solicitacao = await aberta(id);
  if (solicitacao.situacao !== 'aguardando_cliente') throw new ErroDeRegra('Só a solicitação aguardando o cliente retoma.');
  const atualizada = await emTransacao(async () => {
    await interagir(id, 'nota_interna', texto.trim() ? `Cliente respondeu: ${texto.trim()}` : 'Cliente respondeu.', agora);
    await interagir(id, 'mudanca', 'Aguardando cliente → Em atendimento', agora);
    return repositorios.solicitacao_suporte.atualizar(id, { situacao: 'em_atendimento', pausas: fecharPausa(solicitacao.pausas, agora) });
  });
  await sincronizarAlertasDoSuporte(agora);
  return atualizada;
}

export async function registrarNotaInterna(id: string, texto: string, agora: string = new Date().toISOString()): Promise<void> {
  const solicitacao = await repositorios.solicitacao_suporte.obter(id);
  if (!solicitacao) throw new ErroDeRegra('Esta solicitação não existe mais.');
  if (!texto.trim()) throw new ErroDeRegra('Escreva a nota.');
  await interagir(id, 'nota_interna', texto.trim(), agora);
}

export async function resolverSolicitacao(id: string, solucao: string, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const solicitacao = await aberta(id);
  if (!solucao.trim()) throw new ErroDeRegra('Descreva a solução.');
  if (solicitacao.situacao === 'aguardando_proposta') throw new ErroDeRegra('Novo escopo não se resolve como suporte: ele segue pela proposta de aditivo.');
  const atualizada = await emTransacao(async () => {
    await interagir(id, 'mudanca', `${ROTULOS_SITUACAO_SUPORTE[solicitacao.situacao]} → Resolvida`, agora);
    return repositorios.solicitacao_suporte.atualizar(id, { situacao: 'resolvida', resolvida_em: agora, solucao: solucao.trim(), pausas: fecharPausa(solicitacao.pausas, agora), primeira_resposta_em: solicitacao.primeira_resposta_em ?? agora });
  });
  await sincronizarAlertasDoSuporte(agora);
  return atualizada;
}

export async function fecharSolicitacao(id: string, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const solicitacao = await repositorios.solicitacao_suporte.obter(id);
  if (!solicitacao || solicitacao.situacao !== 'resolvida') throw new ErroDeRegra('Só a solicitação resolvida é fechada.');
  await interagir(id, 'mudanca', 'Resolvida → Fechada', agora);
  return repositorios.solicitacao_suporte.atualizar(id, { situacao: 'fechada', fechada_em: agora });
}

/** Reabrir a resolvida: volta ao atendimento, com motivo. O prazo de resolução continua o da abertura. */
export async function reabrirSolicitacao(id: string, motivo: string, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const solicitacao = await repositorios.solicitacao_suporte.obter(id);
  if (!solicitacao || solicitacao.situacao !== 'resolvida') throw new ErroDeRegra('Só a solicitação resolvida é reaberta.');
  if (!motivo.trim()) throw new ErroDeRegra('Reabrir exige motivo.');
  await interagir(id, 'mudanca', `Resolvida → Em atendimento. Motivo: ${motivo.trim()}`, agora);
  const atualizada = await repositorios.solicitacao_suporte.atualizar(id, { situacao: 'em_atendimento', resolvida_em: null }, { motivo: motivo.trim() });
  await sincronizarAlertasDoSuporte(agora);
  return atualizada;
}

export async function cancelarSolicitacao(id: string, motivo: string, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const solicitacao = await aberta(id);
  if (!motivo.trim()) throw new ErroDeRegra('Cancelar exige motivo.');
  await interagir(id, 'mudanca', `${ROTULOS_SITUACAO_SUPORTE[solicitacao.situacao]} → Cancelada. Motivo: ${motivo.trim()}`, agora);
  const atualizada = await repositorios.solicitacao_suporte.atualizar(id, { situacao: 'cancelada', cancelada_motivo: motivo.trim(), pausas: fecharPausa(solicitacao.pausas, agora) }, { motivo: motivo.trim() });
  await sincronizarAlertasDoSuporte(agora);
  return atualizada;
}

/**
 * Reclassificar (tipo e prioridade), com motivo. Mudar a prioridade recalcula os prazos a partir da abertura,
 * pela regra da nova prioridade. Virar Novo escopo põe em "Aguardando proposta" (CA-12.03); sair dele volta ao atendimento.
 */
export async function reclassificarSolicitacao(id: string, { tipo, prioridade, motivo }: { tipo: SolicitacaoSuporte['tipo']; prioridade: SolicitacaoSuporte['prioridade']; motivo: string }, agora: string = new Date().toISOString()): Promise<SolicitacaoSuporte> {
  const solicitacao = await aberta(id);
  if (!motivo.trim()) throw new ErroDeRegra('Reclassificar exige motivo.');
  if (tipo === solicitacao.tipo && prioridade === solicitacao.prioridade) throw new ErroDeRegra('Nada mudou.');
  const mudancas: Partial<SolicitacaoSuporte> = { tipo, prioridade };
  if (prioridade !== solicitacao.prioridade) {
    const escolhida = await regraParaSolicitacao({ contratoId: solicitacao.contrato_id, produtoId: solicitacao.produto_id, prioridade });
    const sla = escolhida ? slaAplicado(escolhida) : null;
    const feriados = await feriadosDoCalendario();
    Object.assign(mudancas, { sla, prazo_resposta_em: sla ? calcularPrazoSla(solicitacao.aberta_em, sla.resposta_horas, sla, feriados, solicitacao.pausas.map((pausa) => ({ inicio: pausa.inicio, fim: pausa.fim ?? agora }))) : null, prazo_resolucao_em: sla ? calcularPrazoSla(solicitacao.aberta_em, sla.resolucao_horas, sla, feriados, solicitacao.pausas.map((pausa) => ({ inicio: pausa.inicio, fim: pausa.fim ?? agora }))) : null });
  }
  if (tipo === 'novo_escopo' && solicitacao.tipo !== 'novo_escopo') Object.assign(mudancas, { situacao: 'aguardando_proposta', pausas: fecharPausa(solicitacao.pausas, agora) });
  if (tipo !== 'novo_escopo' && solicitacao.situacao === 'aguardando_proposta') Object.assign(mudancas, { situacao: 'em_atendimento' });
  const atualizada = await emTransacao(async () => {
    await interagir(id, 'mudanca', `Reclassificada: ${ROTULOS_TIPO_SUPORTE[solicitacao.tipo]}, ${solicitacao.prioridade} → ${ROTULOS_TIPO_SUPORTE[tipo]}, ${prioridade}. Motivo: ${motivo.trim()}`, agora);
    return repositorios.solicitacao_suporte.atualizar(id, mudancas, { motivo: motivo.trim() });
  });
  await sincronizarAlertasDoSuporte(agora);
  return atualizada;
}

/**
 * CA-12.03: Novo escopo oferece criar a oportunidade vinculada (M10), e a solicitação fica "Aguardando proposta".
 * O contrato não muda. Sem contraparte cadastrada, a oportunidade não tem a quem pertencer.
 */
export async function criarOportunidadeDeNovoEscopo(id: string, hoje: string = new Date().toISOString().slice(0, 10)): Promise<string> {
  const solicitacao = await repositorios.solicitacao_suporte.obter(id);
  if (!solicitacao) throw new ErroDeRegra('Esta solicitação não existe mais.');
  if (solicitacao.tipo !== 'novo_escopo') throw new ErroDeRegra('Só Novo escopo vira oportunidade.');
  if (solicitacao.oportunidade_id) return solicitacao.oportunidade_id;
  if (!solicitacao.contraparte_id) throw new ErroDeRegra('Cadastre e escolha a contraparte da solicitação para criar a oportunidade.');
  const { formularioOportunidadeVazio, salvarOportunidade } = await import('./comercial');
  const oportunidade = await salvarOportunidade({ ...formularioOportunidadeVazio(solicitacao.responsavel_id, solicitacao.contraparte_id), titulo: limitar(`Aditivo: ${solicitacao.titulo}`), produtos: [solicitacao.produto_id], tipo: 'sob_medida', origem: 'outro', etapa: 'qualificacao', necessidade: `Novo escopo pedido em ${solicitacao.codigo}${solicitacao.contrato_id ? ', fora do contrato' : ''}.${solicitacao.descricao ? ` ${solicitacao.descricao}` : ''}` }, undefined, hoje);
  await emTransacao(async () => {
    await repositorios.solicitacao_suporte.atualizar(id, { oportunidade_id: oportunidade.id, situacao: 'aguardando_proposta' });
    await repositorios.vinculo.criar({ origem_tipo: 'solicitacao_suporte', origem_id: id, destino_tipo: 'oportunidade', destino_id: oportunidade.id });
    await interagir(id, 'mudanca', `Oportunidade ${oportunidade.codigo} criada para a proposta de aditivo.`, new Date().toISOString());
  });
  return oportunidade.id;
}

export async function vincularIncidente(id: string, incidenteId: string | null): Promise<SolicitacaoSuporte> {
  const solicitacao = await repositorios.solicitacao_suporte.obter(id);
  if (!solicitacao) throw new ErroDeRegra('Esta solicitação não existe mais.');
  if (incidenteId) {
    const incidente = await repositorios.incidente_disponibilidade.obter(incidenteId);
    if (!incidente) throw new ErroDeRegra('O incidente não existe mais.');
    if (incidente.produto_id !== solicitacao.produto_id) throw new ErroDeRegra('O incidente é de outro produto.');
  }
  return repositorios.solicitacao_suporte.atualizar(id, { incidente_id: incidenteId });
}

// ---------- SLA da solicitação ----------

export type SlaDaSolicitacao = { resposta: SituacaoDoPrazo; resolucao: SituacaoDoPrazo };

export function slaDaSolicitacao(solicitacao: SolicitacaoSuporte, agora: string, feriados: readonly Pick<Feriado, 'data'>[]): SlaDaSolicitacao {
  const configuracao = solicitacao.sla;
  const pausas: Pausa[] = solicitacao.pausas;
  const encerradaSem = solicitacao.situacao === 'cancelada' || solicitacao.situacao === 'aguardando_proposta';
  const base = { abertaEm: solicitacao.aberta_em, configuracao, pausas, agora, feriados };
  if (encerradaSem) return { resposta: { estado: 'sem_sla', texto: solicitacao.situacao === 'cancelada' ? 'Cancelada' : 'Aguardando proposta', prazo: null }, resolucao: { estado: 'sem_sla', texto: solicitacao.situacao === 'cancelada' ? 'Cancelada' : 'Aguardando proposta', prazo: null } };
  return {
    resposta: situacaoDoPrazo({ ...base, horas: configuracao?.resposta_horas ?? null, concluidoEm: solicitacao.primeira_resposta_em }),
    resolucao: situacaoDoPrazo({ ...base, horas: configuracao?.resolucao_horas ?? null, concluidoEm: solicitacao.resolvida_em }),
  };
}

// ---------- Alerta "SLA em risco" (05-M03 §5) ----------

export const MOTIVO_SLA_EM_RISCO = 'SLA em risco';

/** 80% de um prazo consumido, ainda aberto: alerta para a responsável. Resolvida, fechada ou cancelada encerra. */
export async function sincronizarAlertasDoSuporte(agora: string = new Date().toISOString()): Promise<number> {
  return comoSistema(async () => {
    const [solicitacoes, feriados] = await Promise.all([repositorios.solicitacao_suporte.listar(), feriadosDoCalendario()]);
    const desejados: AlertaDesejado[] = [];
    for (const solicitacao of solicitacoes) {
      if (ENCERRADAS.has(solicitacao.situacao) || solicitacao.situacao === 'aguardando_proposta' || !solicitacao.sla) continue;
      const sla = solicitacao.sla;
      const consumo = (horas: number, concluido: string | null) => (concluido ? 0 : minutosContaveis(solicitacao.aberta_em, agora, sla, feriados, solicitacao.pausas) / (horas * 60));
      const prazoResposta = !solicitacao.primeira_resposta_em && consumo(sla.resposta_horas, null) >= 0.8 ? calcularPrazoSla(solicitacao.aberta_em, sla.resposta_horas, sla, feriados, solicitacao.pausas.map((pausa) => ({ inicio: pausa.inicio, fim: pausa.fim ?? agora }))) : null;
      const prazoResolucao = consumo(sla.resolucao_horas, solicitacao.resolvida_em) >= 0.8 ? calcularPrazoSla(solicitacao.aberta_em, sla.resolucao_horas, sla, feriados, solicitacao.pausas.map((pausa) => ({ inicio: pausa.inicio, fim: pausa.fim ?? agora }))) : null;
      const prazo = prazoResposta ?? prazoResolucao;
      if (!prazo) continue;
      const dia = prazo.slice(0, 10);
      desejados.push({ origem_tipo: 'solicitacao_suporte', origem_id: solicitacao.id, motivo: MOTIVO_SLA_EM_RISCO, data_referencia: dia, titulo: limitar(`${solicitacao.codigo}: SLA de ${prazoResposta ? 'primeira resposta' : 'resolução'} em risco`), responsavel_id: solicitacao.responsavel_id, area_id: AREA_TECNOLOGIA, acao: 'abrir_solicitacao', exemplo: solicitacao.exemplo });
    }
    return sincronizarAlertas('solicitacao_suporte', desejados, 'Concluído: a solicitação foi resolvida ou saiu do risco.');
  });
}

// ---------- Ler ----------

export type LinhaDaSolicitacao = SolicitacaoSuporte & { sla_situacao: SlaDaSolicitacao };

export async function carregarSuporte(agora: string = new Date().toISOString()) {
  await sincronizarAlertasDoSuporte(agora);
  const [solicitacoes, feriados, produtos, pessoas, contrapartes, contratos] = await Promise.all([repositorios.solicitacao_suporte.listar({ incluirArquivados: true }), feriadosDoCalendario(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.contrato.listar({ incluirArquivados: true })]);
  const linhas: LinhaDaSolicitacao[] = solicitacoes.map((solicitacao) => ({ ...solicitacao, sla_situacao: slaDaSolicitacao(solicitacao, agora, feriados) }));
  // D11: suporte é de Tecnologia, e a responsável padrão da área vem sugerida.
  const { responsavelSugerida } = await import('./implantacoes');
  return { linhas, produtos, pessoas, contrapartes, contratos, sugerida: await responsavelSugerida() };
}

export async function carregarSolicitacao(id: string, agora: string = new Date().toISOString()) {
  const solicitacao = await repositorios.solicitacao_suporte.obter(id);
  if (!solicitacao) return null;
  const [interacoes, feriados, apontamentos, incidentes, oportunidade, nota] = await Promise.all([repositorios.suporte_interacao.listar({ onde: { solicitacao_id: id } }), feriadosDoCalendario(), repositorios.apontamento_horas.listar({ onde: { registro_tipo: 'solicitacao_suporte', registro_id: id } }), repositorios.incidente_disponibilidade.listar({ onde: { produto_id: solicitacao.produto_id } }), solicitacao.oportunidade_id ? repositorios.oportunidade.obter(solicitacao.oportunidade_id) : Promise.resolve(null), solicitacao.nota_id ? repositorios.nota_liberacao.obter(solicitacao.nota_id) : Promise.resolve(null)]);
  return { solicitacao, interacoes: interacoes.sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em)), sla: slaDaSolicitacao(solicitacao, agora, feriados), apontamentos, incidentes, oportunidade, nota };
}

/** Histórico da ficha: a solicitação, as respostas e os links. */
export async function historicoDaSolicitacao(id: string) {
  const { historicoDosRegistros } = await import('./historico');
  const [interacoes, anexos] = await Promise.all([repositorios.suporte_interacao.listar({ onde: { solicitacao_id: id }, incluirArquivados: true }), repositorios.anexo_link.listar({ onde: { registro_id: id }, incluirArquivados: true })]);
  return historicoDosRegistros([id, ...interacoes.map((linha) => linha.id), ...anexos.map((linha) => linha.id)]);
}

// ---------- Relatório: cumprimento de SLA por mês, produto e tipo ----------

export type LinhaDoCumprimento = { chave: string; rotulo: string; comSla: number; respostaNoPrazo: number; respostaMedida: number; resolucaoNoPrazo: number; resolucaoMedida: number };

/**
 * Só conta o prazo que já se decidiu: cumprido, fora do prazo ou violado em aberto. O que ainda corre no prazo
 * não entra no percentual. Sem SLA fica de fora, e a tela diz quantas.
 */
export function cumprimentoDoSla(linhas: readonly LinhaDaSolicitacao[], agrupar: (linha: LinhaDaSolicitacao) => { chave: string; rotulo: string }): LinhaDoCumprimento[] {
  const grupos = new Map<string, LinhaDoCumprimento>();
  for (const linha of linhas) {
    if (!linha.sla || linha.situacao === 'cancelada' || linha.situacao === 'aguardando_proposta') continue;
    const { chave, rotulo } = agrupar(linha);
    const grupo = grupos.get(chave) ?? { chave, rotulo, comSla: 0, respostaNoPrazo: 0, respostaMedida: 0, resolucaoNoPrazo: 0, resolucaoMedida: 0 };
    grupo.comSla += 1;
    const decidido = (situacao: SituacaoDoPrazo) => situacao.estado === 'cumprido' || situacao.estado === 'cumprido_fora' || situacao.estado === 'violado';
    if (decidido(linha.sla_situacao.resposta)) {
      grupo.respostaMedida += 1;
      if (linha.sla_situacao.resposta.estado === 'cumprido') grupo.respostaNoPrazo += 1;
    }
    if (decidido(linha.sla_situacao.resolucao)) {
      grupo.resolucaoMedida += 1;
      if (linha.sla_situacao.resolucao.estado === 'cumprido') grupo.resolucaoNoPrazo += 1;
    }
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].sort((a, b) => a.chave.localeCompare(b.chave));
}

export const percentualDoCumprimento = (noPrazo: number, medidas: number) => (medidas ? `${Math.round((noPrazo / medidas) * 100)}%` : '—');
