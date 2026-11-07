/**
 * Regras de M11 (13-M11), fase F1. Quatro situações independentes (§3): documental, vigência, financeira e
 * renovação. Uma linha por contrato; versões assinadas não mudam (RN-11.03). Fluxo vigente (decisão 5):
 * conferir/revisar → emitir final → aprovar para envio → registrar envio → registrar assinatura.
 * Aditivo financeiro, reajuste e repasses são F2 e não aparecem como funcionando.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Contraparte, Entidade } from '@/dados/tipos/contraparte';
import { CONDICOES_VAZIAS, type CondicoesContrato, type Contrato, type ContratoSignatario, type ContratoVersao, type DadosSaas, type EventoContrato, type ItemContrato, type ObrigacaoContratual, type RegraPrazo } from '@/dados/tipos/contrato';
import type { Feriado } from '@/dados/tipos/calendario';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { criarAtividade, formularioAtividadeVazio } from './atividades-formulario';
import { calcularItem, linhasDosTotais, ROTULOS_PERIODICIDADE_VALOR, totaisDosItens, type DadosDoItem } from './comercial';
import { dadosDaContraparteNoModelo, dadosDaEntidadeNoModelo, dataPorExtenso, emitirDocumento, pendenciasDaContraparte } from './documentos-emitidos';
import { pendenciasDaEntidade } from './entidades';
import { avisoDeVencimento, ehDiaUtil } from './feriados';
import { catalogoComercial } from './integracoes/conexoes';
import { somarMeses } from './legal';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { ROTULOS_FAMILIA, renderizarVersao } from './modelos';
import type { Pendencia } from './pendencias';
import { somarDias } from './repeticao';
import { saldoDoTitulo } from './titulos';

export const ROTULOS_DOCUMENTAL: Readonly<Record<Contrato['situacao_documental'], string>> = { rascunho: 'Rascunho', em_revisao: 'Em revisão', aprovado_envio: 'Aprovado para envio', enviado_assinatura: 'Enviado para assinatura', assinado: 'Assinado', recusado: 'Recusado', cancelado: 'Cancelado' };
export const ROTULOS_VIGENCIA = { sem_vigencia: 'Sem vigência', futuro: 'Futuro', vigente: 'Vigente', suspenso: 'Suspenso', encerrado: 'Encerrado' } as const;
export const ROTULOS_FINANCEIRA = { sem_programacao: 'Sem programação', em_dia: 'Em dia', parcial: 'Parcialmente pago', com_vencidos: 'Com vencidos', quitado: 'Quitado' } as const;
export const ROTULOS_RENOVACAO: Readonly<Record<Contrato['renovacao_situacao'], string>> = { nao_se_aplica: 'Não se aplica', em_analise: 'Em análise', renovar: 'Renovar', nao_renovar: 'Não renovar', renovado: 'Renovado' };
export const ROTULOS_TIPO_CONTRATO: Readonly<Record<Contrato['tipo'], string>> = { assinatura: 'Assinatura', implantacao: 'Implantação', desenvolvimento: 'Desenvolvimento', suporte: 'Suporte', parceria: 'Parceria', prestacao_servico: 'Prestação de serviço', patrocinio: 'Patrocínio', confidencialidade: 'Confidencialidade' };
export const ROTULOS_EVENTO: Readonly<Record<EventoContrato['tipo'], string>> = { assinatura: 'Assinatura', inicio_vigencia: 'Início de vigência', entrega: 'Entrega', aceite: 'Aceite', data_fixa: 'Data fixa', outro: 'Outro evento' };
export const ROTULOS_UNIDADE = { dias_corridos: 'dias corridos', dias_uteis: 'dias úteis', meses: 'meses' } as const;
export const ROTULOS_PARTE = { numa: 'Numa', contraparte: 'Contraparte', terceiro: 'Terceiro' } as const;
export const ROTULOS_FORMA_PAGAMENTO = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', transferencia: 'Transferência', loja_gateway: 'Via loja ou gateway' } as const;
export const ROTULOS_RENOVACAO_TIPO = { sem_renovacao: 'Sem renovação', automatica: 'Automática por período igual', mediante_aditivo: 'Mediante aditivo' } as const;
export const ROTULOS_ENCERRAMENTO = { termino: 'Término', rescisao_numa: 'Rescisão pela Numa', rescisao_contraparte: 'Rescisão pela contraparte', acordo: 'Acordo' } as const;

/** F1: parceiro (repasse) é da F2, e societário fica em M06 (§2). */
export const FAMILIAS_F1 = ['cliente_negociado', 'adesao_condicao_especial', 'fornecedor', 'institucional'] as const;
/** Família e tipo que não têm valor: dispensam item (RN-11.06). */
const SEM_VALOR = (contrato: Pick<Contrato, 'tipo'>) => contrato.tipo === 'confidencialidade';

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const PERIODO_EM_MESES: Readonly<Record<string, number>> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };

// ---------- Criação ----------

export type DadosDasPartes = Pick<Contrato, 'titulo' | 'familia' | 'tipo' | 'entidade_id' | 'contraparte_id' | 'responsavel_id' | 'participantes'>;

function versaoNova(contratoId: string, numero: number, tipo: ContratoVersao['tipo'], extra: Partial<ContratoVersao> = {}) {
  return { contrato_id: contratoId, numero, tipo, situacao: 'em_elaboracao' as const, fluxo: 'rascunho' as const, representante_contraparte_id: null, data_efeito: null, retroatividade_justificativa: null, resumo_mudancas: null, vigencia_inicio: null, vigencia_inicio_evento: 'assinatura' as const, vigencia_inicio_evento_nome: null, vigencia_fim: null, vigencia_duracao_meses: null, vigencia_indeterminada: false, condicoes: CONDICOES_VAZIAS, dados_saas: null, modelo_versao_id: null, snapshot: null, aprovada_envio_por: null, aprovada_envio_em: null, enviada_em: null, enviada_canal: null, enviada_destinatarios: null, enviada_documento_id: null, assinado_arquivo_url: null, assinatura_evidencia_url: null, assinatura_confirmada_por: null, assinatura_confirmada_em: null, publicada_em: null, publicada_por: null, devolucao_motivo: null, recusa_motivo: null, ...extra };
}

export async function criarContrato(partes: DadosDasPartes, { saas = false, dadosSaas = null }: { saas?: boolean; dadosSaas?: DadosSaas | null } = {}): Promise<Contrato> {
  if (!partes.titulo.trim()) throw new ErroDeRegra('Informe o título do contrato.');
  if (!(FAMILIAS_F1 as readonly string[]).includes(partes.familia)) throw new ErroDeRegra('Família de parceiro com repasse é da F2.');
  return emTransacao(async () => {
    const contrato = await repositorios.contrato.criar({ ...partes, titulo: partes.titulo.trim(), proposta_versao_id: null, moeda: 'BRL', situacao_documental: 'rascunho', renovacao_situacao: 'nao_se_aplica', versao_vigente_id: null, versao_elaboracao_id: null, classe: 'doc', saas, suspensao: null, vigencia_prorrogada_ate: null, encerrado_em: null, encerramento_motivo: null, cancelado_motivo: null, administrativo: { endereco_correspondencia: null, dados_bancarios: null, observacoes: null } });
    const versao = await repositorios.contrato_versao.criar(versaoNova(contrato.id, 1, 'original', { dados_saas: dadosSaas }));
    return repositorios.contrato.atualizar(contrato.id, { versao_elaboracao_id: versao.id });
  });
}

/** RN-10.13 e T10.08: só da versão Aceita; converter de novo abre o contrato que já existe. */
export async function converterPropostaEmContrato(propostaId: string): Promise<{ contrato: Contrato; criado: boolean }> {
  const proposta = await repositorios.proposta.obter(propostaId);
  if (!proposta?.versao_aceita_id) throw new ErroDeRegra('Só a proposta com versão aceita vira contrato.');
  const existente = (await repositorios.contrato.listar({ incluirArquivados: true })).find((contrato) => contrato.proposta_versao_id === proposta.versao_aceita_id);
  if (existente) return { contrato: existente, criado: false };
  const [versao, oportunidade, itens] = await Promise.all([repositorios.proposta_versao.obter(proposta.versao_aceita_id), repositorios.oportunidade.obter(proposta.oportunidade_id), repositorios.proposta_item.listar({ onde: { versao_id: proposta.versao_aceita_id } })]);
  if (!versao || !oportunidade) throw new ErroDeRegra('A proposta aceita está incompleta.');
  const sugestao = familiaSugerida(oportunidade.tipo);
  const entidade = versao.entidade_id ?? (await repositorios.entidade.listar()).find((item) => item.entidade_padrao)?.id;
  if (!entidade) throw new ErroDeRegra('A proposta não tem entidade emissora.');
  const condicoesDaProposta = [versao.condicoes.forma_pagamento && `forma de pagamento: ${versao.condicoes.forma_pagamento}`, versao.condicoes.vencimentos && `vencimentos: ${versao.condicoes.vencimentos}`, versao.condicoes.prazo_entrega && `prazo de entrega: ${versao.condicoes.prazo_entrega}`, versao.condicoes.observacoes].filter(Boolean).join('; ');
  const contrato = await emTransacao(async () => {
    const criado = await criarContrato({ titulo: oportunidade.titulo, familia: sugestao.familia, tipo: sugestao.tipo, entidade_id: entidade, contraparte_id: proposta.contraparte_id, responsavel_id: oportunidade.responsavel_id, participantes: [] });
    await repositorios.contrato.atualizar(criado.id, { proposta_versao_id: versao.id });
    const versaoContrato = criado.versao_elaboracao_id as string;
    await repositorios.contrato_versao.atualizar(versaoContrato, { resumo_mudancas: `Original, da proposta ${proposta.codigo} V${versao.numero}.${condicoesDaProposta ? ` Condições combinadas na proposta: ${condicoesDaProposta}.` : ''}`, condicoes: { ...CONDICOES_VAZIAS, reajuste_indice: versao.condicoes.reajuste_indice, reajuste_periodicidade_meses: versao.condicoes.reajuste_periodicidade_meses } });
    for (const item of itens.sort((a, b) => a.ordem - b.ordem)) {
      await repositorios.item_contrato.criar({ versao_id: versaoContrato, produto_id: item.produto_id, tipo_item: item.tipo_item, oferta_id: item.oferta_id, preco_versao_id: item.preco_versao_id, canal_id: item.canal_id, descricao: item.descricao, quantidade: item.quantidade, valor_unitario: item.valor_unitario, justificativa_valor: item.justificativa_valor, desconto_percentual: item.desconto_percentual, desconto: item.desconto_valor, desconto_justificativa: item.desconto_justificativa, desconto_por: item.desconto_por, desconto_em: item.desconto_em, valor_total: item.valor_total, recorrente: item.recorrente, periodicidade: item.periodicidade, inicio: item.inicio_previsto, fim: null, item_origem_id: null, proposta_item_id: item.id, ordem: item.ordem });
    }
    if (versao.contatos[0]) await repositorios.contrato_contato.criar({ contrato_id: criado.id, pessoa_id: versao.contatos[0], papel: 'principal' });
    return (await repositorios.contrato.obter(criado.id)) as Contrato;
  });
  return { contrato, criado: true };
}

export function familiaSugerida(tipo: string): { familia: Contrato['familia']; tipo: Contrato['tipo'] } {
  if (tipo === 'implantacao_assinatura') return { familia: 'cliente_negociado', tipo: 'implantacao' };
  if (tipo === 'sob_medida') return { familia: 'cliente_negociado', tipo: 'desenvolvimento' };
  if (tipo === 'patrocinio') return { familia: 'institucional', tipo: 'patrocinio' };
  if (tipo === 'parceria') return { familia: 'institucional', tipo: 'parceria' };
  return { familia: 'cliente_negociado', tipo: 'assinatura' };
}

// ---------- Carregar ----------

export type FichaDoContrato = {
  contrato: Contrato;
  versoes: ContratoVersao[];
  /** A versão que se edita ou que está no fluxo: a em elaboração, ou a vigente. */
  atual: ContratoVersao;
  vigente: ContratoVersao | null;
  itens: ItemContrato[];
  regras: RegraPrazo[];
  obrigacoes: ObrigacaoContratual[];
  signatarios: ContratoSignatario[];
  eventos: EventoContrato[];
  titulos: Titulo[];
  entidade: Entidade | null;
  contraparte: Contraparte | null;
};

/** RN-11.03: a vigente é a última publicada com data de efeito até hoje. */
export function versaoVigente(versoes: readonly ContratoVersao[], hoje: string): ContratoVersao | null {
  return [...versoes].filter((versao) => versao.situacao === 'publicada' && (!versao.data_efeito || versao.data_efeito <= hoje)).sort((a, b) => b.numero - a.numero)[0] ?? null;
}

export async function carregarContrato(id: string, hoje: string = hojeISO()): Promise<FichaDoContrato | null> {
  const contrato = await repositorios.contrato.obter(id);
  if (!contrato) return null;
  const versoes = (await repositorios.contrato_versao.listar({ onde: { contrato_id: id } })).sort((a, b) => b.numero - a.numero);
  const vigente = versaoVigente(versoes, hoje) ?? versoes.find((versao) => versao.situacao === 'publicada') ?? null;
  const atual = versoes.find((versao) => versao.situacao === 'em_elaboracao') ?? vigente ?? versoes[0];
  if (!atual) return null;
  const [itens, regras, obrigacoes, signatarios, eventos, titulos, entidade, contraparte] = await Promise.all([repositorios.item_contrato.listar({ onde: { versao_id: atual.id } }), repositorios.regra_prazo.listar({ onde: { versao_id: atual.id } }), repositorios.obrigacao_contratual.listar({ onde: { versao_id: atual.id } }), repositorios.contrato_signatario.listar({ onde: { versao_id: atual.id } }), repositorios.evento_contrato.listar({ onde: { contrato_id: id } }), titulosDoContrato(id), repositorios.entidade.obter(contrato.entidade_id), repositorios.contraparte.obter(contrato.contraparte_id)]);
  return { contrato, versoes, atual, vigente, itens: itens.sort((a, b) => a.ordem - b.ordem), regras, obrigacoes, signatarios, eventos, titulos, entidade, contraparte };
}

export async function titulosDoContrato(contratoId: string): Promise<Titulo[]> {
  return (await repositorios.titulo.listar({ onde: { origem: 'contrato', origem_id: contratoId } })).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

// ---------- Situações derivadas (§3) ----------

export function inicioDaVigencia(versao: Pick<ContratoVersao, 'vigencia_inicio' | 'vigencia_inicio_evento' | 'vigencia_inicio_evento_nome'>, eventos: readonly Pick<EventoContrato, 'tipo' | 'nome' | 'data'>[]): string | null {
  if (versao.vigencia_inicio_evento === 'data_fixa') return versao.vigencia_inicio;
  const evento = eventos.find((item) => (versao.vigencia_inicio_evento === 'assinatura' ? item.tipo === 'assinatura' : item.tipo === 'outro' && item.nome === versao.vigencia_inicio_evento_nome));
  return evento?.data ?? null;
}

export function fimDaVigencia(contrato: Pick<Contrato, 'vigencia_prorrogada_ate'>, versao: Pick<ContratoVersao, 'vigencia_fim' | 'vigencia_duracao_meses' | 'vigencia_indeterminada'>, inicio: string | null): string | null {
  if (contrato.vigencia_prorrogada_ate) return contrato.vigencia_prorrogada_ate;
  if (versao.vigencia_indeterminada) return null;
  if (versao.vigencia_fim) return versao.vigencia_fim;
  return inicio && versao.vigencia_duracao_meses ? somarDias(somarMeses(inicio, versao.vigencia_duracao_meses), -1) : null;
}

export function situacaoDaVigencia(contrato: Pick<Contrato, 'encerrado_em' | 'suspensao' | 'vigencia_prorrogada_ate'>, vigente: ContratoVersao | null, eventos: readonly EventoContrato[], hoje: string): keyof typeof ROTULOS_VIGENCIA {
  if (!vigente) return 'sem_vigencia';
  if (contrato.encerrado_em && contrato.encerrado_em <= hoje) return 'encerrado';
  if (contrato.suspensao && contrato.suspensao.inicio <= hoje && (!contrato.suspensao.fim || contrato.suspensao.fim >= hoje)) return 'suspenso';
  const inicio = inicioDaVigencia(vigente, eventos);
  if (!inicio || inicio > hoje) return 'futuro';
  const fim = fimDaVigencia(contrato, vigente, inicio);
  return fim && fim < hoje ? 'encerrado' : 'vigente';
}

/** Derivada dos títulos do contrato (`vw_contrato_financeiro`). */
export function situacaoFinanceira(titulos: readonly Titulo[], baixas: readonly { titulo_id: string; tipo: 'pagamento' | 'estorno' | 'ajuste'; valor_moeda: number; arquivado_em: string | null }[], hoje: string): keyof typeof ROTULOS_FINANCEIRA {
  const validos = titulos.filter((titulo) => titulo.situacao !== 'cancelado' && !titulo.arquivado_em);
  if (!validos.length) return 'sem_programacao';
  const saldos = validos.map((titulo) => ({ titulo, saldo: saldoDoTitulo(titulo, baixas.filter((baixa) => baixa.titulo_id === titulo.id)) }));
  if (saldos.every((linha) => linha.saldo <= 0)) return 'quitado';
  if (saldos.some((linha) => linha.saldo > 0 && linha.titulo.vencimento < hoje && linha.titulo.situacao !== 'previsto')) return 'com_vencidos';
  return saldos.some((linha) => linha.saldo < linha.titulo.valor) ? 'parcial' : 'em_dia';
}

/** RN-11.21: data-limite = fim da vigência − aviso prévio. Sem renovação ou sem fim, não há data. */
export function dataLimiteDaRenovacao(contrato: Pick<Contrato, 'vigencia_prorrogada_ate'>, versao: ContratoVersao | null, eventos: readonly EventoContrato[]): string | null {
  if (!versao || !versao.condicoes.renovacao_tipo || versao.condicoes.renovacao_tipo === 'sem_renovacao') return null;
  const fim = fimDaVigencia(contrato, versao, inicioDaVigencia(versao, eventos));
  if (!fim) return null;
  return somarDias(fim, -(versao.condicoes.aviso_previo_dias ?? 0));
}

/** CA-11.10: o alerta vem antes da data-limite do aviso prévio (fim − aviso − antecedência), não no fim. */
export const ANTECEDENCIA_RENOVACAO_DIAS = 30;

// ---------- Edição do rascunho (T11.03) ----------

function exigirEdicao(versao: ContratoVersao | null | undefined): asserts versao is ContratoVersao {
  if (!versao) throw new ErroDeRegra('Esta versão não existe mais.');
  if (versao.situacao !== 'em_elaboracao' || versao.fluxo !== 'rascunho') throw new ErroDeRegra('Só o rascunho se edita. Devolva para rascunho antes, ou crie uma nova versão (RN-11.03).');
}

export async function salvarPartes(contratoId: string, partes: DadosDasPartes): Promise<void> {
  const contrato = await repositorios.contrato.obter(contratoId);
  if (!contrato) throw new ErroDeRegra('Este contrato não existe mais.');
  const versao = contrato.versao_elaboracao_id ? await repositorios.contrato_versao.obter(contrato.versao_elaboracao_id) : null;
  exigirEdicao(versao);
  // RN-11.02: trocar a entidade de um contrato assinado só por aditivo; aqui, as partes do original.
  if (contrato.versao_vigente_id && (partes.entidade_id !== contrato.entidade_id || partes.contraparte_id !== contrato.contraparte_id)) throw new ErroDeRegra('Trocar uma parte de contrato assinado só por aditivo (RN-11.12).');
  if (!partes.titulo.trim()) throw new ErroDeRegra('Informe o título.');
  await repositorios.contrato.atualizar(contratoId, { ...partes, titulo: partes.titulo.trim() });
}

export type DadosDaVersao = Partial<Pick<ContratoVersao, 'vigencia_inicio' | 'vigencia_inicio_evento' | 'vigencia_inicio_evento_nome' | 'vigencia_fim' | 'vigencia_duracao_meses' | 'vigencia_indeterminada' | 'condicoes' | 'modelo_versao_id' | 'dados_saas' | 'representante_contraparte_id' | 'data_efeito' | 'retroatividade_justificativa' | 'resumo_mudancas'>>;

export function errosDasCondicoes(condicoes: CondicoesContrato): string[] {
  const erros: string[] = [];
  if (condicoes.parcelas.length && Math.abs(condicoes.parcelas.reduce((total, parcela) => total + parcela.percentual, 0) - 100) > 0.001) erros.push('As parcelas precisam somar 100%.');
  for (const parcela of condicoes.parcelas) {
    if (parcela.gatilho === 'data' && !parcela.data) erros.push('Informe a data de cada parcela por data.');
    if (parcela.gatilho === 'evento' && !parcela.evento?.trim()) erros.push('Diga o evento de cada parcela por evento.');
  }
  if (condicoes.fidelidade_meses && !condicoes.fidelidade_motivo?.trim()) erros.push('Fidelidade só com motivo (contrapartida).');
  if (condicoes.renovacao_tipo === 'automatica' && !condicoes.renovacao_periodo_meses) erros.push('Renovação automática pede o período, em meses.');
  return [...new Set(erros)];
}

export async function salvarVersao(versaoId: string, dados: DadosDaVersao, hoje: string = hojeISO()): Promise<void> {
  const versao = await repositorios.contrato_versao.obter(versaoId);
  exigirEdicao(versao);
  if (dados.condicoes) {
    const erros = errosDasCondicoes(dados.condicoes);
    if (erros.length) throw new ErroDeRegra(erros[0] as string);
  }
  const fim = dados.vigencia_fim ?? versao.vigencia_fim;
  const inicio = dados.vigencia_inicio ?? versao.vigencia_inicio;
  if (fim && inicio && fim < inicio) throw new ErroDeRegra('O fim da vigência não pode ser antes do início.');
  const efeito = dados.data_efeito ?? versao.data_efeito;
  if (versao.tipo !== 'original' && efeito && efeito < hoje && !(dados.retroatividade_justificativa ?? versao.retroatividade_justificativa)?.trim()) throw new ErroDeRegra('Data de efeito no passado exige justificativa de retroatividade.');
  await repositorios.contrato_versao.atualizar(versaoId, dados);
}

export async function salvarItemDoContrato(versaoId: string, dados: DadosDoItem, itemId?: string, hoje: string = hojeISO()): Promise<ItemContrato> {
  const versao = await repositorios.contrato_versao.obter(versaoId);
  exigirEdicao(versao);
  const anterior = itemId ? await repositorios.item_contrato.obter(itemId) : null;
  const calculado = await calcularItem(dados, anterior ? { desconto_percentual: anterior.desconto_percentual, desconto_valor: anterior.desconto, desconto_justificativa: anterior.desconto_justificativa, desconto_por: anterior.desconto_por, desconto_em: anterior.desconto_em } : null, hoje);
  const item = { versao_id: versaoId, produto_id: calculado.produto_id, tipo_item: calculado.tipo_item, oferta_id: calculado.oferta_id, preco_versao_id: calculado.preco_versao_id, canal_id: calculado.canal_id, descricao: calculado.descricao, quantidade: calculado.quantidade, valor_unitario: calculado.valor_unitario, justificativa_valor: calculado.justificativa_valor, desconto_percentual: calculado.desconto_percentual, desconto: calculado.desconto_valor, desconto_justificativa: calculado.desconto_justificativa, desconto_por: calculado.desconto_por, desconto_em: calculado.desconto_em, valor_total: calculado.valor_total, recorrente: calculado.recorrente, periodicidade: calculado.periodicidade, inicio: calculado.inicio_previsto, fim: anterior?.fim ?? null, item_origem_id: anterior?.item_origem_id ?? null, proposta_item_id: anterior?.proposta_item_id ?? null, ordem: anterior?.ordem ?? (await repositorios.item_contrato.listar({ onde: { versao_id: versaoId } })).length };
  return itemId ? repositorios.item_contrato.atualizar(itemId, item) : repositorios.item_contrato.criar(item);
}

export async function removerItemDoContrato(itemId: string): Promise<void> {
  const item = await repositorios.item_contrato.obter(itemId);
  if (!item) return;
  exigirEdicao(await repositorios.contrato_versao.obter(item.versao_id));
  await repositorios.item_contrato.arquivar(itemId);
}

/** Itens como o modelo os usa: `desconto_valor` em vez de `desconto`, para o mesmo cálculo de totais. */
export const totaisDoContrato = (itens: readonly ItemContrato[]) => totaisDosItens(itens);

/** "Valor difere da proposta aceita" (T11.03, etapa 2). */
export async function diferencasDaProposta(itens: readonly ItemContrato[]): Promise<Record<string, string>> {
  const resultado: Record<string, string> = {};
  for (const item of itens) {
    if (!item.proposta_item_id) continue;
    const original = await repositorios.proposta_item.obter(item.proposta_item_id);
    if (original && original.valor_total !== item.valor_total) resultado[item.id] = `Valor difere da proposta aceita (${original.valor_total === null ? 'sem valor' : formatarDinheiro(original.valor_total, 'BRL')}).`;
  }
  return resultado;
}

export async function definirSignatarios(versaoId: string, parte: ContratoSignatario['parte'], pessoas: readonly string[]): Promise<void> {
  exigirEdicao(await repositorios.contrato_versao.obter(versaoId));
  await emTransacao(async () => {
    const atuais = await repositorios.contrato_signatario.listar({ onde: { versao_id: versaoId, parte } });
    const faltam = new Set(pessoas);
    for (const linha of atuais) {
      if (!faltam.has(linha.pessoa_id)) await repositorios.contrato_signatario.arquivar(linha.id);
      faltam.delete(linha.pessoa_id);
    }
    for (const pessoa_id of faltam) await repositorios.contrato_signatario.criar({ versao_id: versaoId, parte, pessoa_id, assinado_em: null });
  });
}

// ---------- Prazos e eventos (RN-11.13 e T11.08) ----------

export type DadosDaRegra = Pick<RegraPrazo, 'nome' | 'uso' | 'produto_id' | 'evento_referencia' | 'evento_nome' | 'data_fixa' | 'duracao' | 'unidade' | 'excecao_justificativa'>;

export async function salvarRegraDePrazo(versaoId: string, dados: DadosDaRegra, id?: string): Promise<RegraPrazo> {
  exigirEdicao(await repositorios.contrato_versao.obter(versaoId));
  if (!dados.nome.trim()) throw new ErroDeRegra('Dê um nome ao prazo.');
  if (dados.evento_referencia === 'data_fixa' ? !dados.data_fixa : !dados.duracao || !dados.unidade) throw new ErroDeRegra(dados.evento_referencia === 'data_fixa' ? 'Informe a data.' : 'Informe a duração e a unidade.');
  if (dados.evento_referencia === 'outro' && !dados.evento_nome?.trim()) throw new ErroDeRegra('Dê o nome do evento de referência.');
  return id ? repositorios.regra_prazo.atualizar(id, dados) : repositorios.regra_prazo.criar({ ...dados, versao_id: versaoId });
}

export async function removerRegraDePrazo(id: string): Promise<void> {
  const regra = await repositorios.regra_prazo.obter(id);
  if (!regra) return;
  exigirEdicao(await repositorios.contrato_versao.obter(regra.versao_id));
  await repositorios.regra_prazo.arquivar(id);
}

function somarDiasUteis(dia: string, dias: number, feriados: readonly Pick<Feriado, 'data'>[]): string {
  let atual = dia;
  let contados = 0;
  while (contados < dias) {
    atual = somarDias(atual, 1);
    if (ehDiaUtil(atual, feriados)) contados += 1;
  }
  return atual;
}

export type DataDoPrazo = { data: string; pendente: false } | { data: null; pendente: true; texto: string };

const eventoDaRegra = (regra: Pick<RegraPrazo, 'evento_referencia' | 'evento_nome' | 'produto_id'>, eventos: readonly Pick<EventoContrato, 'tipo' | 'nome' | 'produto_id' | 'data'>[]) => eventos.find((evento) => evento.tipo === regra.evento_referencia && (regra.evento_referencia !== 'outro' || evento.nome === regra.evento_nome) && (regra.evento_referencia !== 'entrega' || !regra.produto_id || evento.produto_id === regra.produto_id));

/** RN-11.13 e CA-11.07: sem o evento, "Pendente: aguardando [evento]", nunca estimado. Dias úteis seguem os feriados. */
export function calcularPrazo(regra: Pick<RegraPrazo, 'evento_referencia' | 'evento_nome' | 'produto_id' | 'data_fixa' | 'duracao' | 'unidade'>, eventos: readonly Pick<EventoContrato, 'tipo' | 'nome' | 'produto_id' | 'data'>[], feriados: readonly Pick<Feriado, 'data'>[]): DataDoPrazo {
  if (regra.evento_referencia === 'data_fixa') return regra.data_fixa ? { data: regra.data_fixa, pendente: false } : { data: null, pendente: true, texto: 'Pendente: sem data' };
  const evento = eventoDaRegra(regra, eventos);
  if (!evento) return { data: null, pendente: true, texto: `Pendente: aguardando ${regra.evento_referencia === 'outro' ? regra.evento_nome : ROTULOS_EVENTO[regra.evento_referencia]}` };
  const duracao = regra.duracao ?? 0;
  if (regra.unidade === 'meses') return { data: somarMeses(evento.data, duracao), pendente: false };
  if (regra.unidade === 'dias_uteis') return { data: somarDiasUteis(evento.data, duracao, feriados), pendente: false };
  return { data: somarDias(evento.data, duracao), pendente: false };
}

export function textoDaRegra(regra: Pick<RegraPrazo, 'evento_referencia' | 'evento_nome' | 'data_fixa' | 'duracao' | 'unidade'>): string {
  if (regra.evento_referencia === 'data_fixa') return regra.data_fixa ? formatarDiaISO(regra.data_fixa) : 'Data a definir';
  return `${regra.duracao ?? '?'} ${regra.unidade ? ROTULOS_UNIDADE[regra.unidade] : ''} após ${regra.evento_referencia === 'outro' ? regra.evento_nome : ROTULOS_EVENTO[regra.evento_referencia].toLowerCase()}`;
}

export type ImpactoDoEvento = { prazos: { nome: string; data: string }[]; obrigacoes: string[] };

/** T11.08: antes de confirmar, o que passa a ter data. */
export async function impactoDoEvento(contratoId: string, evento: Pick<EventoContrato, 'tipo' | 'nome' | 'produto_id' | 'data'>): Promise<ImpactoDoEvento> {
  const ficha = await carregarContrato(contratoId);
  if (!ficha) return { prazos: [], obrigacoes: [] };
  const feriados = await repositorios.feriado.listar();
  const regrasDaVigente = ficha.vigente ? await repositorios.regra_prazo.listar({ onde: { versao_id: ficha.vigente.id } }) : ficha.regras;
  const antes = new Map(regrasDaVigente.map((regra) => [regra.id, calcularPrazo(regra, ficha.eventos, feriados)]));
  const depois = regrasDaVigente.map((regra) => ({ regra, prazo: calcularPrazo(regra, [...ficha.eventos.filter((item) => !(item.tipo === evento.tipo && item.nome === evento.nome && item.produto_id === evento.produto_id)), evento], feriados) }));
  const prazos = depois.filter(({ regra, prazo }) => !prazo.pendente && antes.get(regra.id)?.data !== prazo.data).map(({ regra, prazo }) => ({ nome: regra.nome, data: prazo.data as string }));
  const obrigacoes = (ficha.vigente ? await repositorios.obrigacao_contratual.listar({ onde: { versao_id: ficha.vigente.id } }) : ficha.obrigacoes).filter((obrigacao) => obrigacao.regra_prazo_id && prazos.some((prazo) => regrasDaVigente.find((regra) => regra.id === obrigacao.regra_prazo_id)?.nome === prazo.nome)).map((obrigacao) => obrigacao.descricao);
  return { prazos, obrigacoes };
}

export async function registrarEvento(contratoId: string, dados: { tipo: EventoContrato['tipo']; nome: string; produto_id: string; data: string; evidencia_url: string; observacao: string }, hoje: string = hojeISO()): Promise<EventoContrato> {
  if (dados.tipo === 'assinatura') throw new ErroDeRegra('A assinatura é registrada em “Registrar assinatura”, com o arquivo assinado.');
  if (!dados.data || dados.data > hoje) throw new ErroDeRegra('Informe a data do evento, até hoje.');
  if (dados.tipo === 'outro' && !dados.nome.trim()) throw new ErroDeRegra('Dê o nome do evento.');
  if (dados.evidencia_url.trim() && !linkDoDriveValido(dados.evidencia_url.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  const nome = dados.tipo === 'outro' ? dados.nome.trim() : null;
  const produto_id = dados.tipo === 'entrega' ? dados.produto_id || null : null;
  const repetido = (await repositorios.evento_contrato.listar({ onde: { contrato_id: contratoId } })).find((evento) => evento.tipo === dados.tipo && evento.nome === nome && evento.produto_id === produto_id);
  if (repetido) throw new ErroDeRegra('Este evento já foi registrado. Para mudar a data, use “Corrigir data”, com o motivo (RN-11.14).');
  const evento = await repositorios.evento_contrato.criar({ contrato_id: contratoId, tipo: dados.tipo, nome, produto_id, data: dados.data, confirmado_por: idDaPessoaAtual() ?? 'sistema', evidencia_url: dados.evidencia_url.trim() || null, observacao: dados.observacao.trim() || null, corrigido_de: null, correcao_motivo: null });
  await sincronizarAlertasSeguro();
  return evento;
}

/** RN-11.14: corrigir a data de evento confirmado pede motivo; mudar a regra exige aditivo. */
export async function corrigirEvento(eventoId: string, novaData: string, motivo: string, hoje: string = hojeISO()): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Corrigir a data exige motivo.');
  if (!novaData || novaData > hoje) throw new ErroDeRegra('Informe a nova data, até hoje.');
  const evento = await repositorios.evento_contrato.obter(eventoId);
  if (!evento) throw new ErroDeRegra('Este evento não existe mais.');
  if (evento.tipo === 'assinatura') throw new ErroDeRegra('A data da assinatura segue o arquivo assinado e não se corrige aqui.');
  await repositorios.evento_contrato.atualizar(eventoId, { data: novaData, corrigido_de: evento.data, correcao_motivo: motivo.trim() }, { motivo: motivo.trim() });
  await sincronizarAlertasSeguro();
}

// ---------- Obrigações (RN-11.16) ----------

export type DadosDaObrigacao = Pick<ObrigacaoContratual, 'parte' | 'descricao' | 'clausula_ref' | 'prazo_data' | 'regra_prazo_id' | 'responsavel_id' | 'criterio' | 'depende_de'>;

/** Dependências sem ciclo. */
export function temCiclo(obrigacoes: readonly Pick<ObrigacaoContratual, 'id' | 'depende_de'>[]): boolean {
  const mapa = new Map(obrigacoes.map((obrigacao) => [obrigacao.id, obrigacao.depende_de]));
  const visitando = new Set<string>();
  const feitos = new Set<string>();
  const visitar = (id: string): boolean => {
    if (visitando.has(id)) return true;
    if (feitos.has(id)) return false;
    visitando.add(id);
    const ciclo = (mapa.get(id) ?? []).some(visitar);
    visitando.delete(id);
    feitos.add(id);
    return ciclo;
  };
  return [...mapa.keys()].some(visitar);
}

export async function salvarObrigacao(versaoId: string, dados: DadosDaObrigacao, id?: string): Promise<ObrigacaoContratual> {
  exigirEdicao(await repositorios.contrato_versao.obter(versaoId));
  if (!dados.descricao.trim()) throw new ErroDeRegra('Descreva a obrigação.');
  if (!dados.responsavel_id) throw new ErroDeRegra('Escolha a responsável interna.');
  const outras = (await repositorios.obrigacao_contratual.listar({ onde: { versao_id: versaoId } })).filter((obrigacao) => obrigacao.id !== id);
  if (temCiclo([...outras, { id: id ?? 'nova', depende_de: dados.depende_de }])) throw new ErroDeRegra('Estas dependências formam um ciclo.');
  return id ? repositorios.obrigacao_contratual.atualizar(id, dados) : repositorios.obrigacao_contratual.criar({ ...dados, versao_id: versaoId, situacao: 'pendente', cumprida_em: null, evidencia_url: null, dispensada_motivo: null });
}

export async function removerObrigacao(id: string): Promise<void> {
  const obrigacao = await repositorios.obrigacao_contratual.obter(id);
  if (!obrigacao) return;
  exigirEdicao(await repositorios.contrato_versao.obter(obrigacao.versao_id));
  await repositorios.obrigacao_contratual.arquivar(id);
}

export async function cumprirObrigacao(id: string, { data, evidencia }: { data: string; evidencia: string }, hoje: string = hojeISO()): Promise<void> {
  if (!data || data > hoje) throw new ErroDeRegra('Informe quando foi cumprida, até hoje.');
  if (evidencia.trim() && !linkDoDriveValido(evidencia.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  const obrigacao = await repositorios.obrigacao_contratual.obter(id);
  if (obrigacao?.situacao !== 'pendente') throw new ErroDeRegra('Esta obrigação já foi resolvida.');
  const dependencias = await Promise.all(obrigacao.depende_de.map((dependencia) => repositorios.obrigacao_contratual.obter(dependencia)));
  if (dependencias.some((dependencia) => dependencia && dependencia.situacao === 'pendente')) throw new ErroDeRegra('Há obrigação anterior, da qual esta depende, ainda pendente.');
  await repositorios.obrigacao_contratual.atualizar(id, { situacao: 'cumprida', cumprida_em: data, evidencia_url: evidencia.trim() || null });
  await sincronizarAlertasSeguro();
}

export async function dispensarObrigacao(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Dispensar exige motivo.');
  const obrigacao = await repositorios.obrigacao_contratual.obter(id);
  if (obrigacao?.situacao !== 'pendente') throw new ErroDeRegra('Esta obrigação já foi resolvida.');
  await repositorios.obrigacao_contratual.atualizar(id, { situacao: 'dispensada', dispensada_motivo: motivo.trim() }, { motivo: motivo.trim() });
  await sincronizarAlertasSeguro();
}

export function prazoDaObrigacao(obrigacao: Pick<ObrigacaoContratual, 'prazo_data' | 'regra_prazo_id'>, regras: readonly RegraPrazo[], eventos: readonly EventoContrato[], feriados: readonly Pick<Feriado, 'data'>[]): DataDoPrazo {
  if (obrigacao.prazo_data) return { data: obrigacao.prazo_data, pendente: false };
  const regra = regras.find((item) => item.id === obrigacao.regra_prazo_id);
  return regra ? calcularPrazo(regra, eventos, feriados) : { data: null, pendente: true, texto: 'Sem prazo' };
}

export function situacaoDaObrigacao(obrigacao: Pick<ObrigacaoContratual, 'situacao'>, prazo: DataDoPrazo, hoje: string): 'pendente' | 'cumprida' | 'atrasada' | 'dispensada' {
  if (obrigacao.situacao !== 'pendente') return obrigacao.situacao;
  return !prazo.pendente && prazo.data < hoje ? 'atrasada' : 'pendente';
}

// ---------- Pendências (T11.04) ----------

export async function pendenciasDoContrato(ficha: FichaDoContrato, hoje: string = hojeISO()): Promise<Pendencia[]> {
  const { contrato, atual, itens } = ficha;
  const pendencias: Pendencia[] = [];
  const bloqueia = (id: string, mensagem: string, etapa: string, oQue = 'emissão final', href?: string) => pendencias.push({ id, mensagem, tipo: 'bloqueia', bloqueia: oQue, etapa, ...(href ? { href } : {}) });
  const avisa = (id: string, mensagem: string, etapa: string) => pendencias.push({ id, mensagem, tipo: 'aviso', etapa });
  if (ficha.entidade) for (const [indice, mensagem] of pendenciasDaEntidade(ficha.entidade, await repositorios.entidade_licenciante.listar({ onde: { entidade_id: ficha.entidade.id } })).entries()) bloqueia(`entidade-${indice}`, mensagem, 'partes', 'emissão final', '/configuracoes/cadastros/entidades');
  for (const [indice, mensagem] of pendenciasDaContraparte(ficha.contraparte).entries()) bloqueia(`contraparte-${indice}`, mensagem, 'partes', 'emissão final', ficha.contraparte ? `/configuracoes/cadastros/contrapartes/${ficha.contraparte.id}` : undefined);
  if (!contrato.saas) {
    if (!itens.length && !SEM_VALOR(contrato)) bloqueia('sem-itens', 'Inclua pelo menos um item.', 'itens', 'envio para revisão');
    const catalogo = catalogoComercial();
    for (const item of itens) {
      if (item.tipo_item === 'oferta') {
        const oferta = item.oferta_id ? await catalogo.oferta(item.oferta_id) : null;
        if (!oferta || oferta.situacao !== 'aprovada') bloqueia(`oferta-${item.id}`, `${item.descricao}: oferta não aprovada no catálogo.`, 'itens');
      }
      if (item.valor_unitario === null) bloqueia(`valor-${item.id}`, `${item.descricao}: valor vazio.`, 'itens');
      if ((item.desconto || item.desconto_percentual) && !item.desconto_justificativa) bloqueia(`desc-${item.id}`, `${item.descricao}: desconto sem justificativa (RN-10.09).`, 'itens');
      if (item.tipo_item === 'sob_medida' && contrato.proposta_versao_id) {
        const proposta = (await repositorios.proposta.listar()).find((linha) => linha.versao_aceita_id === contrato.proposta_versao_id);
        if (proposta && !(await repositorios.viabilidade.listar({ onde: { oportunidade_id: proposta.oportunidade_id } })).length) avisa(`viab-${item.id}`, `Viabilidade ausente para ${item.descricao}.`, 'itens');
      }
    }
    if (!atual.modelo_versao_id) bloqueia('modelo', 'Escolha o modelo do documento.', 'documento');
    if (!atual.vigencia_indeterminada && !atual.vigencia_fim && !atual.vigencia_duracao_meses) bloqueia('vigencia', 'Defina o fim da vigência: data, duração ou indeterminado.', 'prazos', 'envio para revisão');
    if (atual.vigencia_inicio_evento === 'data_fixa' && !atual.vigencia_inicio) bloqueia('inicio', 'Informe a data de início da vigência.', 'prazos', 'envio para revisão');
    if (!atual.condicoes.forma_pagamento && !SEM_VALOR(contrato)) bloqueia('pagamento', 'Escolha a forma de pagamento.', 'condicoes');
    if (!atual.condicoes.renovacao_tipo) bloqueia('renovacao', 'Diga como é a renovação. Ela não é presumida (RN-11.21).', 'condicoes');
  }
  if (!ficha.signatarios.some((linha) => linha.parte === 'numa')) bloqueia('sig-numa', 'Escolha quem assina pela Numa.', contrato.saas ? 'assinatura' : 'partes');
  if (ficha.contraparte?.tipo_pessoa === 'pj' && !atual.representante_contraparte_id && !ficha.signatarios.some((linha) => linha.parte === 'contraparte')) bloqueia('sig-contraparte', 'Escolha quem assina pela contraparte.', contrato.saas ? 'produto' : 'partes');
  if (atual.modelo_versao_id) {
    const modelo = await repositorios.modelo_versao.obter(atual.modelo_versao_id);
    if (modelo && modelo.situacao !== 'validada') avisa('modelo-nao-validado', 'Modelo não validado: a emissão final pede confirmação e motivo (RN-09.13).', 'documento');
    if (contrato.familia === 'fornecedor' && modelo && !(await modeloTemProtecaoDeDados(modelo.estrutura))) {
      const ferramentas = await repositorios.ferramenta.listar({ onde: { fornecedor_id: contrato.contraparte_id } });
      if (ferramentas.some((ferramenta) => ferramenta.trata_dados_pessoais)) avisa('lgpd', 'Fornecedor trata dados pessoais e o modelo não tem cláusula de proteção de dados (RN-11.28).', 'documento');
    }
  }
  if (atual.tipo !== 'original') {
    if (!atual.data_efeito) bloqueia('efeito', 'Informe a data de efeito.', 'partes', 'aprovação');
    else if (ficha.versoes.some((versao) => versao.id !== atual.id && versao.situacao === 'publicada' && versao.data_efeito && versao.data_efeito > (atual.data_efeito as string))) bloqueia('conflito', 'Conflito de vigência: há versão publicada com efeito posterior.', 'partes', 'aprovação');
    if (atual.data_efeito && atual.data_efeito < hoje && !atual.retroatividade_justificativa) bloqueia('retro', 'Data de efeito no passado exige justificativa.', 'partes', 'aprovação');
  }
  return pendencias;
}

async function modeloTemProtecaoDeDados(estrutura: readonly { tipo: string; clausula_versao_id: string | null; blocos: readonly unknown[] }[]): Promise<boolean> {
  const versoes = await repositorios.clausula_versao.listar();
  const clausulas = await repositorios.clausula.listar();
  const ids = JSON.stringify(estrutura).match(/"clausula_versao_id":"([^"]+)"/g)?.map((trecho) => trecho.split('"')[3]) ?? [];
  return ids.some((id) => clausulas.find((clausula) => clausula.id === versoes.find((versao) => versao.id === id)?.clausula_id)?.categoria === 'protecao_dados');
}

export const bloqueiaAlgo = (pendencias: readonly Pendencia[], oQue?: string) => pendencias.some((pendencia) => pendencia.tipo === 'bloqueia' && (!oQue || pendencia.bloqueia === oQue));

// ---------- Documento (T11.05) ----------

async function dadosDoModeloDoContrato(ficha: FichaDoContrato, hoje: string) {
  const { contrato, atual, itens, entidade } = ficha;
  const [licenciantes, socias, representantes, pessoas] = await Promise.all([repositorios.entidade_licenciante.listar({ onde: { entidade_id: contrato.entidade_id } }), repositorios.entidade_socias.listar({ onde: { entidade_id: contrato.entidade_id } }), repositorios.entidade_representante.listar({ onde: { entidade_id: contrato.entidade_id } }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  const pessoa = (id: string | null) => pessoas.find((item) => item.id === id) ?? null;
  const inicio = inicioDaVigencia(atual, ficha.eventos);
  const fim = fimDaVigencia(contrato, atual, inicio);
  return {
    contrato: { codigo: contrato.codigo, titulo: contrato.titulo, familia_texto: ROTULOS_FAMILIA[contrato.familia], data_inicio: inicio ? formatarDiaISO(inicio) : null, vigencia_texto: atual.vigencia_indeterminada ? 'por prazo indeterminado' : fim ? `até ${formatarDiaISO(fim)}` : atual.vigencia_duracao_meses ? `por ${atual.vigencia_duracao_meses} meses` : null, data_emissao_extenso: dataPorExtenso(hoje) },
    entidade: dadosDaEntidadeNoModelo(entidade, licenciantes, socias[0]?.marca_comercial ?? null, pessoas.filter((item) => representantes.some((ligacao) => ligacao.pessoa_id === item.id))),
    contraparte: dadosDaContraparteNoModelo(ficha.contraparte, pessoa(atual.representante_contraparte_id) ?? pessoa(ficha.signatarios.find((linha) => linha.parte === 'contraparte')?.pessoa_id ?? null)),
    itens: itens.map((item) => ({ descricao: item.descricao, quantidade: item.quantidade.toLocaleString('pt-BR'), valor_formatado: item.valor_total === null ? null : formatarDinheiro(item.valor_total, contrato.moeda), periodicidade_texto: item.periodicidade ? ROTULOS_PERIODICIDADE_VALOR[item.periodicidade] : null })),
    totais_texto: linhasDosTotais(totaisDosItens(itens), contrato.moeda).join(' · ') || null,
    hoje_extenso: dataPorExtenso(hoje),
    assinaturas: ficha.signatarios.map((linha) => ({ nome: pessoa(linha.pessoa_id)?.nome_completo ?? null, papel: linha.parte === 'numa' ? 'Pela Numa' : 'Pela contraparte' })),
  };
}

export type DocumentoDoContrato = { nos: ReturnType<typeof renderizarVersao>['nos']; dados: unknown; faltando: string[]; pendencias: Pendencia[] };

/** Monta o documento e as pendências. SaaS usa `contrato-saas.ts`, que chega aqui pelo mesmo caminho. */
export async function montarDocumentoDoContrato(ficha: FichaDoContrato, hoje: string = hojeISO()): Promise<DocumentoDoContrato> {
  if (ficha.contrato.saas) {
    const { montarDocumentoSaas } = await import('./contrato-saas');
    return montarDocumentoSaas(ficha, hoje);
  }
  const pendencias = await pendenciasDoContrato(ficha, hoje);
  const modelo = ficha.atual.modelo_versao_id ? await repositorios.modelo_versao.obter(ficha.atual.modelo_versao_id) : null;
  const dados = await dadosDoModeloDoContrato(ficha, hoje);
  if (!modelo) return { nos: [], dados, faltando: [], pendencias };
  const documento = renderizarVersao(modelo, await repositorios.clausula_versao.listar(), dados);
  for (const nome of documento.faltando) pendencias.push({ id: `var-${nome}`, mensagem: `Variável obrigatória vazia: ${nome}.`, tipo: 'bloqueia', bloqueia: 'emissão final', etapa: 'documento' });
  return { nos: documento.nos, dados, faltando: documento.faltando, pendencias };
}

/** T11.05 e CA-11.04: emissões numeradas, cada uma com o próprio texto. O final só depois de enviar para revisão. */
export async function emitirContrato(contratoId: string, final: boolean, opcoes: { confirmarModeloNaoValidado?: boolean; motivo?: string } = {}, hoje: string = hojeISO()) {
  const ficha = await carregarContrato(contratoId, hoje);
  if (!ficha) throw new ErroDeRegra('Este contrato não existe mais.');
  const { atual } = ficha;
  if (atual.situacao !== 'em_elaboracao') throw new ErroDeRegra('Esta versão já foi publicada. Para mudar, crie um aditivo.');
  if (final && atual.fluxo !== 'em_revisao') throw new ErroDeRegra(atual.fluxo === 'rascunho' ? 'Envie para revisão antes de emitir o final: é na revisão que os dados são conferidos.' : 'O documento final já foi aprovado ou enviado. Devolva para rascunho para emitir outro.');
  const documento = await montarDocumentoDoContrato(ficha, hoje);
  if (!atual.modelo_versao_id) throw new ErroDeRegra('Escolha o modelo antes de emitir.');
  if (final && bloqueiaAlgo(documento.pendencias, 'emissão final')) throw new ErroDeRegra(documento.pendencias.find((pendencia) => pendencia.tipo === 'bloqueia' && pendencia.bloqueia === 'emissão final')?.mensagem as string);
  const modelo = await repositorios.modelo_versao.obter(atual.modelo_versao_id);
  const modeloDocumento = modelo ? await repositorios.modelo_documento.obter(modelo.modelo_id) : null;
  return emitirDocumento({ registroTipo: 'contrato_versao', registroId: atual.id, modeloVersao: modelo, modeloCodigo: modeloDocumento?.codigo ?? null, final, nos: documento.nos, dados: documento.dados, confirmarModeloNaoValidado: opcoes.confirmarModeloNaoValidado, motivo: opcoes.motivo, titulo: `${ficha.contrato.codigo} V${atual.numero}` });
}

// ---------- Fluxo documental (RN-11.06 a RN-11.10) ----------

async function atualizarFluxo(ficha: FichaDoContrato, fluxo: ContratoVersao['fluxo'], extra: Partial<ContratoVersao> = {}, motivo?: string) {
  await repositorios.contrato_versao.atualizar(ficha.atual.id, { fluxo, ...extra }, motivo ? { motivo } : {});
  // A situação documental do contrato segue o original; depois da assinatura, continua Assinado (§3).
  if (!ficha.contrato.versao_vigente_id) await repositorios.contrato.atualizar(ficha.contrato.id, { situacao_documental: fluxo }, motivo ? { motivo } : {});
}

async function fichaOuErro(contratoId: string, hoje: string): Promise<FichaDoContrato> {
  const ficha = await carregarContrato(contratoId, hoje);
  if (!ficha) throw new ErroDeRegra('Este contrato não existe mais.');
  if (ficha.atual.situacao !== 'em_elaboracao') throw new ErroDeRegra('Não há versão em andamento neste contrato.');
  return ficha;
}

export async function enviarParaRevisao(contratoId: string, hoje: string = hojeISO()): Promise<void> {
  const ficha = await fichaOuErro(contratoId, hoje);
  if (ficha.atual.fluxo !== 'rascunho') throw new ErroDeRegra('Só o rascunho vai para revisão.');
  const pendencias = await pendenciasDoContrato(ficha, hoje);
  const impede = pendencias.find((pendencia) => pendencia.tipo === 'bloqueia' && pendencia.bloqueia === 'envio para revisão');
  if (impede) throw new ErroDeRegra(impede.mensagem);
  await atualizarFluxo(ficha, 'em_revisao');
}

/** RN-11.07 e decisão 5: aprova o documento final já emitido, sem pendência bloqueante. Registra quem aprovou. */
export async function aprovarParaEnvio(contratoId: string, hoje: string = hojeISO()): Promise<void> {
  const ficha = await fichaOuErro(contratoId, hoje);
  if (ficha.atual.fluxo !== 'em_revisao') throw new ErroDeRegra('Só a versão em revisão é aprovada para envio.');
  const finais = (await repositorios.documento_emitido.listar({ onde: { registro_id: ficha.atual.id, final: true } })).sort((a, b) => b.numero_emissao - a.numero_emissao);
  if (!finais.length) throw new ErroDeRegra('Emita o documento final antes de aprovar para envio.');
  const pendencias = (await montarDocumentoDoContrato(ficha, hoje)).pendencias;
  const impede = pendencias.find((pendencia) => pendencia.tipo === 'bloqueia');
  if (impede) throw new ErroDeRegra(impede.mensagem);
  await atualizarFluxo(ficha, 'aprovado_envio', { aprovada_envio_por: idDaPessoaAtual(), aprovada_envio_em: new Date().toISOString(), enviada_documento_id: finais[0]?.id ?? null });
}

export async function devolverParaRascunho(contratoId: string, motivo: string, hoje: string = hojeISO()): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Devolver exige motivo (RN-11.08).');
  const ficha = await fichaOuErro(contratoId, hoje);
  if (ficha.atual.fluxo !== 'em_revisao' && ficha.atual.fluxo !== 'aprovado_envio' && ficha.atual.fluxo !== 'enviado_assinatura') throw new ErroDeRegra('Esta versão já está em rascunho.');
  await atualizarFluxo(ficha, 'rascunho', { devolucao_motivo: motivo.trim(), aprovada_envio_por: null, aprovada_envio_em: null }, motivo.trim());
}

export async function registrarEnvioParaAssinatura(contratoId: string, { data, canal, destinatarios }: { data: string; canal: string; destinatarios: string }, hoje: string = hojeISO()): Promise<void> {
  const ficha = await fichaOuErro(contratoId, hoje);
  if (ficha.atual.fluxo !== 'aprovado_envio') throw new ErroDeRegra('Aprove para envio antes de registrar o envio.');
  if (!data || data > hoje) throw new ErroDeRegra('Informe a data do envio, até hoje.');
  if (!canal.trim()) throw new ErroDeRegra('Diga por onde foi enviado.');
  if (!destinatarios.trim()) throw new ErroDeRegra('Diga para quem foi enviado.');
  await emTransacao(async () => {
    await atualizarFluxo(ficha, 'enviado_assinatura', { enviada_em: data, enviada_canal: canal.trim(), enviada_destinatarios: destinatarios.trim() });
    if (ficha.atual.enviada_documento_id) await repositorios.documento_emitido.atualizar(ficha.atual.enviada_documento_id, { enviado: true });
  });
  await sincronizarAlertasSeguro();
}

/** Arquivo assinado: o arquivo e a versão específica, nunca a pasta (T11.06). */
export function arquivoAssinadoValido(url: string): boolean {
  return linkDoDriveValido(url) && !/\/(drive\/)?folders\//.test(url) && !/[?&]folder/.test(url);
}

/**
 * RN-11.09 e CA-11.05: assinatura por parte, com data, arquivo assinado (não a pasta) e evidência. Publica a versão
 * com o snapshot das partes (RN-11.04) e registra o evento "Assinatura" (RN-11.13).
 */
export async function registrarAssinatura(contratoId: string, { datas, arquivoUrl, evidenciaUrl }: { datas: Record<string, string>; arquivoUrl: string; evidenciaUrl: string }, hoje: string = hojeISO()): Promise<void> {
  const ficha = await fichaOuErro(contratoId, hoje);
  if (ficha.atual.fluxo !== 'enviado_assinatura') throw new ErroDeRegra('Registre o envio para assinatura antes.');
  if (!arquivoUrl.trim()) throw new ErroDeRegra('Cole o link do arquivo assinado.');
  if (!arquivoAssinadoValido(arquivoUrl.trim())) throw new ErroDeRegra('Use o link do arquivo assinado no Drive, não o de uma pasta.');
  if (!evidenciaUrl.trim()) throw new ErroDeRegra('Cole o link da evidência da assinatura.');
  if (!linkDoDriveValido(evidenciaUrl.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  if (!ficha.signatarios.length) throw new ErroDeRegra('Não há signatários nesta versão.');
  for (const signatario of ficha.signatarios) {
    const data = datas[signatario.id];
    if (!data) throw new ErroDeRegra('Informe a data de assinatura de cada parte.');
    if (data > hoje) throw new ErroDeRegra('A data de assinatura não pode ser futura.');
  }
  const ultima = Object.values(datas).sort().at(-1) as string;
  const [licenciantes, pessoas] = await Promise.all([repositorios.entidade_licenciante.listar({ onde: { entidade_id: ficha.contrato.entidade_id } }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  await emTransacao(async () => {
    for (const signatario of ficha.signatarios) await repositorios.contrato_signatario.atualizar(signatario.id, { assinado_em: datas[signatario.id] as string });
    const snapshot = { entidade: ficha.entidade, licenciantes, contraparte: ficha.contraparte, itens: ficha.itens, condicoes: ficha.atual.condicoes, dados_saas: ficha.atual.dados_saas, regras: ficha.regras, obrigacoes: ficha.obrigacoes, modelo_versao_id: ficha.atual.modelo_versao_id, documento_id: ficha.atual.enviada_documento_id, signatarios: ficha.signatarios.map((linha) => ({ ...linha, nome: pessoas.find((pessoa) => pessoa.id === linha.pessoa_id)?.nome_completo ?? null, assinado_em: datas[linha.id] })) };
    await repositorios.contrato_versao.atualizar(ficha.atual.id, { situacao: 'publicada', fluxo: 'assinado', snapshot: snapshot as unknown as Record<string, unknown>, assinado_arquivo_url: arquivoUrl.trim(), assinatura_evidencia_url: evidenciaUrl.trim(), assinatura_confirmada_por: idDaPessoaAtual(), assinatura_confirmada_em: new Date().toISOString(), publicada_em: new Date().toISOString(), publicada_por: idDaPessoaAtual(), data_efeito: ficha.atual.data_efeito ?? ultima });
    const renovacaoAssinada = ficha.atual.tipo === 'renovacao';
    await repositorios.contrato.atualizar(ficha.contrato.id, { situacao_documental: 'assinado', versao_vigente_id: ficha.atual.id, versao_elaboracao_id: null, renovacao_situacao: renovacaoAssinada ? 'renovado' : ficha.atual.condicoes.renovacao_tipo && ficha.atual.condicoes.renovacao_tipo !== 'sem_renovacao' ? 'em_analise' : 'nao_se_aplica', ...(renovacaoAssinada ? { vigencia_prorrogada_ate: null } : {}) });
    if (ficha.atual.tipo === 'original') await repositorios.evento_contrato.criar({ contrato_id: ficha.contrato.id, tipo: 'assinatura', nome: null, produto_id: null, data: ultima, confirmado_por: idDaPessoaAtual() ?? 'sistema', evidencia_url: evidenciaUrl.trim(), observacao: null, corrigido_de: null, correcao_motivo: null });
  });
  await sincronizarAlertasSeguro();
}

export async function registrarRecusaDoContrato(contratoId: string, motivo: string, hoje: string = hojeISO()): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Recusa exige motivo.');
  const ficha = await fichaOuErro(contratoId, hoje);
  if (ficha.atual.fluxo !== 'enviado_assinatura') throw new ErroDeRegra('Só a versão enviada para assinatura é recusada.');
  await atualizarFluxo(ficha, 'recusado', { recusa_motivo: motivo.trim() }, motivo.trim());
  await sincronizarAlertasSeguro();
}

/** RN-11.10: cancelar só o que não foi assinado. Assinado se encerra (RN-11.24). */
export async function cancelarContrato(contratoId: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Cancelar exige motivo.');
  const contrato = await repositorios.contrato.obter(contratoId);
  if (!contrato) throw new ErroDeRegra('Este contrato não existe mais.');
  if (contrato.versao_vigente_id) throw new ErroDeRegra('Contrato assinado não é cancelado: use Encerrar.');
  await emTransacao(async () => {
    if (contrato.versao_elaboracao_id) await repositorios.contrato_versao.atualizar(contrato.versao_elaboracao_id, { situacao: 'cancelada', fluxo: 'cancelado' }, { motivo: motivo.trim() });
    await repositorios.contrato.atualizar(contratoId, { situacao_documental: 'cancelado', cancelado_motivo: motivo.trim(), versao_elaboracao_id: null }, { motivo: motivo.trim() });
  });
  await sincronizarAlertasSeguro();
}

// ---------- Aditivo e correção administrativa (T11.09) ----------

const semControle = <T extends Record<string, unknown>>(linha: T) => {
  const { id: _id, criado_em: _c, criado_por: _cp, atualizado_em: _a, atualizado_por: _ap, arquivado_em: _ar, arquivado_por: _arp, versao_registro: _v, exemplo: _e, ...resto } = linha;
  return resto;
};

/** RN-11.12 e CA-11.08: mudança de escopo, preço, prazo, parte ou obrigação depois da assinatura é aditivo; a anterior fica intacta. */
export async function criarAditivo(contratoId: string, { tipo, dataEfeito, justificativa, resumo }: { tipo: 'aditivo' | 'renovacao'; dataEfeito: string; justificativa: string; resumo: string }, hoje: string = hojeISO()): Promise<ContratoVersao> {
  const ficha = await carregarContrato(contratoId, hoje);
  if (!ficha?.vigente) throw new ErroDeRegra('Só contrato assinado recebe aditivo.');
  if (ficha.contrato.versao_elaboracao_id) throw new ErroDeRegra('Já existe uma versão em elaboração (RN-11.03).');
  if (ficha.contrato.encerrado_em) throw new ErroDeRegra('Contrato encerrado não recebe aditivo.');
  if (!dataEfeito) throw new ErroDeRegra('Informe a data de efeito.');
  if (dataEfeito < hoje && !justificativa.trim()) throw new ErroDeRegra('Data de efeito no passado exige justificativa de retroatividade.');
  const base = ficha.vigente;
  const [itens, regras, obrigacoes, signatarios] = await Promise.all([repositorios.item_contrato.listar({ onde: { versao_id: base.id } }), repositorios.regra_prazo.listar({ onde: { versao_id: base.id } }), repositorios.obrigacao_contratual.listar({ onde: { versao_id: base.id } }), repositorios.contrato_signatario.listar({ onde: { versao_id: base.id } })]);
  return emTransacao(async () => {
    const copia = semControle(base);
    const nova = await repositorios.contrato_versao.criar({ ...versaoNova(contratoId, Math.max(...ficha.versoes.map((versao) => versao.numero)) + 1, tipo), vigencia_inicio: copia.vigencia_inicio, vigencia_inicio_evento: copia.vigencia_inicio_evento, vigencia_inicio_evento_nome: copia.vigencia_inicio_evento_nome, vigencia_fim: copia.vigencia_fim, vigencia_duracao_meses: copia.vigencia_duracao_meses, vigencia_indeterminada: copia.vigencia_indeterminada, condicoes: copia.condicoes, dados_saas: copia.dados_saas, modelo_versao_id: null, representante_contraparte_id: copia.representante_contraparte_id, data_efeito: dataEfeito, retroatividade_justificativa: justificativa.trim() || null, resumo_mudancas: resumo.trim() || null });
    const mapaRegras = new Map<string, string>();
    for (const regra of regras) mapaRegras.set(regra.id, (await repositorios.regra_prazo.criar({ ...semControle(regra), versao_id: nova.id })).id);
    for (const item of itens) await repositorios.item_contrato.criar({ ...semControle(item), versao_id: nova.id, item_origem_id: item.id });
    for (const obrigacao of obrigacoes) await repositorios.obrigacao_contratual.criar({ ...semControle(obrigacao), versao_id: nova.id, regra_prazo_id: obrigacao.regra_prazo_id ? (mapaRegras.get(obrigacao.regra_prazo_id) ?? null) : null, depende_de: [] });
    for (const signatario of signatarios) await repositorios.contrato_signatario.criar({ versao_id: nova.id, parte: signatario.parte, pessoa_id: signatario.pessoa_id, assinado_em: null });
    await repositorios.contrato.atualizar(contratoId, { versao_elaboracao_id: nova.id });
    return nova;
  });
}

/** RN-11.11: só o que não tem efeito contratual; o snapshot e o arquivo assinado não mudam. */
export async function correcaoAdministrativa(contratoId: string, dados: Contrato['administrativo'], motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Correção administrativa exige motivo.');
  const contrato = await repositorios.contrato.obter(contratoId);
  if (!contrato?.versao_vigente_id) throw new ErroDeRegra('Correção administrativa é para contrato assinado. No rascunho, edite direto.');
  await repositorios.contrato.atualizar(contratoId, { administrativo: dados }, { motivo: motivo.trim() });
}

/** CA-11.02: "dado atual difere do assinado", sem mudar o snapshot. */
export function diferencasDoAssinado(vigente: ContratoVersao | null, contraparte: Contraparte | null, entidade: Entidade | null): string[] {
  const snapshot = vigente?.snapshot as { contraparte?: Contraparte | null; entidade?: Entidade | null } | null;
  if (!snapshot) return [];
  const diferencas: string[] = [];
  const comparar = (rotulo: string, antes: unknown, depois: unknown) => {
    if (JSON.stringify(antes ?? null) !== JSON.stringify(depois ?? null)) diferencas.push(rotulo);
  };
  if (contraparte && snapshot.contraparte) {
    comparar('endereço da contraparte', snapshot.contraparte.endereco, contraparte.endereco);
    comparar('e-mail da contraparte', snapshot.contraparte.email, contraparte.email);
    comparar('nome da contraparte', snapshot.contraparte.nome, contraparte.nome);
    comparar('documento da contraparte', snapshot.contraparte.documento, contraparte.documento);
  }
  if (entidade && snapshot.entidade) {
    comparar('endereço da entidade', snapshot.entidade.endereco, entidade.endereco);
    comparar('nome da entidade', snapshot.entidade.nome, entidade.nome);
  }
  return diferencas;
}

// ---------- Programação financeira (RN-11.17, RN-11.18 e T11.07) ----------

export const JANELA_MESES = 12;

export type LinhaDaProgramacao = { chave: string; itemId: string; descricao: string; periodo_inicio: string; periodo_fim: string; competencia: string; vencimento: string; valor: number; natureza: Titulo['natureza']; jaGerado: boolean; aviso: string | null; produtoId: string | null; recorrente: boolean };
export type PrevisaoDaProgramacao = { linhas: LinhaDaProgramacao[]; aguardando: { descricao: string; motivo: string }[]; janelaAte: string };

export const chaveDoTitulo = (contratoId: string, versaoId: string, itemId: string, periodo: string) => `contrato:${contratoId}:${versaoId}:${itemId}:${periodo}`;

function vencimentoNoMes(inicioPeriodo: string, dia: number | null): string {
  if (!dia) return inicioPeriodo;
  const [ano, mes] = inicioPeriodo.split('-');
  return `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
}

/** Previsão sem gravar nada (P6): tudo o que a ativação criaria, e o que já existe aparece como "já gerado" (CA-11.06). */
export async function previaDaProgramacao(contratoId: string, hoje: string = hojeISO()): Promise<PrevisaoDaProgramacao> {
  const ficha = await carregarContrato(contratoId, hoje);
  const versao = ficha?.versoes.filter((item) => item.situacao === 'publicada').sort((a, b) => b.numero - a.numero)[0];
  if (!ficha || !versao) throw new ErroDeRegra('A programação só é ativada para versão assinada (RN-11.17).');
  if (versao.tipo === 'aditivo') throw new ErroDeRegra('Recalcular a programação por aditivo é da F2 (RN-11.19). A programação da versão anterior continua valendo.');
  const [itens, eventos, feriados, existentes] = await Promise.all([repositorios.item_contrato.listar({ onde: { versao_id: versao.id } }), repositorios.evento_contrato.listar({ onde: { contrato_id: contratoId } }), repositorios.feriado.listar(), titulosDoContrato(contratoId)]);
  const natureza: Titulo['natureza'] = ficha.contrato.familia === 'fornecedor' ? 'pagar' : 'receber';
  const inicio = versao.tipo === 'renovacao' ? versao.data_efeito : inicioDaVigencia(versao, eventos);
  const fim = versao.tipo === 'renovacao' ? versao.vigencia_fim : fimDaVigencia(ficha.contrato, versao, inicio);
  const janelaAte = fim && fim < somarMeses(hoje, JANELA_MESES) ? fim : somarMeses(hoje, JANELA_MESES);
  const chaves = new Set(existentes.map((titulo) => titulo.chave_idempotencia));
  const linhas: LinhaDaProgramacao[] = [];
  const aguardando: PrevisaoDaProgramacao['aguardando'] = [];
  const especial = versao.dados_saas?.condicao_especial;
  for (const item of itens.sort((a, b) => a.ordem - b.ordem)) {
    if (item.valor_total === null) {
      aguardando.push({ descricao: item.descricao, motivo: 'Sem valor definido: nada é gerado.' });
      continue;
    }
    const empurrar = (periodoInicio: string, periodoFim: string, vencimento: string, valor: number) => {
      const chave = chaveDoTitulo(contratoId, versao.id, item.id, periodoInicio);
      linhas.push({ chave, itemId: item.id, descricao: item.descricao, periodo_inicio: periodoInicio, periodo_fim: periodoFim, competencia: `${periodoInicio.slice(0, 7)}-01`, vencimento, valor, natureza, jaGerado: chaves.has(chave), aviso: avisoDeVencimento(vencimento, feriados), produtoId: item.produto_id, recorrente: item.recorrente });
    };
    if (item.recorrente && item.periodicidade && PERIODO_EM_MESES[item.periodicidade]) {
      const comeco = item.inicio ?? inicio;
      if (!comeco) {
        aguardando.push({ descricao: item.descricao, motivo: `Pendente: aguardando ${versao.vigencia_inicio_evento === 'assinatura' ? 'Assinatura' : (versao.vigencia_inicio_evento_nome ?? 'o início da vigência')}.` });
        continue;
      }
      const passo = PERIODO_EM_MESES[item.periodicidade] as number;
      const limite = item.fim && item.fim < janelaAte ? item.fim : janelaAte;
      let periodo = comeco;
      let indice = 0;
      while (periodo <= limite && indice < 240) {
        const proximo = somarMeses(comeco, passo * (indice + 1));
        // Condição especial (RN-11.31): o valor especial vale nos primeiros meses, e depois o valor aprovado.
        const noEspecial = especial && especial.valor !== null && especial.duracao_meses && item.oferta_id === versao.dados_saas?.oferta_id && passo * indice < especial.duracao_meses;
        empurrar(periodo, somarDias(proximo, -1), vencimentoNoMes(periodo, ficha.atual.condicoes.dia_vencimento ?? versao.condicoes.dia_vencimento), noEspecial ? arredondar((especial.valor as number) * item.quantidade) : item.valor_total);
        periodo = proximo;
        indice += 1;
      }
      continue;
    }
    // Único: as parcelas das condições, ou uma só no início.
    const parcelas = versao.condicoes.parcelas.length ? versao.condicoes.parcelas : [{ percentual: 100, gatilho: 'evento' as const, data: null, evento: null }];
    let somado = 0;
    parcelas.forEach((parcela, indice) => {
      const valor = indice === parcelas.length - 1 ? arredondar(item.valor_total! - somado) : arredondar((item.valor_total! * parcela.percentual) / 100);
      somado = arredondar(somado + valor);
      const data = parcela.gatilho === 'data' ? parcela.data : parcela.evento ? (eventos.find((evento) => (evento.nome ?? ROTULOS_EVENTO[evento.tipo]).toLowerCase() === parcela.evento?.toLowerCase())?.data ?? null) : (item.inicio ?? inicio);
      if (!data) {
        aguardando.push({ descricao: `${item.descricao} (${parcela.percentual}%)`, motivo: `Pendente: aguardando ${parcela.evento ?? 'o início da vigência'}.` });
        return;
      }
      empurrar(data, data, data, valor);
    });
  }
  return { linhas, aguardando, janelaAte };
}

export const CATEGORIA_RECORRENTE = 'Assinaturas';
export const CATEGORIA_UNICA = 'Implantação/setup';

/** RN-11.17: ativar de novo não duplica. Usa os títulos do M05 (origem "contrato"), com o rateio no produto do item. */
export async function ativarProgramacao(contratoId: string, { categoriaRecorrente, categoriaUnica }: { categoriaRecorrente: string; categoriaUnica: string }, hoje: string = hojeISO()): Promise<number> {
  const previa = await previaDaProgramacao(contratoId, hoje);
  const novas = previa.linhas.filter((linha) => !linha.jaGerado);
  if (novas.some((linha) => linha.recorrente) && !categoriaRecorrente) throw new ErroDeRegra('Escolha a categoria dos recorrentes.');
  if (novas.some((linha) => !linha.recorrente) && !categoriaUnica) throw new ErroDeRegra('Escolha a categoria dos valores únicos.');
  const contrato = (await repositorios.contrato.obter(contratoId)) as Contrato;
  const versao = (await repositorios.contrato_versao.listar({ onde: { contrato_id: contratoId, situacao: 'publicada' } })).sort((a, b) => b.numero - a.numero)[0] as ContratoVersao;
  await emTransacao(async () => {
    for (const linha of novas) {
      const suspenso = Boolean(contrato.suspensao && linha.vencimento >= contrato.suspensao.inicio && (!contrato.suspensao.fim || linha.vencimento <= contrato.suspensao.fim));
      const titulo = await repositorios.titulo.criar({ natureza: linha.natureza, descricao: `${contrato.codigo} · ${linha.descricao}`, contraparte_id: contrato.contraparte_id, beneficiario_pessoa_id: null, categoria_id: linha.recorrente ? categoriaRecorrente : categoriaUnica, competencia: linha.competencia, vencimento: linha.vencimento, valor: linha.valor, moeda: contrato.moeda, situacao: 'previsto', responsavel_id: contrato.responsavel_id, entidade_id: contrato.entidade_id, origem: 'contrato', origem_id: contrato.id, chave_idempotencia: linha.chave, ajustado_manualmente: false, ferramenta_id: null, assinatura_id: null, periodo_inicio: linha.periodo_inicio, periodo_fim: linha.periodo_fim, suspenso, cancelado_motivo: null, observacao: null });
      await repositorios.titulo_rateio.criar({ titulo_id: titulo.id, produto_id: linha.produtoId, percentual: 100, valor: linha.valor });
    }
    const existente = (await repositorios.programacao_financeira.listar({ onde: { versao_id: versao.id } }))[0];
    if (existente) await repositorios.programacao_financeira.atualizar(existente.id, { janela_ate: previa.janelaAte, situacao: 'ativa' });
    else await repositorios.programacao_financeira.criar({ versao_id: versao.id, contrato_id: contratoId, ativada_em: new Date().toISOString(), ativada_por: idDaPessoaAtual(), janela_ate: previa.janelaAte, situacao: 'ativa' });
  });
  const { sincronizarAlertasDosTitulos } = await import('./alertas');
  await sincronizarAlertasDosTitulos();
  return novas.length;
}

/** Rotina mensal (RN-11.18): estende a janela das programações ativas, com as mesmas categorias já usadas. */
export async function estenderProgramacaoDosContratos(hoje: string = hojeISO()): Promise<number> {
  let novos = 0;
  for (const programacao of await repositorios.programacao_financeira.listar({ onde: { situacao: 'ativa' } })) {
    const titulos = await titulosDoContrato(programacao.contrato_id);
    const recorrente = titulos.find((titulo) => titulo.periodo_inicio !== titulo.periodo_fim)?.categoria_id ?? '';
    const unica = titulos.find((titulo) => titulo.periodo_inicio === titulo.periodo_fim)?.categoria_id ?? recorrente;
    try {
      novos += await ativarProgramacao(programacao.contrato_id, { categoriaRecorrente: recorrente, categoriaUnica: unica }, hoje);
    } catch {
      // Sem categoria conhecida, a extensão espera alguém ativar à mão; o contrato segue como estava.
    }
  }
  return novos;
}

// ---------- Suspensão (RN-11.23) e encerramento (RN-11.24 e T11.12) ----------

export async function suspenderContrato(contratoId: string, { inicio, fim, motivo }: { inicio: string; fim: string; motivo: string }): Promise<number> {
  if (!motivo.trim()) throw new ErroDeRegra('Suspender exige motivo.');
  if (!inicio) throw new ErroDeRegra('Informe o início da suspensão.');
  if (fim && fim < inicio) throw new ErroDeRegra('O fim não pode ser antes do início.');
  const contrato = await repositorios.contrato.obter(contratoId);
  if (!contrato?.versao_vigente_id || contrato.encerrado_em) throw new ErroDeRegra('Só contrato assinado e não encerrado é suspenso.');
  const afetados = (await titulosDoContrato(contratoId)).filter((titulo) => titulo.situacao !== 'cancelado' && titulo.situacao !== 'quitado' && titulo.vencimento >= inicio && (!fim || titulo.vencimento <= fim));
  await emTransacao(async () => {
    await repositorios.contrato.atualizar(contratoId, { suspensao: { inicio, fim: fim || null, motivo: motivo.trim() } }, { motivo: motivo.trim() });
    // Marcados, não cancelados, até a decisão.
    for (const titulo of afetados) await repositorios.titulo.atualizar(titulo.id, { suspenso: true }, { motivo: motivo.trim() });
  });
  return afetados.length;
}

export async function retomarContrato(contratoId: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Retomar exige motivo.');
  await emTransacao(async () => {
    await repositorios.contrato.atualizar(contratoId, { suspensao: null }, { motivo: motivo.trim() });
    for (const titulo of await titulosDoContrato(contratoId)) if (titulo.suspenso) await repositorios.titulo.atualizar(titulo.id, { suspenso: false }, { motivo: motivo.trim() });
  });
}

export const CHECKLIST_DE_SAIDA = ['Revogar os acessos da contraparte', 'Exportar ou excluir os dados, conforme o contrato', 'Organizar os arquivos do contrato no Drive', 'Comunicar o encerramento à contraparte'];

export type PreviaDoEncerramento = { cancelar: Titulo[]; preservados: Titulo[]; saldoAnterior: Titulo[]; obrigacoesAbertas: ObrigacaoContratual[] };

/** CA-11.11: cancela só os futuros não pagos depois da data; os anteriores e os saldos ficam. */
export async function previaDoEncerramento(contratoId: string, dataEfetiva: string): Promise<PreviaDoEncerramento> {
  const contrato = await repositorios.contrato.obter(contratoId);
  if (!contrato?.versao_vigente_id) throw new ErroDeRegra('Só contrato assinado é encerrado. O rascunho se cancela.');
  const [titulos, baixas, obrigacoes] = await Promise.all([titulosDoContrato(contratoId), repositorios.baixa.listar(), repositorios.obrigacao_contratual.listar({ onde: { versao_id: contrato.versao_vigente_id } })]);
  const semBaixa = (titulo: Titulo) => !baixas.some((baixa) => baixa.titulo_id === titulo.id && !baixa.arquivado_em);
  const ativos = titulos.filter((titulo) => titulo.situacao !== 'cancelado');
  return {
    cancelar: ativos.filter((titulo) => titulo.vencimento > dataEfetiva && titulo.situacao !== 'quitado' && semBaixa(titulo)),
    preservados: ativos.filter((titulo) => titulo.vencimento <= dataEfetiva || titulo.situacao === 'quitado' || !semBaixa(titulo)),
    saldoAnterior: ativos.filter((titulo) => titulo.vencimento <= dataEfetiva && (titulo.situacao === 'aberto' || titulo.situacao === 'parcial' || titulo.situacao === 'previsto')),
    obrigacoesAbertas: obrigacoes.filter((obrigacao) => obrigacao.situacao === 'pendente'),
  };
}

export async function encerrarContrato(contratoId: string, { dataEfetiva, motivo, multaValor, multaDescricao }: { dataEfetiva: string; motivo: keyof typeof ROTULOS_ENCERRAMENTO | ''; multaValor: number | null; multaDescricao: string }): Promise<number> {
  if (!dataEfetiva) throw new ErroDeRegra('Informe a data efetiva.');
  if (!motivo) throw new ErroDeRegra('Escolha o motivo do encerramento.');
  const contrato = await repositorios.contrato.obter(contratoId);
  if (!contrato) throw new ErroDeRegra('Este contrato não existe mais.');
  if (contrato.encerrado_em) throw new ErroDeRegra('Este contrato já foi encerrado.');
  if (contrato.versao_elaboracao_id) throw new ErroDeRegra('Há versão em elaboração: cancele ou conclua antes de encerrar.');
  const previa = await previaDoEncerramento(contratoId, dataEfetiva);
  if (previa.obrigacoesAbertas.length) throw new ErroDeRegra('Cumpra ou dispense as obrigações abertas antes de encerrar.');
  const texto = `Encerramento: ${ROTULOS_ENCERRAMENTO[motivo]}`;
  await emTransacao(async () => {
    for (const titulo of previa.cancelar) await repositorios.titulo.atualizar(titulo.id, { situacao: 'cancelado', cancelado_motivo: texto }, { motivo: texto });
    await repositorios.encerramento_contrato.criar({ contrato_id: contratoId, data_efetiva: dataEfetiva, motivo, multa: multaValor !== null || multaDescricao.trim() ? { valor: multaValor, descricao: multaDescricao.trim() || null } : null, checklist: CHECKLIST_DE_SAIDA.map((item) => ({ texto: item, feito: false, observacao: null })), concluido_em: new Date().toISOString(), titulos_cancelados: previa.cancelar.map((titulo) => titulo.id) });
    await repositorios.contrato.atualizar(contratoId, { encerrado_em: dataEfetiva, encerramento_motivo: motivo, renovacao_situacao: contrato.renovacao_situacao === 'nao_se_aplica' ? 'nao_se_aplica' : 'nao_renovar' }, { motivo: texto });
    for (const programacao of await repositorios.programacao_financeira.listar({ onde: { contrato_id: contratoId } })) await repositorios.programacao_financeira.atualizar(programacao.id, { situacao: 'encerrada' });
    // Atividades de saída (RN-11.24): no Meu dia, vinculadas ao contrato.
    for (const item of CHECKLIST_DE_SAIDA) await criarAtividade({ ...formularioAtividadeVazio('tarefa', contrato.responsavel_id, 'consolidada'), titulo: `${contrato.codigo}: ${item}`, prazo: dataEfetiva, vinculo: `contrato:${contratoId}` });
  });
  await sincronizarAlertasSeguro();
  return previa.cancelar.length;
}

// ---------- Renovação (RN-11.21, RN-11.22 e T11.11) ----------

/** "Renegociar" mantém a renovação em análise: o estado persistido não tem um valor próprio (ver relatório). */
export async function decidirRenovacao(contratoId: string, decisao: 'renovar' | 'nao_renovar' | 'renegociar', motivo: string, hoje: string = hojeISO()): Promise<ContratoVersao | null> {
  if (!motivo.trim()) throw new ErroDeRegra('A decisão de renovação exige motivo.');
  const ficha = await carregarContrato(contratoId, hoje);
  if (!ficha?.vigente) throw new ErroDeRegra('Só contrato assinado tem renovação.');
  const limite = dataLimiteDaRenovacao(ficha.contrato, ficha.vigente, ficha.eventos);
  const inicio = inicioDaVigencia(ficha.vigente, ficha.eventos);
  const fim = fimDaVigencia(ficha.contrato, ficha.vigente, inicio);
  return emTransacao(async () => {
    let versaoRenovacao: ContratoVersao | null = null;
    if (decisao === 'renovar') {
      if (!fim) throw new ErroDeRegra('Sem fim de vigência, não há o que renovar.');
      const meses = ficha.vigente!.condicoes.renovacao_periodo_meses ?? ficha.vigente!.vigencia_duracao_meses ?? 12;
      versaoRenovacao = await criarAditivo(contratoId, { tipo: 'renovacao', dataEfeito: somarDias(fim, 1), justificativa: '', resumo: `Renovação por ${meses} meses. ${motivo.trim()}` }, hoje);
      await repositorios.contrato_versao.atualizar(versaoRenovacao.id, { vigencia_inicio_evento: 'data_fixa', vigencia_inicio: somarDias(fim, 1), vigencia_fim: somarDias(somarMeses(somarDias(fim, 1), meses), -1), vigencia_duracao_meses: null });
    }
    if (decisao === 'nao_renovar' && limite) await criarAtividade({ ...formularioAtividadeVazio('tarefa', ficha.contrato.responsavel_id, 'consolidada'), titulo: `${ficha.contrato.codigo}: comunicar a não renovação dentro do aviso prévio`, prazo: limite < hoje ? hoje : limite, vinculo: `contrato:${contratoId}` });
    await repositorios.renovacao_decisao.criar({ contrato_id: contratoId, data_limite: limite, decisao, motivo: motivo.trim(), decidido_por: idDaPessoaAtual(), decidido_em: new Date().toISOString(), versao_renovacao_id: versaoRenovacao?.id ?? null });
    await repositorios.contrato.atualizar(contratoId, { renovacao_situacao: decisao === 'renovar' ? 'renovar' : decisao === 'nao_renovar' ? 'nao_renovar' : 'em_analise' }, { motivo: motivo.trim() });
    return versaoRenovacao;
  });
}

/** Rotina do dia (RN-11.22): automática, sem decisão contrária, passa o fim; estende no dia seguinte e avisa sobre a programação. */
export async function renovarAutomaticamente(hoje: string = hojeISO()): Promise<number> {
  let renovados = 0;
  for (const contrato of await repositorios.contrato.listar()) {
    if (!contrato.versao_vigente_id || contrato.encerrado_em || contrato.renovacao_situacao === 'nao_renovar' || contrato.versao_elaboracao_id) continue;
    const ficha = await carregarContrato(contrato.id, hoje);
    const vigente = ficha?.vigente;
    if (!ficha || !vigente || vigente.condicoes.renovacao_tipo !== 'automatica') continue;
    const fim = fimDaVigencia(contrato, vigente, inicioDaVigencia(vigente, ficha.eventos));
    if (!fim || fim >= hoje) continue;
    const novoFim = somarDias(somarMeses(somarDias(fim, 1), vigente.condicoes.renovacao_periodo_meses ?? 12), -1);
    await emTransacao(async () => {
      await repositorios.contrato.atualizar(contrato.id, { vigencia_prorrogada_ate: novoFim, renovacao_situacao: 'renovado' }, { motivo: 'Renovação automática (RN-11.22)' });
      await repositorios.evento_contrato.criar({ contrato_id: contrato.id, tipo: 'outro', nome: `Renovação automática até ${formatarDiaISO(novoFim)}`, produto_id: null, data: somarDias(fim, 1), confirmado_por: 'sistema', evidencia_url: null, observacao: 'Prorrogação pela cláusula de renovação automática.', corrigido_de: null, correcao_motivo: null });
    });
    renovados += 1;
  }
  return renovados;
}

// ---------- Lista (T11.01) ----------

export type LinhaDoContrato = Contrato & { vigencia: keyof typeof ROTULOS_VIGENCIA; financeira: keyof typeof ROTULOS_FINANCEIRA; inicio: string | null; fim: string | null; dataLimite: string | null; vigente: ContratoVersao | null; paralela: ContratoVersao | null; produtos: string[]; mensalEquivalente: number | null; documental: Contrato['situacao_documental'] };

export async function carregarContratos(hoje: string = hojeISO()) {
  const [contratos, versoes, itens, eventos, titulos, baixas, contrapartes, entidades, produtos, pessoas] = await Promise.all([repositorios.contrato.listar({ incluirArquivados: true }), repositorios.contrato_versao.listar(), repositorios.item_contrato.listar(), repositorios.evento_contrato.listar(), repositorios.titulo.listar({ onde: { origem: 'contrato' } }), repositorios.baixa.listar(), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.entidade.listar({ incluirArquivados: true }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  const linhas: LinhaDoContrato[] = contratos.map((contrato) => {
    const proprias = versoes.filter((versao) => versao.contrato_id === contrato.id);
    const vigente = versaoVigente(proprias, hoje) ?? proprias.filter((versao) => versao.situacao === 'publicada').sort((a, b) => b.numero - a.numero)[0] ?? null;
    const paralela = proprias.find((versao) => versao.situacao === 'em_elaboracao') ?? null;
    const base = vigente ?? paralela;
    const doContrato = eventos.filter((evento) => evento.contrato_id === contrato.id);
    const inicio = base ? inicioDaVigencia(base, doContrato) : null;
    const itensBase = base ? itens.filter((item) => item.versao_id === base.id) : [];
    const totais = totaisDosItens(itensBase);
    return {
      ...contrato,
      vigencia: situacaoDaVigencia(contrato, vigente, doContrato, hoje),
      financeira: situacaoFinanceira(titulos.filter((titulo) => titulo.origem_id === contrato.id), baixas, hoje),
      inicio,
      fim: base ? fimDaVigencia(contrato, base, inicio) : null,
      dataLimite: dataLimiteDaRenovacao(contrato, vigente, doContrato),
      vigente,
      paralela: vigente ? paralela : null,
      produtos: [...new Set(itensBase.map((item) => item.produto_id).filter((id): id is string => Boolean(id)))],
      mensalEquivalente: totais.anualEquivalente === null ? null : arredondar(totais.anualEquivalente / 12),
      documental: vigente ? 'assinado' : (paralela?.fluxo ?? contrato.situacao_documental),
    };
  });
  return { linhas, contrapartes, entidades, produtos, pessoas };
}

export type AbaRapida = 'todos' | 'rascunhos' | 'revisao' | 'vigentes' | 'futuros' | 'renovar' | 'encerrados';

export function passaNaAba(linha: LinhaDoContrato, aba: AbaRapida, hoje: string): boolean {
  switch (aba) {
    case 'rascunhos':
      return linha.documental === 'rascunho';
    case 'revisao':
      return ['em_revisao', 'aprovado_envio', 'enviado_assinatura'].includes(linha.documental) || Boolean(linha.paralela && linha.paralela.fluxo !== 'rascunho');
    case 'vigentes':
      return linha.vigencia === 'vigente' || linha.vigencia === 'suspenso';
    case 'futuros':
      return linha.vigencia === 'futuro';
    case 'renovar':
      return Boolean(linha.dataLimite && linha.dataLimite <= somarDias(hoje, 90) && linha.vigencia !== 'encerrado');
    case 'encerrados':
      return linha.vigencia === 'encerrado' || linha.documental === 'cancelado';
    default:
      return true;
  }
}

/** Indicadores (T11.01): cada contrato conta uma vez (CA-11.01). Mensal normalizado só dos vigentes, rotulado. */
export function indicadoresDosContratos(linhas: readonly LinhaDoContrato[], hoje: string) {
  const vigentes = linhas.filter((linha) => linha.vigencia === 'vigente');
  const comValor = vigentes.filter((linha) => linha.mensalEquivalente !== null);
  return {
    vigentes: vigentes.length,
    recorrenteMensal: comValor.length ? arredondar(comValor.reduce((total, linha) => total + (linha.mensalEquivalente as number), 0)) : null,
    recorrenteParcial: vigentes.length - comValor.length,
    aRenovar: linhas.filter((linha) => passaNaAba(linha, 'renovar', hoje)).length,
    assinaturasPendentes: linhas.filter((linha) => linha.documental === 'enviado_assinatura' || linha.paralela?.fluxo === 'enviado_assinatura').length,
  };
}

/** Os contratos da contraparte, para T10.01. */
export async function contratosDaContraparte(contraparteId: string, hoje: string = hojeISO()): Promise<LinhaDoContrato[]> {
  return (await carregarContratos(hoje)).linhas.filter((linha) => linha.contraparte_id === contraparteId);
}

async function sincronizarAlertasSeguro(): Promise<void> {
  const { sincronizarAlertasComerciais } = await import('./alertas-f1');
  await sincronizarAlertasComerciais();
}

