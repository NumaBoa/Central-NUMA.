/**
 * T07.08: KPIs mensais por produto (RN-07.10). Um registro por produto e competência. Assinantes pagantes é da F1,
 * e listas de espera vêm do M08: nenhum dos dois aparece aqui antes de existir.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { KpiDefinicao, KpiMensal } from '@/dados/tipos/precificacao';
import { hojeISO } from '@/lib/datas';
import { gerarUuid } from '@/lib/ids';
import { somarMeses } from './cobrancas';
import { primeiroDiaDoMes } from './custos-produto';
import { normalizarTexto } from './duplicidade';

export const MAXIMO_DE_KPIS_PROPRIOS = 5;
export const MESES_DO_GRAFICO = 12;
export const KPI_USUARIOS_ATIVOS = 'usuarios_ativos';
export const DEFINICAO_PENDENTE = 'Definição pendente';

export type TipoDeKpi = 'inteiro' | 'decimal';
export type KpiPadrao = { codigo: string; nome: string; tipo: TipoDeKpi; minimo?: number; maximo?: number; ajuda?: string };

export const KPIS_PADRAO: readonly KpiPadrao[] = [
  { codigo: KPI_USUARIOS_ATIVOS, nome: 'Usuários ativos no mês', tipo: 'inteiro' },
  { codigo: 'novos_usuarios', nome: 'Novos usuários / downloads', tipo: 'inteiro' },
  { codigo: 'avaliacao_media', nome: 'Avaliação média nas lojas', tipo: 'decimal', minimo: 0, maximo: 5, ajuda: 'De 0 a 5.' },
];

/** Personalizado aceita decimal: a unidade é o produto que define. */
export function kpisDoProduto(definicoes: readonly KpiDefinicao[]): { codigo: string; nome: string; unidade: string | null; definicao: string | null; tipo: TipoDeKpi; minimo?: number; maximo?: number; ajuda?: string; proprio: boolean }[] {
  return [...KPIS_PADRAO.map((kpi) => ({ ...kpi, unidade: null, definicao: null, proprio: false })), ...[...definicoes].sort((a, b) => a.ordem - b.ordem).map((definicao) => ({ codigo: definicao.kpi_codigo, nome: definicao.nome, unidade: definicao.unidade, definicao: definicao.definicao, tipo: 'decimal' as const, proprio: true }))];
}

/** Aceita "1.234" e "4,5". Vazio é `null`, e `undefined` quer dizer inválido. */
export function lerValorDeKpi(texto: string, tipo: TipoDeKpi): number | null | undefined {
  const limpo = texto.trim();
  if (!limpo) return null;
  if (tipo === 'inteiro') return /^(\d{1,3}(\.\d{3})+|\d+)$/.test(limpo) ? Number(limpo.replaceAll('.', '')) : undefined;
  return /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,4})?$/.test(limpo) ? Number(limpo.replaceAll('.', '').replace(',', '.')) : /^\d+\.\d{1,4}$/.test(limpo) ? Number(limpo) : undefined;
}

function linkHttp(texto: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(texto).protocol);
  } catch {
    return false;
  }
}

export type DadosDoKpiMensal = { competencia: string; valores: Readonly<Record<string, string>>; observacao: string; fonte_url: string };

export function errosDoKpiMensal(dados: DadosDoKpiMensal, kpis: ReturnType<typeof kpisDoProduto>, hoje: string): Readonly<Record<string, string>> {
  const erros: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-01$/.test(dados.competencia)) erros.competencia = 'Escolha o mês.';
  else if (dados.competencia > primeiroDiaDoMes(hoje)) erros.competencia = 'Só dá para registrar até o mês atual.';
  for (const kpi of kpis) {
    const valor = lerValorDeKpi(dados.valores[kpi.codigo] ?? '', kpi.tipo);
    if (valor === undefined) erros[kpi.codigo] = kpi.tipo === 'inteiro' ? 'Use um número inteiro, como 1.200.' : 'Use um número, como 4,5.';
    else if (valor !== null && ((kpi.minimo !== undefined && valor < kpi.minimo) || (kpi.maximo !== undefined && valor > kpi.maximo))) erros[kpi.codigo] = `Use um valor de ${kpi.minimo} a ${kpi.maximo}.`;
  }
  if (dados.fonte_url.trim() && !linkHttp(dados.fonte_url.trim())) erros.fonte_url = 'Use um link completo, começando com https://.';
  return erros;
}

/** Salvar a mesma competência de novo altera o registro, sem criar outro (RN-07.10). */
export async function salvarKpiMensal(produtoId: string, dados: DadosDoKpiMensal, hoje: string = hojeISO()): Promise<KpiMensal> {
  const kpis = kpisDoProduto(await repositorios.kpi_definicao.listar({ onde: { produto_id: produtoId } }));
  const erro = Object.values(errosDoKpiMensal(dados, kpis, hoje))[0];
  if (erro) throw new ErroDeRegra(erro);
  const valores = Object.fromEntries(kpis.map((kpi) => [kpi.codigo, lerValorDeKpi(dados.valores[kpi.codigo] ?? '', kpi.tipo) ?? null]));
  const campos = { valores, observacao: dados.observacao.trim() || null, fonte_url: dados.fonte_url.trim() || null };
  const [existente] = await repositorios.kpi_mensal.listar({ onde: { produto_id: produtoId, competencia: dados.competencia } });
  if (existente) return repositorios.kpi_mensal.atualizar(existente.id, { ...campos, valores: { ...existente.valores, ...valores } });
  return repositorios.kpi_mensal.criar({ produto_id: produtoId, competencia: dados.competencia, ...campos });
}

export const esquemaFormularioKpiProprio = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do indicador.'),
  unidade: z.string().trim(),
  definicao: z.string().trim(),
});

export type FormularioKpiProprio = z.infer<typeof esquemaFormularioKpiProprio>;

export async function salvarKpiProprio(produtoId: string, formulario: FormularioKpiProprio, id?: string): Promise<KpiDefinicao> {
  const definicoes = await repositorios.kpi_definicao.listar({ onde: { produto_id: produtoId } });
  const nome = normalizarTexto(formulario.nome);
  if (definicoes.some((definicao) => definicao.id !== id && normalizarTexto(definicao.nome) === nome) || KPIS_PADRAO.some((kpi) => normalizarTexto(kpi.nome) === nome)) throw new ErroDeRegra('Este produto já tem um indicador com esse nome.');
  const campos = { nome: formulario.nome, unidade: formulario.unidade || null, definicao: formulario.definicao || null };
  if (id) return repositorios.kpi_definicao.atualizar(id, campos);
  if (definicoes.length >= MAXIMO_DE_KPIS_PROPRIOS) throw new ErroDeRegra(`Cada produto pode ter até ${MAXIMO_DE_KPIS_PROPRIOS} indicadores próprios.`);
  return repositorios.kpi_definicao.criar({ produto_id: produtoId, kpi_codigo: `proprio_${gerarUuid().slice(0, 8)}`, ordem: Math.max(0, ...definicoes.map((definicao) => definicao.ordem)) + 1, ...campos });
}

/** Sai da lista, e os valores já registrados continuam guardados (nada some). */
export async function removerKpiProprio(id: string): Promise<void> {
  await repositorios.kpi_definicao.arquivar(id);
}

export function competenciasDoGrafico(hoje: string): string[] {
  const atual = primeiroDiaDoMes(hoje);
  return Array.from({ length: MESES_DO_GRAFICO }, (_, indice) => somarMeses(atual, indice - MESES_DO_GRAFICO + 1));
}

/** Mês sem registro fica vazio, e não zero: no gráfico, vira um buraco na linha. */
export function serieDoKpi(registros: readonly Pick<KpiMensal, 'competencia' | 'valores'>[], codigo: string, hoje: string): { competencia: string; valor: number | null }[] {
  return competenciasDoGrafico(hoje).map((competencia) => ({ competencia, valor: registros.find((registro) => registro.competencia === competencia)?.valores[codigo] ?? null }));
}

/** O mais recente que tem esse KPI preenchido. */
export function ultimoValorDoKpi(registros: readonly Pick<KpiMensal, 'competencia' | 'valores'>[], codigo: string): { competencia: string; valor: number } | null {
  const achado = [...registros].sort((a, b) => b.competencia.localeCompare(a.competencia)).find((registro) => typeof registro.valores[codigo] === 'number');
  return achado ? { competencia: achado.competencia, valor: achado.valores[codigo] as number } : null;
}

export type DadosDosKpis = { definicoes: KpiDefinicao[]; registros: KpiMensal[] };

export async function carregarKpis(produtoId: string): Promise<DadosDosKpis> {
  const [definicoes, registros] = await Promise.all([repositorios.kpi_definicao.listar({ onde: { produto_id: produtoId } }), repositorios.kpi_mensal.listar({ onde: { produto_id: produtoId } })]);
  return { definicoes, registros: registros.sort((a, b) => b.competencia.localeCompare(a.competencia)) };
}
