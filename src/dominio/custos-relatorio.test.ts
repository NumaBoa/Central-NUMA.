import { describe, expect, it } from 'vitest';
import { ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import type { Baixa, Titulo, TituloRateio } from '@/dados/tipos/titulo';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import type { FontesDeCusto } from './custos-produto';
import { custosPorCategoria, custosPorFerramenta, custosPorProduto, mesesDoPeriodo, partesDeCusto, partesDeReceita, periodoPadrao, resultado, totalConsolidado, type FiltrosDeCusto } from './custos-relatorio';

const PRODUTOS = [
  { id: ID_PRODUTO_KIPI, nome: 'Kipi' },
  { id: ID_PRODUTO_ZUPI, nome: 'Zupi' },
];
const titulo = (id: string, parcial: Partial<Titulo> = {}) => ({ id, natureza: 'pagar', situacao: 'aberto', suspenso: false, origem: 'manual', moeda: 'BRL', competencia: '2026-11-01', categoria_id: 'hosp', arquivado_em: null, ferramenta_id: null, ...parcial }) as Titulo;
const rateio = (tituloId: string, produtoId: string | null, percentual: number, valor: number) => ({ titulo_id: tituloId, produto_id: produtoId, percentual, valor }) as TituloRateio;
const categoria = (id: string, nome: string, natureza: CategoriaFinanceira['natureza_custo']) => ({ id, nome, natureza_custo: natureza }) as CategoriaFinanceira;

/** CA-05.06: R$ 300 rateados 50/30/20 entre Kipi, Zupi e Numa; mais R$ 100 só do Kipi, de uma ferramenta; e um investimento. */
const FONTES: FontesDeCusto = {
  titulos: [titulo('t1'), titulo('t2', { ferramenta_id: 'f1' }), titulo('t3', { categoria_id: 'marca' }), titulo('t4', { origem: 'reembolso' }), titulo('t5', { competencia: '2026-08-01' })],
  rateios: [rateio('t1', ID_PRODUTO_KIPI, 50, 150), rateio('t1', ID_PRODUTO_ZUPI, 30, 90), rateio('t1', null, 20, 60), rateio('t2', ID_PRODUTO_KIPI, 100, 100), rateio('t3', ID_PRODUTO_KIPI, 100, 500), rateio('t4', ID_PRODUTO_KIPI, 100, 999), rateio('t5', ID_PRODUTO_KIPI, 100, 999)],
  baixas: [] as Baixa[],
  categorias: [categoria('hosp', 'Hospedagem', 'compartilhado'), categoria('marca', 'Registro de marca', 'investimento')],
  cambios: [],
};
const FILTROS: FiltrosDeCusto = { de: '2026-09', ate: '2026-11', natureza: '', incluirInvestimento: true };

describe('T05.09: custos e resultado por produto', () => {
  it('CA-05.06: por produto 150/90/60, e no consolidado a despesa conta uma vez', () => {
    const partes = partesDeCusto(FONTES, { ...FILTROS, incluirInvestimento: false });
    const linhas = custosPorProduto(partes, PRODUTOS, ID_CONSOLIDADA, new Map());
    const de = (nome: string) => linhas.find((linha) => linha.nome === nome)!;
    expect(de('Kipi')).toMatchObject({ direto: { valor: 100 }, compartilhado: { valor: 150 }, total: { valor: 250 } });
    expect(de('Zupi').total.valor).toBe(90);
    expect(de('Numa institucional').total.valor).toBe(60);
    expect(totalConsolidado(partes, ID_CONSOLIDADA).valor).toBe(400);
  });

  it('fora: reembolso (RN-05.07), outra competência e, se pedido, investimento', () => {
    expect(totalConsolidado(partesDeCusto(FONTES, FILTROS), ID_CONSOLIDADA).valor).toBe(900);
    expect(totalConsolidado(partesDeCusto(FONTES, { ...FILTROS, incluirInvestimento: false }), ID_CONSOLIDADA).valor).toBe(400);
    expect(totalConsolidado(partesDeCusto(FONTES, { ...FILTROS, natureza: 'investimento' }), ID_CONSOLIDADA).valor).toBe(500);
  });

  it('num contexto, só a parte dele', () => {
    const partes = partesDeCusto(FONTES, FILTROS);
    expect(totalConsolidado(partes, ID_PRODUTO_ZUPI).valor).toBe(90);
    expect(custosPorProduto(partes, PRODUTOS, ID_INSTITUCIONAL, new Map()).map((linha) => linha.nome)).toEqual(['Numa institucional']);
  });

  it('por categoria × mês e por ferramenta', () => {
    const partes = partesDeCusto(FONTES, FILTROS);
    const meses = mesesDoPeriodo('2026-09', '2026-11');
    expect(meses).toEqual(['2026-09', '2026-10', '2026-11']);
    const hospedagem = custosPorCategoria(partes, FONTES.categorias, ID_CONSOLIDADA, meses).find((linha) => linha.nome === 'Hospedagem')!;
    expect(hospedagem.meses['2026-11']).toEqual({ valor: 400, estimado: false });
    expect(hospedagem.meses['2026-10']).toEqual({ valor: 0, estimado: false });
    expect(custosPorFerramenta(partes, [{ id: 'f1', nome: 'Nuvem' }], PRODUTOS, ID_CONSOLIDADA)).toEqual([{ ferramentaId: 'f1', nome: 'Nuvem', porContexto: [{ nome: 'Kipi', soma: { valor: 100, estimado: false } }], total: { valor: 100, estimado: false } }]);
  });

  it('moeda sem câmbio deixa o total em aberto, nunca zero', () => {
    const fontes = { ...FONTES, titulos: [titulo('t9', { moeda: 'USD' })], rateios: [rateio('t9', ID_PRODUTO_KIPI, 100, 20)] };
    expect(totalConsolidado(partesDeCusto(fontes, FILTROS), ID_CONSOLIDADA)).toEqual({ valor: null, estimado: true });
  });

  it('F1: a receita líquida vem dos títulos a receber, pelo rateio; resultado = receita − custo', () => {
    const fontes = { ...FONTES, titulos: [...FONTES.titulos, titulo('r1', { natureza: 'receber' }), titulo('r2', { natureza: 'receber', situacao: 'cancelado' })], rateios: [...FONTES.rateios, rateio('r1', ID_PRODUTO_KIPI, 100, 850), rateio('r2', ID_PRODUTO_KIPI, 100, 999)] };
    const receitas = partesDeReceita(fontes, FILTROS);
    expect(receitas.map((parte) => parte.tituloId)).toEqual(['r1']);
    expect(partesDeCusto(fontes, FILTROS).some((parte) => parte.tituloId === 'r1')).toBe(false);
    const kipi = custosPorProduto(partesDeCusto(fontes, { ...FILTROS, incluirInvestimento: false }), PRODUTOS, ID_CONSOLIDADA, new Map(), receitas).find((linha) => linha.contextoId === ID_PRODUTO_KIPI)!;
    expect([kipi.total.valor, kipi.receita.valor, kipi.resultado.valor]).toEqual([250, 850, 600]);
    expect(resultado({ valor: null, estimado: true }, { valor: 10, estimado: false })).toEqual({ valor: null, estimado: true });
  });

  it('período padrão: 3 meses completos e o atual', () => {
    expect(periodoPadrao('2026-11-07')).toEqual({ de: '2026-08', ate: '2026-11' });
    expect(periodoPadrao('2026-02-10')).toEqual({ de: '2025-11', ate: '2026-02' });
  });
});
