/**
 * Regras de T08.05 (10-M08): calendário editorial e peças de conteúdo. A Central planeja e registra;
 * não publica nas redes nem envia e-mail. Data prevista e data realizada são campos distintos.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { CANAIS_DE_CONTEUDO, FORMATOS_DE_CONTEUDO, SITUACOES_DE_PECA, type Arquivo, type ArquivoVinculo, type Campanha, type PecaConteudo, type SituacaoDaPeca } from '@/dados/tipos/marketing';
import type { Area } from '@/dados/tipos/area';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { hojeISO } from '@/lib/datas';
import { sincronizarAlertasDasPecas } from './alertas-m08';
import { definirArquivosDoRegistro } from './biblioteca';
import { podeVerClasse } from './classes';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { normalizarTexto } from './duplicidade';
import { somarDias } from './repeticao';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';

export const ROTULOS_CANAL: Readonly<Record<(typeof CANAIS_DE_CONTEUDO)[number], string>> = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', blog: 'Blog', email: 'E-mail', loja: 'Loja', outro: 'Outro' };
export const ROTULOS_FORMATO: Readonly<Record<(typeof FORMATOS_DE_CONTEUDO)[number], string>> = { post: 'Post', carrossel: 'Carrossel', video_curto: 'Vídeo curto', story: 'Story', artigo: 'Artigo', email: 'E-mail' };
export const ROTULOS_SITUACAO_PECA: Readonly<Record<SituacaoDaPeca, string>> = { ideia: 'Ideia', producao: 'Produção', revisao: 'Revisão', aprovado: 'Aprovado', publicado: 'Publicado', cancelado: 'Cancelado' };
export const DESCRICOES_SITUACAO_PECA: Readonly<Record<SituacaoDaPeca, string>> = {
  ideia: 'Tema definido, em planejamento.',
  producao: 'Conteúdo em elaboração.',
  revisao: 'Em revisão de conteúdo e formato.',
  aprovado: 'Conteúdo validado para publicação.',
  publicado: 'Foi ao ar, com data e link registrados.',
  cancelado: 'Não vai ao ar. O registro continua aqui.',
};

export const VISOES_DO_CALENDARIO = [
  { id: 'mes', rotulo: 'Mês' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'lista', rotulo: 'Lista' },
  { id: 'quadro', rotulo: 'Quadro' },
] as const;
export type VisaoDoCalendario = (typeof VISOES_DO_CALENDARIO)[number]['id'];

/** T08.05: "Padrão: Kimberly (Social media)", pela responsável padrão da área. */
export const responsavelDeMarketing = (areas: readonly Pick<Area, 'nome' | 'responsavel_padrao_id'>[]) => areas.find((area) => area.nome === 'Social media / Marketing')?.responsavel_padrao_id ?? null;

// ---------- Formulário ----------

const curto = z.string().trim();
const numeroVazio = z.string().trim().regex(/^\d*$/, 'Use só números inteiros.');
const LINK_WEB = /^https?:\/\/\S+$/;

/** `medido_em` e os resultados só existem para o que foi ao ar. */
export const esquemaFormularioPeca = z
  .object({
    titulo: curto.min(1, 'Informe o título ou tema.'),
    contexto: z.string().min(1, 'Escolha a marca ou o produto.'),
    canal: z.enum(CANAIS_DE_CONTEUDO),
    formato: z.string(),
    data_prevista: z.string().min(1, 'Informe a data prevista de publicação.'),
    situacao: z.enum(SITUACOES_DE_PECA),
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
    campanha_id: z.string(),
    texto: curto,
    arquivos: z.array(z.string()),
    link_publicacao: curto,
    publicado_em: z.string(),
    alcance: numeroVazio,
    interacoes: numeroVazio,
    cliques: numeroVazio,
    inscritos: numeroVazio,
    medido_em: z.string(),
    cancelado_motivo: curto,
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    const hoje = hojeISO();
    if (dados.situacao === 'publicado') {
      // RN-08.11.
      if (!dados.publicado_em) falha('publicado_em', 'Publicado precisa da data em que foi ao ar.');
      else if (dados.publicado_em > hoje) falha('publicado_em', 'A data realizada não pode estar no futuro. Enquanto não foi ao ar, use a data prevista.');
      if (!dados.link_publicacao) falha('link_publicacao', 'Publicado precisa do link da publicação.');
    }
    if (dados.link_publicacao && !LINK_WEB.test(dados.link_publicacao)) falha('link_publicacao', 'Use um link completo, começando com https://.');
    const temResultado = [dados.alcance, dados.interacoes, dados.cliques, dados.inscritos].some(Boolean);
    if (temResultado && dados.situacao !== 'publicado') falha('alcance', 'Resultados só valem para peça publicada.');
    if (temResultado && !dados.medido_em) falha('medido_em', 'Informe a data da medição.');
    if (dados.medido_em && dados.medido_em > hoje) falha('medido_em', 'A medição não pode estar no futuro.');
    if (dados.medido_em && dados.publicado_em && dados.medido_em < dados.publicado_em) falha('medido_em', 'A medição não pode vir antes da publicação.');
  });
export type FormularioPeca = z.infer<typeof esquemaFormularioPeca>;

export function formularioPecaVazio(responsavelId: string, contextoGlobalId: string, dia: string = ''): FormularioPeca {
  return { titulo: '', contexto: contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId, canal: 'instagram', formato: '', data_prevista: dia, situacao: 'ideia', responsavel_id: responsavelId, campanha_id: '', texto: '', arquivos: [], link_publicacao: '', publicado_em: '', alcance: '', interacoes: '', cliques: '', inscritos: '', medido_em: '', cancelado_motivo: '' };
}

const textoDoNumero = (valor: number | null) => (valor === null ? '' : String(valor));

export function formularioDaPeca(peca: PecaConteudo, arquivos: readonly string[]): FormularioPeca {
  return {
    titulo: peca.titulo,
    contexto: peca.produto_id ?? ID_INSTITUCIONAL,
    canal: peca.canal,
    formato: peca.formato ?? '',
    data_prevista: peca.data_prevista,
    situacao: peca.situacao,
    responsavel_id: peca.responsavel_id,
    campanha_id: peca.campanha_id ?? '',
    texto: peca.texto ?? '',
    arquivos: [...arquivos],
    link_publicacao: peca.link_publicacao ?? '',
    publicado_em: peca.publicado_em ?? '',
    alcance: textoDoNumero(peca.resultados.alcance),
    interacoes: textoDoNumero(peca.resultados.interacoes),
    cliques: textoDoNumero(peca.resultados.cliques),
    inscritos: textoDoNumero(peca.resultados.inscritos),
    medido_em: peca.medido_em ?? '',
    cancelado_motivo: peca.cancelado_motivo ?? '',
  };
}

const nulo = (texto: string) => texto.trim() || null;
const numeroOuNulo = (texto: string) => (texto.trim() === '' ? null : Number(texto));

function dadosDaPeca(formulario: FormularioPeca) {
  const publicada = formulario.situacao === 'publicado';
  return {
    titulo: formulario.titulo,
    produto_id: formulario.contexto === ID_INSTITUCIONAL ? null : formulario.contexto,
    canal: formulario.canal,
    formato: formulario.formato ? (formulario.formato as PecaConteudo['formato']) : null,
    data_prevista: formulario.data_prevista,
    situacao: formulario.situacao,
    responsavel_id: formulario.responsavel_id,
    campanha_id: nulo(formulario.campanha_id),
    texto: nulo(formulario.texto),
    link_publicacao: publicada ? nulo(formulario.link_publicacao) : null,
    publicado_em: publicada ? nulo(formulario.publicado_em) : null,
    resultados: publicada ? { alcance: numeroOuNulo(formulario.alcance), interacoes: numeroOuNulo(formulario.interacoes), cliques: numeroOuNulo(formulario.cliques), inscritos: numeroOuNulo(formulario.inscritos) } : { alcance: null, interacoes: null, cliques: null, inscritos: null },
    medido_em: publicada ? nulo(formulario.medido_em) : null,
    cancelado_motivo: formulario.situacao === 'cancelado' ? nulo(formulario.cancelado_motivo) : null,
  };
}

export function avisosDaPeca(formulario: Pick<FormularioPeca, 'texto' | 'data_prevista' | 'situacao' | 'publicado_em'>, hoje: string = hojeISO()): string[] {
  const avisos: string[] = [];
  if (formulario.situacao !== 'publicado' && formulario.situacao !== 'cancelado' && formulario.data_prevista && formulario.data_prevista < hoje) avisos.push('A data prevista já passou. A peça fica como atrasada no Meu dia até ser publicada, cancelada ou mudar de data.');
  if (pareceCredencial(formulario.texto)) avisos.push(AVISO_CREDENCIAL);
  return avisos;
}

export async function criarPeca(formulario: FormularioPeca): Promise<PecaConteudo> {
  const dados = esquemaFormularioPeca.parse(formulario);
  const peca = await emTransacao(async () => {
    const criada = await repositorios.peca_conteudo.criar(dadosDaPeca(dados));
    await definirArquivosDoRegistro('peca_conteudo', criada.id, dados.arquivos);
    return criada;
  });
  await sincronizarAlertasDasPecas([peca.id]);
  return peca;
}

export async function salvarPeca(id: string, formulario: FormularioPeca): Promise<PecaConteudo> {
  const dados = esquemaFormularioPeca.parse(formulario);
  const peca = await emTransacao(async () => {
    const salva = await repositorios.peca_conteudo.atualizar(id, dadosDaPeca(dados));
    await definirArquivosDoRegistro('peca_conteudo', id, dados.arquivos);
    return salva;
  });
  await sincronizarAlertasDasPecas([id]);
  return peca;
}

/** Quadro: mudar de coluna. Publicar pede data e link, então vai pelo formulário; cancelar pede o motivo, pelo diálogo. */
export async function moverPeca(id: string, situacao: SituacaoDaPeca): Promise<void> {
  if (situacao === 'publicado') throw new ErroDeRegra('Publicado precisa da data realizada e do link. Abra a peça para registrar.');
  if (situacao === 'cancelado') throw new ErroDeRegra('Para cancelar, abra a peça e informe o motivo.');
  await repositorios.peca_conteudo.atualizar(id, { situacao, publicado_em: null, link_publicacao: null, cancelado_motivo: null, resultados: { alcance: null, interacoes: null, cliques: null, inscritos: null }, medido_em: null });
  await sincronizarAlertasDasPecas([id]);
}

/** A peça cancelada fica no calendário e no histórico (LEIA-ME do M08). */
export async function cancelarPeca(id: string, motivo: string): Promise<void> {
  await repositorios.peca_conteudo.atualizar(id, { situacao: 'cancelado', cancelado_motivo: motivo.trim() || null, publicado_em: null, link_publicacao: null }, motivo.trim() ? { motivo: motivo.trim() } : undefined);
  await sincronizarAlertasDasPecas([id]);
}

// ---------- Carga e filtros ----------

export type DadosDoConteudo = {
  pecas: PecaConteudo[];
  campanhas: Campanha[];
  arquivos: Arquivo[];
  vinculos: ArquivoVinculo[];
  pessoas: Pessoa[];
  areas: Area[];
  produtos: Produto[];
  marcas: Marca[];
};

export async function carregarConteudo(): Promise<DadosDoConteudo> {
  const [pecas, campanhas, arquivos, vinculos, pessoas, areas, produtos, marcas] = await Promise.all([
    repositorios.peca_conteudo.listar({ incluirArquivados: true }),
    repositorios.campanha.listar({ incluirArquivados: true }),
    repositorios.arquivo.listar(),
    repositorios.arquivo_vinculo.listar({ onde: { registro_tipo: 'peca_conteudo' } }),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.area.listar(),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
  ]);
  return { pecas, campanhas, arquivos: arquivos.filter((arquivo) => podeVerClasse(arquivo.classe)), vinculos, pessoas, areas, produtos, marcas };
}

export type FiltrosConteudo = { busca: string; contexto: string; canal: string; responsavel: string; situacao: string; formato: string; campanha: string; incluirCanceladas: boolean };
export const FILTROS_CONTEUDO_INICIAIS: FiltrosConteudo = { busca: '', contexto: '', canal: '', responsavel: '', situacao: '', formato: '', campanha: '', incluirCanceladas: false };

export const quantosMaisFiltrosDoConteudo = (filtros: FiltrosConteudo) => [filtros.situacao, filtros.formato, filtros.campanha, filtros.incluirCanceladas].filter(Boolean).length;

export function filtrarPecas(pecas: readonly PecaConteudo[], filtros: FiltrosConteudo, contextoGlobalId: string): PecaConteudo[] {
  const texto = normalizarTexto(filtros.busca);
  const contexto = filtros.contexto || (contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId);
  return pecas
    .filter((peca) => {
      if (peca.arquivado_em) return false;
      if (peca.situacao === 'cancelado' && !filtros.incluirCanceladas && filtros.situacao !== 'cancelado') return false;
      if (texto && !normalizarTexto(`${peca.codigo} ${peca.titulo} ${peca.texto ?? ''}`).includes(texto)) return false;
      if (contexto && (peca.produto_id ?? ID_INSTITUCIONAL) !== contexto) return false;
      if (filtros.canal && peca.canal !== filtros.canal) return false;
      if (filtros.responsavel && peca.responsavel_id !== filtros.responsavel) return false;
      if (filtros.situacao && peca.situacao !== filtros.situacao) return false;
      if (filtros.formato && peca.formato !== filtros.formato) return false;
      if (filtros.campanha && peca.campanha_id !== filtros.campanha) return false;
      return true;
    })
    .sort((a, b) => diaNoCalendario(a).localeCompare(diaNoCalendario(b)) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

// ---------- Calendário ----------

/** O que foi ao ar aparece no dia em que foi ao ar; o resto, no dia previsto. */
export const diaNoCalendario = (peca: Pick<PecaConteudo, 'data_prevista' | 'publicado_em'>) => peca.publicado_em ?? peca.data_prevista;

export const pecaAtrasada = (peca: Pick<PecaConteudo, 'situacao' | 'data_prevista'>, hoje: string) => peca.situacao !== 'publicado' && peca.situacao !== 'cancelado' && peca.data_prevista < hoje;

/** Segunda-feira da semana do dia. */
export function inicioDaSemana(dia: string): string {
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay();
  return somarDias(dia, -((semana + 6) % 7));
}

export const diasDaSemana = (dia: string): string[] => Array.from({ length: 7 }, (_, indice) => somarDias(inicioDaSemana(dia), indice));

/** As semanas que cobrem o mês, de segunda a domingo. `mes` é aaaa-mm. */
export function semanasDoMes(mes: string): string[][] {
  const primeiro = `${mes}-01`;
  const semanas: string[][] = [];
  let inicio = inicioDaSemana(primeiro);
  while (inicio.slice(0, 7) <= mes) {
    semanas.push(diasDaSemana(inicio));
    inicio = somarDias(inicio, 7);
  }
  return semanas;
}

export function mudarMes(mes: string, quantos: number): string {
  const [ano = 0, numero = 1] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, numero - 1 + quantos, 1));
  return data.toISOString().slice(0, 7);
}

export const pecasDoDia = (dia: string, pecas: readonly PecaConteudo[]) => pecas.filter((peca) => diaNoCalendario(peca) === dia);
