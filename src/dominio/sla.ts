/**
 * T12.04 e RN-12.08 a RN-12.09: regras de SLA por oferta (padrão) ou por contrato (exceção), por prioridade.
 * O que a oferta promete (canal, horário, prazos em texto, meta de disponibilidade e compensação) fica na
 * oferta (M07) e é só lido aqui: a regra guarda o que a conta do prazo precisa. A contagem em horas úteis
 * segue o calendário de feriados (M02) e o horário de atendimento; o padrão é 9h–18h (D25).
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Feriado } from '@/dados/tipos/calendario';
import { PRIORIDADES_SUPORTE, type SlaAplicado, type SlaRegra } from '@/dados/tipos/operacao';
import { diaEHoraNoFuso, instanteNoFuso } from '@/lib/datas';
import { ehDiaUtil } from './feriados';
import { catalogoComercial } from './integracoes/conexoes';
import type { OfertaDoCatalogo } from './integracoes/catalogo-comercial';

export type Prioridade = (typeof PRIORIDADES_SUPORTE)[number];
export const ROTULOS_PRIORIDADE: Readonly<Record<Prioridade, string>> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };
export const ROTULOS_CONTAGEM = { horas_uteis: 'Horas úteis', horas_corridas: 'Horas corridas' } as const;

/** D25: suporte das 9h às 18h, em dias úteis (calendário do Rio de Janeiro). */
export const HORARIO_PADRAO = { inicio: '09:00', fim: '18:00' } as const;

export type AlvoDaRegra = { tipo: 'oferta'; id: string } | { tipo: 'contrato'; id: string };

const doAlvo = (alvo: AlvoDaRegra) => (alvo.tipo === 'oferta' ? { oferta_id: alvo.id } : { contrato_id: alvo.id });

// ---------- Contagem do prazo (RN-12.08) ----------

const MINUTOS_NO_DIA = 1440;
const DIA_ZERO = Date.UTC(2000, 0, 1);
const indiceDoDia = (dia: string) => Math.round((Date.parse(`${dia}T00:00:00Z`) - DIA_ZERO) / 86_400_000);
const diaDoIndice = (indice: number) => new Date(DIA_ZERO + indice * 86_400_000).toISOString().slice(0, 10);
const minutosDaHora = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/** O instante como minuto absoluto do relógio local (no fuso de T02.01). */
function paraMinuto(instante: string, fuso?: string): number {
  const { dia, hora } = diaEHoraNoFuso(instante, fuso);
  return indiceDoDia(dia) * MINUTOS_NO_DIA + minutosDaHora(hora);
}

function paraInstante(minuto: number, fuso?: string): string {
  const indice = Math.floor(minuto / MINUTOS_NO_DIA);
  const resto = minuto - indice * MINUTOS_NO_DIA;
  const hora = `${String(Math.floor(resto / 60)).padStart(2, '0')}:${String(resto % 60).padStart(2, '0')}`;
  return instanteNoFuso(diaDoIndice(indice), hora, fuso);
}

export type ConfiguracaoDaContagem = Pick<SlaAplicado, 'contagem' | 'horario_inicio' | 'horario_fim'>;
export type Pausa = { inicio: string; fim: string | null };

/** As janelas que contam num dia: o horário de atendimento em dia útil, ou o dia inteiro em horas corridas. */
function janelaDoDia(indice: number, configuracao: ConfiguracaoDaContagem, feriados: readonly Pick<Feriado, 'data'>[]): [number, number] | null {
  const base = indice * MINUTOS_NO_DIA;
  if (configuracao.contagem === 'horas_corridas') return [base, base + MINUTOS_NO_DIA];
  if (!ehDiaUtil(diaDoIndice(indice), feriados)) return null;
  return [base + minutosDaHora(configuracao.horario_inicio), base + minutosDaHora(configuracao.horario_fim)];
}

/** Tira das janelas os trechos pausados ("Aguardando cliente"). */
function semPausas(janela: [number, number], pausas: readonly [number, number][]): [number, number][] {
  let trechos: [number, number][] = [janela];
  for (const [inicio, fim] of pausas) {
    trechos = trechos.flatMap(([a, b]) => (fim <= a || inicio >= b ? [[a, b] as [number, number]] : ([[a, Math.min(b, inicio)], [Math.max(a, fim), b]] as [number, number][]).filter(([x, y]) => y > x)));
  }
  return trechos;
}

const pausasEmMinutos = (pausas: readonly Pausa[], agora: string, fuso?: string): [number, number][] => pausas.map((pausa) => [paraMinuto(pausa.inicio, fuso), paraMinuto(pausa.fim ?? agora, fuso)]);

/**
 * O prazo: o instante em que o tempo contável, a partir da abertura, chega às horas do SLA. Pausas não contam.
 * CA-12.04: 8 horas úteis abertas numa sexta às 17h, com atendimento 9h–18h, vencem na segunda às 16h.
 */
export function calcularPrazoSla(inicio: string, horas: number, configuracao: ConfiguracaoDaContagem, feriados: readonly Pick<Feriado, 'data'>[], pausas: readonly Pausa[] = [], fuso?: string): string {
  const pausados = pausasEmMinutos(pausas, inicio, fuso).map(([a, b]) => [a, Math.max(a, b)] as [number, number]);
  let faltam = Math.round(horas * 60);
  const comeco = paraMinuto(inicio, fuso);
  for (let indice = Math.floor(comeco / MINUTOS_NO_DIA); indice < Math.floor(comeco / MINUTOS_NO_DIA) + 3660; indice += 1) {
    const janela = janelaDoDia(indice, configuracao, feriados);
    if (!janela) continue;
    const recortada: [number, number] = [Math.max(janela[0], comeco), janela[1]];
    if (recortada[1] <= recortada[0]) continue;
    for (const [a, b] of semPausas(recortada, pausados)) {
      if (b - a >= faltam) return paraInstante(a + faltam, fuso);
      faltam -= b - a;
    }
  }
  throw new ErroDeRegra('O prazo passou de 10 anos: confira o horário de atendimento e os feriados.');
}

/** Minutos contáveis entre dois instantes, sem as pausas: quanto do prazo já foi usado. */
export function minutosContaveis(inicio: string, ate: string, configuracao: ConfiguracaoDaContagem, feriados: readonly Pick<Feriado, 'data'>[], pausas: readonly Pausa[] = [], fuso?: string): number {
  const a = paraMinuto(inicio, fuso);
  const b = paraMinuto(ate, fuso);
  if (b <= a) return 0;
  const pausados = pausasEmMinutos(pausas, ate, fuso);
  let total = 0;
  for (let indice = Math.floor(a / MINUTOS_NO_DIA); indice <= Math.floor(b / MINUTOS_NO_DIA); indice += 1) {
    const janela = janelaDoDia(indice, configuracao, feriados);
    if (!janela) continue;
    const recortada: [number, number] = [Math.max(janela[0], a), Math.min(janela[1], b)];
    if (recortada[1] <= recortada[0]) continue;
    for (const [x, y] of semPausas(recortada, pausados)) total += y - x;
  }
  return total;
}

// ---------- Situação do prazo (T12.03) ----------

export type SituacaoDoPrazo = { estado: 'sem_sla' | 'no_prazo' | 'em_risco' | 'violado' | 'cumprido' | 'cumprido_fora' | 'pausado'; texto: string; prazo: string | null };

function textoDoTempo(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** "Em risco" a partir de 80% do prazo usado; "violado" ao passar; concluído compara a data com o prazo. */
export function situacaoDoPrazo({ abertaEm, horas, configuracao, concluidoEm, pausas, agora, feriados, fuso }: { abertaEm: string; horas: number | null; configuracao: ConfiguracaoDaContagem | null; concluidoEm: string | null; pausas: readonly Pausa[]; agora: string; feriados: readonly Pick<Feriado, 'data'>[]; fuso?: string }): SituacaoDoPrazo {
  if (!horas || !configuracao) return { estado: 'sem_sla', texto: 'Sem SLA', prazo: null };
  const prazo = calcularPrazoSla(abertaEm, horas, configuracao, feriados, pausas.map((pausa) => ({ inicio: pausa.inicio, fim: pausa.fim ?? concluidoEm ?? agora })), fuso);
  const total = Math.round(horas * 60);
  if (concluidoEm) {
    const usados = minutosContaveis(abertaEm, concluidoEm, configuracao, feriados, pausas, fuso);
    return usados <= total ? { estado: 'cumprido', texto: 'Cumprido', prazo } : { estado: 'cumprido_fora', texto: `Fora do prazo, por ${textoDoTempo(usados - total)}`, prazo };
  }
  const usados = minutosContaveis(abertaEm, agora, configuracao, feriados, pausas, fuso);
  if (usados >= total) return { estado: 'violado', texto: `Violado há ${textoDoTempo(usados - total)}`, prazo };
  if (pausas.some((pausa) => !pausa.fim)) return { estado: 'pausado', texto: `Pausado: faltam ${textoDoTempo(total - usados)}`, prazo: null };
  if (usados >= total * 0.8) return { estado: 'em_risco', texto: `Em risco: faltam ${textoDoTempo(total - usados)}`, prazo };
  return { estado: 'no_prazo', texto: `Faltam ${textoDoTempo(total - usados)}`, prazo };
}

// ---------- Regras ----------

export type LinhaDaRegra = { prioridade: Prioridade; resposta_horas: string; resolucao_horas: string };
export type FormularioDeRegras = { contagem: SlaRegra['contagem']; horario_inicio: string; horario_fim: string; disponibilidade_minima: string; creditos: string; linhas: LinhaDaRegra[] };

const lerNumero = (texto: string) => {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : Number.NaN;
};
const textoDoNumero = (valor: number | null) => (valor === null ? '' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

export function formularioDeRegras(regras: readonly SlaRegra[]): FormularioDeRegras {
  const primeira = regras[0];
  return {
    contagem: primeira?.contagem ?? 'horas_uteis',
    horario_inicio: primeira?.horario_inicio ?? HORARIO_PADRAO.inicio,
    horario_fim: primeira?.horario_fim ?? HORARIO_PADRAO.fim,
    disponibilidade_minima: textoDoNumero(primeira?.disponibilidade_minima ?? null),
    creditos: primeira?.creditos ?? '',
    linhas: PRIORIDADES_SUPORTE.map((prioridade) => {
      const regra = regras.find((linha) => linha.prioridade === prioridade);
      return { prioridade, resposta_horas: textoDoNumero(regra?.resposta_horas ?? null), resolucao_horas: textoDoNumero(regra?.resolucao_horas ?? null) };
    }),
  };
}

export async function regrasDoAlvo(alvo: AlvoDaRegra): Promise<SlaRegra[]> {
  return repositorios.sla_regra.listar({ onde: doAlvo(alvo) });
}

/**
 * Grava o conjunto de regras do alvo: uma linha por prioridade preenchida. Prioridade em branco fica "Sem SLA".
 * Disponibilidade mínima e créditos só na exceção do contrato: na oferta, valem os campos do M07.
 */
export async function salvarRegras(alvo: AlvoDaRegra, formulario: FormularioDeRegras): Promise<SlaRegra[]> {
  const uteis = formulario.contagem === 'horas_uteis';
  if (uteis && (!/^\d{2}:\d{2}$/.test(formulario.horario_inicio) || !/^\d{2}:\d{2}$/.test(formulario.horario_fim))) throw new ErroDeRegra('Informe o horário de atendimento.');
  if (uteis && formulario.horario_inicio >= formulario.horario_fim) throw new ErroDeRegra('O atendimento termina depois de começar.');
  const linhas = formulario.linhas.flatMap((linha) => {
    const resposta = lerNumero(linha.resposta_horas);
    const resolucao = lerNumero(linha.resolucao_horas);
    if (resposta === null && resolucao === null) return [];
    const nome = ROTULOS_PRIORIDADE[linha.prioridade];
    if (resposta === null || resolucao === null) throw new ErroDeRegra(`${nome}: informe a primeira resposta e a resolução, ou deixe as duas vazias.`);
    if (Number.isNaN(resposta) || Number.isNaN(resolucao) || resposta <= 0 || resolucao <= 0) throw new ErroDeRegra(`${nome}: use horas maiores que zero, como 4 ou 1,5.`);
    if (resolucao < resposta) throw new ErroDeRegra(`${nome}: a resolução não pode vir antes da primeira resposta.`);
    return [{ prioridade: linha.prioridade, resposta_horas: resposta, resolucao_horas: resolucao }];
  });
  if (!linhas.length) throw new ErroDeRegra('Preencha pelo menos uma prioridade. Para tirar o SLA, use “Remover regras”.');
  let disponibilidade: number | null = null;
  let creditos: string | null = null;
  if (alvo.tipo === 'contrato') {
    disponibilidade = lerNumero(formulario.disponibilidade_minima);
    if (Number.isNaN(disponibilidade) || (disponibilidade !== null && (disponibilidade <= 0 || disponibilidade > 100))) throw new ErroDeRegra('A disponibilidade mínima vai de 0 a 100%, como 99,5.');
    creditos = formulario.creditos.trim() || null;
  }
  if (alvo.tipo === 'oferta' && !(await catalogoComercial().oferta(alvo.id))) throw new ErroDeRegra('Esta oferta não existe no catálogo do M07.');
  if (alvo.tipo === 'contrato') {
    const contrato = await repositorios.contrato.obter(alvo.id);
    if (!contrato || contrato.situacao_documental === 'cancelado') throw new ErroDeRegra('Escolha um contrato que exista e não esteja cancelado.');
  }
  return emTransacao(async () => {
    const atuais = await regrasDoAlvo(alvo);
    const salvas: SlaRegra[] = [];
    for (const linha of linhas) {
      const dados = { oferta_id: alvo.tipo === 'oferta' ? alvo.id : null, contrato_id: alvo.tipo === 'contrato' ? alvo.id : null, ...linha, contagem: formulario.contagem, horario_inicio: uteis ? formulario.horario_inicio : null, horario_fim: uteis ? formulario.horario_fim : null, disponibilidade_minima: disponibilidade, creditos };
      const existente = atuais.find((regra) => regra.prioridade === linha.prioridade);
      salvas.push(existente ? await repositorios.sla_regra.atualizar(existente.id, dados) : await repositorios.sla_regra.criar(dados));
    }
    for (const regra of atuais) if (!linhas.some((linha) => linha.prioridade === regra.prioridade)) await repositorios.sla_regra.arquivar(regra.id);
    return salvas;
  });
}

export async function removerRegras(alvo: AlvoDaRegra): Promise<void> {
  await emTransacao(async () => {
    for (const regra of await regrasDoAlvo(alvo)) await repositorios.sla_regra.arquivar(regra.id);
  });
}

// ---------- O que a oferta promete (M07), sem duplicar ----------

/** "até 4 horas úteis" → 4 horas úteis. Prazo em dias, ou texto livre, não vira número. */
export function horasDoTexto(texto: string | null): { horas: number; uteis: boolean | null } | null {
  if (!texto) return null;
  const achado = /(\d+(?:[.,]\d+)?)\s*(?:h\b|hora|horas)/i.exec(texto);
  if (!achado) return null;
  return { horas: Number(achado[1]!.replace(',', '.')), uteis: /[uú]te(?:is|l)/i.test(texto) ? true : /corrid/i.test(texto) ? false : null };
}

/** Onde a regra contradiz o que a oferta promete no texto do M07 (primeira resposta, crítico e normal). */
export function divergenciasDaOferta(oferta: Pick<OfertaDoCatalogo, 'suporte'>, regras: readonly Pick<SlaRegra, 'prioridade' | 'resposta_horas' | 'contagem'>[]): string[] {
  const avisos: string[] = [];
  const conferir = (prioridade: Prioridade, texto: string | null | undefined, rotulo: string) => {
    const prometido = horasDoTexto(texto ?? null);
    const regra = regras.find((linha) => linha.prioridade === prioridade);
    if (!prometido || !regra) return;
    if (regra.resposta_horas > prometido.horas) avisos.push(`A oferta promete primeira resposta em ${texto?.trim()} no caso ${rotulo}; a regra dá ${textoDoNumero(regra.resposta_horas)} h.`);
    else if (prometido.uteis !== null && prometido.uteis !== (regra.contagem === 'horas_uteis')) avisos.push(`A oferta fala em horas ${prometido.uteis ? 'úteis' : 'corridas'} no caso ${rotulo}; a regra conta ${regra.contagem === 'horas_uteis' ? 'horas úteis' : 'horas corridas'}.`);
  };
  conferir('critica', oferta.suporte?.prazo_critico, 'crítico');
  conferir('normal', oferta.suporte?.prazo_normal, 'normal');
  return avisos;
}

// ---------- Qual regra vale para uma solicitação (RN-12.08 e RN-12.09) ----------

export type RegraEscolhida = { regra: SlaRegra; origem: 'contrato' | 'oferta'; oferta: OfertaDoCatalogo | null } | null;

/**
 * A exceção do contrato vem primeiro; depois, a regra da oferta do contrato (na ordem dos itens). Sem contrato
 * (adesão padrão), vale a regra da única oferta aprovada do produto que tenha SLA; com mais de uma, a Central
 * não adivinha o plano, e fica "Sem SLA" (só acompanhamento).
 */
export async function regraParaSolicitacao({ contratoId, produtoId, prioridade }: { contratoId: string | null; produtoId: string; prioridade: Prioridade }): Promise<RegraEscolhida> {
  const regras = await repositorios.sla_regra.listar();
  const daPrioridade = regras.filter((regra) => regra.prioridade === prioridade);
  const catalogo = catalogoComercial();
  if (contratoId) {
    const excecao = daPrioridade.find((regra) => regra.contrato_id === contratoId);
    if (excecao) return { regra: excecao, origem: 'contrato', oferta: null };
    const contrato = await repositorios.contrato.obter(contratoId);
    const versao = contrato?.versao_vigente_id ?? contrato?.versao_elaboracao_id;
    const itens = versao ? (await repositorios.item_contrato.listar({ onde: { versao_id: versao } })).sort((a, b) => a.ordem - b.ordem) : [];
    for (const item of itens) {
      const regra = item.oferta_id ? daPrioridade.find((linha) => linha.oferta_id === item.oferta_id) : undefined;
      if (regra) return { regra, origem: 'oferta', oferta: await catalogo.oferta(regra.oferta_id as string) };
    }
    return null;
  }
  const ofertas = (await catalogo.ofertasDoProduto(produtoId)).filter((oferta) => oferta.situacao === 'aprovada' && daPrioridade.some((regra) => regra.oferta_id === oferta.id));
  if (ofertas.length !== 1) return null;
  return { regra: daPrioridade.find((regra) => regra.oferta_id === ofertas[0]!.id) as SlaRegra, origem: 'oferta', oferta: ofertas[0]! };
}

export function slaAplicado(escolhida: NonNullable<RegraEscolhida>): SlaAplicado {
  const { regra } = escolhida;
  return { regra_id: regra.id, origem: escolhida.origem, resposta_horas: regra.resposta_horas, resolucao_horas: regra.resolucao_horas, contagem: regra.contagem, horario_inicio: regra.horario_inicio ?? HORARIO_PADRAO.inicio, horario_fim: regra.horario_fim ?? HORARIO_PADRAO.fim };
}

// ---------- Tela T12.04 ----------

export type OfertaComRegras = { oferta: OfertaDoCatalogo; regras: SlaRegra[]; divergencias: string[] };
export type DadosDoSla = { estado: ReturnType<typeof catalogoComercial>['estado']; produtos: { id: string; nome: string; ofertas: OfertaComRegras[] }[]; excecoes: { contrato: Awaited<ReturnType<typeof repositorios.contrato.listar>>[number]; regras: SlaRegra[] }[]; contratos: Awaited<ReturnType<typeof repositorios.contrato.listar>> };

export async function carregarSla(): Promise<DadosDoSla> {
  const catalogo = catalogoComercial();
  const [produtos, regras, contratos] = await Promise.all([repositorios.produto.listar(), repositorios.sla_regra.listar(), repositorios.contrato.listar()]);
  const lista: DadosDoSla['produtos'] = [];
  for (const produto of produtos) {
    const ofertas = (await catalogo.ofertasDoProduto(produto.id)).filter((oferta) => oferta.situacao !== 'inativa');
    if (!ofertas.length) continue;
    lista.push({ id: produto.id, nome: produto.nome, ofertas: ofertas.map((oferta) => { const dela = regras.filter((regra) => regra.oferta_id === oferta.id); return { oferta, regras: dela, divergencias: divergenciasDaOferta(oferta, dela) }; }) });
  }
  const excecoes = contratos.filter((contrato) => regras.some((regra) => regra.contrato_id === contrato.id)).map((contrato) => ({ contrato, regras: regras.filter((regra) => regra.contrato_id === contrato.id) }));
  return { estado: catalogo.estado, produtos: lista, excecoes, contratos: contratos.filter((contrato) => contrato.situacao_documental !== 'cancelado') };
}
