import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { CATEGORIAS_INICIAIS, ID_CONTA_CAMILA, ID_CONTA_KIMBERLY, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import { estornarBaixa, registrarAjuste } from './baixas';
import { arquivarConta } from './contas';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { limparExemplos, resumoDosDados } from './dados';
import { historicoDaConta } from './historico';
import { carregarSaldos, conferirSaldo, contasDoPainel, contasParaTransferencia, criarEsquemaConferencia, criarEsquemaTransferencia, diferencaDoSaldo, extratoDaConta, filtrarTransferencias, FILTROS_TRANSFERENCIAS_INICIAIS, formularioConferenciaVazio, formularioTransferenciaVazio, registrarTransferencia, saldoDaConta, sugestaoDoDestino, ultimaMovimentacao, type FormularioConferencia, type FormularioTransferencia } from './saldos';
import { novoAporteEmDinheiro, formularioAporteVazio } from './socias';
import { criarDespesa, formularioDespesaVazio, registrarPagamento, type DadosDoPagamento } from './titulos';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const categoria = (nome: string) => CATEGORIAS_INICIAIS.find((item) => item.nome === nome)!.id;

const novaConta = (alteracoes: Partial<ContaFinanceira> = {}) => repositorios.conta_financeira.criar({ nome: 'Banco da Numa', tipo: 'banco', titular_entidade_id: null, titular_pessoa_id: ID_KIMBERLY, instituicao: null, final_numero: null, moeda: 'BRL', saldo_inicial: 1000, data_saldo_inicial: '2026-10-01', situacao: 'ativa', ...alteracoes });
const pagamento = (contaId: string, alteracoes: Partial<DadosDoPagamento> = {}): DadosDoPagamento => ({ data: HOJE, contaId, valorMoeda: 100, cambio: null, iofBrl: null, valorBrl: 100, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: null, vencimentoReembolso: null, pagoAMais: false, motivo: null, ...alteracoes });
const despesaEmAberto = () => criarDespesa({ ...formularioDespesaVazio(ID_CONSOLIDADA, 'BRL', HOJE), descricao: 'Despesa de teste', valor: '100,00', categoria_id: categoria('IA'), contextos: [ID_INSTITUCIONAL], pago: false, vencimento: HOJE }, ID_KIMBERLY, HOJE);
const transferencia = (origem: string, destino: string, alteracoes: Partial<FormularioTransferencia> = {}): FormularioTransferencia => ({ ...formularioTransferenciaVazio(HOJE), conta_origem_id: origem, conta_destino_id: destino, valor_origem: '200,00', comprovante_url: DRIVE, ...alteracoes });

async function saldo(id: string, ate?: string) {
  const dados = await carregarSaldos();
  return saldoDaConta(dados.contas.find((conta) => conta.id === id) as ContaFinanceira, dados, ate);
}

async function extrato(id: string) {
  const dados = await carregarSaldos();
  return extratoDaConta(dados.contas.find((conta) => conta.id === id) as ContaFinanceira, dados);
}

describe('T05.06 e T05.07: transferências, contas e saldos', () => {
  let armazenamento: Driver;

  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RN-05.16: saldo da conta', () => {
    it('sem movimento, é o saldo inicial', async () => {
      const conta = await novaConta();
      expect(await saldo(conta.id)).toBe(1000);
      expect(await extrato(conta.id)).toEqual([]);
    });

    it('pagar sai, e o extrato acumula', async () => {
      const conta = await novaConta();
      const titulo = await despesaEmAberto();
      await registrarPagamento(titulo.id, pagamento(conta.id, { data: '2026-10-15', valorMoeda: 30, valorBrl: 30 }), HOJE);
      await registrarPagamento(titulo.id, pagamento(conta.id, { data: '2026-10-20', valorMoeda: 20, valorBrl: 20 }), HOJE);
      expect(await saldo(conta.id)).toBe(950);
      expect((await extrato(conta.id)).map((linha) => [linha.data, linha.saida, linha.saldo])).toEqual([
        ['2026-10-15', 30, 970],
        ['2026-10-20', 20, 950],
      ]);
      expect(await saldo(conta.id, '2026-10-16')).toBe(970);
      expect((await extrato(conta.id))[0]?.href).toBe(`/financeiro/${titulo.id}`);
    });

    it('só conta o que veio a partir da data do saldo inicial', async () => {
      const conta = await novaConta();
      const titulo = await despesaEmAberto();
      await registrarPagamento(titulo.id, pagamento(conta.id, { data: '2026-09-30' }), HOJE);
      expect(await saldo(conta.id)).toBe(1000);
      expect(await extrato(conta.id)).toEqual([]);
    });

    it('o estorno devolve o dinheiro à conta, e fica no extrato', async () => {
      const conta = await novaConta();
      const titulo = await despesaEmAberto();
      await registrarPagamento(titulo.id, pagamento(conta.id, { data: '2026-10-15' }), HOJE);
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      await estornarBaixa(baixa!.id, 'Lançado errado', HOJE);
      expect(await saldo(conta.id)).toBe(1000);
      const linhas = await extrato(conta.id);
      expect(linhas).toHaveLength(2);
      expect(linhas[1]).toMatchObject({ descricao: 'Estorno: Despesa de teste', entrada: 100, saida: 0, saldo: 1000 });
    });

    it('juros saem do caixa, mesmo sem mexer no saldo do título', async () => {
      const conta = await novaConta();
      const titulo = await despesaEmAberto();
      await registrarAjuste(titulo.id, pagamento(conta.id, { valorMoeda: 7.5, valorBrl: 7.5 }), 'Multa', HOJE);
      expect(await saldo(conta.id)).toBe(992.5);
      expect((await extrato(conta.id))[0]?.descricao).toBe('Ajuste: Despesa de teste');
    });

    it('conta em moeda estrangeira usa o valor na moeda; conta em reais, o valor em reais', async () => {
      const emDolar = await novaConta({ nome: 'Em dólar', moeda: 'USD', saldo_inicial: 100 });
      const emReais = await novaConta({ nome: 'Em reais' });
      const titulo = await criarDespesa({ ...formularioDespesaVazio(ID_CONSOLIDADA, 'USD', HOJE), descricao: 'Em dólar', valor: '40,00', moeda: 'USD', categoria_id: categoria('IA'), contextos: [ID_INSTITUCIONAL], pago: false, vencimento: HOJE }, ID_KIMBERLY, HOJE);
      await registrarPagamento(titulo.id, pagamento(emDolar.id, { valorMoeda: 10, cambio: 5.4, valorBrl: 54 }), HOJE);
      await registrarPagamento(titulo.id, pagamento(emReais.id, { valorMoeda: 10, cambio: 5.4, valorBrl: 54 }), HOJE);
      expect(await saldo(emDolar.id)).toBe(90);
      expect(await saldo(emReais.id)).toBe(946);
    });

    it('aporte em dinheiro entra; o que a sócia pagou de despesa não passa pela conta da Numa', async () => {
      const conta = await novaConta();
      await novoAporteEmDinheiro({ ...formularioAporteVazio(HOJE), socia_id: ID_KIMBERLY, valor: '500,00', conta_id: conta.id, comprovante_url: DRIVE }, HOJE);
      expect(await saldo(conta.id)).toBe(1500);
      expect((await extrato(conta.id))[0]).toMatchObject({ descricao: 'Aporte em dinheiro', entrada: 500, href: '/financeiro/socias' });
    });

    it('conta pessoal de sócia e cartão não têm saldo, só extrato', async () => {
      const titulo = await despesaEmAberto();
      await registrarPagamento(titulo.id, pagamento(ID_CONTA_KIMBERLY, { tratamento: 'aporte' }), HOJE);
      expect(await saldo(ID_CONTA_KIMBERLY)).toBeNull();
      expect((await extrato(ID_CONTA_KIMBERLY)).every((linha) => linha.saldo === null)).toBe(true);
      expect((await extrato(ID_CONTA_KIMBERLY)).at(-1)).toMatchObject({ saida: 100 });
      const cartao = await novaConta({ nome: 'Cartão', tipo: 'cartao', saldo_inicial: null, data_saldo_inicial: null });
      expect(await saldo(cartao.id)).toBeNull();
    });

    it('no mesmo dia, segue a ordem em que aconteceu', async () => {
      const conta = await novaConta();
      const outra = await novaConta({ nome: 'Outra' });
      vi.setSystemTime(new Date(`${HOJE}T15:10:00.000Z`));
      await novoAporteEmDinheiro({ ...formularioAporteVazio(HOJE), socia_id: ID_KIMBERLY, valor: '500,00', conta_id: conta.id, comprovante_url: DRIVE }, HOJE);
      vi.setSystemTime(new Date(`${HOJE}T15:20:00.000Z`));
      await registrarTransferencia(transferencia(conta.id, outra.id), HOJE);
      expect((await extrato(conta.id)).map((linha) => [linha.descricao, linha.saldo])).toEqual([
        ['Aporte em dinheiro', 1500],
        ['Transferência enviada', 1300],
      ]);
    });

    it('última movimentação e ordem do painel', async () => {
      const conta = await novaConta();
      const dados = await carregarSaldos();
      expect(ultimaMovimentacao(conta, dados)).toBeNull();
      const encerrada = { arquivado_em: null, situacao: 'encerrada' as const, nome: 'A encerrada' };
      const ativa = { arquivado_em: null, situacao: 'ativa' as const, nome: 'B ativa' };
      const arquivada = { arquivado_em: '2026-01-01T00:00:00.000Z', situacao: 'ativa' as const, nome: 'C arquivada' };
      expect(contasDoPainel([encerrada, arquivada, ativa]).map((item) => item.nome)).toEqual(['B ativa', 'A encerrada']);
    });
  });

  describe('RN-05.10: transferência', () => {
    it('duas pernas na mesma linha, sem título nem baixa', async () => {
      const origem = await novaConta({ nome: 'Origem' });
      const destino = await novaConta({ nome: 'Destino', saldo_inicial: 0 });
      const [titulos, baixas] = [(await repositorios.titulo.listar()).length, (await repositorios.baixa.listar()).length];
      const salva = await registrarTransferencia(transferencia(origem.id, destino.id, { observacao: 'Reserva' }), HOJE);
      expect(salva).toMatchObject({ valor_origem: 200, moeda_origem: 'BRL', valor_destino: 200, moeda_destino: 'BRL', cambio: null, observacao: 'Reserva', comprovante_url: DRIVE });
      expect(await saldo(origem.id)).toBe(800);
      expect(await saldo(destino.id)).toBe(200);
      expect(await repositorios.titulo.listar()).toHaveLength(titulos);
      expect(await repositorios.baixa.listar()).toHaveLength(baixas);
      expect((await extrato(origem.id))[0]).toMatchObject({ descricao: 'Transferência enviada', saida: 200 });
      expect((await extrato(destino.id))[0]).toMatchObject({ descricao: 'Transferência recebida', entrada: 200 });
    });

    it('D17: sem comprovante, o motivo fica na observação', async () => {
      const origem = await novaConta({ nome: 'Origem' });
      const destino = await novaConta({ nome: 'Destino' });
      const salva = await registrarTransferencia(transferencia(origem.id, destino.id, { comprovante_url: DRIVE, sem_comprovante: true, sem_comprovante_motivo: 'Pelo aplicativo, sem recibo', observacao: 'Reserva' }), HOJE);
      expect(salva).toMatchObject({ comprovante_url: null, observacao: 'Reserva · Sem comprovante: Pelo aplicativo, sem recibo' });
    });

    it('moedas diferentes guardam o câmbio e quanto chegou', async () => {
      const origem = await novaConta({ nome: 'Reais' });
      const destino = await novaConta({ nome: 'Dólar', moeda: 'USD', saldo_inicial: 0 });
      const salva = await registrarTransferencia(transferencia(origem.id, destino.id, { valor_origem: '540,00', cambio: '5,4321', valor_destino: '99,41' }), HOJE);
      expect(salva).toMatchObject({ valor_origem: 540, moeda_origem: 'BRL', valor_destino: 99.41, moeda_destino: 'USD', cambio: 5.4321 });
      expect(await saldo(origem.id)).toBe(460);
      expect(await saldo(destino.id)).toBe(99.41);
    });

    it('sugere quanto chega, nos dois sentidos', () => {
      expect(sugestaoDoDestino('BRL', 'USD', '540,00', '5,40')).toBe('100,00');
      expect(sugestaoDoDestino('USD', 'BRL', '100,00', '5,40')).toBe('540,00');
      expect(sugestaoDoDestino('USD', 'EUR', '100,00', '0,9')).toBe('90,00');
      expect(sugestaoDoDestino('BRL', 'USD', '', '5,40')).toBeNull();
      expect(sugestaoDoDestino('BRL', 'USD', '100,00', '')).toBeNull();
      expect(sugestaoDoDestino('BRL', 'BRL', '100,00', '1')).toBeNull();
    });

    it('barra mesma conta, conta de sócia, conta encerrada e data futura', async () => {
      const origem = await novaConta({ nome: 'Origem' });
      const encerrada = await novaConta({ nome: 'Encerrada', situacao: 'encerrada' });
      await expect(registrarTransferencia(transferencia(origem.id, origem.id), HOJE)).rejects.toThrow('precisa ser outra');
      await expect(registrarTransferencia(transferencia(origem.id, ID_CONTA_KIMBERLY), HOJE)).rejects.toThrow('da Numa');
      await expect(registrarTransferencia(transferencia(origem.id, encerrada.id), HOJE)).rejects.toThrow('ativas');
      await expect(registrarTransferencia(transferencia(origem.id, 'sumiu'), HOJE)).rejects.toThrow('as duas contas');
      await expect(registrarTransferencia(transferencia(origem.id, encerrada.id, { data: '2026-11-07' }), HOJE)).rejects.toThrow('futura');
    });

    it('o formulário confere contas, valor, câmbio e comprovante', () => {
      const contas = [
        { id: 'a', moeda: 'BRL' },
        { id: 'b', moeda: 'BRL' },
        { id: 'c', moeda: 'USD' },
      ];
      const problemas = (formulario: FormularioTransferencia) => {
        const resultado = criarEsquemaTransferencia(contas, HOJE).safeParse(formulario);
        return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((item) => [item.path[0], item.message]));
      };
      expect(problemas(transferencia('a', 'b'))).toEqual({});
      expect(problemas(transferencia('a', 'a'))).toHaveProperty('conta_destino_id', 'A conta de destino precisa ser outra.');
      expect(problemas(transferencia('', ''))).toMatchObject({ conta_origem_id: 'Escolha a conta de origem.', conta_destino_id: 'Escolha a conta de destino.' });
      expect(problemas(transferencia('a', 'b', { valor_origem: '' }))).toHaveProperty('valor_origem');
      expect(problemas(transferencia('a', 'c'))).toMatchObject({ cambio: 'Informe o câmbio.', valor_destino: 'Informe quanto chegou na conta de destino.' });
      expect(problemas(transferencia('a', 'c', { cambio: '5,4321', valor_destino: '99,41' }))).toEqual({});
      expect(problemas(transferencia('a', 'b', { comprovante_url: 'https://exemplo.com/x' }))).toHaveProperty('comprovante_url');
      expect(problemas(transferencia('a', 'b', { comprovante_url: '' }))).toHaveProperty('comprovante_url', 'Cole o link do comprovante, ou marque que não tem.');
      expect(problemas(transferencia('a', 'b', { comprovante_url: '', sem_comprovante: true }))).toHaveProperty('sem_comprovante_motivo');
      expect(problemas(transferencia('a', 'b', { comprovante_url: '', sem_comprovante: true, sem_comprovante_motivo: 'Sem recibo' }))).toEqual({});
      expect(problemas(transferencia('a', 'b', { data: '2026-11-07' }))).toHaveProperty('data');
    });

    it('as contas da Numa, ativas', () => {
      const base = { arquivado_em: null, situacao: 'ativa' as const, tipo: 'banco' as const };
      expect(contasParaTransferencia([base, { ...base, tipo: 'cartao' as const }])).toHaveLength(2);
      expect(contasParaTransferencia([{ ...base, tipo: 'pessoal_socia' as const }, { ...base, situacao: 'encerrada' as const }, { ...base, arquivado_em: '2026-01-01T00:00:00.000Z' }])).toHaveLength(0);
    });

    it('a lista filtra por conta, em qualquer ponta, da mais recente para a mais antiga', async () => {
      const a = await novaConta({ nome: 'Conta A' });
      const b = await novaConta({ nome: 'Conta B' });
      const c = await novaConta({ nome: 'Conta C' });
      await registrarTransferencia(transferencia(a.id, b.id, { data: '2026-10-10' }), HOJE);
      await registrarTransferencia(transferencia(c.id, a.id, { data: '2026-10-20', observacao: 'Reserva' }), HOJE);
      await registrarTransferencia(transferencia(b.id, c.id, { data: '2026-10-05' }), HOJE);
      const { transferencias, contas } = await carregarSaldos();
      const nome = (id: string) => contas.find((conta) => conta.id === id)?.nome ?? '';
      expect(filtrarTransferencias(transferencias, FILTROS_TRANSFERENCIAS_INICIAIS, nome).map((item) => item.data)).toEqual(['2026-10-20', '2026-10-10', '2026-10-05']);
      expect(filtrarTransferencias(transferencias, { ...FILTROS_TRANSFERENCIAS_INICIAIS, conta: a.id }, nome).map((item) => item.data)).toEqual(['2026-10-20', '2026-10-10']);
      expect(filtrarTransferencias(transferencias, { ...FILTROS_TRANSFERENCIAS_INICIAIS, busca: 'reserva' }, nome)).toHaveLength(1);
      expect(filtrarTransferencias(transferencias, { ...FILTROS_TRANSFERENCIAS_INICIAIS, busca: 'conta b' }, nome)).toHaveLength(2);
    });
  });

  describe('T05.07: conferir saldo', () => {
    const conferir = (id: string, saldoInformado: number, alteracoes: Partial<{ data: string; ajustar: boolean; motivo: string }> = {}) => conferirSaldo(id, { data: HOJE, saldoInformado, ajustar: false, motivo: '', ...alteracoes }, ID_KIMBERLY, HOJE);

    it('a diferença é o banco menos o sistema', () => {
      expect(diferencaDoSaldo(1000, 950.1)).toBe(-49.9);
      expect(diferencaDoSaldo(1000, 1000)).toBe(0);
    });

    it('sem pedir ajuste, só registra: o saldo não muda sozinho', async () => {
      const conta = await novaConta();
      const titulos = (await repositorios.titulo.listar()).length;
      const conferencia = await conferir(conta.id, 950);
      expect(conferencia).toMatchObject({ conta_id: conta.id, data: HOJE, saldo_informado: 950, saldo_sistema: 1000, diferenca: -50, ajuste_titulo_id: null });
      expect(await saldo(conta.id)).toBe(1000);
      expect(await repositorios.titulo.listar()).toHaveLength(titulos);
    });

    it('com ajuste e motivo, para menos sai da conta como despesa quitada', async () => {
      const conta = await novaConta();
      const conferencia = await conferir(conta.id, 950, { ajustar: true, motivo: 'Tarifa não lançada' });
      expect(await saldo(conta.id)).toBe(950);
      const titulo = await repositorios.titulo.obter(conferencia.ajuste_titulo_id as string);
      expect(titulo).toMatchObject({ natureza: 'pagar', origem: 'ajuste', situacao: 'quitado', valor: 50, descricao: 'Ajuste de saldo: Banco da Numa', observacao: 'Tarifa não lançada', categoria_id: categoria('Outros'), origem_id: conta.id, competencia: '2026-11-01', responsavel_id: ID_KIMBERLY });
      expect(await repositorios.baixa.listar({ onde: { titulo_id: titulo!.id } })).toMatchObject([{ tipo: 'pagamento', conta_financeira_id: conta.id, valor_moeda: 50, valor_brl: 50, data: HOJE }]);
      expect(await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo!.id } })).toMatchObject([{ produto_id: null, percentual: 100, valor: 50 }]);
    });

    it('para mais, entra na conta como recebimento', async () => {
      const conta = await novaConta();
      const conferencia = await conferir(conta.id, 1020.5, { ajustar: true, motivo: 'Rendimento' });
      expect(conferencia.diferenca).toBe(20.5);
      expect(await saldo(conta.id)).toBe(1020.5);
      expect(await repositorios.titulo.obter(conferencia.ajuste_titulo_id as string)).toMatchObject({ natureza: 'receber', categoria_id: categoria('Outras receitas'), valor: 20.5 });
    });

    it('confere numa data passada contra o saldo daquele dia', async () => {
      const conta = await novaConta();
      const titulo = await despesaEmAberto();
      await registrarPagamento(titulo.id, pagamento(conta.id, { data: '2026-10-20' }), HOJE);
      expect(await conferir(conta.id, 1000, { data: '2026-10-10' })).toMatchObject({ saldo_sistema: 1000, diferenca: 0 });
      expect(await conferir(conta.id, 900, { data: '2026-10-25' })).toMatchObject({ saldo_sistema: 900, diferenca: 0 });
    });

    it('sem diferença, não há ajuste, mesmo pedindo', async () => {
      const conta = await novaConta();
      expect((await conferir(conta.id, 1000, { ajustar: true })).ajuste_titulo_id).toBeNull();
    });

    it('barra ajuste sem motivo, data fora da conta e conta sem saldo, sem deixar nada pela metade', async () => {
      const conta = await novaConta();
      await expect(conferir(conta.id, 950, { ajustar: true })).rejects.toThrow('por que');
      await expect(conferir(conta.id, 950, { data: '2026-11-07' })).rejects.toThrow('futura');
      await expect(conferir(conta.id, 950, { data: '2026-09-30' })).rejects.toThrow('saldo inicial');
      await expect(conferir(ID_CONTA_KIMBERLY, 950)).rejects.toThrow('não tem saldo');
      await expect(conferir('sumiu', 950)).rejects.toThrow('não existe mais');
      expect(await repositorios.conferencia_saldo.listar()).toHaveLength(0);
    });

    it('em moeda estrangeira, o ajuste usa o câmbio de referência, e sem ele é barrado', async () => {
      const conta = await novaConta({ moeda: 'EUR', saldo_inicial: 100 });
      await expect(conferir(conta.id, 90, { ajustar: true, motivo: 'Tarifa' })).rejects.toThrow('câmbio de referência de EUR');
      expect(await repositorios.titulo.listar({ onde: { origem: 'ajuste' } })).toHaveLength(0);
      await repositorios.cambio_referencia.criar({ moeda: 'EUR', valor_brl: 6.25, data_referencia: '2026-11-01', fonte: null });
      const conferencia = await conferir(conta.id, 90, { ajustar: true, motivo: 'Tarifa' });
      expect(await saldo(conta.id)).toBe(90);
      expect(await repositorios.baixa.listar({ onde: { titulo_id: conferencia.ajuste_titulo_id as string } })).toMatchObject([{ valor_moeda: 10, cambio: 6.25, valor_brl: 62.5 }]);
    });

    it('o formulário confere data, valor e motivo', () => {
      const problemas = (alteracoes: Partial<FormularioConferencia>) => {
        const resultado = criarEsquemaConferencia({ data_saldo_inicial: '2026-10-01' }, HOJE).safeParse({ ...formularioConferenciaVazio(HOJE), saldo_informado: '100,00', ...alteracoes });
        return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((item) => [item.path[0], item.message]));
      };
      expect(problemas({})).toEqual({});
      expect(problemas({ saldo_informado: '-5,00' })).toEqual({});
      expect(problemas({ saldo_informado: '0' })).toEqual({});
      expect(problemas({ saldo_informado: '' })).toHaveProperty('saldo_informado');
      expect(problemas({ data: '2026-11-07' })).toHaveProperty('data');
      expect(problemas({ data: '2026-09-30' })).toHaveProperty('data');
      expect(problemas({ ajustar: true })).toHaveProperty('motivo');
      expect(problemas({ ajustar: true, motivo: 'Tarifa' })).toEqual({});
    });

    it('o histórico da conta traz as conferências e as transferências', async () => {
      const conta = await novaConta();
      const outra = await novaConta({ nome: 'Outra' });
      await conferir(conta.id, 1000);
      await registrarTransferencia(transferencia(conta.id, outra.id), HOJE);
      const linhas = await historicoDaConta(conta.id);
      expect(linhas.length).toBeGreaterThanOrEqual(3);
      expect(linhas.map((linha) => linha.texto).join(' ')).toMatch(/conferência de saldo/);
      expect(linhas.map((linha) => linha.texto).join(' ')).toMatch(/transferência/);
    });
  });

  describe('integração com os cadastros', () => {
    it('conta com transferência ou aporte não se arquiva: encerra', async () => {
      const a = await novaConta({ nome: 'A' });
      const b = await novaConta({ nome: 'B' });
      const c = await novaConta({ nome: 'C' });
      await registrarTransferencia(transferencia(a.id, b.id), HOJE);
      await expect(arquivarConta(a.id)).rejects.toThrow('transferências');
      await expect(arquivarConta(b.id)).rejects.toThrow('transferências');
      await novoAporteEmDinheiro({ ...formularioAporteVazio(HOJE), socia_id: ID_KIMBERLY, valor: '10,00', conta_id: c.id, comprovante_url: DRIVE }, HOJE);
      await expect(arquivarConta(c.id)).rejects.toThrow('aportes');
    });

    it('limpar exemplos preserva a conta usada de verdade, e a conferência dela', async () => {
      const paraBanco = { tipo: 'banco' as const, saldo_inicial: 0, data_saldo_inicial: '2026-10-01' };
      await repositorios.conta_financeira.atualizar(ID_CONTA_KIMBERLY, paraBanco);
      const real = await novaConta({ nome: 'De verdade' });
      await registrarTransferencia(transferencia(ID_CONTA_KIMBERLY, real.id), HOJE);
      await conferirSaldo(ID_CONTA_KIMBERLY, { data: HOJE, saldoInformado: 0, ajustar: false, motivo: '' }, ID_KIMBERLY, HOJE);
      await repositorios.conta_financeira.atualizar(ID_CONTA_CAMILA, paraBanco);
      await conferirSaldo(ID_CONTA_CAMILA, { data: HOJE, saldoInformado: 0, ajustar: false, motivo: '' }, ID_KIMBERLY, HOJE);
      await limparExemplos();
      const contas = await repositorios.conta_financeira.listar();
      expect(contas.find((conta) => conta.id === ID_CONTA_KIMBERLY)).toMatchObject({ exemplo: false });
      expect(contas.some((conta) => conta.id === ID_CONTA_CAMILA)).toBe(false);
      expect(await repositorios.transferencia.listar()).toHaveLength(1);
      expect((await repositorios.conferencia_saldo.listar()).map((item) => item.conta_id)).toEqual([ID_CONTA_KIMBERLY]);
    });

    it('transferência conta como registro; conferência, não', async () => {
      const a = await novaConta({ nome: 'A' });
      const b = await novaConta({ nome: 'B' });
      const antes = (await resumoDosDados()).registros;
      await conferirSaldo(a.id, { data: HOJE, saldoInformado: 1000, ajustar: false, motivo: '' }, ID_KIMBERLY, HOJE);
      expect((await resumoDosDados()).registros).toBe(antes);
      await registrarTransferencia(transferencia(a.id, b.id), HOJE);
      expect((await resumoDosDados()).registros).toBe(antes + 1);
    });

    it('quem já usa a Central recebe as tabelas novas, vazias, sem perder nada', async () => {
      const conta = await novaConta();
      armazenamento.removeItem(chaveDaTabela('transferencia'));
      armazenamento.removeItem(chaveDaTabela('conferencia_saldo'));
      gravarMeta({ versao_dados: 13 });
      esquecerMetaEmMemoria();
      expect(await repositorios.transferencia.listar()).toEqual([]);
      expect(await repositorios.conferencia_saldo.listar()).toEqual([]);
      expect(await repositorios.conta_financeira.obter(conta.id)).toMatchObject({ nome: 'Banco da Numa' });
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });
  });
});
