import { describe, expect, it } from 'vitest';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import { projecaoDeCaixa } from './projecao-caixa';

const conta = (id: string, parcial: Partial<ContaFinanceira> = {}) => ({ id, tipo: 'banco', moeda: 'BRL', situacao: 'ativa', arquivado_em: null, saldo_inicial: 1000, data_saldo_inicial: '2026-01-01', ...parcial }) as ContaFinanceira;
const titulo = (id: string, parcial: Partial<Titulo>) => ({ id, natureza: 'pagar', situacao: 'aberto', suspenso: false, moeda: 'BRL', valor: 100, vencimento: '2026-11-20', arquivado_em: null, ...parcial }) as Titulo;
const baixa = (tituloId: string, valor: number) => ({ id: `b-${tituloId}`, titulo_id: tituloId, tipo: 'pagamento', valor_moeda: valor, valor_brl: valor, data: '2026-11-01', conta_id: 'outra', arquivado_em: null }) as unknown as Baixa;
const vazio = { transferencias: [], movimentos: [], cambios: [] as CambioReferencia[] };

describe('projeção de caixa 30/60/90 (15-M13 §2)', () => {
  it('saldo controlado + a receber − a pagar, pelo vencimento, com vencidos e previstos', () => {
    const titulos = [
      titulo('vencido', { vencimento: '2026-10-30', valor: 50 }),
      titulo('parcial', { situacao: 'parcial', valor: 300, vencimento: '2026-11-15' }),
      titulo('previsto', { situacao: 'previsto', valor: 200, vencimento: '2026-12-20' }),
      titulo('receber', { natureza: 'receber', valor: 850, vencimento: '2027-01-20' }),
      titulo('quitado', { situacao: 'quitado', valor: 999 }),
      titulo('cancelado', { situacao: 'cancelado', valor: 999 }),
      titulo('suspenso', { suspenso: true, valor: 999 }),
      titulo('longe', { vencimento: '2027-06-01', valor: 999 }),
    ];
    const [d30, d60, d90] = projecaoDeCaixa({ ...vazio, contas: [conta('banco'), conta('cartao', { tipo: 'cartao' }), conta('velha', { situacao: 'encerrada' })], titulos, baixas: [baixa('parcial', 100)] }, '2026-11-08');
    expect(d30).toMatchObject({ ate: '2026-12-08', saldo: { valor: 1000 }, aReceber: { valor: 0 }, aPagar: { valor: 250 }, projetado: { valor: 750, estimado: false } });
    expect(d60!.aPagar.valor).toBe(450);
    expect(d90).toMatchObject({ aReceber: { valor: 850 }, projetado: { valor: 1400 } });
  });

  it('moeda estrangeira vai pelo câmbio, estimada; sem câmbio a projeção fica em aberto, nunca zero', () => {
    const dados = { ...vazio, contas: [conta('banco')], baixas: [], titulos: [titulo('usd', { moeda: 'USD', valor: 10 })] };
    expect(projecaoDeCaixa(dados, '2026-11-08')[0]!.projetado).toEqual({ valor: null, estimado: true });
    const comCambio = projecaoDeCaixa({ ...dados, cambios: [{ moeda: 'USD', valor_brl: 5, data_referencia: '2026-11-01' } as CambioReferencia] }, '2026-11-08')[0]!;
    expect(comCambio.projetado).toEqual({ valor: 950, estimado: true });
  });
});
