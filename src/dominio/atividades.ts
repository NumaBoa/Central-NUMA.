/** Regras de T03.01 (05-M03): atividades, quadro, lista e ações rápidas. */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Area } from '@/dados/tipos/area';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Etiqueta } from '@/dados/tipos/etiqueta';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { fusoConfigurado, hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { tintaDaCor } from './cores';
import { normalizarTexto } from './duplicidade';
import { ACOES_DE_ALERTA_F1, ROTULOS_ORIGEM_ALERTA_F1 } from './integracoes/meu-dia-f1';
import { ACOES_DE_ALERTA_M08, ROTULOS_ORIGEM_ALERTA_M08 } from './integracoes/meu-dia-m08';

type Situacao = Atividade['situacao'];

export const ROTULOS_TIPO_ATIVIDADE = { tarefa: 'Tarefa', demanda: 'Demanda', lembrete: 'Lembrete', alerta: 'Alerta' } as const;
export const ROTULOS_SITUACAO_ATIVIDADE = { a_fazer: 'A fazer', em_andamento: 'Em andamento', aguardando: 'Aguardando retorno', concluida: 'Concluída', cancelada: 'Cancelada' } as const;
export const ROTULOS_PRIORIDADE_ATIVIDADE = { urgente: 'Urgente', alta: 'Alta', normal: 'Normal', baixa: 'Baixa' } as const;

export const COLUNAS_DO_QUADRO = ['a_fazer', 'em_andamento', 'aguardando', 'concluida'] as const;
export type ColunaDoQuadro = (typeof COLUNAS_DO_QUADRO)[number];

/** O que o alerta oferece (RN-03.12). A chave fica no registro; o caminho, aqui, a partir da origem. */
export const ACOES_DE_ALERTA: Readonly<Record<string, { rotulo: string; caminho: (origemId: string) => string }>> = {
  exportar_dados: { rotulo: 'Exportar dados', caminho: () => '/configuracoes/dados' },
  registrar_pagamento: { rotulo: 'Registrar pagamento', caminho: (id) => `/financeiro/${id}?acao=baixa` },
  registrar_baixa: { rotulo: 'Registrar baixa', caminho: (id) => `/financeiro/${id}?acao=baixa` },
  revisar_renovacao: { rotulo: 'Revisar renovação', caminho: (id) => `/ferramentas/${id}` },
  cancelar_ou_manter: { rotulo: 'Cancelar ou manter', caminho: (id) => `/ferramentas/${id}` },
  decidir_teste: { rotulo: 'Decidir: assinar ou cancelar', caminho: (id) => `/ferramentas/${id}` },
  renovar_dominio: { rotulo: 'Renovar', caminho: (id) => `/ferramentas/ativos/${id}` },
  ...ACOES_DE_ALERTA_F1,
  ...ACOES_DE_ALERTA_M08,
};

/** O botão do alerta: o rótulo e o caminho até a origem. */
export function acaoDoAlerta(atividade: Pick<Atividade, 'alerta_acao' | 'origem_id'>): { rotulo: string; href: string } | undefined {
  const acao = atividade.alerta_acao ? ACOES_DE_ALERTA[atividade.alerta_acao] : undefined;
  return acao ? { rotulo: acao.rotulo, href: acao.caminho(atividade.origem_id ?? '') } : undefined;
}

/** Origens da F0a: as das outras fases entram junto com as telas delas (RT-23). */
export const ROTULOS_ORIGEM_ALERTA: Readonly<Record<string, string>> = { titulo: 'Financeiro', ferramenta: 'Ferramentas', ativo: 'Ativos digitais', backup: 'Backup', ...ROTULOS_ORIGEM_ALERTA_F1, ...ROTULOS_ORIGEM_ALERTA_M08 };

export const MAXIMO_NO_TITULO = 140;

export const CAMINHO_DA_ATIVIDADE = (id: string) => `/meu-dia?atividade=${id}`;

// ---------- O que é derivado (RN-03.04 a RN-03.06) ----------

/** O dia, no fuso configurado, de um instante gravado (RT-06). */
const diaDoInstante = (instante: string) => hojeISO(new Date(instante));

export function estaAberta(atividade: Pick<Atividade, 'situacao' | 'arquivado_em'>): boolean {
  return atividade.situacao !== 'concluida' && atividade.situacao !== 'cancelada' && !atividade.arquivado_em;
}

/** Lembrete não tem prazo: o dia do aviso faz esse papel. */
export function prazoEfetivo(atividade: Pick<Atividade, 'tipo' | 'prazo' | 'aviso_em'>): string | null {
  if (atividade.prazo) return atividade.prazo;
  return atividade.tipo === 'lembrete' && atividade.aviso_em ? diaDoInstante(atividade.aviso_em) : null;
}

export function estaAtrasada(atividade: Atividade, hoje: string): boolean {
  const prazo = prazoEfetivo(atividade);
  return estaAberta(atividade) && prazo !== null && prazo < hoje;
}

/** Prazo de hoje, lembretes de hoje e acompanhamentos de hoje (T03.01 e RN-03.09). */
export function ehParaHoje(atividade: Atividade, hoje: string): boolean {
  return estaAberta(atividade) && (prazoEfetivo(atividade) === hoje || atividade.acompanhamento_em === hoje);
}

export function estaBloqueada(atividade: Atividade): boolean {
  return estaAberta(atividade) && atividade.bloqueada;
}

export function concluidaHoje(atividade: Atividade, hoje: string): boolean {
  return atividade.situacao === 'concluida' && !atividade.arquivado_em && Boolean(atividade.concluida_em) && diaDoInstante(atividade.concluida_em as string) === hoje;
}

/** Nada some ao virar o dia (RN-03.05): só saem as concluídas de outros dias e as canceladas. */
export function estaNoDia(atividade: Atividade, hoje: string): boolean {
  return estaAberta(atividade) || concluidaHoje(atividade, hoje);
}

// ---------- Ordenação (RN-03.11) ----------

const PESO_DA_PRIORIDADE = { urgente: 0, alta: 1, normal: 2, baixa: 3 } as const;

function faixaDaOrdem(atividade: Atividade, hoje: string): number {
  if (estaBloqueada(atividade) || (estaAberta(atividade) && atividade.prioridade === 'urgente')) return 0;
  const prazo = prazoEfetivo(atividade);
  if (!prazo) return 4;
  if (prazo < hoje) return 1;
  return prazo === hoje ? 2 : 3;
}

/** Bloqueadas e urgentes → atrasadas (mais antiga primeiro) → hoje → próximas por prazo → sem prazo (por prioridade e criação). */
export function ordenarAtividades<T extends Atividade>(atividades: readonly T[], hoje: string): T[] {
  return [...atividades].sort((a, b) => {
    const faixa = faixaDaOrdem(a, hoje) - faixaDaOrdem(b, hoje);
    if (faixa) return faixa;
    const prazoA = prazoEfetivo(a);
    const prazoB = prazoEfetivo(b);
    if (prazoA && prazoB && prazoA !== prazoB) return prazoA.localeCompare(prazoB);
    if (prazoA && !prazoB) return -1;
    if (!prazoA && prazoB) return 1;
    const hora = (a.prazo_hora ?? '').localeCompare(b.prazo_hora ?? '');
    if (hora) return hora;
    return PESO_DA_PRIORIDADE[a.prioridade] - PESO_DA_PRIORIDADE[b.prioridade] || a.criado_em.localeCompare(b.criado_em);
  });
}

// ---------- Textos do cartão ----------

const UM_DIA = 86_400_000;

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / UM_DIA);
}

const plural = (quantidade: number, um: string, varios: string) => `${quantidade} ${quantidade === 1 ? um : varios}`;

function diaCurto(dia: string): string {
  return formatarDiaISO(dia).slice(0, 5);
}

/** "12/11 (em 8 dias)", "Hoje às 15:00", "Atrasada há 3 dias" ou "Sem prazo". */
export function textoDoPrazo(atividade: Atividade, hoje: string): { texto: string; atrasada: boolean } {
  const prazo = prazoEfetivo(atividade);
  if (!prazo) return { texto: 'Sem prazo', atrasada: false };
  const distancia = diasEntre(hoje, prazo);
  if (estaAtrasada(atividade, hoje)) return { texto: `Atrasada há ${plural(-distancia, 'dia', 'dias')}`, atrasada: true };
  const hora = atividade.prazo_hora ?? (atividade.tipo === 'lembrete' && atividade.aviso_em ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fusoConfigurado() }).format(new Date(atividade.aviso_em)) : null);
  const comHora = hora ? ` às ${hora}` : '';
  if (distancia === 0) return { texto: `Hoje${comHora}`, atrasada: false };
  if (distancia === 1) return { texto: `Amanhã${comHora}`, atrasada: false };
  if (distancia > 1) return { texto: `${diaCurto(prazo)}${comHora} (em ${distancia} dias)`, atrasada: false };
  return { texto: `${diaCurto(prazo)}${comHora}`, atrasada: false };
}

/** A partir da 2ª vez (RN-03.08). */
export function textoDosAdiamentos(atividade: Pick<Atividade, 'adiamentos'>): string | null {
  return atividade.adiamentos >= 2 ? `Adiada ${atividade.adiamentos} vezes` : null;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** "Bom dia", "Boa tarde" ou "Boa noite", no fuso configurado. */
export function saudacao(agora: Date = new Date(), fuso: string = fusoConfigurado()): string {
  const hora = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: fuso }).format(agora));
  if (hora >= 5 && hora < 12) return 'Bom dia';
  return hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/** "sexta-feira, 6 de novembro de 2026", no fuso configurado. */
export function dataPorExtenso(agora: Date = new Date(), fuso: string = fusoConfigurado()): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: fuso }).format(agora);
}

// ---------- Filtros (T03.01) ----------

export type AtividadeDoDia = Atividade & { produtos: string[]; participantes: string[]; itensFeitos: number; itensTotal: number; comentarios: number   /** Os ids das etiquetas. */
  etiquetas: string[];
};

export type PeriodoDoPrazo = '' | 'atrasadas' | 'hoje' | 'semana' | '30dias' | 'sem_prazo' | 'intervalo';
/** O que os cartões do resumo marcam além do período: a situação e o bloqueio não têm outro controle na tela. */
export type DestaqueDoResumo = '' | 'em_andamento' | 'aguardando' | 'bloqueadas' | 'concluidas';

/** O que o Meu dia e o Histórico filtram do mesmo jeito (T03.04). O contexto vem só do seletor global. */
export type FiltrosComuns = {
  busca: string;
  /** Vazio é Todas (RN-03.01); 'minhas' é a pessoa atual; ou o id de uma pessoa. */
  pessoa: string;
  soResponsavel: boolean;
  area: string;
  tipo: string;
  prioridades: string[];
  origem: string;
  /** O id de uma etiqueta (decisão de Kimberly em 06/11/2026). */
  etiqueta: string;
};

export type FiltrosMeuDia = FiltrosComuns & {
  periodo: PeriodoDoPrazo;
  prazoDe: string;
  prazoAte: string;
  destaque: DestaqueDoResumo;
};

export const FILTROS_COMUNS_INICIAIS: FiltrosComuns = { busca: '', pessoa: '', soResponsavel: false, area: '', tipo: '', prioridades: [], origem: '', etiqueta: '' };

export const FILTROS_MEU_DIA_INICIAIS: FiltrosMeuDia = { ...FILTROS_COMUNS_INICIAIS, periodo: '', prazoDe: '', prazoAte: '', destaque: '' };

export const ROTULOS_PERIODO = { hoje: 'Hoje', atrasadas: 'Atrasadas', semana: 'Esta semana', '30dias': 'Próximos 30 dias', sem_prazo: 'Sem prazo', intervalo: 'Intervalo' } as const;

export const MINHAS = 'minhas';

export type OpcoesDosFiltros = {
  hoje: string;
  /** "Você é" (02 §0.4). */
  pessoaAtualId: string;
  /** O seletor global: `consolidada` não filtra. */
  contextoGlobalId: string;
  nomeDaPessoa: (id: string) => string;
};

/** Domingo da semana de hoje. */
function fimDaSemana(hoje: string): string {
  const data = new Date(`${hoje}T00:00:00Z`);
  const diaDaSemana = data.getUTCDay();
  data.setUTCDate(data.getUTCDate() + (diaDaSemana === 0 ? 0 : 7 - diaDaSemana));
  return data.toISOString().slice(0, 10);
}

function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function passaNoPeriodo(atividade: Atividade, { periodo, prazoDe, prazoAte }: Pick<FiltrosMeuDia, 'periodo' | 'prazoDe' | 'prazoAte'>, hoje: string): boolean {
  const prazo = prazoEfetivo(atividade);
  switch (periodo) {
    case 'atrasadas':
      return estaAtrasada(atividade, hoje);
    case 'hoje':
      return ehParaHoje(atividade, hoje);
    case 'semana':
      return prazo !== null && prazo >= hoje && prazo <= fimDaSemana(hoje);
    case '30dias':
      return prazo !== null && prazo >= hoje && prazo <= somarDias(hoje, 30);
    case 'sem_prazo':
      return prazo === null;
    case 'intervalo':
      return prazo !== null && (!prazoDe || prazo >= prazoDe) && (!prazoAte || prazo <= prazoAte);
    default:
      return true;
  }
}

function passaNaPessoa(atividade: AtividadeDoDia, { pessoa, soResponsavel }: FiltrosComuns, pessoaAtualId: string): boolean {
  if (!pessoa) return true;
  const alvo = pessoa === MINHAS ? pessoaAtualId : pessoa;
  return atividade.responsavel_id === alvo || (!soResponsavel && atividade.participantes.includes(alvo));
}

/** O seletor global é o único contexto da tela. O que não tem produto é da Numa. */
export function passaNoContexto(produtos: readonly string[], contextoGlobalId: string): boolean {
  if (contextoGlobalId === ID_CONSOLIDADA) return true;
  return contextoGlobalId === ID_INSTITUCIONAL ? produtos.length === 0 : produtos.includes(contextoGlobalId);
}

function passaNaBusca(atividade: AtividadeDoDia, busca: string, nomeDaPessoa: (id: string) => string): boolean {
  const texto = normalizarTexto(busca);
  if (!texto) return true;
  return normalizarTexto(`${atividade.titulo} ${atividade.codigo} ${atividade.descricao ?? ''} ${nomeDaPessoa(atividade.responsavel_id)}`).includes(texto);
}

export function passaNosFiltrosComuns(atividade: AtividadeDoDia, filtros: FiltrosComuns, { pessoaAtualId, contextoGlobalId, nomeDaPessoa }: OpcoesDosFiltros): boolean {
  return (
    passaNaBusca(atividade, filtros.busca, nomeDaPessoa) &&
    passaNaPessoa(atividade, filtros, pessoaAtualId) &&
    passaNoContexto(atividade.produtos, contextoGlobalId) &&
    (!filtros.area || atividade.area_id === filtros.area) &&
    (!filtros.tipo || atividade.tipo === filtros.tipo) &&
    (!filtros.prioridades.length || filtros.prioridades.includes(atividade.prioridade)) &&
    (!filtros.origem || atividade.origem_tipo === filtros.origem) &&
    (!filtros.etiqueta || atividade.etiquetas.includes(filtros.etiqueta))
  );
}

/** Tudo o que não depende do destaque (RN-03.19). */
export function atividadesDaBase(atividades: readonly AtividadeDoDia[], filtros: FiltrosMeuDia, opcoes: OpcoesDosFiltros): AtividadeDoDia[] {
  return atividades.filter((atividade) => estaNoDia(atividade, opcoes.hoje) && passaNosFiltrosComuns(atividade, filtros, opcoes) && passaNoPeriodo(atividade, filtros, opcoes.hoje));
}

function passaNoDestaque(atividade: Atividade, destaque: DestaqueDoResumo, hoje: string): boolean {
  switch (destaque) {
    case 'em_andamento':
    case 'aguardando':
      return estaAberta(atividade) && atividade.situacao === destaque;
    case 'bloqueadas':
      return estaBloqueada(atividade);
    case 'concluidas':
      return concluidaHoje(atividade, hoje);
    default:
      return true;
  }
}

/** O que aparece na tela, igual no quadro e na lista. As concluídas de hoje ficam por último (RN-03.06). */
export function atividadesVisiveis(base: readonly AtividadeDoDia[], { destaque }: Pick<FiltrosMeuDia, 'destaque'>, hoje: string): AtividadeDoDia[] {
  const ordenadas = ordenarAtividades(base.filter((atividade) => passaNoDestaque(atividade, destaque, hoje)), hoje);
  return [...ordenadas.filter(estaAberta), ...ordenadas.filter((atividade) => !estaAberta(atividade))];
}

export function colunasDoQuadro(visiveis: readonly AtividadeDoDia[]): Record<ColunaDoQuadro, AtividadeDoDia[]> {
  return {
    a_fazer: visiveis.filter((atividade) => atividade.situacao === 'a_fazer'),
    em_andamento: visiveis.filter((atividade) => atividade.situacao === 'em_andamento'),
    aguardando: visiveis.filter((atividade) => atividade.situacao === 'aguardando'),
    concluida: visiveis.filter((atividade) => atividade.situacao === 'concluida'),
  };
}

// ---------- Faixa de resumo (RN-03.19) ----------

export const CARTOES_DO_RESUMO = ['atrasadas', 'hoje', 'em_andamento', 'aguardando', 'bloqueadas', 'concluidas'] as const;
export type CartaoDoResumo = (typeof CARTOES_DO_RESUMO)[number];
export type ResumoDoDia = Record<CartaoDoResumo, number>;

const CARTAO_DE_PERIODO = (cartao: CartaoDoResumo): cartao is 'atrasadas' | 'hoje' => cartao === 'atrasadas' || cartao === 'hoje';

/** "Atrasadas" e "Para hoje" são o mesmo filtro do seletor de período: uma seleção só, nunca duas. */
export function cartaoEstaAtivo(filtros: Pick<FiltrosMeuDia, 'periodo' | 'destaque'>, cartao: CartaoDoResumo): boolean {
  return CARTAO_DE_PERIODO(cartao) ? filtros.periodo === cartao : filtros.destaque === cartao;
}

/** O filtro que o cartão aplica. Clicar de novo tira. */
export function filtroDoCartao(filtros: Pick<FiltrosMeuDia, 'periodo' | 'destaque'>, cartao: CartaoDoResumo): Partial<FiltrosMeuDia> {
  if (CARTAO_DE_PERIODO(cartao)) return { periodo: filtros.periodo === cartao ? '' : cartao, prazoDe: '', prazoAte: '' };
  return { destaque: filtros.destaque === cartao ? '' : cartao };
}

export function resumoDoDia(base: readonly Atividade[], hoje: string): ResumoDoDia {
  const conta = (regra: (atividade: Atividade) => boolean) => base.filter(regra).length;
  return {
    atrasadas: conta((atividade) => estaAtrasada(atividade, hoje)),
    hoje: conta((atividade) => ehParaHoje(atividade, hoje)),
    em_andamento: conta((atividade) => estaAberta(atividade) && atividade.situacao === 'em_andamento'),
    aguardando: conta((atividade) => estaAberta(atividade) && atividade.situacao === 'aguardando'),
    bloqueadas: conta(estaBloqueada),
    concluidas: conta((atividade) => concluidaHoje(atividade, hoje)),
  };
}

/** A frase do cabeçalho: `itens` é o trecho com o marca-texto (18 §2.2). */
export function fraseDoResumo(resumo: ResumoDoDia): { abertura: string; itens: string; resto: string } | null {
  const pedacos = [resumo.atrasadas ? plural(resumo.atrasadas, 'atrasado', 'atrasados') : '', resumo.aguardando ? `${resumo.aguardando} aguardando retorno` : ''].filter(Boolean);
  if (!resumo.hoje && !pedacos.length) return null;
  const resto = pedacos.join(' e ');
  return { abertura: 'Hoje você tem ', itens: plural(resumo.hoje, 'item', 'itens'), resto: resto ? `, ${resto}.` : '.' };
}

/**
 * RN-03.19: todo contador segue o recorte. Só a própria escolha não conta: marcar "Atrasadas" não zera
 * "Para hoje", e marcar "Em andamento" não zera "Aguardando retorno", senão não daria para trocar de um para o outro.
 */
export function resumoDoRecorte(atividades: readonly AtividadeDoDia[], filtros: FiltrosMeuDia, opcoes: OpcoesDosFiltros): ResumoDoDia {
  const base = atividadesDaBase(atividades, filtros, opcoes);
  const periodoDoCartao = filtros.periodo === 'atrasadas' || filtros.periodo === 'hoje';
  const semOPeriodo = periodoDoCartao ? atividadesDaBase(atividades, { ...filtros, periodo: '' }, opcoes) : base;
  const doPeriodo = resumoDoDia(semOPeriodo.filter((atividade) => passaNoDestaque(atividade, filtros.destaque, opcoes.hoje)), opcoes.hoje);
  return { ...resumoDoDia(base, opcoes.hoje), atrasadas: doPeriodo.atrasadas, hoje: doPeriodo.hoje };
}

// ---------- Contexto, nomes e o recorte ----------

export type DadosMeuDia = {
  atividades: AtividadeDoDia[];
  pessoas: Pessoa[];
  areas: Area[];
  produtos: Produto[];
  marcas: Marca[];
  /** Todas, inclusive as arquivadas, para mostrar o nome das que já estavam aplicadas. */
  etiquetas: Etiqueta[];
};

export type ContextoDaAtividade = { id: string; nome: string; cor: string; tinta: string };

/** As etiquetas do cartão, inclusive de produto que saiu do seletor. Sem produto, é a Numa. */
export function contextosDaAtividade(atividade: Pick<AtividadeDoDia, 'produtos'>, { produtos, marcas }: { produtos: readonly Produto[]; marcas: readonly Marca[] }): ContextoDaAtividade[] {
  if (!atividade.produtos.length) {
    const institucional = marcas.find((marca) => marca.institucional);
    return institucional ? [{ id: ID_INSTITUCIONAL, nome: 'Numa', cor: institucional.cor_hex, tinta: tintaDaCor(institucional.cor_hex) }] : [];
  }
  return atividade.produtos.flatMap((id) => {
    const produto = produtos.find((item) => item.id === id);
    const marca = marcas.find((item) => item.id === produto?.marca_id);
    return produto && marca ? [{ id, nome: produto.nome, cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }] : [];
  });
}

/** "Kipi, Alta": o que está reduzindo os contadores (RN-03.19). */
export function recorteDosFiltros(filtros: FiltrosMeuDia, { nomeDaPessoa, nomeDaArea, nomeDoContexto, contextoGlobalId }: { nomeDaPessoa: (id: string) => string; nomeDaArea: (id: string) => string; nomeDoContexto: (id: string) => string; contextoGlobalId: string }): string[] {
  return [
    ...(filtros.busca.trim() ? [`“${filtros.busca.trim()}”`] : []),
    ...(filtros.pessoa ? [filtros.pessoa === MINHAS ? 'Minhas' : nomeDaPessoa(filtros.pessoa)] : []),
    ...(contextoGlobalId === ID_CONSOLIDADA ? [] : [nomeDoContexto(contextoGlobalId)]),
    ...(filtros.area ? [nomeDaArea(filtros.area)] : []),
    ...(filtros.tipo ? [ROTULOS_TIPO_ATIVIDADE[filtros.tipo as Atividade['tipo']]] : []),
    ...filtros.prioridades.map((prioridade) => ROTULOS_PRIORIDADE_ATIVIDADE[prioridade as Atividade['prioridade']]),
    ...(filtros.periodo ? [ROTULOS_PERIODO[filtros.periodo]] : []),
    ...(filtros.origem ? [ROTULOS_ORIGEM_ALERTA[filtros.origem] ?? filtros.origem] : []),
  ];
}

// ---------- Agrupar a lista (T03.01) ----------

export type AgruparPor = 'nenhum' | 'responsavel' | 'contexto' | 'prazo' | 'area';
export const ROTULOS_AGRUPAR = { nenhum: 'Nenhum', responsavel: 'Responsável', contexto: 'Contexto', prazo: 'Prazo', area: 'Área' } as const;

export type GrupoDeAtividades = { id: string; titulo: string; linhas: AtividadeDoDia[] };

const ORDEM_DO_PRAZO = ['Atrasadas', 'Hoje', 'Esta semana', 'Depois', 'Sem prazo'] as const;

function grupoDoPrazo(atividade: Atividade, hoje: string): (typeof ORDEM_DO_PRAZO)[number] {
  const prazo = prazoEfetivo(atividade);
  if (!prazo) return 'Sem prazo';
  if (estaAtrasada(atividade, hoje)) return 'Atrasadas';
  if (prazo === hoje) return 'Hoje';
  return prazo <= fimDaSemana(hoje) ? 'Esta semana' : 'Depois';
}

export function agruparAtividades(linhas: readonly AtividadeDoDia[], por: AgruparPor, hoje: string, dados: Pick<DadosMeuDia, 'pessoas' | 'areas' | 'produtos' | 'marcas'>): GrupoDeAtividades[] {
  if (por === 'nenhum') return [{ id: 'todas', titulo: '', linhas: [...linhas] }];
  const grupos = new Map<string, GrupoDeAtividades>();
  const incluir = (id: string, titulo: string, atividade: AtividadeDoDia) => {
    const grupo = grupos.get(id) ?? { id, titulo, linhas: [] };
    grupo.linhas.push(atividade);
    grupos.set(id, grupo);
  };
  for (const atividade of linhas) {
    if (por === 'responsavel') incluir(atividade.responsavel_id, dados.pessoas.find((pessoa) => pessoa.id === atividade.responsavel_id)?.nome_completo ?? 'Pessoa removida', atividade);
    if (por === 'prazo') incluir(grupoDoPrazo(atividade, hoje), grupoDoPrazo(atividade, hoje), atividade);
    if (por === 'area') incluir(atividade.area_id ?? 'sem-area', dados.areas.find((area) => area.id === atividade.area_id)?.nome ?? 'Sem área', atividade);
    if (por === 'contexto') for (const contexto of contextosDaAtividade(atividade, dados)) incluir(contexto.id, contexto.nome, atividade);
  }
  const lista = [...grupos.values()];
  if (por === 'prazo') return lista.sort((a, b) => ORDEM_DO_PRAZO.indexOf(a.titulo as (typeof ORDEM_DO_PRAZO)[number]) - ORDEM_DO_PRAZO.indexOf(b.titulo as (typeof ORDEM_DO_PRAZO)[number]));
  return lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

// ---------- Ações (RN-03.07 a RN-03.10) ----------

async function obterAtividade(id: string): Promise<Atividade> {
  const atividade = await repositorios.atividade.obter(id);
  if (!atividade) throw new ErroDeRegra('Esta atividade não existe mais.');
  return atividade;
}

const SEM_AGUARDANDO = { aguardando_de_pessoa_id: null, aguardando_de_texto: null, aguardando_desde: null, acompanhamento_em: null };

/** RN-03.12: concluir um alerta não executa a ação de origem, e o aviso diz isso. */
export function mensagemAoConcluir(atividade: Pick<Atividade, 'tipo'>): string {
  return atividade.tipo === 'alerta' ? 'Alerta concluído. A ação de origem não foi feita.' : 'Atividade concluída.';
}

/** Quem conclui é a pessoa atual; o repositório grava o histórico. Devolve a situação anterior, para o "Desfazer". */
export async function concluirAtividade(id: string, pessoaId: string): Promise<Situacao> {
  const atividade = await obterAtividade(id);
  await repositorios.atividade.atualizar(id, { situacao: 'concluida', concluida_em: new Date().toISOString(), concluida_por: pessoaId });
  return atividade.situacao;
}

/** O "Desfazer" logo depois de concluir não pede motivo: a conclusão nem chegou a valer. */
export async function desfazerConclusao(id: string, situacaoAnterior: Situacao): Promise<void> {
  await repositorios.atividade.atualizar(id, { situacao: situacaoAnterior, concluida_em: null, concluida_por: null });
}

/** RN-03.07: reabrir exige motivo e preserva o histórico. */
export async function reabrirAtividade(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo para reabrir.');
  await repositorios.atividade.atualizar(id, { situacao: 'a_fazer', concluida_em: null, concluida_por: null, conclusao_nota: null, cancelada_motivo: null, dispensada_motivo: null, ...SEM_AGUARDANDO }, { motivo });
}

/** RN-03.07: cancelar exige motivo. A atividade sai do quadro e vai para o histórico. */
export async function cancelarAtividade(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo para cancelar.');
  await repositorios.atividade.atualizar(id, { situacao: 'cancelada', cancelada_motivo: motivo }, { motivo });
}

/** RN-03.13: dispensar com motivo não altera a origem. A chave de idempotência continua na linha, e o mesmo motivo não volta. */
export async function dispensarAlerta(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo para dispensar.');
  await repositorios.atividade.atualizar(id, { situacao: 'cancelada', cancelada_motivo: motivo, dispensada_motivo: motivo }, { motivo });
}

/** Mover para A fazer ou Em andamento. Sair de Aguardando limpa de quem se aguardava; o histórico guarda. */
export async function moverAtividade(id: string, situacao: 'a_fazer' | 'em_andamento'): Promise<void> {
  await repositorios.atividade.atualizar(id, { situacao, ...SEM_AGUARDANDO });
}

export type DadosDeAguardando = {
  /** `pessoa:<id>` ou vazio, para usar o texto. */
  pessoaId: string;
  texto: string;
  acompanhamento: string;
};

/** RN-03.09: pede de quem está aguardando (pessoa ou texto livre) e, se quiser, a data de acompanhamento. */
export async function moverParaAguardando(id: string, { pessoaId, texto, acompanhamento }: DadosDeAguardando, hoje: string): Promise<void> {
  if (!pessoaId && !texto.trim()) throw new ErroDeRegra('Diga de quem está aguardando.');
  await repositorios.atividade.atualizar(id, { situacao: 'aguardando', aguardando_de_pessoa_id: pessoaId || null, aguardando_de_texto: pessoaId ? null : texto.trim(), aguardando_desde: hoje, acompanhamento_em: acompanhamento || null });
}

/** O dia de onde "+1 dia" e "+1 semana" contam: de hoje, se o prazo já passou ou não existe. */
export function novaDataDoAdiamento(atividade: Pick<Atividade, 'tipo' | 'prazo' | 'aviso_em'>, dias: number, hoje: string): string {
  const prazo = prazoEfetivo(atividade);
  return somarDias(prazo && prazo > hoje ? prazo : hoje, dias);
}

export type AntesDoAdiamento = Pick<Atividade, 'prazo' | 'aviso_em' | 'adiamentos'>;

/**
 * RN-03.08: adiar exige nova data, e a anterior fica no histórico. Quem não tinha prazo ganha um, sem
 * contar como adiamento. Lembrete adia o aviso, mantendo a hora. Devolve o estado anterior, para o "Desfazer".
 */
export async function adiarAtividade(id: string, novaData: string, hoje: string): Promise<AntesDoAdiamento> {
  const atividade = await obterAtividade(id);
  if (!novaData) throw new ErroDeRegra('Escolha a nova data.');
  if (novaData < hoje) throw new ErroDeRegra('Escolha hoje ou uma data futura.');
  const atual = prazoEfetivo(atividade);
  if (novaData === atual) throw new ErroDeRegra('Esta já é a data da atividade. Escolha outra.');
  const antes = { prazo: atividade.prazo, aviso_em: atividade.aviso_em, adiamentos: atividade.adiamentos };
  const adiamentos = atual ? atividade.adiamentos + 1 : atividade.adiamentos;
  if (atividade.tipo === 'lembrete' && atividade.aviso_em && !atividade.prazo) {
    const dias = Math.round((Date.parse(`${novaData}T00:00:00Z`) - Date.parse(`${atual}T00:00:00Z`)) / UM_DIA);
    await repositorios.atividade.atualizar(id, { aviso_em: new Date(new Date(atividade.aviso_em).getTime() + dias * UM_DIA).toISOString(), adiamentos, editada_individualmente: Boolean(atividade.recorrencia_id) });
    return antes;
  }
  await repositorios.atividade.atualizar(id, { prazo: novaData, adiamentos, editada_individualmente: Boolean(atividade.recorrencia_id) });
  return antes;
}

export async function desfazerAdiamento(id: string, antes: AntesDoAdiamento): Promise<void> {
  await repositorios.atividade.atualizar(id, antes);
}

/** RN-03.10: marcar bloqueada exige motivo. É um marcador, não uma coluna. */
export async function bloquearAtividade(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Informe o motivo do bloqueio.');
  await repositorios.atividade.atualizar(id, { bloqueada: true, bloqueio_motivo: motivo, bloqueada_em: new Date().toISOString() });
}

export async function desbloquearAtividade(id: string): Promise<void> {
  await repositorios.atividade.atualizar(id, { bloqueada: false, bloqueio_motivo: null, bloqueada_em: null });
}

/** Quem vira responsável deixa de ser participante: não aparece duas vezes no cartão. Numa ocorrência, vale só para ela. */
export async function trocarResponsavel(id: string, pessoaId: string): Promise<void> {
  const atividade = await obterAtividade(id);
  await emTransacao(async () => {
    await repositorios.atividade.atualizar(id, { responsavel_id: pessoaId, editada_individualmente: Boolean(atividade.recorrencia_id) });
    for (const ligacao of await repositorios.atividade_participante.listar({ onde: { atividade_id: id, pessoa_id: pessoaId } })) await repositorios.atividade_participante.arquivar(ligacao.id);
  });
}

// ---------- Vínculos com os cadastros (RN-02.04) ----------

/** Só as abertas prendem a pessoa, a área e o produto: as encerradas continuam com o nome no histórico. */
export async function vinculosDeAtividadeDaPessoa(id: string): Promise<string[]> {
  const [responsavel, participacoes, todas] = await Promise.all([repositorios.atividade.listar({ onde: { responsavel_id: id } }), repositorios.atividade_participante.listar({ onde: { pessoa_id: id } }), repositorios.atividade.listar()]);
  const abertas = new Set(todas.filter(estaAberta).map((atividade) => atividade.id));
  const quantasResponsavel = responsavel.filter(estaAberta).length;
  const quantasParticipa = participacoes.filter((ligacao) => abertas.has(ligacao.atividade_id)).length;
  return [...(quantasResponsavel ? [`Responsável por ${plural(quantasResponsavel, 'atividade aberta', 'atividades abertas')}`] : []), ...(quantasParticipa ? [`Participa de ${plural(quantasParticipa, 'atividade aberta', 'atividades abertas')}`] : [])];
}

export async function quantasAtividadesAbertasNaArea(id: string): Promise<number> {
  return (await repositorios.atividade.listar({ onde: { area_id: id } })).filter(estaAberta).length;
}

export async function quantasAtividadesAbertasNoProduto(id: string): Promise<number> {
  const [ligacoes, vinculadas, todas] = await Promise.all([repositorios.atividade_produto.listar({ onde: { produto_id: id } }), atividadesVinculadas('produto', id), repositorios.atividade.listar()]);
  const abertas = new Set(todas.filter(estaAberta).map((atividade) => atividade.id));
  return new Set([...ligacoes.map((ligacao) => ligacao.atividade_id), ...vinculadas].filter((atividadeId) => abertas.has(atividadeId))).size;
}

/** Ids das atividades ligadas a um registro pelo `vinculo` (RN-03.20). */
async function atividadesVinculadas(tipo: string, id: string): Promise<string[]> {
  const vinculos = await repositorios.vinculo.listar();
  return vinculos.flatMap((vinculo) => {
    if (vinculo.origem_tipo === tipo && vinculo.origem_id === id && vinculo.destino_tipo === 'atividade') return [vinculo.destino_id];
    if (vinculo.destino_tipo === tipo && vinculo.destino_id === id && vinculo.origem_tipo === 'atividade') return [vinculo.origem_id];
    return [];
  });
}

export async function quantasAtividadesAbertasVinculadas(tipo: string, id: string): Promise<number> {
  const [vinculadas, todas] = await Promise.all([atividadesVinculadas(tipo, id), repositorios.atividade.listar()]);
  const abertas = new Set(todas.filter(estaAberta).map((atividade) => atividade.id));
  return vinculadas.filter((atividadeId) => abertas.has(atividadeId)).length;
}

// ---------- Carga da tela ----------

export async function carregarMeuDia(): Promise<DadosMeuDia> {
  const [atividades, ligacoesProduto, ligacoesParticipante, itens, comentarios, pessoas, areas, produtos, marcas] = await Promise.all([
    repositorios.atividade.listar(),
    repositorios.atividade_produto.listar(),
    repositorios.atividade_participante.listar(),
    repositorios.checklist_item.listar({ onde: { registro_tipo: 'atividade' } }),
    repositorios.comentario.listar({ onde: { registro_tipo: 'atividade' } }),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.area.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
  ]);
  const [vinculosDeEtiqueta, etiquetas] = await Promise.all([repositorios.etiqueta_vinculo.listar({ onde: { registro_tipo: 'atividade' } }), repositorios.etiqueta.listar({ incluirArquivados: true })]);
  const etiquetasDa = (id: string) => vinculosDeEtiqueta.filter((vinculo) => vinculo.registro_id === id).map((vinculo) => vinculo.etiqueta_id);
  return {
    atividades: atividades.map((atividade) => ({
      ...atividade,
      produtos: ligacoesProduto.filter((ligacao) => ligacao.atividade_id === atividade.id).map((ligacao) => ligacao.produto_id),
      participantes: ligacoesParticipante.filter((ligacao) => ligacao.atividade_id === atividade.id).map((ligacao) => ligacao.pessoa_id),
      itensTotal: itens.filter((item) => item.registro_id === atividade.id).length,
      itensFeitos: itens.filter((item) => item.registro_id === atividade.id && item.feito).length,
      comentarios: comentarios.filter((comentario) => comentario.registro_id === atividade.id && !comentario.removido_em).length,
      etiquetas: etiquetasDa(atividade.id),
    })),
    pessoas,
    areas,
    produtos,
    marcas,
    etiquetas,
  };
}
