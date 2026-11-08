/**
 * T05.09 Custos e resultado por produto (F0b; receitas a partir da F1). Usa a mesma conta de `custos-produto.ts`
 * (RN-07.11, AR-04): despesa a pagar, sem reembolso (RN-05.07), sem cancelado nem suspenso; moeda estrangeira paga
 * pelo valor efetivo, em aberto pelo câmbio de referência (estimado), e sem câmbio "falta câmbio", nunca zero.
 * RN-05.09: por produto, valor × percentual do rateio; no consolidado, cada despesa conta uma vez (CA-05.06).
 */
import { repositorios } from '@/dados/repositorios';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import type { Titulo, TituloRateio } from '@/dados/tipos/titulo';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { calcularCustoMedio, lerFontes, type CustoMedio, type FontesDeCusto } from './custos-produto';
import { ultimoCambio } from './ferramentas';

export type NaturezaDoCusto = NonNullable<CategoriaFinanceira['natureza_custo']>;

export type FiltrosDeCusto = {
  /** Competências `AAAA-MM`, inclusive. */
  de: string;
  ate: string;
  /** '' = todas; 'sem' = natureza ainda não informada na categoria. */
  natureza: '' | NaturezaDoCusto | 'sem';
  incluirInvestimento: boolean;
};

/** Uma parte rateada de uma despesa. */
export type ParteDeCusto = {
  tituloId: string;
  produtoId: string | null;
  competencia: string;
  categoriaId: string;
  natureza: NaturezaDoCusto | null;
  /** `null`: moeda sem câmbio de referência. */
  valor: number | null;
  estimado: boolean;
  /** Rateada entre mais de um contexto. */
  compartilhado: boolean;
  ferramentaId: string | null;
};

/** Soma que não esconde a falta de câmbio: uma parte sem valor deixa o total em aberto. */
export type Soma = { valor: number | null; estimado: boolean };

const redondo = (valor: number) => Math.round(valor * 100) / 100;

export function somar(partes: readonly Pick<ParteDeCusto, 'valor' | 'estimado'>[]): Soma {
  const semValor = partes.some((parte) => parte.valor === null);
  return { valor: semValor ? null : redondo(partes.reduce((total, parte) => total + (parte.valor as number), 0)), estimado: partes.some((parte) => parte.estimado) };
}

function valorDaParte(titulo: Titulo, rateio: TituloRateio, fontes: FontesDeCusto): { valor: number | null; estimado: boolean } {
  if (titulo.moeda === 'BRL') return { valor: rateio.valor, estimado: false };
  const baixas = fontes.baixas.filter((baixa) => baixa.titulo_id === titulo.id && !baixa.arquivado_em);
  if (titulo.situacao === 'quitado' && baixas.length) {
    const pago = baixas.reduce((total, baixa) => total + (baixa.tipo === 'estorno' ? -baixa.valor_brl : baixa.valor_brl), 0);
    return { valor: pago * (rateio.percentual / 100), estimado: false };
  }
  const cambio = ultimoCambio(titulo.moeda, fontes.cambios);
  return { valor: cambio === null ? null : rateio.valor * cambio, estimado: true };
}

/** Todas as partes rateadas que são custo, no período e na natureza escolhidos. */
export function partesDeCusto(fontes: FontesDeCusto, filtros: FiltrosDeCusto): ParteDeCusto[] {
  const naturezas = new Map(fontes.categorias.map((categoria) => [categoria.id, categoria.natureza_custo ?? null]));
  const porTitulo = new Map<string, TituloRateio[]>();
  for (const rateio of fontes.rateios) porTitulo.set(rateio.titulo_id, [...(porTitulo.get(rateio.titulo_id) ?? []), rateio]);
  return fontes.titulos.flatMap((titulo) => {
    if (titulo.arquivado_em || titulo.natureza !== 'pagar' || titulo.situacao === 'cancelado' || titulo.suspenso || titulo.origem === 'reembolso') return [];
    const mes = titulo.competencia.slice(0, 7);
    if (mes < filtros.de || mes > filtros.ate) return [];
    const natureza = naturezas.get(titulo.categoria_id) ?? null;
    if (!filtros.incluirInvestimento && natureza === 'investimento') return [];
    if (filtros.natureza === 'sem' ? natureza !== null : filtros.natureza && natureza !== filtros.natureza) return [];
    const rateios = porTitulo.get(titulo.id) ?? [];
    return rateios.map((rateio) => ({ tituloId: titulo.id, produtoId: rateio.produto_id, competencia: mes, categoriaId: titulo.categoria_id, natureza, ...valorDaParte(titulo, rateio, fontes), compartilhado: rateios.length > 1, ferramentaId: titulo.ferramenta_id ?? null }));
  });
}

const doContexto = (partes: readonly ParteDeCusto[], contextoId: string) => (contextoId === ID_CONSOLIDADA ? partes : partes.filter((parte) => (parte.produtoId ?? ID_INSTITUCIONAL) === contextoId));

export type LinhaPorProduto = { contextoId: string; nome: string; direto: Soma; compartilhado: Soma; total: Soma; media: CustoMedio | null };

/** Visão "Por produto": diretos + compartilhados rateados = total. A Numa institucional vem por último. */
export function custosPorProduto(partes: readonly ParteDeCusto[], produtos: readonly { id: string; nome: string }[], contextoId: string, medias: ReadonlyMap<string, CustoMedio>): LinhaPorProduto[] {
  const contextos = [...[...produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((produto) => ({ contextoId: produto.id, nome: produto.nome })), { contextoId: ID_INSTITUCIONAL, nome: 'Numa institucional' }];
  return contextos
    .filter((contexto) => contextoId === ID_CONSOLIDADA || contexto.contextoId === contextoId)
    .map((contexto) => {
      const deste = doContexto(partes, contexto.contextoId);
      return { ...contexto, direto: somar(deste.filter((parte) => !parte.compartilhado)), compartilhado: somar(deste.filter((parte) => parte.compartilhado)), total: somar(deste), media: medias.get(contexto.contextoId) ?? null };
    });
}

/** O total consolidado: cada despesa uma vez (a soma das partes rateadas é a despesa inteira). */
export function totalConsolidado(partes: readonly ParteDeCusto[], contextoId: string): Soma {
  return somar(doContexto(partes, contextoId));
}

export type LinhaPorCategoria = { categoriaId: string; nome: string; meses: Record<string, Soma>; total: Soma };

/** Visão "Por categoria": matriz categoria × mês, no contexto escolhido. */
export function custosPorCategoria(partes: readonly ParteDeCusto[], categorias: readonly CategoriaFinanceira[], contextoId: string, meses: readonly string[]): LinhaPorCategoria[] {
  const deste = doContexto(partes, contextoId);
  const ids = [...new Set(deste.map((parte) => parte.categoriaId))];
  const nome = (id: string) => categorias.find((categoria) => categoria.id === id)?.nome ?? 'Categoria removida';
  return ids
    .map((id) => {
      const daCategoria = deste.filter((parte) => parte.categoriaId === id);
      return { categoriaId: id, nome: nome(id), meses: Object.fromEntries(meses.map((mes) => [mes, somar(daCategoria.filter((parte) => parte.competencia === mes))])), total: somar(daCategoria) };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type LinhaPorFerramenta = { ferramentaId: string; nome: string; porContexto: { nome: string; soma: Soma }[]; total: Soma };

/** Visão "Ferramentas": o custo de cada ferramenta (M04) e a parte de cada produto. */
export function custosPorFerramenta(partes: readonly ParteDeCusto[], ferramentas: readonly { id: string; nome: string }[], produtos: readonly { id: string; nome: string }[], contextoId: string): LinhaPorFerramenta[] {
  const deste = doContexto(partes, contextoId).filter((parte) => parte.ferramentaId);
  const nomeDoContexto = (id: string | null) => (id === null ? 'Numa institucional' : (produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));
  return [...new Set(deste.map((parte) => parte.ferramentaId as string))]
    .map((id) => {
      const daFerramenta = deste.filter((parte) => parte.ferramentaId === id);
      const contextos = [...new Set(daFerramenta.map((parte) => parte.produtoId))];
      return {
        ferramentaId: id,
        nome: ferramentas.find((ferramenta) => ferramenta.id === id)?.nome ?? 'Ferramenta removida',
        porContexto: contextos.map((produtoId) => ({ nome: nomeDoContexto(produtoId), soma: somar(daFerramenta.filter((parte) => parte.produtoId === produtoId)) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        total: somar(daFerramenta),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** `AAAA-MM` de `de` até `ate`, inclusive. */
export function mesesDoPeriodo(de: string, ate: string): string[] {
  const meses: string[] = [];
  let [ano, mes] = de.split('-').map(Number) as [number, number];
  while (`${ano}-${String(mes).padStart(2, '0')}` <= ate && meses.length < 36) {
    meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return meses;
}

/** Padrão: os 3 meses completos antes do atual e o mês atual (o que alimenta o custo médio, mais o mês em curso). */
export function periodoPadrao(hoje: string): { de: string; ate: string } {
  const [ano, mes] = hoje.split('-').map(Number) as [number, number];
  const inicio = new Date(Date.UTC(ano, mes - 1 - 3, 1)).toISOString().slice(0, 7);
  return { de: inicio, ate: hoje.slice(0, 7) };
}

export type TelaDeCustos = {
  meses: string[];
  porProduto: LinhaPorProduto[];
  total: Soma;
  porCategoria: LinhaPorCategoria[];
  porFerramenta: LinhaPorFerramenta[];
  institucional: LinhaPorCategoria[];
};

export async function carregarCustos(filtros: FiltrosDeCusto, contextoId: string, hoje: string): Promise<TelaDeCustos> {
  const [fontes, produtos, ferramentas] = await Promise.all([lerFontes(), repositorios.produto.listar(), repositorios.ferramenta.listar({ incluirArquivados: true })]);
  const partes = partesDeCusto(fontes, filtros);
  const meses = mesesDoPeriodo(filtros.de, filtros.ate);
  // O custo médio (RN-07.11) é o mesmo do simulador: 3 meses completos, sem investimento, independente do filtro.
  const medias = new Map(produtos.map((produto) => [produto.id, calcularCustoMedio(produto.id, fontes, hoje)]));
  return {
    meses,
    porProduto: custosPorProduto(partes, produtos, contextoId, medias),
    total: totalConsolidado(partes, contextoId),
    porCategoria: custosPorCategoria(partes, fontes.categorias, contextoId, meses),
    porFerramenta: custosPorFerramenta(partes, ferramentas, produtos, contextoId),
    institucional: custosPorCategoria(partes.filter((parte) => parte.produtoId === null), fontes.categorias, ID_CONSOLIDADA, meses),
  };
}
