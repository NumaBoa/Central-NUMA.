/**
 * Regras de M10 (12-M10): oportunidades, funil, viabilidade e propostas. A próxima ação é uma atividade do
 * Meu dia vinculada (RN-10.02), e não uma lista à parte. Ofertas e preços vêm do catálogo do M07
 * (`integracoes/catalogo-comercial.ts`): sem ele, o rascunho é salvo e a emissão final espera.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Atividade } from '@/dados/tipos/atividade';
import { ETAPAS_FUNIL, MOTIVOS_PERDA, PERIODICIDADES_VALOR, TIPOS_OPORTUNIDADE, type Oportunidade, type Proposta, type PropostaItem, type PropostaVersao, type Viabilidade } from '@/dados/tipos/comercial';
import type { Contraparte } from '@/dados/tipos/contraparte';
import type { Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { estaAberta } from './atividades';
import { criarAtividade, formularioAtividadeVazio } from './atividades-formulario';
import { dadosDaContraparteNoModelo, dadosDaEntidadeNoModelo, dataPorExtenso, emitirDocumento } from './documentos-emitidos';
import { pendenciasDaEntidade } from './entidades';
import { catalogoComercial } from './integracoes/conexoes';
import { MENSAGEM_CATALOGO_AUSENTE, precoVigente } from './integracoes/catalogo-comercial';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { renderizarVersao } from './modelos';
import { somarDias } from './repeticao';
import type { Pendencia } from './pendencias';

export const ROTULOS_ETAPA: Readonly<Record<Oportunidade['etapa'], string>> = { novo: 'Novo contato', qualificacao: 'Qualificação', proposta: 'Proposta', negociacao: 'Negociação', ganha: 'Ganha', perdida: 'Perdida' };
export const ROTULOS_MOTIVO_PERDA: Readonly<Record<Oportunidade['motivo_perda'] & string, string>> = { preco: 'Preço', momento: 'Momento', concorrente: 'Concorrente', sem_resposta: 'Sem resposta', escopo: 'Escopo não atendido', desistiu: 'Desistiu', outro: 'Outro' };
export const ROTULOS_TIPO_OPORTUNIDADE: Readonly<Record<Oportunidade['tipo'], string>> = { assinatura: 'Assinatura', implantacao_assinatura: 'Implantação + assinatura', sob_medida: 'Sob medida', parceria: 'Parceria', patrocinio: 'Patrocínio' };
export const ROTULOS_PERIODICIDADE_VALOR: Readonly<Record<(typeof PERIODICIDADES_VALOR)[number], string>> = { unica: 'Único', mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
export const ROTULOS_SITUACAO_VERSAO: Readonly<Record<PropostaVersao['situacao'], string>> = { rascunho: 'Rascunho', pronta: 'Pronta para envio', enviada: 'Enviada', aceita: 'Aceita', recusada: 'Recusada', expirada: 'Expirada', substituida: 'Substituída' };
export const ROTULOS_FORMA_ACEITE: Readonly<Record<NonNullable<PropostaVersao['aceite_forma']>, string>> = { email: 'E-mail', mensagem: 'Mensagem', assinatura: 'Assinatura', verbal_confirmado: 'Verbal com confirmação por escrito' };
export const ROTULOS_CONCLUSAO_VIABILIDADE: Readonly<Record<Viabilidade['conclusao'], string>> = { viavel: 'Viável', viavel_condicoes: 'Viável com condições', nao_viavel: 'Não viável' };
export const ETAPAS_ABERTAS: readonly Oportunidade['etapa'][] = ['novo', 'qualificacao', 'proposta', 'negociacao'];

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const lerNumero = (texto: string) => {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : Number.NaN;
};

// ---------- Oportunidade (T10.03) ----------

export const esquemaFormularioOportunidade = z
  .object({
    contraparte_id: z.string().min(1, 'Escolha a contraparte.'),
    titulo: z.string().trim().min(1, 'Informe o título.'),
    produtos: z.array(z.string()).min(1, 'Escolha pelo menos um produto de interesse.'),
    tipo: z.enum(TIPOS_OPORTUNIDADE, { error: 'Escolha o tipo.' }),
    origem: z.enum(['indicacao', 'rede_social', 'site', 'evento', 'busca_ativa', 'lista_espera', 'outro'], { error: 'Escolha a origem.' }),
    valor_estimado: z.string().trim(),
    valor_periodicidade: z.union([z.literal(''), z.enum(PERIODICIDADES_VALOR)]),
    probabilidade: z.string().trim(),
    fechamento_previsto: z.string(),
    etapa: z.enum(['novo', 'qualificacao', 'proposta', 'negociacao']),
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
    participantes: z.array(z.string()),
    contatos: z.array(z.string()),
    necessidade: z.string().trim(),
    /** RN-08.12: campanha de origem, informada à mão (sem atribuição automática, que é da F2). */
    campanha_id: z.string(),
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    const valor = lerNumero(dados.valor_estimado);
    if (Number.isNaN(valor) || (valor !== null && valor < 0)) falha('valor_estimado', 'Use só números, como 1.500,00.');
    if (valor !== null && !Number.isNaN(valor) && !dados.valor_periodicidade) falha('valor_periodicidade', 'Diga a periodicidade do valor.');
    const probabilidade = lerNumero(dados.probabilidade);
    if (Number.isNaN(probabilidade) || (probabilidade !== null && (probabilidade < 0 || probabilidade > 100))) falha('probabilidade', 'Use de 0 a 100.');
  });
export type FormularioOportunidade = z.infer<typeof esquemaFormularioOportunidade>;

export function formularioOportunidadeVazio(responsavelId: string, contraparteId = ''): FormularioOportunidade {
  return { contraparte_id: contraparteId, titulo: '', produtos: [], tipo: 'assinatura', origem: 'indicacao', valor_estimado: '', valor_periodicidade: '', probabilidade: '', fechamento_previsto: '', etapa: 'novo', responsavel_id: responsavelId, participantes: [], contatos: [], necessidade: '', campanha_id: '' };
}

export function formularioDaOportunidade(oportunidade: Oportunidade, ligacoes: { produtos: string[]; participantes: string[]; contatos: string[] }): FormularioOportunidade {
  const numero = (valor: number | null) => (valor === null ? '' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
  return { contraparte_id: oportunidade.contraparte_id, titulo: oportunidade.titulo, produtos: ligacoes.produtos, tipo: oportunidade.tipo, origem: oportunidade.origem, valor_estimado: numero(oportunidade.valor_estimado), valor_periodicidade: oportunidade.valor_periodicidade ?? '', probabilidade: numero(oportunidade.probabilidade), fechamento_previsto: oportunidade.fechamento_previsto ?? '', etapa: ETAPAS_ABERTAS.includes(oportunidade.etapa) ? (oportunidade.etapa as FormularioOportunidade['etapa']) : 'negociacao', responsavel_id: oportunidade.responsavel_id, participantes: ligacoes.participantes, contatos: ligacoes.contatos, necessidade: oportunidade.necessidade ?? '' , campanha_id: oportunidade.campanha_id ?? '' };
}

async function sincronizarLigacoes<R extends { id: string; oportunidade_id: string }>(repositorio: { listar: (f: { onde: Partial<R> }) => Promise<R[]>; arquivar: (id: string) => Promise<unknown>; criar: (dados: never) => Promise<unknown> }, oportunidadeId: string, campo: keyof R, desejados: readonly string[], extra: Record<string, unknown> = {}) {
  const atuais = await repositorio.listar({ onde: { oportunidade_id: oportunidadeId } as Partial<R> });
  const faltam = new Set(desejados);
  for (const ligacao of atuais) {
    if (!faltam.has(String(ligacao[campo]))) await repositorio.arquivar(ligacao.id);
    faltam.delete(String(ligacao[campo]));
  }
  for (const valor of faltam) await repositorio.criar({ oportunidade_id: oportunidadeId, [campo]: valor, ...extra } as never);
}

export async function salvarOportunidade(formulario: FormularioOportunidade, id?: string, hoje: string = hojeISO()): Promise<Oportunidade> {
  const valor = lerNumero(formulario.valor_estimado);
  const probabilidade = lerNumero(formulario.probabilidade);
  return emTransacao(async () => {
    const atual = id ? await repositorios.oportunidade.obter(id) : null;
    if (atual && !ETAPAS_ABERTAS.includes(atual.etapa)) throw new ErroDeRegra('Oportunidade encerrada não se edita. Reabra antes.');
    const dados = {
      contraparte_id: formulario.contraparte_id,
      titulo: formulario.titulo,
      tipo: formulario.tipo,
      origem: formulario.origem,
      valor_estimado: valor === null || Number.isNaN(valor) ? null : valor,
      valor_periodicidade: formulario.valor_periodicidade || null,
      probabilidade: probabilidade === null || Number.isNaN(probabilidade) ? null : probabilidade,
      fechamento_previsto: formulario.fechamento_previsto || null,
      responsavel_id: formulario.responsavel_id,
      necessidade: formulario.necessidade || null,
      campanha_id: formulario.campanha_id || null,
    };
    const oportunidade = atual
      ? await repositorios.oportunidade.atualizar(atual.id, { ...dados, ...(atual.etapa !== formulario.etapa ? { etapa: formulario.etapa, etapa_desde: hoje } : {}) })
      : await repositorios.oportunidade.criar({ ...dados, moeda: 'BRL', etapa: formulario.etapa, etapa_desde: hoje, motivo_perda: null, motivo_perda_texto: null, ganha_em: null, perdida_em: null, adesao_padrao: false });
    await sincronizarLigacoes(repositorios.oportunidade_produto, oportunidade.id, 'produto_id', formulario.produtos);
    await sincronizarLigacoes(repositorios.oportunidade_participante, oportunidade.id, 'pessoa_id', formulario.participantes.filter((pessoa) => pessoa !== formulario.responsavel_id));
    await sincronizarLigacoes(repositorios.oportunidade_contato, oportunidade.id, 'pessoa_id', formulario.contatos, { papel: null });
    // RN-10.01: a contraparte com oportunidade é prospect, sem tirar outros papéis.
    const contraparte = await repositorios.contraparte.obter(formulario.contraparte_id);
    if (contraparte && !contraparte.papeis.includes('prospect') && !contraparte.papeis.includes('cliente')) await repositorios.contraparte.atualizar(contraparte.id, { papeis: [...contraparte.papeis, 'prospect'] });
    return oportunidade;
  });
}

export async function avancarEtapa(id: string, etapa: Oportunidade['etapa'], hoje: string = hojeISO()): Promise<void> {
  if (!ETAPAS_ABERTAS.includes(etapa)) throw new ErroDeRegra('Para encerrar, use Marcar ganha ou Marcar perdida.');
  const oportunidade = await repositorios.oportunidade.obter(id);
  if (!oportunidade || !ETAPAS_ABERTAS.includes(oportunidade.etapa)) throw new ErroDeRegra('Esta oportunidade está encerrada.');
  if (oportunidade.etapa !== etapa) await repositorios.oportunidade.atualizar(id, { etapa, etapa_desde: hoje });
}

/** RN-10.03 e RN-10.05: Perdida com motivo; Ganha com versão aceita ou adesão padrão. Ganhar não cria receita (RN-10.04). */
export async function encerrarOportunidade(id: string, desfecho: { tipo: 'perdida'; motivo: NonNullable<Oportunidade['motivo_perda']>; texto: string } | { tipo: 'ganha'; adesaoPadrao: boolean }, hoje: string = hojeISO()): Promise<void> {
  await emTransacao(async () => {
    const oportunidade = await repositorios.oportunidade.obter(id);
    if (!oportunidade || !ETAPAS_ABERTAS.includes(oportunidade.etapa)) throw new ErroDeRegra('Esta oportunidade já está encerrada.');
    if (desfecho.tipo === 'perdida') {
      if (!MOTIVOS_PERDA.includes(desfecho.motivo)) throw new ErroDeRegra('Escolha o motivo da perda.');
      if (desfecho.motivo === 'outro' && !desfecho.texto.trim()) throw new ErroDeRegra('Diga qual foi o motivo.');
      await repositorios.oportunidade.atualizar(id, { etapa: 'perdida', etapa_desde: hoje, perdida_em: hoje, motivo_perda: desfecho.motivo, motivo_perda_texto: desfecho.texto.trim() || null }, { motivo: ROTULOS_MOTIVO_PERDA[desfecho.motivo] });
      return;
    }
    const propostas = await repositorios.proposta.listar({ onde: { oportunidade_id: id } });
    const aceita = propostas.some((proposta) => proposta.versao_aceita_id);
    if (!aceita && !desfecho.adesaoPadrao) throw new ErroDeRegra('Ganha exige uma proposta com versão aceita, ou a indicação “Adesão padrão” (RN-10.03).');
    await repositorios.oportunidade.atualizar(id, { etapa: 'ganha', etapa_desde: hoje, ganha_em: hoje, adesao_padrao: !aceita && desfecho.adesaoPadrao });
    const contraparte = await repositorios.contraparte.obter(oportunidade.contraparte_id);
    if (contraparte && !contraparte.papeis.includes('cliente')) await repositorios.contraparte.atualizar(contraparte.id, { papeis: [...contraparte.papeis, 'cliente'] });
  });
}

export async function reabrirOportunidade(id: string, motivo: string, hoje: string = hojeISO()): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Reabrir exige motivo.');
  const oportunidade = await repositorios.oportunidade.obter(id);
  if (!oportunidade || ETAPAS_ABERTAS.includes(oportunidade.etapa)) throw new ErroDeRegra('Esta oportunidade já está aberta.');
  await repositorios.oportunidade.atualizar(id, { etapa: 'negociacao', etapa_desde: hoje, ganha_em: null, perdida_em: null, motivo_perda: null, motivo_perda_texto: null, adesao_padrao: false }, { motivo: motivo.trim() });
}

// ---------- Próxima ação (RN-10.02): atividade do Meu dia ----------

export async function registrarProximaAcao(oportunidadeId: string, { titulo, prazo, responsavelId }: { titulo: string; prazo: string; responsavelId: string }): Promise<Atividade> {
  if (!titulo.trim()) throw new ErroDeRegra('Diga qual é a próxima ação.');
  if (!prazo) throw new ErroDeRegra('A próxima ação precisa de data.');
  const oportunidade = await repositorios.oportunidade.obter(oportunidadeId);
  if (!oportunidade || !ETAPAS_ABERTAS.includes(oportunidade.etapa)) throw new ErroDeRegra('Oportunidade encerrada não precisa de próxima ação.');
  const produtos = (await repositorios.oportunidade_produto.listar({ onde: { oportunidade_id: oportunidadeId } })).map((ligacao) => ligacao.produto_id);
  return criarAtividade({ ...formularioAtividadeVazio('tarefa', responsavelId, 'consolidada'), titulo: titulo.trim().slice(0, 140), prazo, responsavel_id: responsavelId, contextos: produtos.length ? produtos : ['institucional'], vinculo: `oportunidade:${oportunidadeId}` });
}

export function proximaAcao(atividades: readonly Atividade[]): Atividade | null {
  return [...atividades].filter((atividade) => estaAberta(atividade) && atividade.prazo).sort((a, b) => (a.prazo as string).localeCompare(b.prazo as string))[0] ?? null;
}

// ---------- Viabilidade (T10.04) ----------

export const esquemaFormularioViabilidade = z.object({
  existe: z.string().trim().min(1, 'Diga o que já existe e atende.'),
  entregas: z.array(z.object({ descricao: z.string().trim().min(1, 'Descreva a entrega.'), horas: z.string().trim().min(1, 'Informe as horas.'), prazo_dias: z.string().trim() })).min(1, 'Inclua pelo menos uma entrega.'),
  prazo_estimado_dias: z.string().trim().min(1, 'Informe o prazo estimado.'),
  custo_estimado: z.string().trim(),
  capacidade: z.string().trim().min(1, 'Diga quem faz e quando.'),
  riscos: z.string().trim(),
  conclusao: z.enum(['viavel', 'viavel_condicoes', 'nao_viavel'], { error: 'Escolha a conclusão.' }),
  decididores: z.array(z.string()).min(1, 'Escolha quem decidiu.'),
  decidido_em: z.string().min(1, 'Informe a data da decisão.'),
});
export type FormularioViabilidade = z.infer<typeof esquemaFormularioViabilidade>;

/** Sem entregas realizadas registradas (M12), não há média: "Histórico insuficiente", nunca uma estimativa artificial. */
export const REFERENCIA_HISTORICA = 'Histórico insuficiente';

export async function salvarViabilidade(oportunidadeId: string, formulario: FormularioViabilidade, id?: string): Promise<Viabilidade> {
  const entregas = formulario.entregas.map((entrega) => {
    const horas = lerNumero(entrega.horas);
    const prazo = lerNumero(entrega.prazo_dias);
    if (horas === null || Number.isNaN(horas) || horas <= 0) throw new ErroDeRegra(`Informe as horas de “${entrega.descricao}”.`);
    return { descricao: entrega.descricao, horas, prazo_dias: prazo === null || Number.isNaN(prazo) ? null : Math.round(prazo) };
  });
  const prazo = lerNumero(formulario.prazo_estimado_dias);
  if (prazo === null || Number.isNaN(prazo) || prazo <= 0) throw new ErroDeRegra('Informe o prazo estimado em dias.');
  const custo = lerNumero(formulario.custo_estimado);
  if (Number.isNaN(custo)) throw new ErroDeRegra('Use só números no custo, como 1.500,00.');
  const dados = { oportunidade_id: oportunidadeId, existe: formulario.existe, entregas, horas_total: arredondar(entregas.reduce((total, entrega) => total + entrega.horas, 0)), prazo_estimado_dias: Math.round(prazo), custo_estimado: custo, capacidade: formulario.capacidade, riscos: formulario.riscos || null, conclusao: formulario.conclusao, decidido_em: formulario.decidido_em, decididores: formulario.decididores };
  return id ? repositorios.viabilidade.atualizar(id, dados) : repositorios.viabilidade.criar(dados);
}

// ---------- Proposta (T10.05) ----------

export async function criarProposta(oportunidadeId: string, hoje: string = hojeISO()): Promise<Proposta> {
  const oportunidade = await repositorios.oportunidade.obter(oportunidadeId);
  if (!oportunidade || !ETAPAS_ABERTAS.includes(oportunidade.etapa)) throw new ErroDeRegra('Só oportunidade aberta recebe proposta.');
  const [configuracao, entidades] = await Promise.all([repositorios.configuracao.ler(), repositorios.entidade.listar()]);
  const padrao = entidades.find((entidade) => entidade.entidade_padrao);
  return emTransacao(async () => {
    const proposta = await repositorios.proposta.criar({ oportunidade_id: oportunidadeId, contraparte_id: oportunidade.contraparte_id, versao_aceita_id: null });
    await repositorios.proposta_versao.criar(versaoVazia(proposta.id, 1, somarDias(hoje, configuracao.validade_proposta_dias), padrao?.id ?? null));
    if (oportunidade.etapa === 'novo' || oportunidade.etapa === 'qualificacao') await repositorios.oportunidade.atualizar(oportunidadeId, { etapa: 'proposta', etapa_desde: hoje });
    return proposta;
  });
}

function versaoVazia(propostaId: string, numero: number, validade: string, entidadeId: string | null) {
  return { proposta_id: propostaId, numero, situacao: 'rascunho' as const, entidade_id: entidadeId, marca_id: null, modelo_versao_id: null, contatos: [], validade, escopo_incluido: null, escopo_excluido: null, premissas: null, dependencias: null, condicoes: { forma_pagamento: null, vencimentos: null, reajuste_indice: null, reajuste_periodicidade_meses: null, prazo_entrega: null, observacoes: null }, enviada_em: null, enviada_canal: null, enviada_para: null, enviada_evidencia_url: null, aceite_em: null, aceite_forma: null, aceite_evidencia_url: null, aceite_registrado_por: null, recusa_motivo: null, validade_reaberta_motivo: null, snapshot: null, documento_emitido_id: null };
}

async function exigirRascunho(versaoId: string): Promise<PropostaVersao> {
  const versao = await repositorios.proposta_versao.obter(versaoId);
  if (!versao) throw new ErroDeRegra('Esta versão não existe mais.');
  if (versao.situacao !== 'rascunho') throw new ErroDeRegra('Só o rascunho se edita. Versão enviada não muda: crie uma nova versão (RN-10.11).');
  return versao;
}

export type CabecalhoDaVersao = Pick<PropostaVersao, 'entidade_id' | 'modelo_versao_id' | 'contatos' | 'validade' | 'escopo_incluido' | 'escopo_excluido' | 'premissas' | 'dependencias' | 'condicoes'>;

export async function salvarVersaoDaProposta(versaoId: string, dados: CabecalhoDaVersao): Promise<void> {
  await exigirRascunho(versaoId);
  await repositorios.proposta_versao.atualizar(versaoId, dados);
}

export type DadosDoItem = {
  tipo_item: PropostaItem['tipo_item'];
  produto_id: string;
  oferta_id: string;
  canal_id: string;
  periodicidade: string;
  quantidade: string;
  descricao: string;
  valor_unitario: string;
  justificativa_valor: string;
  horas_estimadas: string;
  desconto_tipo: 'percentual' | 'valor' | '';
  desconto: string;
  desconto_justificativa: string;
  inicio_previsto: string;
  recurso_planejado: string;
  recurso_previsto_para: string;
};

export const ITEM_VAZIO: DadosDoItem = { tipo_item: 'oferta', produto_id: '', oferta_id: '', canal_id: '', periodicidade: 'mensal', quantidade: '1', descricao: '', valor_unitario: '', justificativa_valor: '', horas_estimadas: '', desconto_tipo: '', desconto: '', desconto_justificativa: '', inicio_previsto: '', recurso_planejado: '', recurso_previsto_para: '' };

/** Valor do item: quantidade × unitário − desconto. Sem unitário, não há total (RT-08). */
export function totalDoItem(item: Pick<PropostaItem, 'quantidade' | 'valor_unitario' | 'desconto_percentual' | 'desconto_valor'>): number | null {
  if (item.valor_unitario === null) return null;
  const bruto = item.quantidade * item.valor_unitario;
  const desconto = item.desconto_percentual !== null ? (bruto * item.desconto_percentual) / 100 : (item.desconto_valor ?? 0);
  return arredondar(Math.max(0, bruto - desconto));
}

/**
 * RN-10.08: o preço é o da versão Aprovada vigente no canal, copiado para o item. RN-10.09: desconto sem
 * limite, com justificativa, autor e data. Item sob medida: valor informado, com justificativa.
 */
export async function salvarItemDaProposta(versaoId: string, dados: DadosDoItem, itemId?: string, hoje: string = hojeISO()): Promise<PropostaItem> {
  await exigirRascunho(versaoId);
  const anterior = itemId ? await repositorios.proposta_item.obter(itemId) : null;
  const item = await calcularItem(dados, anterior, hoje);
  const completo = { ...item, versao_id: versaoId, ordem: anterior?.ordem ?? (await repositorios.proposta_item.listar({ onde: { versao_id: versaoId } })).length };
  return itemId ? repositorios.proposta_item.atualizar(itemId, completo) : repositorios.proposta_item.criar(completo);
}

export type ItemCalculado = Omit<PropostaItem, 'id' | 'criado_em' | 'criado_por' | 'atualizado_em' | 'atualizado_por' | 'arquivado_em' | 'arquivado_por' | 'versao_registro' | 'exemplo' | 'versao_id' | 'ordem'>;

/** O item da proposta e do contrato: preço do catálogo copiado, desconto com autor e data. */
export async function calcularItem(dados: DadosDoItem, anterior: Pick<PropostaItem, 'desconto_percentual' | 'desconto_valor' | 'desconto_justificativa' | 'desconto_por' | 'desconto_em'> | null, hoje: string = hojeISO()): Promise<ItemCalculado> {
  const quantidade = lerNumero(dados.quantidade);
  if (quantidade === null || Number.isNaN(quantidade) || quantidade <= 0) throw new ErroDeRegra('Informe a quantidade.');
  const desconto = lerNumero(dados.desconto);
  if (dados.desconto_tipo && (desconto === null || Number.isNaN(desconto) || desconto < 0)) throw new ErroDeRegra('Informe o desconto, ou tire o tipo de desconto.');
  if (dados.desconto_tipo === 'percentual' && desconto !== null && desconto > 100) throw new ErroDeRegra('O desconto vai de 0 a 100%.');
  const comDesconto = Boolean(dados.desconto_tipo) && Boolean(desconto);
  const mudouDesconto = !anterior || anterior.desconto_percentual !== (dados.desconto_tipo === 'percentual' ? desconto : null) || anterior.desconto_valor !== (dados.desconto_tipo === 'valor' ? desconto : null) || (anterior.desconto_justificativa ?? '') !== dados.desconto_justificativa.trim();
  const comum = {
    quantidade,
    desconto_percentual: comDesconto && dados.desconto_tipo === 'percentual' ? desconto : null,
    desconto_valor: comDesconto && dados.desconto_tipo === 'valor' ? desconto : null,
    desconto_justificativa: comDesconto ? dados.desconto_justificativa.trim() || null : null,
    desconto_por: comDesconto ? (mudouDesconto ? idDaPessoaAtual() : (anterior?.desconto_por ?? idDaPessoaAtual())) : null,
    desconto_em: comDesconto ? (mudouDesconto ? hoje : (anterior?.desconto_em ?? hoje)) : null,
    inicio_previsto: dados.inicio_previsto || null,
    recurso_planejado: dados.recurso_planejado.trim() || null,
    recurso_previsto_para: dados.recurso_previsto_para || null,
  };
  let item: Omit<ItemCalculado, 'valor_total'>;
  if (dados.tipo_item === 'oferta') {
    const catalogo = catalogoComercial();
    const oferta = dados.oferta_id ? await catalogo.oferta(dados.oferta_id) : null;
    if (!oferta) throw new ErroDeRegra(catalogo.estado === 'ausente' ? MENSAGEM_CATALOGO_AUSENTE : 'Escolha a oferta.');
    const periodicidade = (PERIODICIDADES_VALOR as readonly string[]).includes(dados.periodicidade) ? (dados.periodicidade as PropostaItem['periodicidade']) : null;
    const preco = precoVigente(await catalogo.precosDaOferta(oferta.id), { canalId: dados.canal_id || null, periodicidade, naData: dados.inicio_previsto || hoje });
    item = { ...comum, tipo_item: 'oferta', produto_id: oferta.produto_id, oferta_id: oferta.id, preco_versao_id: preco?.id ?? null, canal_id: dados.canal_id || null, descricao: oferta.nome, valor_unitario: preco?.valor ?? null, recorrente: periodicidade !== 'unica', periodicidade, horas_estimadas: null, justificativa_valor: null };
  } else {
    if (!dados.descricao.trim()) throw new ErroDeRegra('Descreva o item sob medida.');
    const valor = lerNumero(dados.valor_unitario);
    if (Number.isNaN(valor) || (valor !== null && valor < 0)) throw new ErroDeRegra('Use só números no valor, como 2.000,00.');
    const horas = lerNumero(dados.horas_estimadas);
    const periodicidade = (PERIODICIDADES_VALOR as readonly string[]).includes(dados.periodicidade) ? (dados.periodicidade as PropostaItem['periodicidade']) : 'unica';
    item = { ...comum, tipo_item: 'sob_medida', produto_id: dados.produto_id || null, oferta_id: null, preco_versao_id: null, canal_id: null, descricao: dados.descricao.trim(), valor_unitario: valor, recorrente: periodicidade !== 'unica', periodicidade, horas_estimadas: horas === null || Number.isNaN(horas) ? null : horas, justificativa_valor: dados.justificativa_valor.trim() || null };
  }
  return { ...item, valor_total: totalDoItem(item) };
}

export async function removerItemDaProposta(itemId: string): Promise<void> {
  const item = await repositorios.proposta_item.obter(itemId);
  if (!item) return;
  await exigirRascunho(item.versao_id);
  await repositorios.proposta_item.arquivar(itemId);
}

// ---------- Totais (RN-10.14) ----------

export type Totais = { unico: number; recorrentes: { periodicidade: string; valor: number }[]; anualEquivalente: number | null; semValor: number };

const MESES: Readonly<Record<string, number>> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };

/** Únicos e recorrentes por periodicidade, separados. O anual equivalente é só referência e não inclui os únicos. */
export function totaisDosItens(itens: readonly Pick<PropostaItem, 'valor_total' | 'recorrente' | 'periodicidade'>[]): Totais {
  let unico = 0;
  const porPeriodo = new Map<string, number>();
  let semValor = 0;
  for (const item of itens) {
    if (item.valor_total === null) {
      semValor += 1;
      continue;
    }
    if (!item.recorrente || item.periodicidade === 'unica' || !item.periodicidade) unico = arredondar(unico + item.valor_total);
    else porPeriodo.set(item.periodicidade, arredondar((porPeriodo.get(item.periodicidade) ?? 0) + item.valor_total));
  }
  const recorrentes = ['mensal', 'trimestral', 'semestral', 'anual'].flatMap((periodicidade) => (porPeriodo.has(periodicidade) ? [{ periodicidade, valor: porPeriodo.get(periodicidade) as number }] : []));
  const anualEquivalente = recorrentes.length ? arredondar(recorrentes.reduce((total, linha) => total + (linha.valor * 12) / (MESES[linha.periodicidade] ?? 12), 0)) : null;
  return { unico, recorrentes, anualEquivalente, semValor };
}

export function linhasDosTotais(totais: Totais, moeda = 'BRL'): string[] {
  const linhas = [...(totais.unico ? [`Único: ${formatarDinheiro(totais.unico, moeda)}`] : []), ...totais.recorrentes.map((linha) => `${ROTULOS_PERIODICIDADE_VALOR[linha.periodicidade as keyof typeof ROTULOS_PERIODICIDADE_VALOR]}: ${formatarDinheiro(linha.valor, moeda)}`)];
  if (totais.semValor) linhas.push(`Cálculo parcial: ${totais.semValor} ${totais.semValor === 1 ? 'item sem valor definido' : 'itens sem valor definido'}`);
  return linhas;
}

// ---------- Pendências e documento (T10.05 etapa 5 e T10.06) ----------

export type FichaDaProposta = { proposta: Proposta; versoes: PropostaVersao[]; atual: PropostaVersao; itens: PropostaItem[]; oportunidade: Oportunidade; viabilidade: Viabilidade | null; contraparte: Contraparte | null };

export async function carregarProposta(id: string): Promise<FichaDaProposta | null> {
  const proposta = await repositorios.proposta.obter(id);
  if (!proposta) return null;
  const versoes = (await repositorios.proposta_versao.listar({ onde: { proposta_id: id } })).sort((a, b) => b.numero - a.numero);
  const atual = versoes[0];
  const oportunidade = await repositorios.oportunidade.obter(proposta.oportunidade_id);
  if (!atual || !oportunidade) return null;
  const [itens, viabilidades, contraparte] = await Promise.all([repositorios.proposta_item.listar({ onde: { versao_id: atual.id } }), repositorios.viabilidade.listar({ onde: { oportunidade_id: oportunidade.id } }), repositorios.contraparte.obter(proposta.contraparte_id)]);
  return { proposta, versoes, atual, itens: itens.sort((a, b) => a.ordem - b.ordem), oportunidade, viabilidade: viabilidades[0] ?? null, contraparte };
}

export async function itensDaVersao(versaoId: string): Promise<PropostaItem[]> {
  return (await repositorios.proposta_item.listar({ onde: { versao_id: versaoId } })).sort((a, b) => a.ordem - b.ordem);
}

async function dadosDoModeloDaProposta(ficha: FichaDaProposta, versao: PropostaVersao, itens: readonly PropostaItem[], hoje: string) {
  const [entidade, licenciantes, socias, representantes, pessoas] = await Promise.all([versao.entidade_id ? repositorios.entidade.obter(versao.entidade_id) : null, repositorios.entidade_licenciante.listar(), repositorios.entidade_socias.listar(), repositorios.entidade_representante.listar(), repositorios.pessoa.listar({ incluirArquivados: true })]);
  const totais = totaisDosItens(itens);
  const contato = pessoas.find((pessoa) => pessoa.id === versao.contatos[0]) ?? null;
  return {
    proposta: { codigo: ficha.proposta.codigo, versao: `V${versao.numero}`, validade: formatarDiaISO(versao.validade), escopo_incluido: versao.escopo_incluido, escopo_excluido: versao.escopo_excluido, premissas: versao.premissas, dependencias: versao.dependencias, forma_pagamento: versao.condicoes.forma_pagamento, vencimentos: versao.condicoes.vencimentos, prazo_entrega: versao.condicoes.prazo_entrega, reajuste: versao.condicoes.reajuste_indice, observacoes: versao.condicoes.observacoes, recursos_previstos: itens.filter((item) => item.recurso_planejado).map((item) => `${item.recurso_planejado}: previsto para ${item.recurso_previsto_para ? formatarDiaISO(item.recurso_previsto_para) : '(sem data)'}`).join('; ') || null },
    entidade: dadosDaEntidadeNoModelo(entidade, entidade ? licenciantes.filter((linha) => linha.entidade_id === entidade.id) : [], entidade ? (socias.find((linha) => linha.entidade_id === entidade.id)?.marca_comercial ?? null) : null, entidade ? pessoas.filter((pessoa) => representantes.some((ligacao) => ligacao.entidade_id === entidade.id && ligacao.pessoa_id === pessoa.id)) : []),
    contraparte: dadosDaContraparteNoModelo(ficha.contraparte, contato),
    itens: itens.map((item) => ({ descricao: item.recurso_planejado ? `${item.descricao} (inclui ${item.recurso_planejado}, previsto para ${item.recurso_previsto_para ? formatarDiaISO(item.recurso_previsto_para) : 'data a definir'})` : item.descricao, quantidade: item.quantidade.toLocaleString('pt-BR'), valor_formatado: item.valor_total === null ? null : formatarDinheiro(item.valor_total, 'BRL'), periodicidade_texto: item.periodicidade ? ROTULOS_PERIODICIDADE_VALOR[item.periodicidade] : null })),
    totais_texto: linhasDosTotais(totais).join(' · ') || null,
    hoje_extenso: dataPorExtenso(hoje),
    assinaturas: [],
  };
}

export type DocumentoDaProposta = { pendencias: Pendencia[]; nos: ReturnType<typeof renderizarVersao>['nos']; dados: unknown; modeloNaoValidado: boolean; faltando: string[] };

export async function montarDocumentoDaProposta(ficha: FichaDaProposta, versao: PropostaVersao = ficha.atual, hoje: string = hojeISO()): Promise<DocumentoDaProposta> {
  const itens = versao.id === ficha.atual.id ? ficha.itens : await itensDaVersao(versao.id);
  const pendencias: Pendencia[] = [];
  const bloqueia = (id: string, mensagem: string, etapa: string) => pendencias.push({ id, mensagem, tipo: 'bloqueia', bloqueia: 'emissão final', etapa });
  const avisa = (id: string, mensagem: string, etapa: string) => pendencias.push({ id, mensagem, tipo: 'aviso', etapa });
  const catalogo = catalogoComercial();
  if (catalogo.estado === 'ausente') avisa('catalogo', MENSAGEM_CATALOGO_AUSENTE, 'itens');
  if (!itens.length) bloqueia('sem-itens', 'Inclua pelo menos um item.', 'itens');
  for (const item of itens) {
    if (item.tipo_item === 'oferta') {
      const oferta = item.oferta_id ? await catalogo.oferta(item.oferta_id) : null;
      if (!oferta || oferta.situacao !== 'aprovada') bloqueia(`oferta-${item.id}`, `${item.descricao}: a oferta não está Aprovada no catálogo.`, 'itens');
      if (item.valor_unitario === null) bloqueia(`preco-${item.id}`, `${item.descricao}: sem preço aprovado vigente neste canal e periodicidade.`, 'itens');
    } else {
      if (item.valor_unitario === null) bloqueia(`valor-${item.id}`, `${item.descricao}: informe o valor.`, 'itens');
      else if (!item.justificativa_valor) bloqueia(`just-${item.id}`, `${item.descricao}: valor sob medida exige justificativa.`, 'itens');
      if (!ficha.viabilidade) avisa(`viab-${item.id}`, `Viabilidade não registrada para ${item.descricao} (RN-10.06).`, 'itens');
    }
    if ((item.desconto_percentual || item.desconto_valor) && !item.desconto_justificativa) bloqueia(`desc-${item.id}`, `${item.descricao}: desconto sem justificativa (RN-10.09).`, 'itens');
    if (item.recurso_planejado && !item.recurso_previsto_para) bloqueia(`plan-${item.id}`, `${item.descricao}: recurso planejado sem data de disponibilidade (RN-10.07).`, 'escopo');
    if (item.recurso_planejado && !ficha.viabilidade) avisa(`viabp-${item.id}`, `Viabilidade não registrada para o recurso planejado de ${item.descricao}.`, 'escopo');
  }
  const entidade = versao.entidade_id ? await repositorios.entidade.obter(versao.entidade_id) : null;
  if (!entidade) bloqueia('entidade', 'Escolha a entidade emissora.', 'cabecalho');
  else for (const [indice, mensagem] of pendenciasDaEntidade(entidade, await repositorios.entidade_licenciante.listar({ onde: { entidade_id: entidade.id } })).entries()) bloqueia(`entidade-${indice}`, mensagem, 'cabecalho');
  if (versao.validade < hoje && (versao.situacao === 'rascunho' || versao.situacao === 'pronta')) bloqueia('validade', 'A validade já passou: ajuste a data.', 'cabecalho');
  const modelo = versao.modelo_versao_id ? await repositorios.modelo_versao.obter(versao.modelo_versao_id) : null;
  let nos: DocumentoDaProposta['nos'] = [];
  let faltando: string[] = [];
  const dados = await dadosDoModeloDaProposta(ficha, versao, itens, hoje);
  if (!modelo) bloqueia('modelo', 'Escolha o modelo de proposta (Legal › Modelos).', 'cabecalho');
  else {
    if (modelo.situacao !== 'validada') avisa('modelo-nao-validado', 'Modelo não validado: a emissão final pede confirmação e motivo (RN-09.13).', 'cabecalho');
    const documento = renderizarVersao(modelo, await repositorios.clausula_versao.listar(), dados);
    nos = documento.nos;
    faltando = documento.faltando;
    for (const nome of faltando) bloqueia(`var-${nome}`, `Variável obrigatória vazia: ${nome}.`, 'revisao');
  }
  return { pendencias, nos, dados, modeloNaoValidado: Boolean(modelo && modelo.situacao !== 'validada'), faltando };
}

export function bloqueiaEmissao(pendencias: readonly Pendencia[]): boolean {
  return pendencias.some((pendencia) => pendencia.tipo === 'bloqueia');
}

/** T10.06: rascunho leva marca d'água e não muda nada; final grava o snapshot e a versão fica Pronta para envio. */
export async function emitirProposta(propostaId: string, final: boolean, opcoes: { confirmarModeloNaoValidado?: boolean; motivo?: string } = {}, hoje: string = hojeISO()) {
  const ficha = await carregarProposta(propostaId);
  if (!ficha) throw new ErroDeRegra('Esta proposta não existe mais.');
  const versao = ficha.atual;
  if (final && versao.situacao !== 'rascunho' && versao.situacao !== 'pronta') throw new ErroDeRegra('Esta versão já foi enviada. Crie uma nova versão.');
  const documento = await montarDocumentoDaProposta(ficha, versao, hoje);
  if (!versao.modelo_versao_id) throw new ErroDeRegra('Escolha o modelo de proposta antes de emitir.');
  if (final && bloqueiaEmissao(documento.pendencias)) throw new ErroDeRegra(documento.pendencias.find((pendencia) => pendencia.tipo === 'bloqueia')?.mensagem as string);
  const modelo = await repositorios.modelo_versao.obter(versao.modelo_versao_id);
  const modeloDocumento = modelo ? await repositorios.modelo_documento.obter(modelo.modelo_id) : null;
  return emTransacao(async () => {
    const emitido = await emitirDocumento({ registroTipo: 'proposta_versao', registroId: versao.id, modeloVersao: modelo, modeloCodigo: modeloDocumento?.codigo ?? null, final, nos: documento.nos, dados: documento.dados, confirmarModeloNaoValidado: opcoes.confirmarModeloNaoValidado, motivo: opcoes.motivo, titulo: `${ficha.proposta.codigo} V${versao.numero}` });
    if (final) await repositorios.proposta_versao.atualizar(versao.id, { situacao: 'pronta', snapshot: { dados: documento.dados, itens: ficha.itens, emitido_em: emitido.emitido_em } as Record<string, unknown>, documento_emitido_id: emitido.id });
    return emitido;
  });
}

export async function voltarParaRascunho(versaoId: string): Promise<void> {
  const versao = await repositorios.proposta_versao.obter(versaoId);
  if (versao?.situacao !== 'pronta') throw new ErroDeRegra('Só a versão pronta, ainda não enviada, volta a rascunho.');
  await repositorios.proposta_versao.atualizar(versaoId, { situacao: 'rascunho', documento_emitido_id: null, snapshot: null });
}

// ---------- Envio, aceite e recusa (T10.07) ----------

export async function registrarEnvio(versaoId: string, { data, canal, para, evidencia }: { data: string; canal: string; para: string; evidencia: string }, hoje: string = hojeISO()): Promise<void> {
  const versao = await repositorios.proposta_versao.obter(versaoId);
  if (versao?.situacao !== 'pronta') throw new ErroDeRegra('Emita o documento final antes de registrar o envio.');
  if (!data || data > hoje) throw new ErroDeRegra('Informe a data do envio, até hoje.');
  if (!canal.trim()) throw new ErroDeRegra('Diga por onde foi enviada.');
  if (!para.trim()) throw new ErroDeRegra('Diga para quem foi enviada.');
  if (evidencia.trim() && !linkDoDriveValido(evidencia.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await emTransacao(async () => {
    await repositorios.proposta_versao.atualizar(versaoId, { situacao: 'enviada', enviada_em: data, enviada_canal: canal.trim(), enviada_para: para.trim(), enviada_evidencia_url: evidencia.trim() || null });
    if (versao.documento_emitido_id) await repositorios.documento_emitido.atualizar(versao.documento_emitido_id, { enviado: true });
  });
}

/** RN-10.12: o aceite aponta para uma versão e não é a assinatura do contrato. As demais abertas ficam Substituídas (RN-10.11). */
export async function registrarAceite(versaoId: string, { data, forma, evidencia }: { data: string; forma: NonNullable<PropostaVersao['aceite_forma']> | ''; evidencia: string }, hoje: string = hojeISO()): Promise<void> {
  const versao = await repositorios.proposta_versao.obter(versaoId);
  if (!versao) throw new ErroDeRegra('Esta versão não existe mais.');
  if (versao.situacao === 'expirada') throw new ErroDeRegra('A validade desta versão passou. Use “Reabrir validade”, com o motivo, antes do aceite (RN-10.10).');
  if (versao.situacao !== 'enviada') throw new ErroDeRegra('Só a versão enviada recebe aceite.');
  if (!data || data > hoje) throw new ErroDeRegra('Informe a data do aceite, até hoje.');
  if (versao.enviada_em && data < versao.enviada_em) throw new ErroDeRegra('O aceite não pode ser antes do envio.');
  if (!forma) throw new ErroDeRegra('Diga a forma do aceite.');
  if (!evidencia.trim()) throw new ErroDeRegra('Cole o link da evidência do aceite.');
  if (!linkDoDriveValido(evidencia.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await emTransacao(async () => {
    await repositorios.proposta_versao.atualizar(versaoId, { situacao: 'aceita', aceite_em: data, aceite_forma: forma, aceite_evidencia_url: evidencia.trim(), aceite_registrado_por: idDaPessoaAtual() });
    for (const outra of await repositorios.proposta_versao.listar({ onde: { proposta_id: versao.proposta_id } })) {
      if (outra.id !== versaoId && ['rascunho', 'pronta', 'enviada', 'expirada'].includes(outra.situacao)) await repositorios.proposta_versao.atualizar(outra.id, { situacao: 'substituida' });
    }
    await repositorios.proposta.atualizar(versao.proposta_id, { versao_aceita_id: versaoId });
  });
}

export async function registrarRecusa(versaoId: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Recusa exige motivo.');
  const versao = await repositorios.proposta_versao.obter(versaoId);
  if (versao?.situacao !== 'enviada' && versao?.situacao !== 'expirada') throw new ErroDeRegra('Só a versão enviada é recusada.');
  await repositorios.proposta_versao.atualizar(versaoId, { situacao: 'recusada', recusa_motivo: motivo.trim() }, { motivo: motivo.trim() });
}

export async function reabrirValidade(versaoId: string, novaValidade: string, motivo: string, hoje: string = hojeISO()): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Reabrir a validade exige motivo.');
  if (!novaValidade || novaValidade < hoje) throw new ErroDeRegra('A nova validade precisa ser hoje ou depois.');
  const versao = await repositorios.proposta_versao.obter(versaoId);
  if (versao?.situacao !== 'expirada') throw new ErroDeRegra('Só a versão expirada tem a validade reaberta.');
  await repositorios.proposta_versao.atualizar(versaoId, { situacao: 'enviada', validade: novaValidade, validade_reaberta_motivo: motivo.trim() }, { motivo: motivo.trim() });
}

/** T10.07: copia a versão atual para um rascunho novo, com o preço vigente de novo no rascunho. */
export async function novaVersaoDaProposta(propostaId: string, hoje: string = hojeISO()): Promise<PropostaVersao> {
  const proposta = await repositorios.proposta.obter(propostaId);
  if (!proposta) throw new ErroDeRegra('Esta proposta não existe mais.');
  if (proposta.versao_aceita_id) throw new ErroDeRegra('Esta proposta já foi aceita. Mudanças depois disso seguem pelo contrato.');
  const versoes = (await repositorios.proposta_versao.listar({ onde: { proposta_id: propostaId } })).sort((a, b) => b.numero - a.numero);
  if (versoes.some((versao) => versao.situacao === 'rascunho')) throw new ErroDeRegra('Já existe um rascunho desta proposta (RN-10.11).');
  const atual = versoes[0];
  if (!atual) throw new ErroDeRegra('Esta proposta não tem versão.');
  const configuracao = await repositorios.configuracao.ler();
  return emTransacao(async () => {
    const { id: _id, criado_em: _c, criado_por: _cp, atualizado_em: _a, atualizado_por: _ap, arquivado_em: _ar, arquivado_por: _arp, versao_registro: _v, exemplo: _e, ...copia } = atual;
    const nova = await repositorios.proposta_versao.criar({ ...versaoVazia(propostaId, atual.numero + 1, somarDias(hoje, configuracao.validade_proposta_dias), atual.entidade_id), entidade_id: copia.entidade_id, modelo_versao_id: copia.modelo_versao_id, contatos: copia.contatos, escopo_incluido: copia.escopo_incluido, escopo_excluido: copia.escopo_excluido, premissas: copia.premissas, dependencias: copia.dependencias, condicoes: copia.condicoes });
    // Pronta que não chegou a ir fica substituída pelo rascunho novo.
    if (atual.situacao === 'pronta') await repositorios.proposta_versao.atualizar(atual.id, { situacao: 'substituida' });
    for (const item of await itensDaVersao(atual.id)) {
      const { id: _i, criado_em: _ic, criado_por: _icp, atualizado_em: _ia, atualizado_por: _iap, arquivado_em: _iar, arquivado_por: _iarp, versao_registro: _iv, exemplo: _ie, ...dadosDoItem } = item;
      await repositorios.proposta_item.criar({ ...dadosDoItem, versao_id: nova.id });
    }
    return nova;
  });
}

/** Rotina do dia (RN-10.10): versão enviada depois da validade vira Expirada. */
export async function expirarPropostas(hoje: string = hojeISO()): Promise<number> {
  const enviadas = await repositorios.proposta_versao.listar({ onde: { situacao: 'enviada' } });
  const vencidas = enviadas.filter((versao) => versao.validade < hoje);
  await emTransacao(async () => {
    for (const versao of vencidas) await repositorios.proposta_versao.atualizar(versao.id, { situacao: 'expirada' });
  });
  return vencidas.length;
}

// ---------- Funil (T10.02) e visão comercial ----------

export type LinhaDaOportunidade = Oportunidade & { produtos: string[]; proxima: Atividade | null; propostas: number; aceita: boolean };

export type DadosComerciais = { oportunidades: LinhaDaOportunidade[]; contrapartes: Contraparte[]; produtos: Produto[]; pessoas: Pessoa[]; campanhas: { id: string; codigo: string; nome: string; situacao: string }[] };

export async function carregarComercial(): Promise<DadosComerciais> {
  const [campanhas, oportunidades, ligacoes, vinculos, atividades, propostas, contrapartes, produtos, pessoas] = await Promise.all([repositorios.campanha.listar({ incluirArquivados: true }), repositorios.oportunidade.listar(), repositorios.oportunidade_produto.listar(), repositorios.vinculo.listar(), repositorios.atividade.listar(), repositorios.proposta.listar(), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.produto.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  const atividadesDa = (id: string) => {
    const ids = new Set(vinculos.flatMap((vinculo) => (vinculo.origem_tipo === 'atividade' && vinculo.destino_tipo === 'oportunidade' && vinculo.destino_id === id ? [vinculo.origem_id] : vinculo.destino_tipo === 'atividade' && vinculo.origem_tipo === 'oportunidade' && vinculo.origem_id === id ? [vinculo.destino_id] : [])));
    return atividades.filter((atividade) => ids.has(atividade.id));
  };
  return {
    campanhas: campanhas.map((campanha) => ({ id: campanha.id, codigo: campanha.codigo, nome: campanha.nome, situacao: campanha.situacao })),
    oportunidades: oportunidades.map((oportunidade) => {
      const proprias = propostas.filter((proposta) => proposta.oportunidade_id === oportunidade.id);
      return { ...oportunidade, produtos: ligacoes.filter((ligacao) => ligacao.oportunidade_id === oportunidade.id).map((ligacao) => ligacao.produto_id), proxima: proximaAcao(atividadesDa(oportunidade.id)), propostas: proprias.length, aceita: proprias.some((proposta) => proposta.versao_aceita_id) };
    }),
    contrapartes,
    produtos,
    pessoas,
  };
}

export const estaAbertaNoFunil = (oportunidade: Pick<Oportunidade, 'etapa'>) => ETAPAS_ABERTAS.includes(oportunidade.etapa);
/** RN-10.02: encerradas não precisam de próxima ação. */
export const semProximaAcao = (oportunidade: Pick<LinhaDaOportunidade, 'etapa' | 'proxima'>) => estaAbertaNoFunil(oportunidade) && !oportunidade.proxima;
export const acaoAtrasada = (oportunidade: Pick<LinhaDaOportunidade, 'proxima'>, hoje: string) => Boolean(oportunidade.proxima?.prazo && oportunidade.proxima.prazo < hoje);

export function diasNaEtapa(oportunidade: Pick<Oportunidade, 'etapa_desde'>, hoje: string): number {
  return Math.max(0, Math.round((new Date(`${hoje}T00:00:00Z`).getTime() - new Date(`${oportunidade.etapa_desde}T00:00:00Z`).getTime()) / 86_400_000));
}

export type FiltrosFunil = { busca: string; produto: string; responsavel: string; origem: string; semProxima: boolean; criadaDe: string; criadaAte: string };
export const FILTROS_FUNIL_INICIAIS: FiltrosFunil = { busca: '', produto: '', responsavel: '', origem: '', semProxima: false, criadaDe: '', criadaAte: '' };

export function filtrarOportunidades(linhas: readonly LinhaDaOportunidade[], filtros: FiltrosFunil, nomeDaContraparte: (id: string) => string): LinhaDaOportunidade[] {
  const termo = filtros.busca.trim().toLowerCase();
  return linhas.filter((linha) => {
    if (filtros.produto && !linha.produtos.includes(filtros.produto)) return false;
    if (filtros.responsavel && linha.responsavel_id !== filtros.responsavel) return false;
    if (filtros.origem && linha.origem !== filtros.origem) return false;
    if (filtros.semProxima && !semProximaAcao(linha)) return false;
    const criada = linha.criado_em.slice(0, 10);
    if (filtros.criadaDe && criada < filtros.criadaDe) return false;
    if (filtros.criadaAte && criada > filtros.criadaAte) return false;
    return !termo || `${linha.codigo} ${linha.titulo} ${nomeDaContraparte(linha.contraparte_id)}`.toLowerCase().includes(termo);
  });
}

/** Totais por coluna (T10.02): por periodicidade, e o que não tem valor fica contado à parte, nunca como zero. */
export function totaisDaColuna(linhas: readonly Pick<Oportunidade, 'valor_estimado' | 'valor_periodicidade'>[]): { quantidade: number; valores: { periodicidade: string; valor: number }[]; semValor: number } {
  const totais = totaisDosItens(linhas.map((linha) => ({ valor_total: linha.valor_estimado, recorrente: linha.valor_periodicidade !== 'unica', periodicidade: linha.valor_periodicidade })));
  return { quantidade: linhas.length, valores: [...(totais.unico ? [{ periodicidade: 'unica', valor: totais.unico }] : []), ...totais.recorrentes], semValor: totais.semValor };
}

export function textoDosValores(valores: readonly { periodicidade: string; valor: number }[]): string {
  return valores.map((linha) => `${formatarDinheiro(linha.valor, 'BRL')}${linha.periodicidade === 'unica' ? ' único' : `/${linha.periodicidade === 'mensal' ? 'mês' : ROTULOS_PERIODICIDADE_VALOR[linha.periodicidade as keyof typeof ROTULOS_PERIODICIDADE_VALOR].toLowerCase()}`}`).join(' · ');
}

/** Relatório rápido do funil (T10.02): conversão por etapa, motivos de perda e tempo médio das encerradas. */
export function relatorioDoFunil(linhas: readonly Oportunidade[]) {
  const porEtapa = ETAPAS_FUNIL.map((etapa) => ({ etapa, quantidade: linhas.filter((linha) => linha.etapa === etapa).length }));
  const encerradas = linhas.filter((linha) => linha.etapa === 'ganha' || linha.etapa === 'perdida');
  const ganhas = linhas.filter((linha) => linha.etapa === 'ganha').length;
  const motivos = MOTIVOS_PERDA.map((motivo) => ({ motivo, quantidade: linhas.filter((linha) => linha.motivo_perda === motivo).length })).filter((linha) => linha.quantidade);
  const duracoes = encerradas.map((linha) => diasNaEtapa({ etapa_desde: linha.criado_em.slice(0, 10) }, (linha.ganha_em ?? linha.perdida_em) as string));
  return { porEtapa, conversao: encerradas.length ? Math.round((ganhas / encerradas.length) * 100) : null, motivos, tempoMedioDias: duracoes.length ? Math.round(duracoes.reduce((total, dias) => total + dias, 0) / duracoes.length) : null };
}

export { formatarDiaISO };
