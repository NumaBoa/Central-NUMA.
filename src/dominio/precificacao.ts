/**
 * Ofertas, canais, versões de preço e simulações salvas (M07 §3 e T07.04 a T07.07 e T07.09). Cada produto tem os
 * seus (RN-07.01). As contas ficam em `simulador.ts`. M10 e M11 devem ler o preço por `precoVigente` e guardar o id
 * da versão: a linha aprovada não muda depois, e o `snapshot` guarda o que valia na aprovação (RT-10 e CA-07.02).
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import { FORMALIZACOES_DE_OFERTA, PERIODICIDADES_DE_PRECO, PUBLICOS_DE_OFERTA, TIPOS_DE_CANAL, TIPOS_DE_OFERTA, type CanalDaSimulacao, type CanalVenda, type Concorrente, type Oferta, type OfertaRecurso, type PrecoVersao, type Premissas, type Resultados, type Simulacao } from '@/dados/tipos/precificacao';
import { hojeISO } from '@/lib/datas';
import { somarMeses } from './cobrancas';
import { lerValor, valorParaCampo } from './dinheiro';
import { errosDaDecisao, resolverDecisao, vincularDecisao, type EntradaDecisao } from './decisoes';
import { normalizarTexto } from './duplicidade';
import { ultimoCambio } from './ferramentas';
import { calcularSimulacao, cenarioPrincipal, custoFixoFoiSubstituido, linhaPrincipal, MAXIMO_DE_CANAIS, MAXIMO_DE_VOLUMES, MENSAGEM_TAXAS_100, precoMensal, premissasVazias, VOLUMES_PADRAO } from './simulador';

// ---------- Rótulos ----------

export const ROTULOS_TIPO_OFERTA: Readonly<Record<Oferta['tipo'], string>> = { assinatura: 'Assinatura', implantacao: 'Implantação/setup', servico_pontual: 'Serviço pontual', sob_medida: 'Sob medida', consumo: 'Consumo/uso', comissao: 'Comissão', gratuidade: 'Gratuidade' };
export const ROTULOS_PUBLICO_OFERTA: Readonly<Record<Oferta['publico'], string>> = { b2c: 'B2C', b2b: 'B2B', parceiro: 'Parceiro' };
export const ROTULOS_FORMALIZACAO: Readonly<Record<Oferta['formalizacao'], string>> = { adesao: 'Adesão padrão (termos)', negociado: 'Contrato negociado', ambos: 'Ambos' };
export const ROTULOS_PERIODICIDADE_PRECO: Readonly<Record<PrecoVersao['periodicidade'], string>> = { mensal: 'Mensal', anual: 'Anual', unica: 'Única', por_uso: 'Por uso' };
export const ROTULOS_SITUACAO_OFERTA: Readonly<Record<Oferta['situacao'], string>> = { em_estudo: 'Em estudo', aprovada: 'Aprovada', inativa: 'Inativa' };
export const ROTULOS_SITUACAO_PRECO: Readonly<Record<PrecoVersao['situacao'], string>> = { rascunho: 'Rascunho', aprovada: 'Aprovada', substituida: 'Substituída' };
export const ROTULOS_TIPO_CANAL: Readonly<Record<CanalVenda['tipo'], string>> = { loja_ios: 'Loja iOS', loja_android: 'Loja Android', web_gateway: 'Web com gateway', direto: 'Direto (PIX/boleto/transferência)', patrocinio: 'Patrocínio', outro: 'Outro' };
export const NAO_DEFINIDO = 'Não definido';
export const TODOS_OS_CANAIS = 'Todos os canais';

// ---------- Leitura dos campos: vazio é `null`, e inválido é `undefined` ----------

export function lerValorDoCampo(texto: string): number | null | undefined {
  if (!texto.trim()) return null;
  const valor = lerValor(texto);
  return valor === null || valor < 0 ? undefined : valor;
}

/** De 0 a 100, com até 4 casas (02 §6). */
export function lerPercentual(texto: string): number | null | undefined {
  const limpo = texto.trim().replace(/%$/, '').trim();
  if (!limpo) return null;
  if (!/^\d{1,3}([.,]\d{1,4})?$/.test(limpo)) return undefined;
  const valor = Number(limpo.replace(',', '.'));
  return valor > 100 ? undefined : valor;
}

export function percentualParaCampo(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

export function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function lerInteiro(texto: string): number | null | undefined {
  const limpo = texto.trim();
  if (!limpo) return null;
  return /^\d{1,6}$/.test(limpo) ? Number(limpo) : undefined;
}

export function linkHttpValido(texto: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(texto).protocol);
  } catch {
    return false;
  }
}

const MENSAGEM_VALOR = 'Use um valor como 19,90. Zero é 0,00; sem valor, deixe vazio.';
const MENSAGEM_PERCENTUAL = 'Use um percentual de 0 a 100, como 15 ou 3,5.';
const MENSAGEM_LINK = 'Use um link completo, começando com https://.';

// ---------- Canais de venda (T07.05 e RN-07.09) ----------

export const esquemaFormularioCanal = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do canal.'),
    tipo: z.enum(TIPOS_DE_CANAL),
    taxa_percentual: z.string(),
    taxa_fixa: z.string(),
    taxa_fixa_moeda: z.string(),
    prazo_repasse_dias: z.string(),
    moeda_repasse: z.string(),
    observacao: z.string().trim(),
    verificado_em: z.string(),
    fonte_url: z.string().trim(),
    situacao: z.enum(['ativo', 'inativo']),
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    const percentual = lerPercentual(dados.taxa_percentual);
    const fixa = lerValorDoCampo(dados.taxa_fixa);
    if (percentual === undefined) falha('taxa_percentual', MENSAGEM_PERCENTUAL);
    if (fixa === undefined) falha('taxa_fixa', MENSAGEM_VALOR);
    if (lerInteiro(dados.prazo_repasse_dias) === undefined) falha('prazo_repasse_dias', 'Use o número de dias, como 30.');
    if (dados.fonte_url && !linkHttpValido(dados.fonte_url)) falha('fonte_url', MENSAGEM_LINK);
    // Taxa sem origem é taxa presumida (RN-07.09): quem informa diz de onde veio e quando conferiu.
    if (percentual !== null || fixa !== null) {
      if (!dados.verificado_em) falha('verificado_em', 'Informe quando a taxa foi conferida.');
      if (!dados.fonte_url) falha('fonte_url', 'Informe de onde a taxa veio.');
    }
    if (dados.verificado_em && dados.verificado_em > hojeISO()) falha('verificado_em', 'A verificação precisa já ter acontecido.');
  });

export type FormularioCanal = z.infer<typeof esquemaFormularioCanal>;

export const FORMULARIO_CANAL_VAZIO: FormularioCanal = { nome: '', tipo: 'web_gateway', taxa_percentual: '', taxa_fixa: '', taxa_fixa_moeda: 'BRL', prazo_repasse_dias: '', moeda_repasse: 'BRL', observacao: '', verificado_em: '', fonte_url: '', situacao: 'ativo' };

export function formularioDoCanal(canal: CanalVenda): FormularioCanal {
  return {
    nome: canal.nome,
    tipo: canal.tipo,
    taxa_percentual: canal.taxa_percentual === null ? '' : percentualParaCampo(canal.taxa_percentual),
    taxa_fixa: canal.taxa_fixa === null ? '' : valorParaCampo(canal.taxa_fixa),
    taxa_fixa_moeda: canal.taxa_fixa_moeda ?? 'BRL',
    prazo_repasse_dias: canal.prazo_repasse_dias === null ? '' : String(canal.prazo_repasse_dias),
    moeda_repasse: canal.moeda_repasse ?? 'BRL',
    observacao: canal.observacao ?? '',
    verificado_em: canal.verificado_em ?? '',
    fonte_url: canal.fonte_url ?? '',
    situacao: canal.situacao,
  };
}

export async function salvarCanal(formulario: FormularioCanal, id?: string): Promise<CanalVenda> {
  const canais = await repositorios.canal_venda.listar();
  if (canais.some((canal) => canal.id !== id && normalizarTexto(canal.nome) === normalizarTexto(formulario.nome))) throw new ErroDeRegra('Já existe um canal com esse nome.');
  const taxa_fixa = lerValorDoCampo(formulario.taxa_fixa) ?? null;
  const dados = {
    nome: formulario.nome,
    tipo: formulario.tipo,
    taxa_percentual: lerPercentual(formulario.taxa_percentual) ?? null,
    taxa_fixa,
    taxa_fixa_moeda: taxa_fixa === null ? null : formulario.taxa_fixa_moeda || 'BRL',
    prazo_repasse_dias: lerInteiro(formulario.prazo_repasse_dias) ?? null,
    moeda_repasse: formulario.moeda_repasse || null,
    observacao: formulario.observacao || null,
    verificado_em: formulario.verificado_em || null,
    fonte_url: formulario.fonte_url || null,
    situacao: formulario.situacao,
  };
  return id ? repositorios.canal_venda.atualizar(id, dados) : repositorios.canal_venda.criar(dados);
}

export type AlertaDoCanal = 'sem_verificacao' | 'vencida' | null;

/** "Alerta quando a última verificação tiver mais de 12 meses" (T07.05). */
export function alertaDoCanal(canal: Pick<CanalVenda, 'verificado_em'>, hoje: string): AlertaDoCanal {
  if (!canal.verificado_em) return 'sem_verificacao';
  return somarMeses(canal.verificado_em, 12) < hoje ? 'vencida' : null;
}

/** O canal como vai para a simulação. Taxa fixa em outra moeda só entra convertida (RT-07). */
export function canalParaSimulacao(canal: CanalVenda, cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[]): CanalDaSimulacao {
  const moeda = canal.taxa_fixa_moeda;
  const estrangeira = canal.taxa_fixa !== null && moeda !== null && moeda !== 'BRL';
  const cambio = estrangeira ? ultimoCambio(moeda, cambios) : null;
  return {
    canal_id: canal.id,
    nome: canal.nome,
    taxa_percentual: canal.taxa_percentual,
    taxa_fixa: canal.taxa_fixa === null ? null : estrangeira ? (cambio === null ? null : canal.taxa_fixa * cambio) : canal.taxa_fixa,
    taxa_fixa_original: canal.taxa_fixa,
    taxa_fixa_moeda: moeda,
    cambio,
    verificado_em: canal.verificado_em,
    fonte_url: canal.fonte_url,
  };
}

// ---------- Ofertas (T07.04) ----------

const esquemaRecursoDoFormulario = z.object({
  id: z.string(),
  nome: z.string().trim().min(1, 'Informe o nome do recurso.'),
  incluido: z.boolean(),
  limite: z.string().trim(),
  observacao: z.string().trim(),
});

export const esquemaFormularioOferta = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome da oferta.'),
    tipo: z.enum(TIPOS_DE_OFERTA),
    publico: z.enum(PUBLICOS_DE_OFERTA),
    descricao: z.string().trim(),
    formalizacao: z.enum(FORMALIZACOES_DE_OFERTA),
    periodicidade: z.string(),
    exclusoes: z.string().trim(),
    recursos: z.array(esquemaRecursoDoFormulario),
    // Para o contrato SaaS (19 §8): tudo opcional aqui; o que faltar vira pendência na emissão final.
    regras_uso: z.string().trim(),
    suporte_canal: z.string().trim(),
    suporte_horario: z.string().trim(),
    suporte_prazo_critico: z.string().trim(),
    suporte_prazo_normal: z.string().trim(),
    disponibilidade_meta: z.string().trim(),
    disponibilidade_compensacao: z.string().trim(),
    teste_dias: z.string().trim(),
    adicionais_ids: z.array(z.string()),
  })
  .superRefine((dados, contexto) => {
    if (dados.tipo === 'assinatura' && !dados.periodicidade) contexto.addIssue({ code: 'custom', path: ['periodicidade'], message: 'Assinatura precisa da periodicidade.' });
    if (dados.teste_dias && !/^\d{1,3}$/.test(dados.teste_dias)) contexto.addIssue({ code: 'custom', path: ['teste_dias'], message: 'Informe o número de dias, de 0 a 999.' });
    const meta = lerPercentual(dados.disponibilidade_meta);
    if (meta === undefined) contexto.addIssue({ code: 'custom', path: ['disponibilidade_meta'], message: 'Informe um percentual de 0 a 100, como 99,5.' });
  });


export type FormularioOferta = z.infer<typeof esquemaFormularioOferta>;

export const FORMULARIO_OFERTA_VAZIO: FormularioOferta = { nome: '', tipo: 'assinatura', publico: 'b2c', descricao: '', formalizacao: 'adesao', periodicidade: 'mensal', exclusoes: '', recursos: [], regras_uso: '', suporte_canal: '', suporte_horario: '', suporte_prazo_critico: '', suporte_prazo_normal: '', disponibilidade_meta: '', disponibilidade_compensacao: '', teste_dias: '', adicionais_ids: [] };

export function formularioDaOferta(oferta: Oferta, recursos: readonly OfertaRecurso[]): FormularioOferta {
  return {
    nome: oferta.nome,
    tipo: oferta.tipo,
    publico: oferta.publico,
    descricao: oferta.descricao ?? '',
    formalizacao: oferta.formalizacao,
    periodicidade: oferta.periodicidade ?? '',
    exclusoes: oferta.exclusoes ?? '',
    recursos: [...recursos].sort((a, b) => a.ordem - b.ordem).map((recurso) => ({ id: recurso.id, nome: recurso.nome, incluido: recurso.incluido, limite: recurso.limite ?? '', observacao: recurso.observacao ?? '' })),
    regras_uso: oferta.regras_uso ?? '',
    suporte_canal: oferta.suporte_canal ?? '',
    suporte_horario: oferta.suporte_horario ?? '',
    suporte_prazo_critico: oferta.suporte_prazo_critico ?? '',
    suporte_prazo_normal: oferta.suporte_prazo_normal ?? '',
    disponibilidade_meta: oferta.disponibilidade_meta === null ? '' : String(oferta.disponibilidade_meta).replace('.', ','),
    disponibilidade_compensacao: oferta.disponibilidade_compensacao ?? '',
    teste_dias: oferta.teste_dias === null ? '' : String(oferta.teste_dias),
    adicionais_ids: [...oferta.adicionais_ids],
  };
}

function camposDoContrato(formulario: FormularioOferta, adicionais: string[]) {
  return {
    regras_uso: formulario.regras_uso || null,
    suporte_canal: formulario.suporte_canal || null,
    suporte_horario: formulario.suporte_horario || null,
    suporte_prazo_critico: formulario.suporte_prazo_critico || null,
    suporte_prazo_normal: formulario.suporte_prazo_normal || null,
    disponibilidade_meta: lerPercentual(formulario.disponibilidade_meta) ?? null,
    disponibilidade_compensacao: formulario.disponibilidade_compensacao || null,
    teste_dias: formulario.teste_dias ? Number(formulario.teste_dias) : null,
    adicionais_ids: adicionais,
  };
}

/** RN-07.02: nasce Em estudo e sem preço. Nome único no produto. */
export async function salvarOferta(produtoId: string, formulario: FormularioOferta, id?: string): Promise<Oferta> {
  const [ofertas, precos] = await Promise.all([repositorios.oferta.listar({ onde: { produto_id: produtoId } }), id ? repositorios.preco_versao.listar({ onde: { oferta_id: id } }) : Promise.resolve([])]);
  if (ofertas.some((oferta) => oferta.id !== id && normalizarTexto(oferta.nome) === normalizarTexto(formulario.nome))) throw new ErroDeRegra('Este produto já tem uma oferta com esse nome.');
  const atual = id ? ofertas.find((oferta) => oferta.id === id) : undefined;
  if (id && !atual) throw new ErroDeRegra('Esta oferta não é deste produto.');
  // Gratuidade vale zero, e as demais não: trocar depois de aprovar mudaria o sentido do preço aprovado.
  const trocaGratuidade = atual && (atual.tipo === 'gratuidade') !== (formulario.tipo === 'gratuidade');
  if (trocaGratuidade && precos.some((preco) => preco.situacao !== 'rascunho')) throw new ErroDeRegra('Esta oferta já tem preço aprovado: não dá para mudar de ou para Gratuidade. Crie outra oferta.');
  // Adicional é outra oferta do mesmo produto, nunca a própria (19 §8).
  const adicionais = [...new Set(formulario.adicionais_ids)];
  if (adicionais.some((adicional) => adicional === id || !ofertas.some((oferta) => oferta.id === adicional))) throw new ErroDeRegra('Os adicionais precisam ser outras ofertas deste produto.');

  const dados = { nome: formulario.nome, tipo: formulario.tipo, publico: formulario.publico, descricao: formulario.descricao || null, formalizacao: formulario.formalizacao, periodicidade: (formulario.periodicidade || null) as Oferta['periodicidade'], exclusoes: formulario.exclusoes || null, ...camposDoContrato(formulario, adicionais) };
  return emTransacao(async () => {
    const oferta = atual ? await repositorios.oferta.atualizar(atual.id, dados) : await repositorios.oferta.criar({ ...dados, produto_id: produtoId, sla_regra_id: null, situacao: 'em_estudo' });
    const existentes = await repositorios.oferta_recurso.listar({ onde: { oferta_id: oferta.id } });
    const mantidos = new Set(formulario.recursos.map((recurso) => recurso.id).filter(Boolean));
    for (const recurso of existentes) if (!mantidos.has(recurso.id)) await repositorios.oferta_recurso.arquivar(recurso.id);
    for (const [ordem, recurso] of formulario.recursos.entries()) {
      const campos = { nome: recurso.nome, incluido: recurso.incluido, limite: recurso.limite || null, observacao: recurso.observacao || null, ordem };
      if (recurso.id && existentes.some((linha) => linha.id === recurso.id)) await repositorios.oferta_recurso.atualizar(recurso.id, campos);
      else await repositorios.oferta_recurso.criar({ oferta_id: oferta.id, planejado: false, disponivel_previsto_em: null, ...campos });
    }
    return oferta;
  });
}

export async function inativarOferta(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo.');
  await repositorios.oferta.atualizar(id, { situacao: 'inativa' }, { motivo: motivo.trim() });
}

export async function reativarOferta(id: string, hoje: string = hojeISO()): Promise<void> {
  const precos = await repositorios.preco_versao.listar({ onde: { oferta_id: id } });
  await repositorios.oferta.atualizar(id, { situacao: precos.some((preco) => versaoVigenteEm(preco, hoje)) ? 'aprovada' : 'em_estudo' });
}

// ---------- Vigência (RN-07.05 e RN-07.07) ----------

/** Aprovada ou substituída, dentro das datas. A substituída ainda vale até o dia anterior ao início da nova. */
export function versaoVigenteEm(preco: Pick<PrecoVersao, 'situacao' | 'valido_de' | 'valido_ate' | 'arquivado_em'>, dia: string): boolean {
  if (preco.situacao === 'rascunho' || preco.arquivado_em || !preco.valido_de) return false;
  return preco.valido_de <= dia && (!preco.valido_ate || dia <= preco.valido_ate);
}

export type FaseDaVersao = 'rascunho' | 'vigente' | 'futura' | 'encerrada';

export function faseDaVersao(preco: PrecoVersao, hoje: string): FaseDaVersao {
  if (preco.situacao === 'rascunho') return 'rascunho';
  if (versaoVigenteEm(preco, hoje)) return 'vigente';
  return preco.valido_de && preco.valido_de > hoje ? 'futura' : 'encerrada';
}

/**
 * O preço que vale na data: o do canal e, sem ele, o de todos os canais. É a porta de entrada de M10 e M11.
 * `canalId` `null` procura só o de "todos os canais".
 */
export function precoVigente(precos: readonly PrecoVersao[], canalId: string | null, dia: string): PrecoVersao | null {
  const validos = precos.filter((preco) => versaoVigenteEm(preco, dia));
  return validos.find((preco) => preco.canal_id === canalId) ?? validos.find((preco) => preco.canal_id === null) ?? null;
}

/** RN-07.07: só com versão aprovada vigente. Preço aprovado para o futuro ainda não aprova a oferta. */
export function situacaoEfetivaDaOferta(oferta: Pick<Oferta, 'situacao'>, precos: readonly PrecoVersao[], hoje: string): Oferta['situacao'] {
  if (oferta.situacao === 'inativa') return 'inativa';
  return precos.some((preco) => versaoVigenteEm(preco, hoje)) ? 'aprovada' : 'em_estudo';
}

/** Uma linha por canal com versão vigente. Vazio quer dizer "Não definido", nunca zero. */
export function precosVigentesDaOferta(precos: readonly PrecoVersao[], hoje: string): PrecoVersao[] {
  const validos = precos.filter((preco) => versaoVigenteEm(preco, hoje));
  const porCanal = new Map(validos.map((preco) => [preco.canal_id, preco]));
  return [...porCanal.values()];
}

export function proximaVersao(precos: readonly Pick<PrecoVersao, 'oferta_id' | 'canal_id' | 'versao'>[], ofertaId: string, canalId: string | null, semContar?: string): number {
  return Math.max(0, ...precos.filter((preco) => preco.oferta_id === ofertaId && preco.canal_id === canalId && (preco as { id?: string }).id !== semContar).map((preco) => preco.versao)) + 1;
}

// ---------- Versões de preço (T07.04 e T07.09) ----------

export type DadosDaVersao = {
  canal_id: string | null;
  /** `null` é "Não definido". */
  valor: number | null;
  moeda: string;
  periodicidade: PrecoVersao['periodicidade'];
  valido_de: string | null;
  simulacao_id: string | null;
};

/** Zero explícito só existe em Gratuidade; nela, só zero (RN-07.02 e RN-07.03). */
export function erroDoValor(tipo: Oferta['tipo'], valor: number | null): string | null {
  if (valor === null) return null;
  if (tipo === 'gratuidade') return valor === 0 ? null : 'Gratuidade tem preço R$ 0,00.';
  return valor === 0 ? 'R$ 0,00 só vale para Gratuidade. Sem valor ainda, deixe vazio: fica "Não definido".' : null;
}

/** Cria o rascunho: não aprova nem muda o que está valendo. */
export async function criarRascunhoDePreco(ofertaId: string, dados: DadosDaVersao): Promise<PrecoVersao> {
  const oferta = await repositorios.oferta.obter(ofertaId);
  if (!oferta) throw new ErroDeRegra('Esta oferta não existe mais.');
  if (oferta.situacao === 'inativa') throw new ErroDeRegra('Esta oferta está inativa. Reative antes de criar uma versão.');
  const erro = erroDoValor(oferta.tipo, dados.valor);
  if (erro) throw new ErroDeRegra(erro);
  const precos = await repositorios.preco_versao.listar({ onde: { oferta_id: ofertaId }, incluirArquivados: true });
  return repositorios.preco_versao.criar({ oferta_id: ofertaId, versao: proximaVersao(precos, ofertaId, dados.canal_id), ...dados, valido_ate: null, situacao: 'rascunho', decisao_id: null, aprovado_por: null, aprovado_em: null, justificativa_excecao: null, snapshot: null });
}

export async function salvarRascunhoDePreco(id: string, dados: DadosDaVersao): Promise<PrecoVersao> {
  const atual = await repositorios.preco_versao.obter(id);
  if (!atual) throw new ErroDeRegra('Esta versão não existe mais.');
  if (atual.situacao !== 'rascunho') throw new ErroDeRegra('Versão aprovada não muda: crie uma nova versão.');
  const oferta = await repositorios.oferta.obter(atual.oferta_id);
  const erro = oferta && erroDoValor(oferta.tipo, dados.valor);
  if (erro) throw new ErroDeRegra(erro);
  const precos = await repositorios.preco_versao.listar({ onde: { oferta_id: atual.oferta_id }, incluirArquivados: true });
  const versao = dados.canal_id === atual.canal_id ? atual.versao : proximaVersao(precos, atual.oferta_id, dados.canal_id, id);
  return repositorios.preco_versao.atualizar(id, { ...dados, versao });
}

/** Só rascunho sai da lista (RT-03). Fica guardado no histórico. */
export async function descartarRascunhoDePreco(id: string): Promise<void> {
  const atual = await repositorios.preco_versao.obter(id);
  if (atual?.situacao !== 'rascunho') throw new ErroDeRegra('Só um rascunho pode ser descartado.');
  await repositorios.preco_versao.arquivar(id);
}

export type AvaliacaoDoPiso = { piso: number | null; abaixo: boolean; equivalenteMensal: number | null; volume: number | null; erro: string | null };

/**
 * Compara com o piso da simulação (RN-07.06), em precisão completa, no volume principal dela. Em "todos os canais",
 * vale o maior piso entre os canais: o preço precisa se sustentar em qualquer um.
 */
export function avaliarPiso(preco: Pick<DadosDaVersao, 'canal_id' | 'valor' | 'moeda' | 'periodicidade'>, simulacao: Pick<Simulacao, 'premissas' | 'resultados'> | null): AvaliacaoDoPiso {
  const vazio = { piso: null, abaixo: false, equivalenteMensal: null, volume: null };
  if (!simulacao) return { ...vazio, erro: null };
  const { premissas, resultados } = simulacao;
  if (preco.moeda !== premissas.moeda) return { ...vazio, erro: `A simulação está em ${premissas.moeda}, e o preço, em ${preco.moeda}: não dá para comparar com o piso.` };
  if (preco.periodicidade !== premissas.periodicidade) return { ...vazio, erro: `A simulação é ${ROTULOS_PERIODICIDADE_PRECO[premissas.periodicidade].toLocaleLowerCase('pt-BR')}, e o preço, ${ROTULOS_PERIODICIDADE_PRECO[preco.periodicidade].toLocaleLowerCase('pt-BR')}. Use uma simulação da mesma periodicidade.` };
  const principal = cenarioPrincipal(premissas);
  if (!principal) return { ...vazio, erro: 'A simulação não tem canal e volume calculados.' };
  if (preco.canal_id && !premissas.canais.some((canal) => canal.canal_id === preco.canal_id)) return { ...vazio, erro: 'A simulação não inclui este canal. Escolha outra ou simule com ele.' };
  const doVolume = resultados.linhas.filter((linha) => linha.volume === principal.volume && (preco.canal_id ? linha.canal_id === preco.canal_id : true));
  if (!doVolume.length || doVolume.some((linha) => linha.piso === null)) return { ...vazio, volume: principal.volume, erro: 'A simulação não tem o piso calculado neste canal: faltam premissas. Recalcule antes de aprovar.' };
  const piso = Math.max(...doVolume.map((linha) => linha.piso as number));
  const equivalenteMensal = preco.valor === null ? null : precoMensal(preco.valor, preco.periodicidade);
  return { piso, equivalenteMensal, volume: principal.volume, abaixo: equivalenteMensal !== null && equivalenteMensal < piso, erro: null };
}

export type DadosDaAprovacao = DadosDaVersao & { decisao: EntradaDecisao | null; justificativa_excecao: string };
export type ErrosDaAprovacao = Readonly<Record<string, string>>;

/** Todas as exigências de RN-07.04 e RN-07.06, em um lugar só: a tela mostra e `aprovarPreco` confere de novo. */
export function errosDaAprovacao(oferta: Pick<Oferta, 'tipo' | 'produto_id' | 'situacao' | 'id'>, dados: DadosDaAprovacao, simulacao: Simulacao | null, ordem: { ultimoInicio: string | null }, hoje: string): ErrosDaAprovacao {
  const erros: Record<string, string> = {};
  const gratuidade = oferta.tipo === 'gratuidade';
  if (dados.valor === null) erros.valor = 'Informe o valor. "Não definido" não pode ser aprovado.';
  else {
    const erro = erroDoValor(oferta.tipo, dados.valor);
    if (erro) erros.valor = erro;
  }
  if (!/^[A-Z]{3}$/.test(dados.moeda)) erros.moeda = 'Escolha a moeda.';
  if (!dados.valido_de) erros.valido_de = 'Informe o início da validade.';
  else if (ordem.ultimoInicio && dados.valido_de <= ordem.ultimoInicio) erros.valido_de = `Precisa começar depois de ${ordem.ultimoInicio.split('-').reverse().join('/')}, o início da última versão aprovada neste canal.`;

  if (!gratuidade) {
    if (!dados.simulacao_id) erros.simulacao_id = 'Vincule a simulação: ela é exigida, exceto em Gratuidade.';
    else if (!simulacao) erros.simulacao_id = 'Esta simulação não existe mais.';
    else if (simulacao.produto_id !== oferta.produto_id) erros.simulacao_id = 'Esta simulação é de outro produto.';
    else if (simulacao.oferta_id && simulacao.oferta_id !== oferta.id) erros.simulacao_id = 'Esta simulação é de outra oferta.';
    else {
      const { erro, abaixo } = avaliarPiso(dados, simulacao);
      if (erro) erros.simulacao_id = erro;
      if (abaixo && !dados.justificativa_excecao.trim()) erros.justificativa_excecao = 'Preço abaixo do piso exige justificativa.';
    }
  }
  for (const [campo, mensagem] of Object.entries(errosDaDecisao(dados.decisao, hoje))) erros[`decisao_${campo}`] = mensagem;
  return erros;
}

/** RN-07.05: o início da última versão aprovada na mesma oferta e canal. A nova precisa vir depois dela. */
export function ultimoInicioAprovado(precos: readonly PrecoVersao[], canalId: string | null, semContar?: string): string | null {
  return precos.filter((preco) => preco.id !== semContar && preco.canal_id === canalId && preco.situacao !== 'rascunho' && preco.valido_de).reduce<string | null>((maior, preco) => (!maior || (preco.valido_de as string) > maior ? (preco.valido_de as string) : maior), null);
}

export function diaAnterior(dia: string): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

/**
 * Aprova a versão (T07.09): grava de uma vez a decisão, o fim da anterior na mesma oferta e canal, a situação da
 * oferta e o snapshot. Só encosta na versão anterior e nesta: propostas e contratos guardam a própria cópia.
 */
export async function aprovarPreco(id: string, dados: DadosDaAprovacao, pessoaId: string | null, hoje: string = hojeISO()): Promise<PrecoVersao> {
  if (!pessoaId) throw new ErroDeRegra('Escolha quem está aprovando em "Você é".');
  const atual = await repositorios.preco_versao.obter(id);
  if (!atual || atual.arquivado_em) throw new ErroDeRegra('Esta versão não existe mais.');
  if (atual.situacao !== 'rascunho') throw new ErroDeRegra('Esta versão já foi aprovada.');
  const oferta = await repositorios.oferta.obter(atual.oferta_id);
  if (!oferta) throw new ErroDeRegra('Esta oferta não existe mais.');
  if (oferta.situacao === 'inativa') throw new ErroDeRegra('Esta oferta está inativa. Reative antes de aprovar.');
  const [precos, simulacao, canal, pessoa] = await Promise.all([repositorios.preco_versao.listar({ onde: { oferta_id: atual.oferta_id } }), dados.simulacao_id ? repositorios.simulacao.obter(dados.simulacao_id) : Promise.resolve(null), dados.canal_id ? repositorios.canal_venda.obter(dados.canal_id) : Promise.resolve(null), repositorios.pessoa.obter(pessoaId)]);
  if (dados.canal_id && !canal) throw new ErroDeRegra('Este canal não existe mais.');

  const erros = errosDaAprovacao(oferta, dados, simulacao, { ultimoInicio: ultimoInicioAprovado(precos, dados.canal_id, id) }, hoje);
  const primeiro = Object.values(erros)[0];
  if (primeiro) throw new ErroDeRegra(primeiro);

  const gratuidade = oferta.tipo === 'gratuidade';
  const avaliacao = gratuidade ? null : avaliarPiso(dados, simulacao);
  const abaixo = Boolean(avaliacao?.abaixo);
  const inicio = dados.valido_de as string;

  return emTransacao(async () => {
    const decisao = await resolverDecisao(dados.decisao, { produto_id: oferta.produto_id, assunto: abaixo ? 'excecao_preco' : 'preco', exigirAssunto: abaixo }, hoje);
    await vincularDecisao(decisao.id, 'oferta', oferta.id);
    const anterior = precos.find((preco) => preco.id !== id && preco.canal_id === dados.canal_id && preco.situacao === 'aprovada');
    if (anterior) await repositorios.preco_versao.atualizar(anterior.id, { situacao: 'substituida', valido_ate: diaAnterior(inicio) }, { motivo: `Substituída pela versão aprovada em ${decisao.codigo}.` });
    const versao = dados.canal_id === atual.canal_id ? atual.versao : proximaVersao(precos, atual.oferta_id, dados.canal_id, id);
    const snapshot = {
      oferta: { id: oferta.id, codigo: oferta.codigo, nome: oferta.nome, tipo: oferta.tipo, publico: oferta.publico, formalizacao: oferta.formalizacao },
      canal: canal ? { id: canal.id, nome: canal.nome, taxa_percentual: canal.taxa_percentual, taxa_fixa: canal.taxa_fixa, taxa_fixa_moeda: canal.taxa_fixa_moeda, verificado_em: canal.verificado_em, fonte_url: canal.fonte_url } : null,
      simulacao: simulacao ? { id: simulacao.id, codigo: simulacao.codigo, nome: simulacao.nome, versao: simulacao.versao, premissas: simulacao.premissas, resultados: simulacao.resultados } : null,
      piso: avaliacao?.piso ?? null,
      equivalente_mensal: avaliacao?.equivalenteMensal ?? null,
      abaixo_do_piso: abaixo,
      decisao: { id: decisao.id, codigo: decisao.codigo, titulo: decisao.titulo, data: decisao.data, assunto: decisao.assunto },
      aprovado_por_nome: pessoa?.nome_completo ?? null,
      substituiu: anterior ? { id: anterior.id, versao: anterior.versao, valor: anterior.valor, moeda: anterior.moeda, valido_de: anterior.valido_de, valido_ate: diaAnterior(inicio) } : null,
    };
    const aprovada = await repositorios.preco_versao.atualizar(id, {
      canal_id: dados.canal_id,
      versao,
      valor: dados.valor,
      moeda: dados.moeda,
      periodicidade: dados.periodicidade,
      valido_de: inicio,
      valido_ate: null,
      situacao: 'aprovada',
      simulacao_id: gratuidade ? dados.simulacao_id || null : dados.simulacao_id,
      decisao_id: decisao.id,
      aprovado_por: pessoaId,
      aprovado_em: new Date().toISOString(),
      justificativa_excecao: abaixo ? dados.justificativa_excecao.trim() : null,
      snapshot,
    });
    const todas = (await repositorios.preco_versao.listar({ onde: { oferta_id: oferta.id } }));
    await repositorios.oferta.atualizar(oferta.id, { situacao: situacaoEfetivaDaOferta(oferta, todas, hoje) });
    return aprovada;
  });
}

// ---------- Simulador: entradas da tela (T07.06) ----------

export type EntradasDoSimulador = {
  periodicidade: Premissas['periodicidade'];
  cf: string;
  cf_justificativa: string;
  cv: string;
  tributos: string;
  margem: string;
  incluir_horas: boolean;
  horas: string;
  valor_hora: string;
  canais: readonly string[];
  volumes: readonly string[];
  preco_teste: string;
  principal_canal: string;
  principal_volume: string;
};

export function entradasVazias(cfCalculado: number | null): EntradasDoSimulador {
  return { periodicidade: 'mensal', cf: cfCalculado === null ? '' : valorParaCampo(cfCalculado), cf_justificativa: '', cv: '', tributos: '', margem: '', incluir_horas: true, horas: '', valor_hora: '', canais: [], volumes: VOLUMES_PADRAO.map(String), preco_teste: '', principal_canal: '', principal_volume: '' };
}

/** Texto → premissas: vazio vira `null`, inválido também, e o erro fica junto do campo. Quem falta aparece em "Falta: …". */
export function premissasDasEntradas(entradas: EntradasDoSimulador, { canais, cambios, cfCalculado, canaisCongelados = [] }: { canais: readonly CanalVenda[]; cambios: readonly Pick<CambioReferencia, 'moeda' | 'valor_brl' | 'data_referencia'>[]; cfCalculado: number | null; canaisCongelados?: readonly CanalDaSimulacao[] }): { premissas: Premissas; erros: Readonly<Record<string, string>> } {
  const erros: Record<string, string> = {};
  const valor = (campo: string, texto: string) => {
    const lido = lerValorDoCampo(texto);
    if (lido === undefined) erros[campo] = MENSAGEM_VALOR;
    return lido ?? null;
  };
  const percentual = (campo: string, texto: string) => {
    const lido = lerPercentual(texto);
    if (lido === undefined) erros[campo] = MENSAGEM_PERCENTUAL;
    return lido ?? null;
  };

  const lidos = entradas.volumes.map((texto) => lerInteiro(texto));
  if (lidos.some((lido) => lido === undefined || lido === 0)) erros.volumes = 'Use números inteiros de clientes, maiores que zero.';
  const volumes = [...new Set(lidos.filter((lido): lido is number => typeof lido === 'number' && lido > 0))].sort((a, b) => a - b);
  if (volumes.length > MAXIMO_DE_VOLUMES) erros.volumes = `Compare até ${MAXIMO_DE_VOLUMES} volumes.`;
  if (entradas.canais.length > MAXIMO_DE_CANAIS) erros.canais = `Compare até ${MAXIMO_DE_CANAIS} canais.`;

  const escolhidos = entradas.canais.slice(0, MAXIMO_DE_CANAIS).flatMap((id) => {
    const congelado = canaisCongelados.find((canal) => canal.canal_id === id);
    if (congelado) return [congelado];
    const canal = canais.find((item) => item.id === id);
    return canal ? [canalParaSimulacao(canal, cambios)] : [];
  });

  const principalVolume = lerInteiro(entradas.principal_volume);
  const premissas: Premissas = {
    ...premissasVazias(),
    periodicidade: entradas.periodicidade,
    cf: valor('cf', entradas.cf),
    cf_calculado: cfCalculado,
    cf_justificativa: entradas.cf_justificativa.trim() || null,
    cv: valor('cv', entradas.cv),
    tributos_pct: percentual('tributos', entradas.tributos),
    margem_pct: percentual('margem', entradas.margem),
    incluir_horas: entradas.incluir_horas,
    horas: entradas.incluir_horas ? valor('horas', entradas.horas) : null,
    valor_hora: entradas.incluir_horas ? valor('valor_hora', entradas.valor_hora) : null,
    canais: escolhidos,
    volumes: volumes.slice(0, MAXIMO_DE_VOLUMES),
    preco_teste: valor('preco_teste', entradas.preco_teste),
    principal: entradas.principal_canal && principalVolume ? { canal_id: entradas.principal_canal, volume: principalVolume } : null,
  };
  if (custoFixoFoiSubstituido(premissas) && !premissas.cf_justificativa) erros.cf_justificativa = 'Custo informado à mão precisa de justificativa (RN-07.11).';
  return { premissas, erros };
}

export function entradasDaSimulacao({ premissas }: Pick<Simulacao, 'premissas'>): EntradasDoSimulador {
  const principal = cenarioPrincipal(premissas);
  const paraCampo = (valor: number | null) => (valor === null ? '' : valorParaCampo(valor));
  return {
    periodicidade: premissas.periodicidade,
    cf: paraCampo(premissas.cf),
    cf_justificativa: premissas.cf_justificativa ?? '',
    cv: paraCampo(premissas.cv),
    tributos: premissas.tributos_pct === null ? '' : percentualParaCampo(premissas.tributos_pct),
    margem: premissas.margem_pct === null ? '' : percentualParaCampo(premissas.margem_pct),
    incluir_horas: premissas.incluir_horas,
    horas: paraCampo(premissas.horas),
    valor_hora: paraCampo(premissas.valor_hora),
    canais: premissas.canais.map((canal) => canal.canal_id),
    volumes: premissas.volumes.map(String),
    preco_teste: paraCampo(premissas.preco_teste),
    principal_canal: principal?.canal_id ?? '',
    principal_volume: principal ? String(principal.volume) : '',
  };
}

// ---------- Simulações salvas (T07.07 e RN-07.15) ----------

export type DadosDaSimulacaoNova = { produto_id: string; oferta_id: string | null; nome: string; observacao: string; premissas: Premissas; anterior_id: string | null };

/** Os resultados saem das premissas aqui, e não da tela: o snapshot é sempre coerente com o que foi informado. */
export async function salvarSimulacao({ produto_id, oferta_id, nome, observacao, premissas, anterior_id }: DadosDaSimulacaoNova): Promise<Simulacao> {
  const limpo = nome.trim();
  if (!limpo) throw new ErroDeRegra('Dê um nome à simulação.');
  if (!premissas.canais.length) throw new ErroDeRegra('Escolha ao menos um canal antes de salvar.');
  if (!premissas.volumes.length) throw new ErroDeRegra('Informe ao menos um volume antes de salvar.');
  if (custoFixoFoiSubstituido(premissas) && !premissas.cf_justificativa) throw new ErroDeRegra('Custo informado à mão precisa de justificativa (RN-07.11).');
  const resultados = calcularSimulacao(premissas);
  if (resultados.bloqueios.length) throw new ErroDeRegra(`${MENSAGEM_TAXAS_100}. Ajuste antes de salvar.`);
  const produto = await repositorios.produto.obter(produto_id);
  if (!produto) throw new ErroDeRegra('Este produto não existe mais.');
  if (oferta_id) {
    const oferta = await repositorios.oferta.obter(oferta_id);
    if (oferta?.produto_id !== produto_id) throw new ErroDeRegra('Esta oferta é de outro produto.');
  }
  const anterior = anterior_id ? await repositorios.simulacao.obter(anterior_id) : null;
  if (anterior_id && anterior?.produto_id !== produto_id) throw new ErroDeRegra('A simulação anterior é de outro produto.');
  return repositorios.simulacao.criar({ produto_id, oferta_id, nome: limpo, versao: anterior ? anterior.versao + 1 : 1, premissas, resultados, observacao: observacao.trim() || null, simulacao_anterior_id: anterior?.id ?? null });
}

/** Salvar não aprova nada; usar como base cria só o rascunho. Repetir não cria outro igual. */
export async function criarRascunhoDaSimulacao(simulacaoId: string, ofertaId: string): Promise<PrecoVersao> {
  const simulacao = await repositorios.simulacao.obter(simulacaoId);
  if (!simulacao) throw new ErroDeRegra('Esta simulação não existe mais.');
  const oferta = await repositorios.oferta.obter(ofertaId);
  if (oferta?.produto_id !== simulacao.produto_id) throw new ErroDeRegra('Esta oferta é de outro produto.');
  if (simulacao.oferta_id && simulacao.oferta_id !== ofertaId) throw new ErroDeRegra('Esta simulação é de outra oferta.');
  const principal = cenarioPrincipal(simulacao.premissas);
  const canal_id = principal?.canal_id ?? null;
  const precos = await repositorios.preco_versao.listar({ onde: { oferta_id: ofertaId } });
  const existente = precos.find((preco) => preco.situacao === 'rascunho' && preco.simulacao_id === simulacaoId && preco.canal_id === canal_id);
  if (existente) return existente;
  return criarRascunhoDePreco(ofertaId, { canal_id, valor: simulacao.premissas.preco_teste, moeda: simulacao.premissas.moeda, periodicidade: simulacao.premissas.periodicidade, valido_de: null, simulacao_id: simulacaoId });
}

export type LinhaDaSimulacao = Simulacao & { autor: string; nomeDaOferta: string | null; usadaEmPreco: boolean; precoPrincipal: number | null };

export type DadosDasSimulacoes = { simulacoes: LinhaDaSimulacao[]; ofertas: Oferta[] };

export async function carregarSimulacoes(produtoId: string): Promise<DadosDasSimulacoes> {
  const [simulacoes, ofertas, precos, pessoas] = await Promise.all([repositorios.simulacao.listar({ onde: { produto_id: produtoId } }), repositorios.oferta.listar({ onde: { produto_id: produtoId } }), repositorios.preco_versao.listar(), repositorios.pessoa.listar({ incluirArquivados: true })]);
  return {
    ofertas,
    simulacoes: simulacoes
      .map((simulacao) => ({
        ...simulacao,
        autor: pessoas.find((pessoa) => pessoa.id === simulacao.criado_por)?.nome_completo ?? 'Sistema',
        nomeDaOferta: ofertas.find((oferta) => oferta.id === simulacao.oferta_id)?.nome ?? null,
        usadaEmPreco: precos.some((preco) => preco.simulacao_id === simulacao.id),
        precoPrincipal: linhaPrincipal(simulacao.premissas, simulacao.resultados)?.preco_sugerido ?? null,
      }))
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
  };
}

export type TipoDeLinhaComparada = 'dinheiro' | 'percentual' | 'numero' | 'texto';
export type LinhaComparada = { rotulo: string; grupo: 'premissas' | 'resultados'; tipo: TipoDeLinhaComparada; a: number | string | null; b: number | string | null; diferente: boolean; diferenca: number | null };

function textoDosCanais(premissas: Premissas): string {
  return premissas.canais.map((canal) => `${canal.nome} (${canal.taxa_percentual === null ? 'taxa não informada' : formatarPercentual(canal.taxa_percentual)}${canal.taxa_fixa ? ` + R$ ${valorParaCampo(canal.taxa_fixa)}` : ''})`).join(', ');
}

/** T07.07: premissas e resultados, lidos dos snapshots, com o que mudou marcado. */
export function compararSimulacoes(a: Pick<Simulacao, 'premissas' | 'resultados'>, b: Pick<Simulacao, 'premissas' | 'resultados'>): LinhaComparada[] {
  const linha = (grupo: LinhaComparada['grupo'], rotulo: string, tipo: TipoDeLinhaComparada, valorA: number | string | null, valorB: number | string | null): LinhaComparada => ({ grupo, rotulo, tipo, a: valorA, b: valorB, diferente: valorA !== valorB, diferenca: typeof valorA === 'number' && typeof valorB === 'number' ? valorB - valorA : null });
  const principalA = linhaPrincipal(a.premissas, a.resultados);
  const principalB = linhaPrincipal(b.premissas, b.resultados);
  const equilibrio = (simulacao: Pick<Simulacao, 'premissas' | 'resultados'>) => simulacao.resultados.equilibrio.find((item) => item.canal_id === cenarioPrincipal(simulacao.premissas)?.canal_id)?.clientes ?? null;
  return [
    linha('premissas', 'Periodicidade', 'texto', ROTULOS_PERIODICIDADE_PRECO[a.premissas.periodicidade], ROTULOS_PERIODICIDADE_PRECO[b.premissas.periodicidade]),
    linha('premissas', 'Custo fixo mensal', 'dinheiro', a.premissas.cf, b.premissas.cf),
    linha('premissas', 'Custo variável por cliente', 'dinheiro', a.premissas.cv, b.premissas.cv),
    linha('premissas', 'Tributos estimados', 'percentual', a.premissas.tributos_pct, b.premissas.tributos_pct),
    linha('premissas', 'Margem desejada', 'percentual', a.premissas.margem_pct, b.premissas.margem_pct),
    linha('premissas', 'Horas das fundadoras', 'numero', a.premissas.incluir_horas ? a.premissas.horas : null, b.premissas.incluir_horas ? b.premissas.horas : null),
    linha('premissas', 'Valor-hora', 'dinheiro', a.premissas.incluir_horas ? a.premissas.valor_hora : null, b.premissas.incluir_horas ? b.premissas.valor_hora : null),
    linha('premissas', 'Canais', 'texto', textoDosCanais(a.premissas), textoDosCanais(b.premissas)),
    linha('premissas', 'Volumes', 'texto', a.premissas.volumes.join(', '), b.premissas.volumes.join(', ')),
    linha('premissas', 'Preço de teste', 'dinheiro', a.premissas.preco_teste, b.premissas.preco_teste),
    linha('resultados', 'Volume principal', 'numero', principalA?.volume ?? null, principalB?.volume ?? null),
    linha('resultados', 'Preço sugerido', 'dinheiro', principalA?.preco_sugerido ?? null, principalB?.preco_sugerido ?? null),
    linha('resultados', 'Piso (margem 0)', 'dinheiro', principalA?.piso ?? null, principalB?.piso ?? null),
    linha('resultados', 'Receita líquida por cliente', 'dinheiro', principalA?.receita_liquida ?? null, principalB?.receita_liquida ?? null),
    linha('resultados', 'Contribuição por cliente', 'dinheiro', principalA?.margem_contribuicao ?? null, principalB?.margem_contribuicao ?? null),
    linha('resultados', 'Resultado mensal', 'dinheiro', principalA?.resultado_mensal ?? null, principalB?.resultado_mensal ?? null),
    linha('resultados', 'Ponto de equilíbrio (clientes)', 'numero', equilibrio(a), equilibrio(b)),
  ];
}

/** Exportar (T07.06): as premissas junto dos resultados, como pede RN-07.13. Valores com 2 casas, em texto. */
export function tabelaParaExportar(premissas: Premissas, resultados: Resultados): { cabecalho: string[]; linhas: string[][] } {
  const dinheiro = (valor: number | null) => (valor === null ? 'Não calculado' : valorParaCampo(valor));
  const nomeDoCanal = (id: string) => premissas.canais.find((canal) => canal.canal_id === id)?.nome ?? id;
  return {
    cabecalho: ['Canal', 'Clientes', 'Preço sugerido', 'Piso', 'Receita líquida por cliente', 'Contribuição por cliente', 'Resultado mensal'],
    linhas: resultados.linhas.map((linha) => [nomeDoCanal(linha.canal_id), String(linha.volume), dinheiro(linha.preco_sugerido), dinheiro(linha.piso), dinheiro(linha.receita_liquida), dinheiro(linha.margem_contribuicao), dinheiro(linha.resultado_mensal)]),
  };
}

// ---------- Concorrentes de referência (T07.06) ----------

export const esquemaFormularioConcorrente = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome.'),
    preco: z.string(),
    moeda: z.string(),
    periodicidade: z.string(),
    link: z.string().trim(),
    data: z.string(),
  })
  .superRefine((dados, contexto) => {
    if (lerValorDoCampo(dados.preco) === undefined) contexto.addIssue({ code: 'custom', path: ['preco'], message: MENSAGEM_VALOR });
    if (dados.link && !linkHttpValido(dados.link)) contexto.addIssue({ code: 'custom', path: ['link'], message: MENSAGEM_LINK });
  });

export type FormularioConcorrente = z.infer<typeof esquemaFormularioConcorrente>;

export const FORMULARIO_CONCORRENTE_VAZIO: FormularioConcorrente = { nome: '', preco: '', moeda: 'BRL', periodicidade: 'mensal', link: '', data: '' };

export async function salvarConcorrente(produtoId: string, formulario: FormularioConcorrente): Promise<Concorrente> {
  return repositorios.concorrente_referencia.criar({ produto_id: produtoId, nome: formulario.nome, preco: lerValorDoCampo(formulario.preco) ?? null, moeda: formulario.moeda || null, periodicidade: (formulario.periodicidade || null) as Concorrente['periodicidade'], link: formulario.link || null, data: formulario.data || null });
}

export async function removerConcorrente(id: string): Promise<void> {
  await repositorios.concorrente_referencia.arquivar(id);
}

// ---------- Leituras das telas ----------

export type DadosDaOferta = { oferta: Oferta; recursos: OfertaRecurso[]; precos: PrecoVersao[]; canais: CanalVenda[]; simulacoes: Simulacao[]; nomes: ReadonlyMap<string, string> };

export async function carregarOferta(ofertaId: string): Promise<DadosDaOferta | null> {
  const oferta = await repositorios.oferta.obter(ofertaId);
  if (!oferta) return null;
  const [recursos, precos, canais, simulacoes, decisoes, pessoas] = await Promise.all([repositorios.oferta_recurso.listar({ onde: { oferta_id: ofertaId } }), repositorios.preco_versao.listar({ onde: { oferta_id: ofertaId } }), repositorios.canal_venda.listar({ incluirArquivados: true }), repositorios.simulacao.listar({ onde: { produto_id: oferta.produto_id } }), repositorios.decisao.listar({ incluirArquivados: true }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  const nomes = new Map<string, string>([...decisoes.map((decisao): [string, string] => [decisao.id, decisao.codigo]), ...simulacoes.map((simulacao): [string, string] => [simulacao.id, simulacao.codigo]), ...canais.map((canal): [string, string] => [canal.id, canal.nome]), ...pessoas.map((pessoa): [string, string] => [pessoa.id, pessoa.nome_completo])]);
  return { oferta, recursos: recursos.sort((a, b) => a.ordem - b.ordem), precos: precos.sort((a, b) => b.criado_em.localeCompare(a.criado_em)), canais, simulacoes, nomes };
}

export type LinhaDaOferta = Oferta & { situacaoEfetiva: Oferta['situacao']; vigentes: PrecoVersao[]; quantosRecursos: number; rascunhos: number };

export async function ofertasDoProduto(produtoId: string, hoje: string = hojeISO()): Promise<{ ofertas: LinhaDaOferta[]; canais: CanalVenda[] }> {
  const [ofertas, recursos, precos, canais] = await Promise.all([repositorios.oferta.listar({ onde: { produto_id: produtoId } }), repositorios.oferta_recurso.listar(), repositorios.preco_versao.listar(), repositorios.canal_venda.listar({ incluirArquivados: true })]);
  return {
    canais,
    ofertas: ofertas
      .map((oferta) => {
        const dela = precos.filter((preco) => preco.oferta_id === oferta.id);
        return { ...oferta, situacaoEfetiva: situacaoEfetivaDaOferta(oferta, dela, hoje), vigentes: precosVigentesDaOferta(dela, hoje), quantosRecursos: recursos.filter((recurso) => recurso.oferta_id === oferta.id).length, rascunhos: dela.filter((preco) => preco.situacao === 'rascunho').length };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

export async function carregarCanais(): Promise<CanalVenda[]> {
  return (await repositorios.canal_venda.listar()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export { PERIODICIDADES_DE_PRECO };
