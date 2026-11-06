/** Regras de T02.07 (04-M02): árvore de 2 níveis, grupo e categoria. */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import { normalizarTexto } from './duplicidade';
import { vinculosDeFerramentaDaCategoria } from './ferramentas';

type TipoCategoria = CategoriaFinanceira['tipo'];

export const ROTULOS_TIPO_CATEGORIA = { despesa: 'Despesa', receita: 'Receita', movimento_societario: 'Movimento societário', transferencia: 'Transferência' } as const;
export const ROTULOS_NATUREZA = { direto: 'Direto do produto', compartilhado: 'Compartilhado', investimento: 'Investimento', operacional: 'Operacional da Numa' } as const;
export const ROTULOS_SITUACAO_CATEGORIA = { ativa: 'Ativa', inativa: 'Inativa' } as const;

/** Movimento societário e Transferência não entram no resultado (T02.07). */
export function entraNoResultado(tipo: TipoCategoria): boolean {
  return tipo === 'receita' || tipo === 'despesa';
}

export const esquemaFormularioCategoria = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome.'),
    tipo: z.enum(['despesa', 'receita', 'movimento_societario', 'transferencia']),
    natureza_custo: z.string(),
    pai_id: z.string(),
    situacao: z.enum(['ativa', 'inativa']),
  })
  .superRefine((dados, contexto) => {
    // Quem não tem grupo normalmente é um grupo, e grupo não tem natureza própria.
    if (dados.tipo === 'despesa' && dados.pai_id && !dados.natureza_custo) contexto.addIssue({ code: 'custom', path: ['natureza_custo'], message: 'Escolha a natureza do custo.' });
  });

export type FormularioCategoria = z.infer<typeof esquemaFormularioCategoria>;

export function formularioCategoriaVazio(grupo?: CategoriaFinanceira | null): FormularioCategoria {
  return { nome: '', tipo: grupo?.tipo ?? 'despesa', natureza_custo: '', pai_id: grupo?.id ?? '', situacao: 'ativa' };
}

export function formularioDaCategoria(categoria: CategoriaFinanceira): FormularioCategoria {
  return { nome: categoria.nome, tipo: categoria.tipo, natureza_custo: categoria.natureza_custo ?? '', pai_id: categoria.pai_id ?? '', situacao: categoria.situacao };
}

export function dadosDaCategoria(formulario: FormularioCategoria) {
  return {
    nome: formulario.nome,
    tipo: formulario.tipo,
    natureza_custo: formulario.tipo === 'despesa' && formulario.natureza_custo ? (formulario.natureza_custo as NonNullable<CategoriaFinanceira['natureza_custo']>) : null,
    pai_id: formulario.pai_id || null,
    situacao: formulario.situacao,
  };
}

// ---------- Conferência antes de gravar ----------

export type ConferenciaCategoria = {
  /** Bloqueiam: nome único no grupo e os 2 níveis da árvore. */
  erroNome: string | null;
  erroGrupo: string | null;
  /** Só avisa e deixa continuar. */
  avisos: readonly string[];
};

export function conferirDadosDaCategoria(formulario: FormularioCategoria, categorias: readonly CategoriaFinanceira[], idAtual?: string): ConferenciaCategoria {
  const nome = normalizarTexto(formulario.nome);
  const repetida = categorias.find((categoria) => categoria.id !== idAtual && (categoria.pai_id ?? '') === formulario.pai_id && normalizarTexto(categoria.nome) === nome);
  const erroNome = !repetida ? null : repetida.arquivado_em ? `Já existe “${repetida.nome}” em Arquivados: restaure em vez de criar outra.` : formulario.pai_id ? `Já existe “${repetida.nome}” neste grupo.` : `Já existe um grupo “${repetida.nome}”.`;

  const grupo = formulario.pai_id ? categorias.find((categoria) => categoria.id === formulario.pai_id) : null;
  let erroGrupo: string | null = null;
  if (formulario.pai_id) {
    if (formulario.pai_id === idAtual) erroGrupo = 'Uma categoria não pode ficar dentro dela mesma.';
    else if (!grupo || grupo.arquivado_em) erroGrupo = 'Este grupo não está mais na lista. Escolha outro.';
    else if (grupo.pai_id) erroGrupo = 'A árvore tem 2 níveis: escolha um grupo, não uma categoria.';
    else if (idAtual && categorias.some((categoria) => categoria.pai_id === idAtual)) erroGrupo = 'Este grupo tem categorias, e a árvore só tem 2 níveis: ele não pode ficar dentro de outro.';
  }

  const avisos = grupo && grupo.tipo !== formulario.tipo ? [`O grupo ${grupo.nome} é de ${ROTULOS_TIPO_CATEGORIA[grupo.tipo]}, e esta categoria é de ${ROTULOS_TIPO_CATEGORIA[formulario.tipo]}.`] : [];
  return { erroNome, erroGrupo, avisos };
}

export async function conferirCategoria(formulario: FormularioCategoria, idAtual?: string): Promise<ConferenciaCategoria> {
  return conferirDadosDaCategoria(formulario, await repositorios.categoria_financeira.listar({ incluirArquivados: true }), idAtual);
}

export async function salvarCategoria(formulario: FormularioCategoria, id?: string): Promise<CategoriaFinanceira> {
  const { erroNome, erroGrupo } = await conferirCategoria(formulario, id);
  if (erroNome || erroGrupo) throw new ErroDeRegra((erroNome ?? erroGrupo) as string);
  const dados = dadosDaCategoria(formulario);
  return id ? repositorios.categoria_financeira.atualizar(id, dados) : repositorios.categoria_financeira.criar(dados);
}

// ---------- Vínculos e arquivo (RN-02.04) ----------

/** O que depende da categoria. Lançamentos acrescentam aqui na T05. */
export async function vinculosDaCategoria(id: string): Promise<string[]> {
  const filhas = await repositorios.categoria_financeira.listar({ onde: { pai_id: id } });
  return [...filhas.map((categoria) => `Categoria ${categoria.nome}`), ...(await vinculosDeFerramentaDaCategoria(id))];
}

export async function arquivarCategoria(id: string): Promise<void> {
  const categoria = await repositorios.categoria_financeira.obter(id);
  const vinculos = await vinculosDaCategoria(id);
  if (vinculos.length) throw new ErroDeRegra(categoria?.pai_id ? `Esta categoria está em uso: ${vinculos.join(', ')}. Troque a categoria nesses registros antes.` : `Este grupo tem categorias: ${vinculos.join(', ')}. Mova ou arquive essas categorias antes.`);
  await repositorios.categoria_financeira.arquivar(id);
}

/** Categoria não volta para dentro de um grupo arquivado: a árvore ficaria com um galho solto. */
export async function restaurarCategoria(id: string): Promise<void> {
  const categoria = await repositorios.categoria_financeira.obter(id);
  const grupo = categoria?.pai_id ? await repositorios.categoria_financeira.obter(categoria.pai_id) : null;
  if (grupo?.arquivado_em) throw new ErroDeRegra(`O grupo ${grupo.nome} está arquivado. Restaure o grupo antes.`);
  await repositorios.categoria_financeira.restaurar(id);
}

// ---------- Seletores ----------

const disponivel = (categoria: CategoriaFinanceira) => categoria.situacao === 'ativa' && !categoria.arquivado_em;

/** Grupos que a categoria pode escolher. O grupo atual continua na lista, mesmo inativo. */
export function gruposParaEscolher(categorias: readonly CategoriaFinanceira[], { idAtual, grupoAtual }: { idAtual?: string; grupoAtual?: string } = {}): CategoriaFinanceira[] {
  return categorias.filter((categoria) => !categoria.pai_id && categoria.id !== idAtual && !categoria.arquivado_em && (categoria.situacao === 'ativa' || categoria.id === grupoAtual));
}

/**
 * RN-02.04: inativa não aparece nos novos registros. Grupo inativo leva junto as suas categorias, e
 * um grupo com categorias não é escolhido: escolhe-se a categoria dentro dele.
 */
export function categoriasParaSeletor(categorias: readonly CategoriaFinanceira[], tipo?: TipoCategoria): CategoriaFinanceira[] {
  return categorias.filter(disponivel).filter((categoria) => {
    if (tipo && categoria.tipo !== tipo) return false;
    if (categoria.pai_id) {
      const grupo = categorias.find((item) => item.id === categoria.pai_id);
      return Boolean(grupo && disponivel(grupo));
    }
    return !categorias.some((item) => item.pai_id === categoria.id && !item.arquivado_em);
  });
}

// ---------- Árvore e filtros ----------

export type FiltrosCategorias = {
  busca: string;
  tipo: 'todos' | TipoCategoria;
  situacao: 'todas' | CategoriaFinanceira['situacao'];
  /** Vazio é todas; 'sem' são as despesas que ainda não têm natureza. */
  natureza: string;
  arquivadas: boolean;
};

export const FILTROS_CATEGORIAS_INICIAIS: FiltrosCategorias = { busca: '', tipo: 'todos', situacao: 'todas', natureza: '', arquivadas: false };
export const FILTRO_SEM_NATUREZA = 'sem';

export function semNatureza(categoria: CategoriaFinanceira): boolean {
  return categoria.tipo === 'despesa' && categoria.pai_id !== null && !categoria.natureza_custo;
}

function passaNosFiltros(categoria: CategoriaFinanceira, { tipo, situacao, natureza }: FiltrosCategorias): boolean {
  if (tipo !== 'todos' && categoria.tipo !== tipo) return false;
  if (situacao !== 'todas' && categoria.situacao !== situacao) return false;
  if (natureza === FILTRO_SEM_NATUREZA) return semNatureza(categoria);
  return !natureza || categoria.natureza_custo === natureza;
}

export type GrupoDaArvore = { grupo: CategoriaFinanceira; categorias: CategoriaFinanceira[] };

/** Sem filtro, a árvore inteira. Com filtro, os grupos que têm o que mostrar; buscar pelo grupo mostra todas as dele. */
export function arvoreDeCategorias(categorias: readonly CategoriaFinanceira[], filtros: FiltrosCategorias): GrupoDaArvore[] {
  const texto = normalizarTexto(filtros.busca);
  const vivas = categorias.filter((categoria) => !categoria.arquivado_em);
  const filtrando = Boolean(texto) || filtros.tipo !== 'todos' || filtros.situacao !== 'todas' || Boolean(filtros.natureza);
  return vivas
    .filter((categoria) => !categoria.pai_id)
    .flatMap((grupo) => {
      const doGrupo = vivas.filter((categoria) => categoria.pai_id === grupo.id);
      if (!filtrando) return [{ grupo, categorias: doGrupo }];
      const grupoPelaBusca = normalizarTexto(grupo.nome).includes(texto);
      const visiveis = doGrupo.filter((categoria) => passaNosFiltros(categoria, filtros) && (grupoPelaBusca || normalizarTexto(categoria.nome).includes(texto)));
      if (visiveis.length || (grupoPelaBusca && passaNosFiltros(grupo, filtros))) return [{ grupo, categorias: visiveis }];
      return [];
    });
}

/** Os números dos filtros rápidos: só categorias, porque o grupo é o título delas. */
export function contagemPorTipo(categorias: readonly CategoriaFinanceira[], filtros: FiltrosCategorias) {
  const linhas = arvoreDeCategorias(categorias, { ...filtros, tipo: 'todos' }).flatMap((galho) => galho.categorias);
  const de = (tipo: TipoCategoria) => linhas.filter((categoria) => categoria.tipo === tipo).length;
  return { todos: linhas.length, despesa: de('despesa'), receita: de('receita'), movimento_societario: de('movimento_societario'), transferencia: de('transferencia') };
}

export async function carregarCategorias(): Promise<CategoriaFinanceira[]> {
  return repositorios.categoria_financeira.listar({ incluirArquivados: true });
}
