/** Regras de T03.01 (05-M03): atividades, quadro, lista e ações rápidas. */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { Area } from '@/dados/tipos/area';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { fusoConfigurado, hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { tintaDaCor } from './cores';
import { normalizarTexto } from './duplicidade';

type Situacao = Atividade['situacao'];

export const ROTULOS_TIPO_ATIVIDADE = { tarefa: 'Tarefa', demanda: 'Demanda', lembrete: 'Lembrete', alerta: 'Alerta' } as const;
export const ROTULOS_SITUACAO_ATIVIDADE = { a_fazer: 'A fazer', em_andamento: 'Em andamento', aguardando: 'Aguardando retorno', concluida: 'Concluída', cancelada: 'Cancelada' } as const;
export const ROTULOS_PRIORIDADE_ATIVIDADE = { urgente: 'Urgente', alta: 'Alta', normal: 'Normal', baixa: 'Baixa' } as const;

export const COLUNAS_DO_QUADRO = ['a_fazer', 'em_andamento', 'aguardando', 'concluida'] as const;
export type ColunaDoQuadro = (typeof COLUNAS_DO_QUADRO)[number];

/** O que o alerta oferece (RN-03.12). A chave fica no registro; o caminho, aqui. */
export const ACOES_DE_ALERTA: Readonly<Record<string, { rotulo: string; href: string }>> = {
  exportar_dados: { rotulo: 'Exportar dados', href: '/configuracoes/dados' },
};

/** Origens da F0a: as das outras fases entram junto com as telas delas (RT-23). */
export const ROTULOS_ORIGEM_ALERTA: Readonly<Record<string, string>> = { titulo: 'Financeiro', ferramenta: 'Ferramentas', ativo: 'Ferramentas', backup: 'Backup' };

export const MAXIMO_NO_TITULO = 140;

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

/** "sexta-feira, 6 de novembro", no fuso configurado. */
export function dataPorExtenso(agora: Date = new Date(), fuso: string = fusoConfigurado()): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: fuso }).format(agora);
}

// ---------- Filtros (T03.01) ----------

export type AtividadeDoDia = Atividade & { produtos: string[]; participantes: string[] };

export type PeriodoDoPrazo = '' | 'atrasadas' | 'hoje' | 'semana' | '30dias' | 'sem_prazo' | 'intervalo';
export type DestaqueDoResumo = '' | 'atrasadas' | 'hoje' | 'em_andamento' | 'aguardando' | 'bloqueadas' | 'concluidas';

export type FiltrosMeuDia = {
  busca: string;
  /** Vazio é Todas (RN-03.01); 'minhas' é a pessoa atual; ou o id de uma pessoa. */
  pessoa: string;
  soResponsavel: boolean;
  /** Ids de produtos e `institucional`. Vazio herda o seletor global. */
  contextos: string[];
  area: string;
  tipo: string;
  situacao: 'abertas' | ColunaDoQuadro;
  prioridades: string[];
  periodo: PeriodoDoPrazo;
  prazoDe: string;
  prazoAte: string;
  origem: string;
  /** O cartão clicado na faixa de resumo. */
  destaque: DestaqueDoResumo;
};

export const FILTROS_MEU_DIA_INICIAIS: FiltrosMeuDia = { busca: '', pessoa: '', soResponsavel: false, contextos: [], area: '', tipo: '', situacao: 'abertas', prioridades: [], periodo: '', prazoDe: '', prazoAte: '', origem: '', destaque: '' };

export const ROTULOS_PERIODO = { atrasadas: 'Atrasadas', hoje: 'Hoje', semana: 'Esta semana', '30dias': 'Próximos 30 dias', sem_prazo: 'Sem prazo', intervalo: 'Intervalo' } as const;

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

function passaNoPeriodo(atividade: Atividade, { periodo, prazoDe, prazoAte }: FiltrosMeuDia, hoje: string): boolean {
  const prazo = prazoEfetivo(atividade);
  switch (periodo) {
    case 'atrasadas':
      return estaAtrasada(atividade, hoje);
    case 'hoje':
      return ehParaHoje(atividade, hoje) || (prazo === hoje && !estaAberta(atividade));
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

function passaNaPessoa(atividade: AtividadeDoDia, { pessoa, soResponsavel }: FiltrosMeuDia, pessoaAtualId: string): boolean {
  if (!pessoa) return true;
  const alvo = pessoa === MINHAS ? pessoaAtualId : pessoa;
  return atividade.responsavel_id === alvo || (!soResponsavel && atividade.participantes.includes(alvo));
}

/** Os contextos do filtro; sem nenhum, vale o seletor global. Atividade sem produto é da Numa. */
function passaNoContexto(atividade: AtividadeDoDia, { contextos }: FiltrosMeuDia, contextoGlobalId: string): boolean {
  const escolhidos = contextos.length ? contextos : contextoGlobalId === ID_CONSOLIDADA ? [] : [contextoGlobalId];
  if (!escolhidos.length) return true;
  return escolhidos.some((id) => (id === ID_INSTITUCIONAL ? atividade.produtos.length === 0 : atividade.produtos.includes(id)));
}

function passaNaBusca(atividade: AtividadeDoDia, busca: string, nomeDaPessoa: (id: string) => string): boolean {
  const texto = normalizarTexto(busca);
  if (!texto) return true;
  return normalizarTexto(`${atividade.titulo} ${atividade.codigo} ${atividade.descricao ?? ''} ${nomeDaPessoa(atividade.responsavel_id)}`).includes(texto);
}

/** Tudo o que não depende da situação nem do destaque: é a base dos contadores (RN-03.19). */
export function atividadesDaBase(atividades: readonly AtividadeDoDia[], filtros: FiltrosMeuDia, { hoje, pessoaAtualId, contextoGlobalId, nomeDaPessoa }: OpcoesDosFiltros): AtividadeDoDia[] {
  return atividades
    .filter((atividade) => estaNoDia(atividade, hoje))
    .filter((atividade) => passaNaBusca(atividade, filtros.busca, nomeDaPessoa))
    .filter((atividade) => passaNaPessoa(atividade, filtros, pessoaAtualId))
    .filter((atividade) => passaNoContexto(atividade, filtros, contextoGlobalId))
    .filter((atividade) => !filtros.area || atividade.area_id === filtros.area)
    .filter((atividade) => !filtros.tipo || atividade.tipo === filtros.tipo)
    .filter((atividade) => !filtros.prioridades.length || filtros.prioridades.includes(atividade.prioridade))
    .filter((atividade) => passaNoPeriodo(atividade, filtros, hoje))
    .filter((atividade) => !filtros.origem || atividade.origem_tipo === filtros.origem);
}

function passaNoDestaque(atividade: Atividade, destaque: DestaqueDoResumo, hoje: string): boolean {
  switch (destaque) {
    case 'atrasadas':
      return estaAtrasada(atividade, hoje);
    case 'hoje':
      return ehParaHoje(atividade, hoje);
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

/**
 * O que aparece na tela. No quadro, a coluna Concluída fica sempre (RN-03.06); na lista, "abertas"
 * são só as abertas, salvo se o cartão "Concluídas hoje" estiver escolhido.
 */
export function atividadesVisiveis(base: readonly AtividadeDoDia[], { situacao, destaque }: FiltrosMeuDia, visao: 'quadro' | 'lista', hoje: string): AtividadeDoDia[] {
  return ordenarAtividades(
    base
      .filter((atividade) => passaNoDestaque(atividade, destaque, hoje))
      .filter((atividade) => {
        if (situacao !== 'abertas') return atividade.situacao === situacao;
        return visao === 'quadro' || destaque === 'concluidas' || estaAberta(atividade);
      }),
    hoje,
  );
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

export type ResumoDoDia = Record<Exclude<DestaqueDoResumo, ''>, number>;

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

// ---------- Contexto, nomes e o recorte ----------

export type DadosMeuDia = {
  atividades: AtividadeDoDia[];
  pessoas: Pessoa[];
  areas: Area[];
  produtos: Produto[];
  marcas: Marca[];
};

export type ContextoDaAtividade = { id: string; nome: string; cor: string; tinta: string };

/** As etiquetas do cartão, inclusive de produto que saiu do seletor. Sem produto, é a Numa. */
export function contextosDaAtividade(atividade: Pick<AtividadeDoDia, 'produtos'>, { produtos, marcas }: Pick<DadosMeuDia, 'produtos' | 'marcas'>): ContextoDaAtividade[] {
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
  const contextos = filtros.contextos.length ? filtros.contextos : contextoGlobalId === ID_CONSOLIDADA ? [] : [contextoGlobalId];
  return [
    ...(filtros.busca.trim() ? [`“${filtros.busca.trim()}”`] : []),
    ...(filtros.pessoa ? [filtros.pessoa === MINHAS ? 'Minhas' : nomeDaPessoa(filtros.pessoa)] : []),
    ...contextos.map(nomeDoContexto),
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
  await repositorios.atividade.atualizar(id, { situacao: 'a_fazer', concluida_em: null, concluida_por: null, conclusao_nota: null, ...SEM_AGUARDANDO }, { motivo });
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
    await repositorios.atividade.atualizar(id, { aviso_em: new Date(new Date(atividade.aviso_em).getTime() + dias * UM_DIA).toISOString(), adiamentos });
    return antes;
  }
  await repositorios.atividade.atualizar(id, { prazo: novaData, adiamentos });
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

export async function trocarResponsavel(id: string, pessoaId: string): Promise<void> {
  await repositorios.atividade.atualizar(id, { responsavel_id: pessoaId });
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
  const [ligacoes, todas] = await Promise.all([repositorios.atividade_produto.listar({ onde: { produto_id: id } }), repositorios.atividade.listar()]);
  const abertas = new Set(todas.filter(estaAberta).map((atividade) => atividade.id));
  return ligacoes.filter((ligacao) => abertas.has(ligacao.atividade_id)).length;
}

// ---------- Carga da tela ----------

export async function carregarMeuDia(): Promise<DadosMeuDia> {
  const [atividades, ligacoesProduto, ligacoesParticipante, pessoas, areas, produtos, marcas] = await Promise.all([
    repositorios.atividade.listar(),
    repositorios.atividade_produto.listar(),
    repositorios.atividade_participante.listar(),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.area.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
  ]);
  return {
    atividades: atividades.map((atividade) => ({
      ...atividade,
      produtos: ligacoesProduto.filter((ligacao) => ligacao.atividade_id === atividade.id).map((ligacao) => ligacao.produto_id),
      participantes: ligacoesParticipante.filter((ligacao) => ligacao.atividade_id === atividade.id).map((ligacao) => ligacao.pessoa_id),
    })),
    pessoas,
    areas,
    produtos,
    marcas,
  };
}
