import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_BRUNA, ID_CAMILA, ID_CONTA_KIMBERLY, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { MOVIMENTOS_INICIAIS } from './apoio-testes';
import { estornarBaixa } from './baixas';
import { carregarSocias, consolidadoDoRelatorio, contasParaAporte, criarEsquemaAporte, filtrarMovimentos, FILTROS_MOVIMENTOS_INICIAIS, fimDoPreOperacional, formularioAporteVazio, novoAporteEmDinheiro, reembolsosEmAberto, relatorioDeInvestimento, resumoDaSocia, type FormularioAporte } from './socias';
import { registrarPagamento, type DadosDoPagamento } from './titulos';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const SOCIA = { id: 'a', nome_completo: 'Sócia A' } as Pessoa;

const contaDaNuma = (alteracoes: Partial<ContaFinanceira> = {}) => repositorios.conta_financeira.criar({ nome: 'Banco da Numa', tipo: 'banco', titular_entidade_id: null, titular_pessoa_id: ID_KIMBERLY, instituicao: null, final_numero: null, moeda: 'BRL', saldo_inicial: 1000, data_saldo_inicial: '2026-01-01', situacao: 'ativa', ...alteracoes });
const aporte = (alteracoes: Partial<FormularioAporte> = {}): FormularioAporte => ({ ...formularioAporteVazio(HOJE), socia_id: ID_KIMBERLY, valor: '500,00', conta_id: 'conta', comprovante_url: DRIVE, ...alteracoes });
const pagamento = (alteracoes: Partial<DadosDoPagamento> = {}): DadosDoPagamento => ({ data: HOJE, contaId: ID_CONTA_KIMBERLY, valorMoeda: 100, cambio: null, iofBrl: null, valorBrl: 100, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: null, vencimentoReembolso: null, pagoAMais: false, motivo: null, ...alteracoes });
const problemas = (formulario: FormularioAporte) => {
  const resultado = criarEsquemaAporte(HOJE).safeParse(formulario);
  return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((item) => [item.path[0], item.message]));
};

describe('T05.05: sócias', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CA-05.05: investimento líquido', () => {
    const movimentos = [
      { socia_id: 'a', tipo: 'aporte' as const, valor_brl: 300 },
      { socia_id: 'a', tipo: 'retirada' as const, valor_brl: 50 },
      { socia_id: 'a', tipo: 'distribuicao' as const, valor_brl: 20 },
      { socia_id: 'b', tipo: 'aporte' as const, valor_brl: 999 },
    ];

    it('é aportes menos retiradas e distribuições', () => {
      expect(resumoDaSocia(SOCIA, movimentos, [])).toMatchObject({ aportes: 300, retiradasEDistribuicoes: 70, investimentoLiquido: 230 });
    });

    it('não muda com os reembolsos, que têm os próprios totais', () => {
      const reembolsos = [
        { beneficiario_pessoa_id: 'a', valor: 100, saldo: 40 },
        { beneficiario_pessoa_id: 'a', valor: 50.5, saldo: 50.5 },
        { beneficiario_pessoa_id: 'b', valor: 700, saldo: 700 },
      ];
      expect(resumoDaSocia(SOCIA, movimentos, reembolsos)).toMatchObject({ reembolsosPagos: 60, reembolsosEmAberto: 90.5, investimentoLiquido: 230 });
    });

    it('pagar um reembolso de verdade não mexe no investimento', async () => {
      const conta = await contaDaNuma();
      const antes = await carregarSocias(HOJE);
      const reembolso = reembolsosEmAberto(antes.reembolsos)[0]!;
      const socia = antes.socias.find((item) => item.id === reembolso.beneficiario_pessoa_id)!;
      const resumoAntes = resumoDaSocia(socia, antes.movimentos, antes.reembolsos);
      await registrarPagamento(reembolso.id, pagamento({ contaId: conta.id, valorMoeda: reembolso.saldo, valorBrl: reembolso.saldo }), HOJE);
      const depois = await carregarSocias(HOJE);
      const resumoDepois = resumoDaSocia(socia, depois.movimentos, depois.reembolsos);
      expect(resumoDepois.investimentoLiquido).toBe(resumoAntes.investimentoLiquido);
      expect(resumoDepois.reembolsosEmAberto).toBeCloseTo(resumoAntes.reembolsosEmAberto - reembolso.saldo, 2);
      expect(resumoDepois.reembolsosPagos).toBeCloseTo(resumoAntes.reembolsosPagos + reembolso.saldo, 2);
    });

    it('o aporte desfeito por um estorno sai da conta da sócia', async () => {
      const antes = await carregarSocias(HOJE);
      const movimento = antes.movimentos.find((item) => item.baixa_origem_id && item.tipo === 'aporte')!;
      const socia = antes.socias.find((item) => item.id === movimento.socia_id)!;
      await estornarBaixa(movimento.baixa_origem_id as string, 'Lançado errado', HOJE);
      const depois = await carregarSocias(HOJE);
      expect(depois.movimentos).toHaveLength(antes.movimentos.length - 1);
      expect(resumoDaSocia(socia, depois.movimentos, depois.reembolsos).aportes).toBeCloseTo(resumoDaSocia(socia, antes.movimentos, antes.reembolsos).aportes - movimento.valor_brl, 2);
    });
  });

  describe('carregar', () => {
    it('traz as duas sócias, os movimentos do mais recente ao mais antigo e só reembolsos válidos', async () => {
      const dados = await carregarSocias(HOJE);
      expect(dados.socias.map((socia) => socia.id).sort()).toEqual([ID_KIMBERLY, ID_CAMILA].sort());
      expect(dados.movimentos).toHaveLength(MOVIMENTOS_INICIAIS);
      expect([...dados.movimentos].sort((a, b) => b.data.localeCompare(a.data))).toEqual(dados.movimentos);
      expect(dados.reembolsos.every((titulo) => titulo.origem === 'reembolso' && titulo.situacao !== 'cancelado')).toBe(true);
    });

    it('sócia arquivada com movimento continua nos cartões', async () => {
      await novoAporteEmDinheiro(aporte({ socia_id: ID_CAMILA, conta_id: (await contaDaNuma()).id }), HOJE);
      await repositorios.pessoa.arquivar(ID_CAMILA);
      expect((await carregarSocias(HOJE)).socias.some((socia) => socia.id === ID_CAMILA)).toBe(true);
    });
  });

  describe('reembolsos em aberto', () => {
    it('só o que tem saldo, do vencimento mais próximo ao mais distante', () => {
      const lista = [
        { id: 'c', vencimento: '2026-12-01', saldo: 10 },
        { id: 'a', vencimento: '2026-11-01', saldo: 10 },
        { id: 'b', vencimento: '2026-11-15', saldo: 0 },
      ];
      expect(reembolsosEmAberto(lista).map((item) => item.id)).toEqual(['a', 'c']);
    });
  });

  describe('novo aporte em dinheiro', () => {
    it('nasce como aporte em dinheiro, na conta da Numa, e não é título (RN-05.11)', async () => {
      const conta = await contaDaNuma();
      const titulos = (await repositorios.titulo.listar()).length;
      const movimento = await novoAporteEmDinheiro(aporte({ conta_id: conta.id, observacao: 'Capital inicial' }), HOJE);
      expect(movimento).toMatchObject({ tipo: 'aporte', forma: 'dinheiro', socia_id: ID_KIMBERLY, valor_brl: 500, conta_financeira_id: conta.id, comprovante_url: DRIVE, observacao: 'Capital inicial', titulo_origem_id: null });
      expect(movimento.codigo).toMatch(/^MOV-/);
      expect(await repositorios.titulo.listar()).toHaveLength(titulos);
    });

    it('sem comprovante, o motivo fica na observação', async () => {
      const conta = await contaDaNuma();
      const movimento = await novoAporteEmDinheiro(aporte({ conta_id: conta.id, comprovante_url: '', sem_comprovante: true, sem_comprovante_motivo: 'Depósito em espécie', observacao: 'Capital' }), HOJE);
      expect(movimento.comprovante_url).toBeNull();
      expect(movimento.observacao).toBe('Capital · Sem comprovante: Depósito em espécie');
    });

    it('barra data futura, quem não é sócia e conta que não serve', async () => {
      const conta = await contaDaNuma();
      const emDolar = await contaDaNuma({ nome: 'Em dólar', moeda: 'USD' });
      await expect(novoAporteEmDinheiro(aporte({ conta_id: conta.id, data: '2026-11-07' }), HOJE)).rejects.toThrow('futura');
      await expect(novoAporteEmDinheiro(aporte({ conta_id: conta.id, socia_id: ID_BRUNA }), HOJE)).rejects.toThrow('sócia');
      await expect(novoAporteEmDinheiro(aporte({ conta_id: ID_CONTA_KIMBERLY }), HOJE)).rejects.toThrow('conta da Numa');
      await expect(novoAporteEmDinheiro(aporte({ conta_id: emDolar.id }), HOJE)).rejects.toThrow('em reais');
    });

    it('o formulário confere valor, comprovante e data', () => {
      expect(problemas(aporte())).toEqual({});
      expect(problemas(aporte({ valor: '' }))).toHaveProperty('valor');
      expect(problemas(aporte({ valor: '0' }))).toHaveProperty('valor');
      expect(problemas(aporte({ comprovante_url: '' }))).toHaveProperty('comprovante_url');
      expect(problemas(aporte({ comprovante_url: 'https://exemplo.com/x' }))).toHaveProperty('comprovante_url');
      expect(problemas(aporte({ comprovante_url: '', sem_comprovante: true }))).toHaveProperty('sem_comprovante_motivo');
      expect(problemas(aporte({ data: '2026-11-07' }))).toHaveProperty('data');
      expect(problemas(aporte({ socia_id: '', conta_id: '' }))).toMatchObject({ socia_id: 'Escolha a sócia.', conta_id: 'Escolha a conta da Numa que recebeu.' });
    });

    it('só conta da Numa, ativa e em reais', () => {
      const base = { arquivado_em: null, situacao: 'ativa' as const, tipo: 'banco' as const, moeda: 'BRL' };
      expect(contasParaAporte([base])).toHaveLength(1);
      expect(contasParaAporte([{ ...base, arquivado_em: '2026-01-01T00:00:00.000Z' }])).toHaveLength(0);
      expect(contasParaAporte([{ ...base, situacao: 'encerrada' as const }])).toHaveLength(0);
      expect(contasParaAporte([{ ...base, tipo: 'pessoal_socia' as const }])).toHaveLength(0);
      expect(contasParaAporte([{ ...base, moeda: 'USD' }])).toHaveLength(0);
    });
  });

  describe('RN-05.19: relatório do período pré-operacional', () => {
    const movimentos = [
      { socia_id: 'a', data: '2026-10-05', tipo: 'aporte' as const, valor_brl: 100 },
      { socia_id: 'a', data: '2026-10-20', tipo: 'retirada' as const, valor_brl: 30 },
      { socia_id: 'a', data: '2026-11-02', tipo: 'aporte' as const, valor_brl: 50 },
      { socia_id: 'b', data: '2026-09-15', tipo: 'aporte' as const, valor_brl: 70 },
    ];

    it('por sócia e por mês, do mais antigo ao mais recente', () => {
      expect(relatorioDeInvestimento(movimentos, null).map(({ mes, sociaId, aportes, retiradas, liquido }) => [mes, sociaId, aportes, retiradas, liquido])).toEqual([
        ['2026-09', 'b', 70, 0, 70],
        ['2026-10', 'a', 100, 30, 70],
        ['2026-11', 'a', 50, 0, 50],
      ]);
    });

    it('para na abertura da PJ', () => {
      expect(relatorioDeInvestimento(movimentos, '2026-11-02').map((linha) => linha.mes)).toEqual(['2026-09', '2026-10']);
    });

    it('o consolidado mostra os aportes líquidos e os reembolsos em aberto separados, sem somar (decisão de 06/11)', () => {
      const linhas = relatorioDeInvestimento(movimentos, null);
      const [consolidado] = consolidadoDoRelatorio([SOCIA], linhas, [{ beneficiario_pessoa_id: 'a', valor: 40, saldo: 25 }]);
      expect(consolidado).toEqual({ socia: SOCIA, aportes: 150, retiradas: 30, aportesLiquidos: 120, reembolsosEmAberto: 25 });
    });

    it('o período vai até a primeira PJ ativa com data de abertura', () => {
      const entidade = { tipo_pessoa: 'pj' as const, situacao: 'ativa' as const, data_abertura: '2027-02-01', arquivado_em: null };
      expect(fimDoPreOperacional([])).toBeNull();
      expect(fimDoPreOperacional([{ ...entidade, situacao: 'em_constituicao' }])).toBeNull();
      expect(fimDoPreOperacional([{ ...entidade, tipo_pessoa: 'pf' }])).toBeNull();
      expect(fimDoPreOperacional([{ ...entidade, arquivado_em: '2026-01-01T00:00:00.000Z' }])).toBeNull();
      expect(fimDoPreOperacional([entidade, { ...entidade, data_abertura: '2026-12-01' }])).toBe('2026-12-01');
    });
  });

  describe('filtros', () => {
    it('por sócia, tipo, forma e busca', async () => {
      const { movimentos } = await carregarSocias(HOJE);
      const nome = (id: string) => (id === ID_KIMBERLY ? 'Kimberly Grebe' : 'Camila Lima');
      expect(filtrarMovimentos(movimentos, FILTROS_MOVIMENTOS_INICIAIS, nome)).toHaveLength(movimentos.length);
      expect(filtrarMovimentos(movimentos, { ...FILTROS_MOVIMENTOS_INICIAIS, socia: ID_KIMBERLY }, nome).every((item) => item.socia_id === ID_KIMBERLY)).toBe(true);
      expect(filtrarMovimentos(movimentos, { ...FILTROS_MOVIMENTOS_INICIAIS, tipo: 'retirada' }, nome)).toHaveLength(0);
      expect(filtrarMovimentos(movimentos, { ...FILTROS_MOVIMENTOS_INICIAIS, forma: 'bem_servico' }, nome)).toHaveLength(0);
      expect(filtrarMovimentos(movimentos, { ...FILTROS_MOVIMENTOS_INICIAIS, busca: 'kimberly' }, nome).every((item) => item.socia_id === ID_KIMBERLY)).toBe(true);
    });
  });
});
