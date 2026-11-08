/**
 * T12.01 e T12.02 (RN-12.01 a RN-12.06): a implantação nasce de um contrato assinado com item de implantação
 * ou sob medida, uma por produto, e herda dele o que é do contrato, só para leitura. As datas da operação
 * (planejada e realizada) nunca mudam o contrato. As tarefas são atividades do Meu dia vinculadas (RN-12.04).
 */
import { ErroDeRegra } from '@/dados/erros';
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema, idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Contrato, ContratoVersao, EventoContrato, ItemContrato, RegraPrazo } from '@/dados/tipos/contrato';
import type { Feriado } from '@/dados/tipos/calendario';
import { MARCOS_IMPLANTACAO, type ApontamentoHoras, type Implantacao, type ImplantacaoMarco } from '@/dados/tipos/operacao';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { sincronizarAlertas, type AlertaDesejado } from './alertas';
import { MAXIMO_NO_TITULO } from './atividades';
import { criarAtividade, formularioAtividadeVazio } from './atividades-formulario';
import { calcularPrazo, type DataDoPrazo } from './contratos';
import { somarHoras } from './horas';
import { catalogoComercial } from './integracoes/conexoes';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';

export type Marco = (typeof MARCOS_IMPLANTACAO)[number];
export type SituacaoImplantacao = Implantacao['situacao'];

export const ROTULOS_SITUACAO_IMPLANTACAO: Readonly<Record<SituacaoImplantacao, string>> = { nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento', em_validacao: 'Em validação', entregue: 'Entregue', acompanhamento: 'Em acompanhamento', concluida: 'Concluída', suspensa: 'Suspensa', cancelada: 'Cancelada' };

/** Os 5 marcos padrão (RN-12.03), na ordem. */
export const ROTULOS_MARCO: Readonly<Record<Marco, string>> = { inicio: 'Início (kickoff)', configuracao: 'Configuração ou desenvolvimento', validacao: 'Validação com o cliente', entrega: 'Entrega (Go Live)', acompanhamento: 'Acompanhamento' };

const idDaArea = (nome: string) => AREAS_INICIAIS.find((area) => area.nome === nome)?.id ?? null;
const AREA_TECNOLOGIA = idDaArea('Tecnologia');
const limitar = (texto: string) => (texto.length <= MAXIMO_NO_TITULO ? texto : `${texto.slice(0, MAXIMO_NO_TITULO - 1).trimEnd()}…`);

// ---------- Situação, marco atual e desvio ----------

const ordenar = <M extends Pick<ImplantacaoMarco, 'marco'>>(marcos: readonly M[]) => [...marcos].sort((a, b) => MARCOS_IMPLANTACAO.indexOf(a.marco) - MARCOS_IMPLANTACAO.indexOf(b.marco));

/** O primeiro marco que se aplica e ainda não foi realizado. */
export function marcoAtual<M extends Pick<ImplantacaoMarco, 'marco' | 'realizado_em' | 'nao_se_aplica'>>(marcos: readonly M[]): M | null {
  return ordenar(marcos).find((marco) => !marco.nao_se_aplica && !marco.realizado_em) ?? null;
}

const realizado = (marcos: readonly Pick<ImplantacaoMarco, 'marco' | 'realizado_em' | 'nao_se_aplica'>[], qual: Marco) => Boolean(marcos.find((marco) => marco.marco === qual)?.realizado_em);
const seAplica = (marcos: readonly Pick<ImplantacaoMarco, 'marco' | 'nao_se_aplica'>[], qual: Marco) => !marcos.find((marco) => marco.marco === qual)?.nao_se_aplica;

/**
 * A situação sai dos fatos, nunca é escolhida à mão: suspensa e cancelada vêm da interrupção, concluída da
 * ação Concluir, e o resto do marco atual. Entregue com aceite e acompanhamento por fazer: Em acompanhamento.
 */
export function situacaoPelosMarcos(implantacao: Pick<Implantacao, 'interrupcao' | 'concluida_em' | 'aceite_em'>, marcos: readonly Pick<ImplantacaoMarco, 'marco' | 'realizado_em' | 'nao_se_aplica'>[]): SituacaoImplantacao {
  if (implantacao.interrupcao) return implantacao.interrupcao.tipo;
  if (implantacao.concluida_em) return 'concluida';
  if (realizado(marcos, 'entrega')) return implantacao.aceite_em && seAplica(marcos, 'acompanhamento') && !realizado(marcos, 'acompanhamento') ? 'acompanhamento' : 'entregue';
  const atual = marcoAtual(marcos)?.marco;
  if (!atual || atual === 'inicio') return realizado(marcos, 'inicio') ? 'em_andamento' : 'nao_iniciada';
  if (atual === 'configuracao') return 'em_andamento';
  return 'em_validacao';
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

const textoDosDias = (dias: number) => `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;

export type Desvio = { dias: number | null; texto: string; tom: 'neutro' | 'sucesso' | 'atencao' | 'erro' };

/** RN-12.05: planejada × contratual e realizada × contratual, em dias, com texto. */
export function desvioDaEntrega(contratual: DataDoPrazo | null, data: string | null, tipo: 'planejada' | 'realizada'): Desvio {
  if (!contratual) return { dias: null, texto: 'Sem prazo contratual de entrega', tom: 'neutro' };
  if (contratual.pendente) return { dias: null, texto: contratual.texto, tom: 'neutro' };
  if (!data) return { dias: null, texto: tipo === 'planejada' ? 'Entrega ainda não planejada' : 'Ainda não entregue', tom: 'neutro' };
  const dias = diasEntre(contratual.data, data);
  if (dias > 0) return { dias, texto: `${textoDosDias(dias)} depois do prazo contratual`, tom: tipo === 'planejada' ? 'atencao' : 'erro' };
  if (dias < 0) return { dias, texto: `${textoDosDias(dias)} antes do prazo contratual`, tom: 'sucesso' };
  return { dias: 0, texto: 'No prazo contratual', tom: 'sucesso' };
}

// ---------- O que vem do contrato ----------

/** A versão que vale para a operação: a vigente (com aditivo, a mais nova assinada); sem ela, a de origem. */
async function versaoDoContrato(contrato: Contrato, origemId?: string): Promise<ContratoVersao | null> {
  const id = contrato.versao_vigente_id ?? origemId;
  return id ? repositorios.contrato_versao.obter(id) : null;
}

/** A regra de entrega do produto; sem uma só dele, a regra de entrega geral do contrato. */
export function regraDeEntrega(regras: readonly RegraPrazo[], produtoId: string): RegraPrazo | null {
  const deEntrega = regras.filter((regra) => regra.uso === 'entrega');
  return deEntrega.find((regra) => regra.produto_id === produtoId) ?? deEntrega.find((regra) => !regra.produto_id) ?? null;
}

export function entregaContratual(regras: readonly RegraPrazo[], eventos: readonly EventoContrato[], feriados: readonly Pick<Feriado, 'data'>[], produtoId: string): { regra: RegraPrazo | null; prazo: DataDoPrazo | null } {
  const regra = regraDeEntrega(regras, produtoId);
  return { regra, prazo: regra ? calcularPrazo(regra, eventos, feriados) : null };
}

/** RN-12.01: item de implantação (oferta do tipo implantação ou sob medida no M07) ou item sob medida. */
async function itemDeImplantacao(item: ItemContrato): Promise<boolean> {
  if (item.tipo_item === 'sob_medida') return true;
  if (!item.oferta_id) return false;
  const oferta = await catalogoComercial().oferta(item.oferta_id);
  return oferta?.tipo === 'implantacao' || oferta?.tipo === 'sob_medida';
}

export type ProdutoParaImplantar = { produtoId: string; itens: ItemContrato[]; implantacaoId: string | null };

/** O que o contrato oferece para "Criar implantação": produtos com item de implantação, e se já existe. */
export async function produtosParaImplantar(contratoId: string): Promise<{ produtos: ProdutoParaImplantar[]; semProduto: ItemContrato[]; motivo: string | null }> {
  const contrato = await repositorios.contrato.obter(contratoId);
  if (!contrato) throw new ErroDeRegra('Este contrato não existe mais.');
  if (!contrato.versao_vigente_id) return { produtos: [], semProduto: [], motivo: 'A implantação nasce do contrato assinado (RN-12.01).' };
  if (contrato.situacao_documental === 'cancelado' || contrato.encerrado_em) return { produtos: [], semProduto: [], motivo: 'Contrato encerrado ou cancelado não recebe implantação.' };
  const [itens, implantacoes] = await Promise.all([repositorios.item_contrato.listar({ onde: { versao_id: contrato.versao_vigente_id } }), repositorios.implantacao.listar({ onde: { contrato_id: contratoId }, incluirArquivados: true })]);
  const elegiveis: ItemContrato[] = [];
  for (const item of itens) if (await itemDeImplantacao(item)) elegiveis.push(item);
  const porProduto = new Map<string, ItemContrato[]>();
  for (const item of elegiveis) if (item.produto_id) porProduto.set(item.produto_id, [...(porProduto.get(item.produto_id) ?? []), item]);
  const produtos = [...porProduto.entries()].map(([produtoId, lista]) => ({ produtoId, itens: lista, implantacaoId: implantacoes.find((linha) => linha.produto_id === produtoId)?.id ?? null }));
  return { produtos, semProduto: elegiveis.filter((item) => !item.produto_id), motivo: produtos.length ? null : 'O contrato não tem item de implantação ou sob medida com produto: contratação de uso imediato dispensa implantação (RN-12.01).' };
}

export type TarefaSugerida = { titulo: string; horas: number | null };

export type PreviaDaImplantacao = {
  contrato: Contrato;
  produtoId: string;
  itens: ItemContrato[];
  horasEstimadas: number | null;
  prazoEstimadoDias: number | null;
  tarefas: TarefaSugerida[];
  entrega: { regra: RegraPrazo | null; prazo: DataDoPrazo | null };
  aceiteCriterios: string | null;
  jaExiste: Implantacao | null;
};

/** As estimativas e as entregas da proposta aceita e da viabilidade. Com mais de um produto, a viabilidade não se divide. */
async function estimativas(contrato: Contrato, itensDoProduto: readonly ItemContrato[], produtosNoContrato: number) {
  const itensDaProposta = await Promise.all(itensDoProduto.filter((item) => item.proposta_item_id).map((item) => repositorios.proposta_item.obter(item.proposta_item_id as string)));
  const horasDosItens = itensDaProposta.flatMap((item) => (item && item.horas_estimadas !== null ? [item.horas_estimadas] : []));
  const versaoDaProposta = contrato.proposta_versao_id ? await repositorios.proposta_versao.obter(contrato.proposta_versao_id) : null;
  const proposta = versaoDaProposta ? await repositorios.proposta.obter(versaoDaProposta.proposta_id) : null;
  const viabilidade = proposta && produtosNoContrato === 1 ? ((await repositorios.viabilidade.listar({ onde: { oportunidade_id: proposta.oportunidade_id } })).sort((a, b) => b.decidido_em.localeCompare(a.decidido_em))[0] ?? null) : null;
  const tarefas: TarefaSugerida[] = [];
  const acrescentar = (titulo: string, horas: number | null) => {
    if (!tarefas.some((tarefa) => tarefa.titulo.toLowerCase() === titulo.toLowerCase())) tarefas.push({ titulo: limitar(titulo), horas });
  };
  for (const entrega of viabilidade?.entregas ?? []) acrescentar(entrega.descricao, entrega.horas);
  for (const item of itensDoProduto) if (item.tipo_item === 'sob_medida') acrescentar(item.descricao, itensDaProposta.find((linha) => linha?.id === item.proposta_item_id)?.horas_estimadas ?? null);
  return {
    horasEstimadas: horasDosItens.length ? Math.round(horasDosItens.reduce((total, horas) => total + horas, 0) * 100) / 100 : (viabilidade?.horas_total ?? null),
    prazoEstimadoDias: viabilidade?.prazo_estimado_dias ?? null,
    tarefas,
  };
}

export async function previaDaImplantacao(contratoId: string, produtoId: string): Promise<PreviaDaImplantacao> {
  const { produtos, motivo } = await produtosParaImplantar(contratoId);
  const alvo = produtos.find((linha) => linha.produtoId === produtoId);
  if (!alvo) throw new ErroDeRegra(motivo ?? 'Este produto não tem item de implantação no contrato.');
  const contrato = (await repositorios.contrato.obter(contratoId)) as Contrato;
  const versao = (await versaoDoContrato(contrato)) as ContratoVersao;
  const [regras, eventos, feriados] = await Promise.all([repositorios.regra_prazo.listar({ onde: { versao_id: versao.id } }), repositorios.evento_contrato.listar({ onde: { contrato_id: contratoId } }), repositorios.feriado.listar()]);
  const estimado = await estimativas(contrato, alvo.itens, produtos.length);
  return { contrato, produtoId, itens: alvo.itens, ...estimado, entrega: entregaContratual(regras, eventos, feriados, produtoId), aceiteCriterios: versao.condicoes.aceite_criterios, jaExiste: alvo.implantacaoId ? await repositorios.implantacao.obter(alvo.implantacaoId) : null };
}

// ---------- Criar ----------

/** RN-12.01: criar de novo não duplica (contrato + produto). As tarefas escolhidas na prévia viram atividades. */
export async function criarImplantacao(contratoId: string, produtoId: string, { responsavelId, tarefas }: { responsavelId: string; tarefas: readonly string[] }, hoje: string = hojeISO()): Promise<{ implantacao: Implantacao; criada: boolean; tarefas: number }> {
  if (!responsavelId) throw new ErroDeRegra('Escolha a responsável pela implantação.');
  const previa = await previaDaImplantacao(contratoId, produtoId);
  if (previa.jaExiste) return { implantacao: previa.jaExiste, criada: false, tarefas: 0 };
  const versaoId = previa.contrato.versao_vigente_id as string;
  const implantacao = await emTransacao(async () => {
    const criada = await repositorios.implantacao.criar({ contrato_id: contratoId, versao_id: versaoId, produto_id: produtoId, contraparte_id: previa.contrato.contraparte_id, responsavel_id: responsavelId, situacao: 'nao_iniciada', entrega_planejada: null, entrega_realizada: null, horas_estimadas: previa.horasEstimadas, prazo_estimado_dias: previa.prazoEstimadoDias, aceite_em: null, aceite_por_texto: null, aceite_evidencia_url: null, interrupcao: null, concluida_em: null, observacoes: null });
    // RN-12.03: o sistema não inventa datas: os marcos nascem sem data.
    for (const marco of MARCOS_IMPLANTACAO) await repositorios.implantacao_marco.criar({ implantacao_id: criada.id, marco, planejado_em: null, realizado_em: null, nao_se_aplica: false, observacao: null });
    return criada;
  });
  void hoje;
  const geradas = await gerarTarefas(implantacao.id, tarefas.filter((titulo) => previa.tarefas.some((tarefa) => tarefa.titulo === titulo)));
  return { implantacao, criada: true, tarefas: geradas };
}

/** RN-12.04 e princípio 6: gerar de novo não duplica (mesmo título já vinculado à implantação). */
export async function gerarTarefas(implantacaoId: string, titulos: readonly string[]): Promise<number> {
  const implantacao = await repositorios.implantacao.obter(implantacaoId);
  if (!implantacao) throw new ErroDeRegra('Esta implantação não existe mais.');
  const existentes = await atividadesDaImplantacao(implantacaoId);
  let criadas = 0;
  for (const titulo of titulos) {
    if (existentes.some((atividade) => atividade.titulo.toLowerCase() === titulo.toLowerCase())) continue;
    // Sem prazo: a data é da operação, e ninguém a inventa (RN-12.03).
    await criarAtividade({ ...formularioAtividadeVazio('tarefa', implantacao.responsavel_id, implantacao.produto_id), titulo: limitar(titulo), responsavel_id: implantacao.responsavel_id, contextos: [implantacao.produto_id], vinculo: `implantacao:${implantacaoId}` });
    criadas += 1;
  }
  return criadas;
}

async function atividadesDaImplantacao(implantacaoId: string) {
  const vinculos = await repositorios.vinculo.listar();
  const ids = new Set(vinculos.flatMap((vinculo) => (vinculo.origem_tipo === 'atividade' && vinculo.destino_tipo === 'implantacao' && vinculo.destino_id === implantacaoId ? [vinculo.origem_id] : vinculo.destino_tipo === 'atividade' && vinculo.origem_tipo === 'implantacao' && vinculo.origem_id === implantacaoId ? [vinculo.destino_id] : [])));
  return (await repositorios.atividade.listar()).filter((atividade) => ids.has(atividade.id) && atividade.situacao !== 'cancelada');
}

// ---------- Editar ----------

async function implantacaoAberta(id: string): Promise<Implantacao> {
  const implantacao = await repositorios.implantacao.obter(id);
  if (!implantacao) throw new ErroDeRegra('Esta implantação não existe mais.');
  if (implantacao.concluida_em) throw new ErroDeRegra('Implantação concluída fica só para consulta.');
  if (implantacao.interrupcao?.tipo === 'cancelada') throw new ErroDeRegra('Implantação cancelada fica só para consulta.');
  return implantacao;
}

async function recalcularSituacao(id: string): Promise<Implantacao> {
  const implantacao = (await repositorios.implantacao.obter(id)) as Implantacao;
  const marcos = await repositorios.implantacao_marco.listar({ onde: { implantacao_id: id } });
  const entrega = marcos.find((marco) => marco.marco === 'entrega');
  const situacao = situacaoPelosMarcos(implantacao, marcos);
  // A entrega planejada e a realizada são o marco Entrega: as duas ficam iguais.
  const mudancas = { situacao, entrega_planejada: entrega?.planejado_em ?? null, entrega_realizada: entrega?.realizado_em ?? null };
  if (mudancas.situacao === implantacao.situacao && mudancas.entrega_planejada === implantacao.entrega_planejada && mudancas.entrega_realizada === implantacao.entrega_realizada) return implantacao;
  return repositorios.implantacao.atualizar(id, mudancas);
}

export type DadosDoMarco = { planejado_em: string; realizado_em: string; nao_se_aplica: boolean; observacao: string };

/** RN-12.03: datas planejada e realizada, "não se aplica" e observação. Realizado não fica no futuro. */
export async function salvarMarco(implantacaoId: string, marco: Marco, dados: DadosDoMarco, hoje: string = hojeISO()): Promise<Implantacao> {
  await implantacaoAberta(implantacaoId);
  if (dados.realizado_em && dados.realizado_em > hoje) throw new ErroDeRegra('A data realizada vai até hoje.');
  if (dados.nao_se_aplica && (marco === 'inicio' || marco === 'entrega')) throw new ErroDeRegra(`${ROTULOS_MARCO[marco]} sempre se aplica.`);
  const registro = (await repositorios.implantacao_marco.listar({ onde: { implantacao_id: implantacaoId, marco } }))[0];
  if (!registro) throw new ErroDeRegra('Este marco não existe mais.');
  const novo = dados.nao_se_aplica ? { planejado_em: null, realizado_em: null, nao_se_aplica: true, observacao: dados.observacao.trim() || null } : { planejado_em: dados.planejado_em || null, realizado_em: dados.realizado_em || null, nao_se_aplica: false, observacao: dados.observacao.trim() || null };
  await repositorios.implantacao_marco.atualizar(registro.id, novo);
  const atualizada = await recalcularSituacao(implantacaoId);
  await sincronizarAlertasDasImplantacoes(hoje);
  return atualizada;
}

export type DadosDaImplantacao = { responsavel_id: string; horas_estimadas: string; prazo_estimado_dias: string; observacoes: string };

const lerNumero = (texto: string) => {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : Number.NaN;
};

export async function salvarDadosDaImplantacao(id: string, dados: DadosDaImplantacao, hoje: string = hojeISO()): Promise<Implantacao> {
  await implantacaoAberta(id);
  if (!dados.responsavel_id) throw new ErroDeRegra('Escolha a responsável.');
  const horas = lerNumero(dados.horas_estimadas);
  if (Number.isNaN(horas) || (horas !== null && horas < 0)) throw new ErroDeRegra('Use um número de horas, como 40 ou 12,5.');
  const prazo = lerNumero(dados.prazo_estimado_dias);
  if (Number.isNaN(prazo) || (prazo !== null && (prazo <= 0 || !Number.isInteger(prazo)))) throw new ErroDeRegra('O prazo estimado é um número inteiro de dias.');
  const salva = await repositorios.implantacao.atualizar(id, { responsavel_id: dados.responsavel_id, horas_estimadas: horas, prazo_estimado_dias: prazo, observacoes: dados.observacoes.trim() || null });
  await sincronizarAlertasDasImplantacoes(hoje);
  return salva;
}

export type ResultadoDoAceite = { eventoNovo: boolean; eventoEm: string; titulosGerados: number; programacaoAtiva: boolean };

/**
 * T12.02 e CA-12.02: o aceite da entrega vira o evento "Aceite" do contrato, que calcula os prazos e as
 * parcelas relativos a ele. Com a programação financeira ativa, a parcela que aguardava o aceite nasce agora,
 * sem duplicar. Um contrato tem um evento Aceite: com outro produto já aceito, vale a data dele.
 */
export async function registrarAceiteDaEntrega(id: string, { data, porTexto, evidenciaUrl }: { data: string; porTexto: string; evidenciaUrl: string }, hoje: string = hojeISO()): Promise<ResultadoDoAceite> {
  const implantacao = await implantacaoAberta(id);
  if (implantacao.aceite_em) throw new ErroDeRegra('O aceite desta entrega já foi registrado.');
  if (!implantacao.entrega_realizada) throw new ErroDeRegra('Registre a entrega (Go Live) realizada antes do aceite.');
  if (!data || data > hoje) throw new ErroDeRegra('Informe a data do aceite, até hoje.');
  if (data < implantacao.entrega_realizada) throw new ErroDeRegra('O aceite não pode ser antes da entrega.');
  if (!porTexto.trim()) throw new ErroDeRegra('Diga quem aceitou pelo cliente.');
  if (!evidenciaUrl.trim()) throw new ErroDeRegra('Cole o link da evidência do aceite no Drive.');
  if (!linkDoDriveValido(evidenciaUrl.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  const { registrarEvento } = await import('./contratos');
  const eventos = await repositorios.evento_contrato.listar({ onde: { contrato_id: implantacao.contrato_id } });
  const existente = eventos.find((evento) => evento.tipo === 'aceite');
  const produto = await repositorios.produto.obter(implantacao.produto_id);
  if (!existente) await registrarEvento(implantacao.contrato_id, { tipo: 'aceite', nome: '', produto_id: '', data, evidencia_url: evidenciaUrl.trim(), observacao: `Aceite da entrega de ${produto?.nome ?? 'produto'} (${implantacao.codigo}), por ${porTexto.trim()}.` }, hoje);
  await repositorios.implantacao.atualizar(id, { aceite_em: data, aceite_por_texto: porTexto.trim(), aceite_evidencia_url: evidenciaUrl.trim() });
  await recalcularSituacao(id);
  const programacoes = await repositorios.programacao_financeira.listar({ onde: { contrato_id: implantacao.contrato_id, situacao: 'ativa' } });
  const antes = (await repositorios.titulo.listar({ onde: { origem: 'contrato', origem_id: implantacao.contrato_id } })).length;
  // A mesma extensão da rotina mensal, só para este contrato: as mesmas categorias, e nada em dobro.
  if (programacoes.length) await gerarParcelasDoContrato(implantacao.contrato_id, hoje);
  const depois = (await repositorios.titulo.listar({ onde: { origem: 'contrato', origem_id: implantacao.contrato_id } })).length;
  await sincronizarAlertasDasImplantacoes(hoje);
  return { eventoNovo: !existente, eventoEm: existente?.data ?? data, titulosGerados: depois - antes, programacaoAtiva: programacoes.length > 0 };
}

async function gerarParcelasDoContrato(contratoId: string, hoje: string): Promise<void> {
  const { ativarProgramacao, titulosDoContrato } = await import('./contratos');
  const titulos = await titulosDoContrato(contratoId);
  const recorrente = titulos.find((titulo) => titulo.periodo_inicio !== titulo.periodo_fim)?.categoria_id ?? '';
  const unica = titulos.find((titulo) => titulo.periodo_inicio === titulo.periodo_fim)?.categoria_id ?? recorrente;
  try {
    await ativarProgramacao(contratoId, { categoriaRecorrente: recorrente, categoriaUnica: unica }, hoje);
  } catch {
    // Sem categoria conhecida, a parcela aparece na prévia da programação do contrato, para ativar à mão.
  }
}

/** Concluir: a entrega realizada, e cada marco realizado ou "não se aplica". Alimenta a referência histórica (RN-12.06). */
export async function concluirImplantacao(id: string, hoje: string = hojeISO()): Promise<Implantacao> {
  const implantacao = await implantacaoAberta(id);
  if (implantacao.interrupcao) throw new ErroDeRegra('Retome a implantação antes de concluir.');
  const marcos = await repositorios.implantacao_marco.listar({ onde: { implantacao_id: id } });
  const faltam = ordenar(marcos).filter((marco) => !marco.nao_se_aplica && !marco.realizado_em);
  if (faltam.length) throw new ErroDeRegra(`Falta registrar: ${faltam.map((marco) => ROTULOS_MARCO[marco.marco]).join(', ')}. Ou marque "Não se aplica".`);
  const concluida = await repositorios.implantacao.atualizar(id, { concluida_em: hoje, situacao: 'concluida' });
  await sincronizarAlertasDasImplantacoes(hoje);
  return concluida;
}

export async function interromperImplantacao(id: string, tipo: 'suspensa' | 'cancelada', motivo: string, hoje: string = hojeISO()): Promise<Implantacao> {
  const implantacao = await implantacaoAberta(id);
  if (!motivo.trim()) throw new ErroDeRegra(tipo === 'suspensa' ? 'Suspender exige motivo.' : 'Cancelar exige motivo.');
  if (implantacao.interrupcao?.tipo === tipo) throw new ErroDeRegra(tipo === 'suspensa' ? 'Já está suspensa.' : 'Já está cancelada.');
  const salva = await repositorios.implantacao.atualizar(id, { interrupcao: { tipo, motivo: motivo.trim(), em: hoje }, situacao: tipo }, { motivo: motivo.trim() });
  await sincronizarAlertasDasImplantacoes(hoje);
  return salva;
}

export async function retomarImplantacao(id: string, hoje: string = hojeISO()): Promise<Implantacao> {
  const implantacao = await implantacaoAberta(id);
  if (implantacao.interrupcao?.tipo !== 'suspensa') throw new ErroDeRegra('Só a implantação suspensa é retomada.');
  await repositorios.implantacao.atualizar(id, { interrupcao: null });
  const retomada = await recalcularSituacao(id);
  await sincronizarAlertasDasImplantacoes(hoje);
  return retomada;
}

// ---------- Alerta (RN-12.05 e CA-12.01) ----------

export const MOTIVO_ALERTA_ENTREGA = 'Entrega planejada após o prazo contratual';

/** Planejada depois da contratual: alerta para a responsável, sem bloquear e sem mudar o contrato. */
export async function sincronizarAlertasDasImplantacoes(hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const [implantacoes, feriados] = await Promise.all([repositorios.implantacao.listar(), repositorios.feriado.listar()]);
    const desejados: AlertaDesejado[] = [];
    for (const implantacao of implantacoes) {
      if (implantacao.concluida_em || implantacao.interrupcao || implantacao.entrega_realizada || !implantacao.entrega_planejada) continue;
      const contrato = await repositorios.contrato.obter(implantacao.contrato_id);
      if (!contrato) continue;
      const versao = await versaoDoContrato(contrato, implantacao.versao_id);
      if (!versao) continue;
      const [regras, eventos] = await Promise.all([repositorios.regra_prazo.listar({ onde: { versao_id: versao.id } }), repositorios.evento_contrato.listar({ onde: { contrato_id: contrato.id } })]);
      const { prazo } = entregaContratual(regras, eventos, feriados, implantacao.produto_id);
      if (!prazo || prazo.pendente || implantacao.entrega_planejada <= prazo.data) continue;
      desejados.push({ origem_tipo: 'implantacao', origem_id: implantacao.id, motivo: MOTIVO_ALERTA_ENTREGA, data_referencia: prazo.data, titulo: limitar(`${implantacao.codigo}: entrega planejada para ${formatarDiaISO(implantacao.entrega_planejada)}, depois do prazo contratual (${formatarDiaISO(prazo.data)})`), responsavel_id: implantacao.responsavel_id, area_id: AREA_TECNOLOGIA, acao: 'abrir_implantacao', exemplo: implantacao.exemplo });
    }
    return sincronizarAlertas('implantacao', desejados, 'Concluído: a entrega voltou para o prazo, foi realizada ou a implantação foi encerrada.');
  });
}

// ---------- Ler ----------

export type LinhaDaImplantacao = Implantacao & { marcos: ImplantacaoMarco[]; atual: ImplantacaoMarco | null; contrato: Contrato | null; contratual: DataDoPrazo | null; desvioPlanejado: Desvio; desvioRealizado: Desvio; horasApontadas: number };

export type DadosDasImplantacoes = { linhas: LinhaDaImplantacao[]; produtos: Awaited<ReturnType<typeof repositorios.produto.listar>>; pessoas: Awaited<ReturnType<typeof repositorios.pessoa.listar>>; contrapartes: Awaited<ReturnType<typeof repositorios.contraparte.listar>>; apontamentos: ApontamentoHoras[] };

export async function carregarImplantacoes(): Promise<DadosDasImplantacoes> {
  const [implantacoes, marcos, contratos, regras, eventos, feriados, apontamentos, produtos, pessoas, contrapartes] = await Promise.all([repositorios.implantacao.listar({ incluirArquivados: true }), repositorios.implantacao_marco.listar(), repositorios.contrato.listar({ incluirArquivados: true }), repositorios.regra_prazo.listar(), repositorios.evento_contrato.listar(), repositorios.feriado.listar(), repositorios.apontamento_horas.listar(), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.contraparte.listar({ incluirArquivados: true })]);
  const linhas = implantacoes.map((implantacao) => {
    const contrato = contratos.find((linha) => linha.id === implantacao.contrato_id) ?? null;
    const versaoId = contrato?.versao_vigente_id ?? implantacao.versao_id;
    const doRegistro = ordenar(marcos.filter((marco) => marco.implantacao_id === implantacao.id));
    const { prazo } = entregaContratual(regras.filter((regra) => regra.versao_id === versaoId), eventos.filter((evento) => evento.contrato_id === implantacao.contrato_id), feriados, implantacao.produto_id);
    return { ...implantacao, marcos: doRegistro, atual: marcoAtual(doRegistro), contrato, contratual: prazo, desvioPlanejado: desvioDaEntrega(prazo, implantacao.entrega_planejada, 'planejada'), desvioRealizado: desvioDaEntrega(prazo, implantacao.entrega_realizada, 'realizada'), horasApontadas: somarHoras(apontamentos.filter((linha) => linha.registro_tipo === 'implantacao' && linha.registro_id === implantacao.id)) };
  });
  return { linhas, produtos, pessoas, contrapartes, apontamentos };
}

export type FichaDaImplantacao = LinhaDaImplantacao & { versao: ContratoVersao | null; regraDeEntrega: RegraPrazo | null; itens: ItemContrato[]; escopo: { incluido: string | null; excluido: string | null; premissas: string | null } | null; aceiteCriterios: string | null; aceitePrazoDias: number | null; eventoAceite: EventoContrato | null; apontamentosDaImplantacao: ApontamentoHoras[] };

/** Escopo e critérios de aceite vêm do contrato (RO), do snapshot da versão vigente e da proposta aceita. */
export async function carregarImplantacao(id: string): Promise<FichaDaImplantacao | null> {
  const dados = await carregarImplantacoes();
  const linha = dados.linhas.find((item) => item.id === id);
  if (!linha || !linha.contrato) return null;
  const versao = await versaoDoContrato(linha.contrato, linha.versao_id);
  const snapshot = (versao?.snapshot ?? null) as { itens?: ItemContrato[] } | null;
  const itens = (snapshot?.itens ?? (versao ? await repositorios.item_contrato.listar({ onde: { versao_id: versao.id } }) : [])).filter((item) => item.produto_id === linha.produto_id);
  const proposta = linha.contrato.proposta_versao_id ? await repositorios.proposta_versao.obter(linha.contrato.proposta_versao_id) : null;
  const [regras, eventos] = await Promise.all([versao ? repositorios.regra_prazo.listar({ onde: { versao_id: versao.id } }) : Promise.resolve([]), repositorios.evento_contrato.listar({ onde: { contrato_id: linha.contrato_id } })]);
  return {
    ...linha,
    versao,
    regraDeEntrega: regraDeEntrega(regras, linha.produto_id),
    itens,
    escopo: proposta ? { incluido: proposta.escopo_incluido, excluido: proposta.escopo_excluido, premissas: proposta.premissas } : null,
    aceiteCriterios: versao?.condicoes.aceite_criterios ?? null,
    aceitePrazoDias: versao?.condicoes.aceite_prazo_dias ?? null,
    eventoAceite: eventos.find((evento) => evento.tipo === 'aceite') ?? null,
    apontamentosDaImplantacao: dados.apontamentos.filter((apontamento) => apontamento.registro_tipo === 'implantacao' && apontamento.registro_id === id),
  };
}

/** "Nova implantação" fora do contrato: os assinados que ainda têm produto por implantar. */
export async function contratosParaImplantar(): Promise<{ contrato: Contrato; produtos: ProdutoParaImplantar[] }[]> {
  const lista: { contrato: Contrato; produtos: ProdutoParaImplantar[] }[] = [];
  for (const contrato of await repositorios.contrato.listar()) {
    if (!contrato.versao_vigente_id) continue;
    const { produtos } = await produtosParaImplantar(contrato.id);
    if (produtos.some((produto) => !produto.implantacaoId)) lista.push({ contrato, produtos });
  }
  return lista;
}

/** D11: Tecnologia sugere a responsável padrão da área. */
export async function responsavelSugerida(): Promise<string> {
  const area = (await repositorios.area.listar()).find((linha) => linha.id === AREA_TECNOLOGIA);
  return area?.responsavel_padrao_id ?? idDaPessoaAtual() ?? '';
}

/** Histórico da ficha: a implantação, os marcos e os links dela. */
export async function historicoDaImplantacao(id: string) {
  const { historicoDosRegistros } = await import('./historico');
  const [marcos, anexos] = await Promise.all([repositorios.implantacao_marco.listar({ onde: { implantacao_id: id }, incluirArquivados: true }), repositorios.anexo_link.listar({ onde: { registro_id: id }, incluirArquivados: true })]);
  return historicoDosRegistros([id, ...marcos.map((marco) => marco.id), ...anexos.map((anexo) => anexo.id)]);
}

/** Tarefas ainda não geradas, para "Gerar tarefas do escopo" na ficha. */
export async function tarefasPorGerar(id: string): Promise<TarefaSugerida[]> {
  const implantacao = await repositorios.implantacao.obter(id);
  if (!implantacao) return [];
  const previa = await previaDaImplantacao(implantacao.contrato_id, implantacao.produto_id).catch(() => null);
  const existentes = await atividadesDaImplantacao(id);
  return (previa?.tarefas ?? []).filter((tarefa) => !existentes.some((atividade) => atividade.titulo.toLowerCase() === tarefa.titulo.toLowerCase()));
}

export async function implantacoesDoContrato(contratoId: string): Promise<Implantacao[]> {
  return repositorios.implantacao.listar({ onde: { contrato_id: contratoId } });
}

export const pessoaAtualOuNada = () => idDaPessoaAtual() ?? '';
