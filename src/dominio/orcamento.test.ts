import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Orcamento } from '@/dados/tipos/orcamento';
import type { Baixa, Titulo, TituloRateio } from '@/dados/tipos/titulo';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import type { FontesDeCusto } from './custos-produto';
import { alertasDoMes, copiarDoMesAnterior, montarOrcamento, nivelDoConsumo, salvarOrcamentoDoContexto } from './orcamento';

const PRODUTOS = [
  { id: ID_PRODUTO_KIPI, nome: 'Kipi' },
  { id: ID_PRODUTO_ZUPI, nome: 'Zupi' },
];

const titulo = (id: string, parcial: Partial<Titulo> = {}) => ({ id, natureza: 'pagar', situacao: 'aberto', suspenso: false, origem: 'manual', moeda: 'BRL', competencia: '2026-11-01', categoria_id: 'c', arquivado_em: null, ...parcial }) as Titulo;
const rateio = (tituloId: string, produtoId: string | null, percentual: number, valor: number) => ({ titulo_id: tituloId, produto_id: produtoId, percentual, valor }) as TituloRateio;

/** CA-05.06: R$ 300 rateados 50/30/20 entre Kipi, Zupi e Numa. */
const FONTES: FontesDeCusto = {
  titulos: [titulo('t1'), titulo('t2', { origem: 'reembolso' }), titulo('t3', { situacao: 'cancelado' })],
  rateios: [rateio('t1', ID_PRODUTO_KIPI, 50, 150), rateio('t1', ID_PRODUTO_ZUPI, 30, 90), rateio('t1', null, 20, 60), rateio('t2', ID_PRODUTO_KIPI, 100, 999), rateio('t3', ID_PRODUTO_KIPI, 100, 999)],
  baixas: [] as Baixa[],
  categorias: [],
  cambios: [],
};

const orcamento = (produtoId: string | null, competencia: string, valor: number) => ({ produto_id: produtoId, competencia, valor_brl: valor, arquivado_em: null }) as Orcamento;

describe('T05.08: orçamento por contexto (RN-05.17)', () => {
  it('realizado é a despesa da competência rateada, sem reembolso nem cancelado (CA-05.06)', () => {
    const tela = montarOrcamento(2026, ID_CONSOLIDADA, FONTES, PRODUTOS, [orcamento(ID_PRODUTO_KIPI, '2026-11-01', 160)]);
    expect(tela.meses).toHaveLength(12);
    const novembro = (nome: string) => tela.linhas.find((linha) => linha.nome === nome)!.celulas[10]!;
    expect(novembro('Kipi')).toMatchObject({ orcado: 160, realizado: 150, nivel: 'atencao', percentual: 93.8 });
    expect(novembro('Zupi')).toMatchObject({ orcado: null, realizado: 90, nivel: 'sem_orcamento' });
    expect(novembro('Numa institucional')).toMatchObject({ realizado: 60 });
    // No total, os R$ 300 aparecem uma vez só.
    expect(tela.total![10]).toMatchObject({ realizado: 300, orcado: 160 });
  });

  it('num contexto, só ele e sem total', () => {
    const tela = montarOrcamento(2026, ID_INSTITUCIONAL, FONTES, PRODUTOS, []);
    expect(tela.linhas.map((linha) => linha.nome)).toEqual(['Numa institucional']);
    expect(tela.total).toBeNull();
  });

  it('atenção a partir de 80%, estouro a partir de 100%; sem orçamento não é zero', () => {
    expect(nivelDoConsumo(100, 79)).toEqual({ percentual: 79, nivel: 'ok' });
    expect(nivelDoConsumo(100, 80)).toEqual({ percentual: 80, nivel: 'atencao' });
    expect(nivelDoConsumo(100, 100)).toEqual({ percentual: 100, nivel: 'estourado' });
    expect(nivelDoConsumo(null, 50)).toEqual({ percentual: null, nivel: 'sem_orcamento' });
    expect(nivelDoConsumo(0, 10).nivel).toBe('estourado');
  });

  it('moeda sem câmbio deixa o realizado em aberto, nunca zero', () => {
    const fontes = { ...FONTES, titulos: [titulo('t9', { moeda: 'USD' })], rateios: [rateio('t9', ID_PRODUTO_KIPI, 100, 20)] };
    const kipi = montarOrcamento(2026, ID_PRODUTO_KIPI, fontes, PRODUTOS, [orcamento(ID_PRODUTO_KIPI, '2026-11-01', 100)]).linhas[0]!.celulas[10]!;
    expect(kipi).toMatchObject({ realizado: null, estimado: true, percentual: null });
  });

  it('o alerta do mês lista o que passou de 80%', () => {
    const tela = montarOrcamento(2026, ID_CONSOLIDADA, FONTES, PRODUTOS, [orcamento(ID_PRODUTO_KIPI, '2026-11-01', 100), orcamento(ID_PRODUTO_ZUPI, '2026-11-01', 1000)]);
    expect(alertasDoMes(tela, '2026-11-01').map((alerta) => [alerta.nome, alerta.celula.nivel])).toEqual([['Kipi', 'estourado']]);
  });

  describe('gravar e copiar', () => {
    beforeEach(() => {
      usarDriverDeTeste(criarArmazenamentoEmMemoria());
      esquecerMetaEmMemoria();
      vi.useFakeTimers({ now: new Date('2026-11-07T15:00:00.000Z'), toFake: ['Date'] });
    });
    afterEach(() => {
      vi.useRealTimers();
      usarDriverDeTeste(null);
    });

    it('grava os meses, e vazio apaga (sem orçamento, diferente de R$ 0,00)', async () => {
      expect(await salvarOrcamentoDoContexto(ID_PRODUTO_KIPI, { '2026-10-01': '1.250,00', '2026-11-01': '0' })).toBe(2);
      expect((await repositorios.orcamento.listar()).map((item) => [item.competencia, item.valor_brl]).sort()).toEqual([
        ['2026-10-01', 1250],
        ['2026-11-01', 0],
      ]);
      expect(await salvarOrcamentoDoContexto(ID_PRODUTO_KIPI, { '2026-10-01': '', '2026-11-01': '0' })).toBe(1);
      expect((await repositorios.orcamento.listar()).map((item) => item.competencia)).toEqual(['2026-11-01']);
      await expect(salvarOrcamentoDoContexto(ID_PRODUTO_KIPI, { '2026-12-01': 'abc' })).rejects.toThrow('Valor inválido em 12/2026');
    });

    it('copiar do mês anterior só preenche quem está sem orçamento', async () => {
      await salvarOrcamentoDoContexto(ID_PRODUTO_KIPI, { '2026-10-01': '100', '2026-11-01': '500' });
      await salvarOrcamentoDoContexto(null, { '2026-10-01': '40' });
      expect(await copiarDoMesAnterior('2026-11-01')).toBe(1);
      const novembro = (await repositorios.orcamento.listar()).filter((item) => item.competencia === '2026-11-01').map((item) => [item.produto_id, item.valor_brl]);
      expect(novembro).toEqual(expect.arrayContaining([[ID_PRODUTO_KIPI, 500], [null, 40]]));
      await expect(copiarDoMesAnterior('2026-03-01')).rejects.toThrow('não tem orçamento');
    });
  });
});
