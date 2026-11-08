import { describe, expect, it } from 'vitest';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Baixa, Titulo, TituloRateio } from '@/dados/tipos/titulo';
import { csvDoFluxo, fluxoDeCaixa, parteDoContexto, periodoDoFluxo, type DadosDoFluxo } from './fluxo-caixa';

const HOJE = '2026-11-08';
const conta = { id: 'c1', nome: 'Conta PJ', tipo: 'banco', moeda: 'BRL', saldo_inicial: 1000, data_saldo_inicial: '2026-08-01', situacao: 'ativa', arquivado_em: null } as unknown as ContaFinanceira;
const titulo = (id: string, natureza: Titulo['natureza'], valor: number, vencimento: string, parcial: Partial<Titulo> = {}) => ({ id, natureza, valor, vencimento, moeda: 'BRL', situacao: 'aberto', suspenso: false, arquivado_em: null, descricao: id, ...parcial }) as Titulo;
const baixa = (id: string, tituloId: string, data: string, valor: number, parcial: Partial<Baixa> = {}) => ({ id, titulo_id: tituloId, data, valor_brl: valor, valor_moeda: valor, tipo: 'pagamento', conta_financeira_id: 'c1', arquivado_em: null, criado_em: `${data}T12:00:00.000Z`, ...parcial }) as Baixa;
const rateio = (tituloId: string, produto: string | null, percentual: number) => ({ titulo_id: tituloId, produto_id: produto, percentual, arquivado_em: null }) as TituloRateio;

const dados = (): DadosDoFluxo => ({
  contas: [conta],
  titulos: [
    titulo('aluguel-set', 'pagar', 300, '2026-09-10', { situacao: 'quitado' }),
    titulo('cliente-out', 'receber', 800, '2026-10-15', { situacao: 'quitado' }),
    titulo('vencido', 'pagar', 100, '2026-10-20'),
    titulo('dezembro', 'receber', 500, '2026-12-10'),
    titulo('suspenso', 'pagar', 900, '2026-12-10', { suspenso: true }),
  ],
  baixas: [baixa('b1', 'aluguel-set', '2026-09-10', 300), baixa('b2', 'cliente-out', '2026-10-15', 800)],
  transferencias: [],
  movimentos: [{ id: 'm1', data: '2026-10-02', tipo: 'aporte', forma: 'dinheiro', valor_brl: 200, conta_financeira_id: 'c1', arquivado_em: null, criado_em: '2026-10-02T10:00:00.000Z' } as never],
  cambios: [],
  rateios: [rateio('cliente-out', 'kipi', 100), rateio('aluguel-set', 'kipi', 50), rateio('aluguel-set', null, 50)],
});

describe('T13.02: fluxo de caixa (realizado e projetado)', () => {
  it('padrão: 5 meses antes, o atual e 3 depois', () => {
    expect(periodoDoFluxo(HOJE)).toEqual({ de: '2026-06', ate: '2027-02' });
  });

  it('realizado pelas baixas e movimentos; o mês atual leva o vencido; o futuro, o que falta; o saldo acumula', () => {
    const meses = fluxoDeCaixa(dados(), { de: '2026-09', ate: '2026-12', contaId: '' }, 'consolidada', HOJE);
    expect(meses.map((linha) => linha.tipo)).toEqual(['realizado', 'realizado', 'atual', 'projetado']);
    const [setembro, outubro, novembro, dezembro] = meses as [NonNullable<(typeof meses)[0]>, NonNullable<(typeof meses)[0]>, NonNullable<(typeof meses)[0]>, NonNullable<(typeof meses)[0]>];
    expect([setembro.saidas.valor, setembro.saldoFinal?.valor]).toEqual([300, 700]);
    expect([outubro.entradas.valor, outubro.aportes, outubro.saldoFinal?.valor]).toEqual([800, 200, 1700]);
    expect([novembro.aPagar.valor, novembro.saldoFinal?.valor]).toEqual([100, 1600]);
    expect([dezembro.aReceber.valor, dezembro.aPagar.valor, dezembro.saldoFinal?.valor]).toEqual([500, 0, 2100]);
  });

  it('num produto: só a parte rateada; movimentos e saldo ficam de fora', () => {
    const meses = fluxoDeCaixa(dados(), { de: '2026-09', ate: '2026-10', contaId: '' }, 'kipi', HOJE);
    expect(meses.map((linha) => [linha.entradas.valor, linha.saidas.valor, linha.aportes, linha.saldoFinal])).toEqual([[0, 150, null, null], [800, 0, null, null]]);
    expect(parteDoContexto('vencido', dados().rateios, 'institucional')).toBe(1);
    expect(parteDoContexto('vencido', dados().rateios, 'kipi')).toBe(0);
  });

  it('moeda estrangeira sem câmbio deixa o mês em aberto, nunca zero; o CSV escreve isso', () => {
    const comDolar = { ...dados(), titulos: [...dados().titulos, titulo('dolar', 'pagar', 50, '2026-12-05', { moeda: 'USD' })] };
    const dezembro = fluxoDeCaixa(comDolar, { de: '2026-12', ate: '2026-12', contaId: '' }, 'consolidada', HOJE)[0]!;
    expect([dezembro.aPagar.valor, dezembro.saldoFinal?.valor]).toEqual([null, null]);
    expect(csvDoFluxo([dezembro])).toContain('sem câmbio');
  });
});
