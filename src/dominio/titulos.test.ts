import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_CONTA_CAMILA, ID_CONTA_KIMBERLY, ID_ENTIDADE_PLANEJADA, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { esquemaBaixa, esquemaMovimentoSocietario, esquemaTitulo, esquemaTituloRateio } from '@/dados/tipos/titulo';
import { EXEMPLOS_INICIAIS, MOVIMENTOS_INICIAIS, REGISTROS_INICIAIS, TITULOS_INICIAIS } from './apoio-testes';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { arquivarConta } from './contas';
import { limparExemplos, resumoDosDados } from './dados';
import { cancelarFerramenta, criarFerramenta, formularioDaFerramenta, formularioFerramentaVazio, salvarFerramenta, type FormularioFerramenta } from './ferramentas';
import { carregarLancamentos, comprovanteDoTitulo, competenciasDosTitulos, filtrarTitulos, FILTROS_LANCAMENTOS_INICIAIS, pagoDoTitulo, parteDoContexto, periodoDosTotais, quantosMaisFiltros, rotuloDoMes, totaisDosLancamentos, type LinhaDoTitulo } from './lancamentos';
import { vinculosDaPessoa } from './pessoas';
import { executarRotinas } from './rotinas';
import {
  assinaturaSugerida,
  atualizarSituacoesDosTitulos,
  categoriaDoFornecedor,
  chaveDaCobranca,
  competenciaDoDia,
  conferirDespesa,
  criarDespesa,
  criarEsquemaDespesa,
  descricoesAnteriores,
  erroDoRateioDoTitulo,
  estaVencido,
  estenderProgramacao,
  formularioDespesaVazio,
  rateioEmPartesIguais,
  registrarPagamento,
  rotuloDaCompetencia,
  saldoDoTitulo,
  situacaoPelasBaixas,
  titulosAfetadosPeloReajuste,
  titulosFuturosDaFerramenta,
  valoresDoRateio,
  valorEmReais,
  type DadosDoPagamento,
  type FormularioDespesa,
} from './titulos';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const CONTAS = [
  { id: ID_CONTA_KIMBERLY, tipo: 'pessoal_socia' as const },
  { id: 'banco', tipo: 'banco' as const },
];
const categoria = (nome: string) => CATEGORIAS_INICIAIS.find((item) => item.nome === nome)!.id;

function novaDespesa(alteracoes: Partial<FormularioDespesa> = {}): FormularioDespesa {
  return {
    ...formularioDespesaVazio(ID_CONSOLIDADA, 'BRL', HOJE),
    descricao: 'Despesa de teste',
    valor: '100,00',
    categoria_id: categoria('IA'),
    contextos: [ID_INSTITUCIONAL],
    conta_id: ID_CONTA_KIMBERLY,
    tratamento: 'aporte',
    comprovante_url: DRIVE,
    ...alteracoes,
  };
}

function novaEmAberto(alteracoes: Partial<FormularioDespesa> = {}): FormularioDespesa {
  return novaDespesa({ pago: false, vencimento: '2026-12-10', conta_id: '', tratamento: '', comprovante_url: '', ...alteracoes });
}

const problemas = (formulario: FormularioDespesa) => {
  const resultado = criarEsquemaDespesa(CONTAS, HOJE).safeParse(formulario);
  return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join('.'), problema.message]));
};

const pagamento = (alteracoes: Partial<DadosDoPagamento> = {}): DadosDoPagamento => ({ data: HOJE, contaId: ID_CONTA_KIMBERLY, valorMoeda: 100, cambio: null, iofBrl: null, valorBrl: 100, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null, pagoAMais: false, motivo: null, ...alteracoes });

const filtrar = async (filtros: Partial<typeof FILTROS_LANCAMENTOS_INICIAIS> = {}, contextoGlobalId: string = ID_CONSOLIDADA) => {
  const dados = await carregarLancamentos(HOJE);
  return filtrarTitulos(dados.titulos, { ...FILTROS_LANCAMENTOS_INICIAIS, ...filtros }, { contextoGlobalId, hoje: HOJE, nomeDaContraparte: () => '' });
};

describe('T05.01 e T05.02: títulos', () => {
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

  describe('carga', () => {
    it('traz os lançamentos de exemplo, cobrindo os estados de 17 §6', async () => {
      const titulos = await repositorios.titulo.listar();
      expect(titulos).toHaveLength(TITULOS_INICIAIS);
      expect(new Set(titulos.map((titulo) => titulo.situacao))).toEqual(new Set(['previsto', 'aberto', 'parcial', 'quitado', 'cancelado']));
      expect(titulos.every((titulo) => titulo.exemplo)).toBe(true);
      expect((await repositorios.baixa.listar()).some((baixa) => baixa.tipo === 'estorno')).toBe(true);
      expect(await repositorios.movimento_societario.listar()).toHaveLength(MOVIMENTOS_INICIAIS);
    });

    it('todos os exemplos passam nos esquemas', async () => {
      for (const titulo of await repositorios.titulo.listar()) expect(esquemaTitulo.safeParse(titulo).success).toBe(true);
      for (const linha of await repositorios.titulo_rateio.listar()) expect(esquemaTituloRateio.safeParse(linha).success).toBe(true);
      for (const baixa of await repositorios.baixa.listar()) expect(esquemaBaixa.safeParse(baixa).success).toBe(true);
      for (const movimento of await repositorios.movimento_societario.listar()) expect(esquemaMovimentoSocietario.safeParse(movimento).success).toBe(true);
    });

    it('a situação guardada é a que as baixas dizem', async () => {
      const baixas = await repositorios.baixa.listar();
      for (const titulo of await repositorios.titulo.listar()) expect(situacaoPelasBaixas(titulo, baixas.filter((baixa) => baixa.titulo_id === titulo.id))).toBe(titulo.situacao);
    });

    it('o rateio de cada exemplo soma o valor do título', async () => {
      const rateios = await repositorios.titulo_rateio.listar();
      for (const titulo of await repositorios.titulo.listar()) {
        const dele = rateios.filter((linha) => linha.titulo_id === titulo.id);
        expect(Math.round(dele.reduce((total, linha) => total + linha.valor, 0) * 100) / 100).toBe(titulo.valor);
      }
    });

    it('a contagem inclui títulos e movimentos, mas não rateios nem baixas', async () => {
      const resumo = await resumoDosDados();
      expect(resumo.registros).toBe(REGISTROS_INICIAIS);
      expect(resumo.exemplos).toBe(EXEMPLOS_INICIAIS);
    });

    it('migra quem veio da versão anterior', async () => {
      for (const tabela of ['titulo', 'titulo_rateio', 'baixa', 'movimento_societario']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 12 });
      garantirCarga();
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
      expect(await repositorios.titulo.listar()).toHaveLength(TITULOS_INICIAIS);
    });

    it('quem já limpou os exemplos não recebe lançamentos fictícios', async () => {
      await limparExemplos();
      for (const tabela of ['titulo', 'titulo_rateio', 'baixa', 'movimento_societario']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 12 });
      garantirCarga();
      expect(await repositorios.titulo.listar()).toEqual([]);
    });
  });

  describe('RN-05.02: saldo e situação', () => {
    const titulo = { valor: 100, situacao: 'aberto' as const };
    const baixa = (tipo: 'pagamento' | 'estorno' | 'ajuste', valor_moeda: number) => ({ tipo, valor_moeda, arquivado_em: null });

    it('CA-05.03: pagar R$ 60 de R$ 100 deixa R$ 40, e parcial', () => {
      expect(saldoDoTitulo(titulo, [baixa('pagamento', 60)])).toBe(40);
      expect(situacaoPelasBaixas(titulo, [baixa('pagamento', 60)])).toBe('parcial');
    });

    it('CA-05.03: o estorno volta o saldo, com as duas baixas', () => {
      const baixas = [baixa('pagamento', 60), baixa('estorno', 60)];
      expect(saldoDoTitulo(titulo, baixas)).toBe(100);
      expect(situacaoPelasBaixas({ ...titulo, situacao: 'parcial' }, baixas)).toBe('aberto');
    });

    it('pagar tudo quita; ajuste não mexe no saldo', () => {
      expect(situacaoPelasBaixas(titulo, [baixa('pagamento', 100)])).toBe('quitado');
      expect(saldoDoTitulo(titulo, [baixa('pagamento', 60), baixa('ajuste', 5)])).toBe(40);
    });

    it('previsto continua previsto sem baixa; cancelado fica cancelado, sem saldo', () => {
      expect(situacaoPelasBaixas({ valor: 100, situacao: 'previsto' }, [])).toBe('previsto');
      expect(situacaoPelasBaixas({ valor: 100, situacao: 'cancelado' }, [])).toBe('cancelado');
      expect(saldoDoTitulo({ valor: 100, situacao: 'cancelado' }, [])).toBe(0);
    });

    it('vencido é derivado: em aberto ou parcial, com vencimento antes de hoje', () => {
      expect(estaVencido({ situacao: 'aberto', vencimento: '2026-11-05' }, HOJE)).toBe(true);
      expect(estaVencido({ situacao: 'parcial', vencimento: '2026-11-05' }, HOJE)).toBe(true);
      expect(estaVencido({ situacao: 'aberto', vencimento: HOJE }, HOJE)).toBe(false);
      expect(estaVencido({ situacao: 'previsto', vencimento: '2026-11-05' }, HOJE)).toBe(false);
      expect(estaVencido({ situacao: 'quitado', vencimento: '2026-11-05' }, HOJE)).toBe(false);
    });
  });

  describe('competência e câmbio', () => {
    it('competência é o primeiro dia do mês, e aparece por extenso', () => {
      expect(competenciaDoDia('2026-11-20')).toBe('2026-11-01');
      expect(rotuloDaCompetencia('2026-11-01')).toBe('nov/2026');
    });

    it('RN-05.05: moeda × câmbio + IOF', () => {
      expect(valorEmReais(20, 5.4, 4.05)).toBe(112.05);
      expect(valorEmReais(20, 5.4, null)).toBe(108);
    });
  });

  describe('RN-05.08: rateio', () => {
    it('partes iguais, com a última fechando 100%', () => {
      expect(rateioEmPartesIguais(['a', 'b']).map((linha) => linha.percentual)).toEqual(['50', '50']);
      expect(rateioEmPartesIguais(['a', 'b', 'c']).map((linha) => linha.percentual)).toEqual(['33,33', '33,33', '33,34']);
    });

    it('precisa somar 100, com um só não precisa', () => {
      expect(erroDoRateioDoTitulo([{ percentual: '60' }, { percentual: '40' }])).toBeNull();
      expect(erroDoRateioDoTitulo([{ percentual: '60' }, { percentual: '30' }])).toBe('A soma precisa dar 100%. Está em 90%.');
      expect(erroDoRateioDoTitulo([{ percentual: '' }])).toBeNull();
      expect(erroDoRateioDoTitulo([{ percentual: 'x' }, { percentual: '100' }])).toBe('Use percentuais de 0 a 100.');
    });

    it('o último fica com o resíduo em valor', () => {
      expect(valoresDoRateio(100, [33.33, 33.33, 33.34])).toEqual([33.33, 33.33, 33.34]);
      expect(valoresDoRateio(0.1, [50, 50])).toEqual([0.05, 0.05]);
      expect(valoresDoRateio(10.01, [50, 50])).toEqual([5.01, 5]);
    });

    it('CA-05.06: R$ 300 em 50/30/20 dá 150/90/60', () => {
      expect(valoresDoRateio(300, [50, 30, 20])).toEqual([150, 90, 60]);
    });
  });

  describe('T05.02: formulário', () => {
    it('em aberto, só o básico', () => {
      expect(problemas(novaEmAberto())).toEqual({});
    });

    it('descrição, valor, categoria, contexto e competência são obrigatórios', () => {
      expect(problemas(novaEmAberto({ descricao: ' ', valor: '', categoria_id: '', contextos: [], competencia: '' }))).toEqual({
        descricao: 'Diga o que foi essa despesa.',
        valor: 'Informe o valor, como 0,00.',
        categoria_id: 'Escolha a categoria.',
        contextos: 'Escolha a Numa ou um produto.',
        competencia: 'Informe a competência.',
      });
    });

    it('não pago exige vencimento', () => {
      expect(problemas(novaEmAberto({ vencimento: '' })).vencimento).toBe('Informe o vencimento.');
    });

    it('pago exige data e conta, e a data não é futura', () => {
      const erros = problemas(novaDespesa({ data_pagamento: '', conta_id: '' }));
      expect(erros.data_pagamento).toBe('Informe a data do pagamento.');
      expect(erros.conta_id).toBe('Escolha a conta usada.');
      expect(problemas(novaDespesa({ data_pagamento: '2026-11-07' })).data_pagamento).toBe('A data do pagamento não pode ser futura.');
    });

    it('moeda estrangeira exige câmbio e valor em reais; IOF é opcional', () => {
      const erros = problemas(novaDespesa({ moeda: 'USD' }));
      expect(erros.cambio).toBe('Informe o câmbio pago.');
      expect(erros.valor_brl).toBe('Informe o valor efetivo em reais.');
      expect(problemas(novaDespesa({ moeda: 'USD', cambio: '5,40', valor_brl: '540,00' }))).toEqual({});
    });

    it('RN-05.06: conta de sócia exige o tratamento; reembolso, o vencimento', () => {
      expect(problemas(novaDespesa({ tratamento: '' })).tratamento).toBe('Conta de sócia: escolha entre aporte e reembolso.');
      expect(problemas(novaDespesa({ tratamento: 'reembolso' })).vencimento_reembolso).toBe('Informe quando a Numa vai reembolsar.');
      expect(problemas(novaDespesa({ conta_id: 'banco', tratamento: '' }))).toEqual({});
    });

    it('RN-05.12: comprovante do Drive, ou o motivo de não ter', () => {
      expect(problemas(novaDespesa({ comprovante_url: '' })).comprovante_url).toBe('Cole o link do comprovante, ou marque que não tem.');
      expect(problemas(novaDespesa({ comprovante_url: 'https://exemplo.com/x' })).comprovante_url).toContain('drive.google.com');
      expect(problemas(novaDespesa({ comprovante_url: '', sem_comprovante: true })).sem_comprovante_motivo).toBe('Diga por que não tem comprovante.');
      expect(problemas(novaDespesa({ comprovante_url: '', sem_comprovante: true, sem_comprovante_motivo: 'Pago em dinheiro' }))).toEqual({});
    });

    it('vários contextos precisam somar 100%', () => {
      expect(problemas(novaEmAberto({ contextos: ['a', 'b'], percentuais: { a: '60', b: '30' } })).percentuais).toContain('A soma precisa dar 100%');
      expect(problemas(novaEmAberto({ contextos: ['a', 'b'], percentuais: { a: '60', b: '40' } }))).toEqual({});
    });
  });

  describe('T05.02: conferência', () => {
    const existentes = [{ codigo: 'TIT-2026-0031', contraparte_id: 'c', valor: 100, vencimento: '2026-12-10', situacao: 'aberto' as const }];

    it('RN-05.15: mesma contraparte, valor e vencimento ±3 dias avisa', () => {
      expect(conferirDespesa(novaEmAberto({ contraparte_id: 'c', vencimento: '2026-12-13' }), existentes).avisos).toEqual(['Possível duplicidade: TIT-2026-0031.']);
      expect(conferirDespesa(novaEmAberto({ contraparte_id: 'c', vencimento: '2026-12-14' }), existentes).avisos).toEqual([]);
      expect(conferirDespesa(novaEmAberto({ contraparte_id: 'c', valor: '99,00', vencimento: '2026-12-10' }), existentes).avisos).toEqual([]);
      expect(conferirDespesa(novaEmAberto({ contraparte_id: 'x', vencimento: '2026-12-10' }), existentes).avisos).toEqual([]);
    });

    it('cancelado não conta como duplicidade', () => {
      expect(conferirDespesa(novaEmAberto({ contraparte_id: 'c', vencimento: '2026-12-10' }), [{ ...existentes[0]!, situacao: 'cancelado' }]).avisos).toEqual([]);
    });

    it('RT-14: texto que parece senha avisa', () => {
      expect(conferirDespesa(novaEmAberto({ observacao: 'senha: abc123' }), []).avisos.join(' ')).toContain('senha');
    });
  });

  describe('T05.02: gravar', () => {
    it('em aberto: um título, sem baixa, com o rateio', async () => {
      const titulo = await criarDespesa(novaEmAberto({ contextos: [ID_PRODUTO_KIPI, ID_INSTITUCIONAL], percentuais: { [ID_PRODUTO_KIPI]: '70', [ID_INSTITUCIONAL]: '30' } }), ID_KIMBERLY, HOJE);
      expect(titulo).toMatchObject({ natureza: 'pagar', situacao: 'aberto', valor: 100, moeda: 'BRL', vencimento: '2026-12-10', origem: 'manual', responsavel_id: ID_KIMBERLY, exemplo: false });
      expect(titulo.codigo).toMatch(/^TIT-2026-\d{4}$/);
      expect((await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } }))).toEqual([]);
      const rateio = await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } });
      expect(rateio.map((linha) => [linha.produto_id, linha.percentual, linha.valor])).toEqual([
        [ID_PRODUTO_KIPI, 70, 70],
        [null, 30, 30],
      ]);
    });

    it('um contexto só fica com 100%', async () => {
      const titulo = await criarDespesa(novaEmAberto({ contextos: [ID_PRODUTO_ZUPI] }), ID_KIMBERLY, HOJE);
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } })).map((linha) => [linha.produto_id, linha.percentual])).toEqual([[ID_PRODUTO_ZUPI, 100]]);
    });

    it('pago sem vencimento: o vencimento é a data do pagamento, e fica quitado', async () => {
      const titulo = await criarDespesa(novaDespesa({ data_pagamento: '2026-11-03', conta_id: ID_CONTA_KIMBERLY }), ID_KIMBERLY, HOJE);
      expect(titulo).toMatchObject({ situacao: 'quitado', vencimento: '2026-11-03' });
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      expect(baixa).toMatchObject({ tipo: 'pagamento', data: '2026-11-03', valor_moeda: 100, valor_brl: 100, comprovante_url: DRIVE, cambio: null, registrado_por: expect.anything() });
    });

    it('CA-05.01: US$ 20 no cartão de sócia, como reembolso', async () => {
      const titulo = await criarDespesa(novaDespesa({ descricao: 'Hospedagem', valor: '20,00', moeda: 'USD', cambio: '5,40', iof: '4,05', valor_brl: '112,05', tratamento: 'reembolso', vencimento_reembolso: '2026-12-01', contextos: [ID_PRODUTO_KIPI] }), ID_KIMBERLY, HOJE);
      expect(titulo).toMatchObject({ situacao: 'quitado', valor: 20, moeda: 'USD' });
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      expect(baixa).toMatchObject({ valor_moeda: 20, cambio: 5.4, iof_brl: 4.05, valor_brl: 112.05, tratamento: 'reembolso', movimento_societario_id: null });
      const reembolso = await repositorios.titulo.obter(baixa!.titulo_reembolso_id as string);
      expect(reembolso).toMatchObject({ natureza: 'pagar', situacao: 'aberto', valor: 112.05, moeda: 'BRL', beneficiario_pessoa_id: ID_KIMBERLY, categoria_id: categoria('Reembolso de despesas'), vencimento: '2026-12-01', origem: 'reembolso', origem_id: titulo.id, descricao: 'Reembolso: Hospedagem' });
      expect((await repositorios.movimento_societario.listar({ onde: { titulo_origem_id: titulo.id } }))).toEqual([]);
    });

    it('CA-05.02: a mesma despesa como aporte gera o movimento, e nenhum reembolso', async () => {
      const titulo = await criarDespesa(novaDespesa({ valor: '20,00', moeda: 'USD', cambio: '5,40', iof: '4,05', valor_brl: '112,05', tratamento: 'aporte' }), ID_KIMBERLY, HOJE);
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      expect(baixa?.titulo_reembolso_id).toBeNull();
      const movimento = await repositorios.movimento_societario.obter(baixa!.movimento_societario_id as string);
      expect(movimento).toMatchObject({ tipo: 'aporte', socia_id: ID_KIMBERLY, valor_brl: 112.05, forma: 'pagamento_despesa', titulo_origem_id: titulo.id, baixa_origem_id: baixa!.id, conta_financeira_id: ID_CONTA_KIMBERLY, data: HOJE });
    });

    it('a sócia do tratamento é a titular da conta', async () => {
      const titulo = await criarDespesa(novaDespesa({ conta_id: ID_CONTA_CAMILA }), ID_KIMBERLY, HOJE);
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      expect((await repositorios.movimento_societario.obter(baixa!.movimento_societario_id as string))?.socia_id).toBe(ID_CAMILA);
    });

    it('sem comprovante, com motivo', async () => {
      const titulo = await criarDespesa(novaDespesa({ comprovante_url: '', sem_comprovante: true, sem_comprovante_motivo: 'Sem recibo' }), ID_KIMBERLY, HOJE);
      expect((await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } }))[0]).toMatchObject({ comprovante_url: null, sem_comprovante_motivo: 'Sem recibo' });
    });

    it('uma falha no meio não deixa nada pela metade (AR-02)', async () => {
      const antes = (await repositorios.titulo.listar()).length;
      await expect(criarDespesa(novaDespesa({ conta_id: 'nao-existe' }), ID_KIMBERLY, HOJE)).rejects.toThrow('Escolha a conta usada.');
      expect(await repositorios.titulo.listar()).toHaveLength(antes);
    });
  });

  describe('RN-05.03 e RN-05.06: registrar pagamento', () => {
    const emAberto = () => criarDespesa(novaEmAberto(), ID_KIMBERLY, HOJE);

    it('não baixa mais que o saldo', async () => {
      const titulo = await emAberto();
      await expect(registrarPagamento(titulo.id, pagamento({ valorMoeda: 120, valorBrl: 120 }), HOJE)).rejects.toThrow('O saldo é menor que o valor');
    });

    it('pago a mais: a diferença vira ajuste, e quita', async () => {
      const titulo = await emAberto();
      await registrarPagamento(titulo.id, pagamento({ valorMoeda: 110, valorBrl: 110, pagoAMais: true }), HOJE);
      const baixas = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      expect(baixas.map((baixa) => [baixa.tipo, baixa.valor_moeda, baixa.valor_brl])).toEqual([
        ['pagamento', 100, 100],
        ['ajuste', 10, 10],
      ]);
      expect(baixas[1]?.motivo).toBe('Juros e multas');
      expect((await repositorios.titulo.obter(titulo.id))?.situacao).toBe('quitado');
    });

    it('sem data futura, sem comprovante nem motivo, sem tratamento em conta de sócia', async () => {
      const titulo = await emAberto();
      await expect(registrarPagamento(titulo.id, pagamento({ data: '2026-11-07' }), HOJE)).rejects.toThrow('não pode ser futura');
      await expect(registrarPagamento(titulo.id, pagamento({ comprovanteUrl: null }), HOJE)).rejects.toThrow('RN-05.12');
      await expect(registrarPagamento(titulo.id, pagamento({ tratamento: null }), HOJE)).rejects.toThrow('RN-05.06');
    });

    it('cancelado não recebe baixa', async () => {
      const titulo = await emAberto();
      await repositorios.titulo.atualizar(titulo.id, { situacao: 'cancelado', cancelado_motivo: 'x' });
      await expect(registrarPagamento(titulo.id, pagamento(), HOJE)).rejects.toThrow('cancelado');
    });

    it('o reembolso é pago por conta da empresa', async () => {
      const titulo = await criarDespesa(novaDespesa({ tratamento: 'reembolso', vencimento_reembolso: '2026-12-01' }), ID_KIMBERLY, HOJE);
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } });
      await expect(registrarPagamento(baixa!.titulo_reembolso_id as string, pagamento({ tratamento: 'aporte' }), HOJE)).rejects.toThrow('escolha uma conta da empresa');
    });
  });

  describe('T05.02: sugestões', () => {
    it('descrições anteriores, sem repetir, só manuais, da mais recente', () => {
      const titulos = [
        { descricao: 'A', origem: 'manual' as const, criado_em: '2026-01-01' },
        { descricao: 'B', origem: 'manual' as const, criado_em: '2026-03-01' },
        { descricao: 'A', origem: 'manual' as const, criado_em: '2026-02-01' },
        { descricao: 'C', origem: 'assinatura' as const, criado_em: '2026-04-01' },
      ];
      expect(descricoesAnteriores(titulos)).toEqual(['B', 'A']);
    });

    it('categoria usada da última vez com o fornecedor', () => {
      const titulos = [
        { contraparte_id: 'c', categoria_id: 'velha', criado_em: '2026-01-01' },
        { contraparte_id: 'c', categoria_id: 'nova', criado_em: '2026-02-01' },
        { contraparte_id: 'x', categoria_id: 'outra', criado_em: '2026-03-01' },
      ];
      expect(categoriaDoFornecedor('c', titulos)).toBe('nova');
      expect(categoriaDoFornecedor('z', titulos)).toBeNull();
    });

    it('RN-04.04: sugere a assinatura pelo fornecedor e, se escolhida, pela categoria', async () => {
      const [ferramentas, assinaturas] = await Promise.all([repositorios.ferramenta.listar(), repositorios.assinatura_ferramenta.listar()]);
      const nuvem = ferramentas.find((ferramenta) => ferramenta.nome === 'Nuvem Clara Hosting')!;
      expect(assinaturaSugerida(nuvem.fornecedor_id as string, '', ferramentas, assinaturas)?.ferramenta.nome).toBe('Nuvem Clara Hosting');
      expect(assinaturaSugerida(nuvem.fornecedor_id as string, categoria('Hospedagem e nuvem'), ferramentas, assinaturas)?.ferramenta.nome).toBe('Nuvem Clara Hosting');
      expect(assinaturaSugerida(nuvem.fornecedor_id as string, categoria('Domínios'), ferramentas, assinaturas)).toBeNull();
      expect(assinaturaSugerida('', '', ferramentas, assinaturas)).toBeNull();
    });
  });

  describe('RN-04.03: títulos das assinaturas', () => {
    function paga(alteracoes: Partial<FormularioFerramenta> = {}): FormularioFerramenta {
      return {
        ...formularioFerramentaVazio(ID_KIMBERLY, ID_CONSOLIDADA, { tecnica: ID_CAMILA, financeira: ID_KIMBERLY }),
        nome: 'Paga com títulos',
        categoria_id: 'categoria',
        finalidade: 'Testar',
        contextos: [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI],
        modalidade: 'paga',
        plano: 'Pro',
        valor: '50,00',
        periodicidade: 'mensal',
        proxima_cobranca: '2026-11-20',
        renovacao: 'automatica',
        conta_financeira_id: ID_CONTA_KIMBERLY,
        categoria_financeira_id: categoria('IA'),
        ...alteracoes,
      };
    }
    const dela = async (id: string) => (await repositorios.titulo.listar({ onde: { ferramenta_id: id } })).sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    it('mensal: um previsto por cobrança, até 3 meses, com chave e dados da assinatura', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const titulos = await dela(ferramenta.id);
      expect(titulos.map((titulo) => titulo.vencimento)).toEqual(['2026-11-20', '2026-12-20', '2027-01-20']);
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } }))[0]!;
      expect(titulos[0]).toMatchObject({ situacao: 'previsto', origem: 'assinatura', valor: 50, responsavel_id: ID_KIMBERLY, categoria_id: categoria('IA'), chave_idempotencia: chaveDaCobranca(assinatura.id, '2026-11-20'), assinatura_id: assinatura.id, competencia: '2026-11-01', descricao: 'Paga com títulos · Pro' });
    });

    it('CA-04.03: gratuita não cria nenhum título', async () => {
      const ferramenta = await criarFerramenta(paga({ nome: 'De graça', modalidade: 'gratuita' }), HOJE);
      expect(await dela(ferramenta.id)).toEqual([]);
    });

    it('sem geração, sem valor ou sem categoria financeira, não cria', async () => {
      expect(await dela((await criarFerramenta(paga({ nome: 'Sem geração', gerar_titulos: false }), HOJE)).id)).toEqual([]);
      expect(await dela((await criarFerramenta(paga({ nome: 'Sem valor', valor: '' }), HOJE)).id)).toEqual([]);
    });

    it('CA-04.04: salvar duas vezes não duplica', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const linha = (await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } }));
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } }))[0]!;
      await salvarFerramenta(ferramenta.id, formularioDaFerramenta(ferramenta, linha, assinatura), { hoje: HOJE });
      await salvarFerramenta(ferramenta.id, formularioDaFerramenta(ferramenta, linha, assinatura), { hoje: HOJE });
      expect(await dela(ferramenta.id)).toHaveLength(3);
    });

    it('os exemplos também: estender a programação não duplica o que a carga trouxe', async () => {
      const antes = (await repositorios.titulo.listar()).filter((titulo) => titulo.origem === 'assinatura' && titulo.vencimento === '2026-11-10');
      await estenderProgramacao(HOJE);
      expect((await repositorios.titulo.listar()).filter((titulo) => titulo.origem === 'assinatura' && titulo.vencimento === '2026-11-10')).toHaveLength(antes.length);
    });

    it('RN-04.04: despesa lançada à mão para a mesma assinatura, até 3 dias, conta como a mesma cobrança', async () => {
      const ferramenta = await criarFerramenta(paga({ gerar_titulos: false }), HOJE);
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } }))[0]!;
      await criarDespesa(novaEmAberto({ vencimento: '2026-11-22', ferramenta_id: ferramenta.id, assinatura_id: assinatura.id }), ID_KIMBERLY, HOJE);
      const linha = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      await salvarFerramenta(ferramenta.id, { ...formularioDaFerramenta(ferramenta, linha, assinatura), gerar_titulos: true }, { hoje: HOJE });
      expect((await dela(ferramenta.id)).map((titulo) => titulo.vencimento)).toEqual(['2026-11-22', '2026-12-20', '2027-01-20']);
    });

    it('sem rateio, 100% no contexto principal; com rateio, o da ferramenta (RN-05.08)', async () => {
      const ferramenta = await criarFerramenta(paga({ periodicidade: 'anual' }), HOJE);
      const [titulo] = await dela(ferramenta.id);
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo!.id } })).map((linha) => [linha.produto_id, linha.percentual])).toEqual([[ID_PRODUTO_KIPI, 100]]);
      const nuvem = (await repositorios.ferramenta.listar()).find((item) => item.nome === 'Nuvem Clara Hosting')!;
      const previsto = (await repositorios.titulo.listar({ onde: { ferramenta_id: nuvem.id, situacao: 'previsto' } }))[0]!;
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: previsto.id } })).map((linha) => linha.percentual)).toEqual([60, 40]);
    });

    it('mudar a data refaz as previstas; a geração desligada cancela as futuras', async () => {
      const ferramenta = await criarFerramenta(paga({ periodicidade: 'anual' }), HOJE);
      const linha = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } }))[0]!;
      const formulario = formularioDaFerramenta(ferramenta, linha, assinatura);
      await salvarFerramenta(ferramenta.id, { ...formulario, proxima_cobranca: '2026-12-15' }, { hoje: HOJE });
      expect((await dela(ferramenta.id)).map((titulo) => [titulo.vencimento, titulo.situacao])).toEqual([
        ['2026-11-20', 'cancelado'],
        ['2026-12-15', 'previsto'],
      ]);
      await salvarFerramenta(ferramenta.id, { ...formulario, proxima_cobranca: '2026-12-15', gerar_titulos: false }, { hoje: HOJE });
      expect((await dela(ferramenta.id)).every((titulo) => titulo.situacao === 'cancelado')).toBe(true);
    });

    it('RN-04.17: o reajuste muda só os futuros sem pagamento, e o rateio acompanha', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const linha = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } }))[0]!;
      const [primeiro] = await dela(ferramenta.id);
      await registrarPagamento(primeiro!.id, pagamento({ valorMoeda: 50, valorBrl: 50, contaId: ID_CONTA_KIMBERLY }), HOJE);
      expect((await titulosAfetadosPeloReajuste(assinatura.id, HOJE)).map((titulo) => titulo.vencimento)).toEqual(['2026-12-20', '2027-01-20']);
      await salvarFerramenta(ferramenta.id, { ...formularioDaFerramenta(ferramenta, linha, assinatura), valor: '60,00' }, { motivoDoValor: 'Reajuste', hoje: HOJE });
      const titulos = await dela(ferramenta.id);
      expect(titulos.map((titulo) => titulo.valor)).toEqual([50, 60, 60]);
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulos[1]!.id } }))[0]?.valor).toBe(60);
    });

    it('RN-05.13: título ajustado à mão não muda com o reajuste', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const linha = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } }))[0]!;
      const titulos = await dela(ferramenta.id);
      await repositorios.titulo.atualizar(titulos[1]!.id, { ajustado_manualmente: true, valor: 77 });
      await salvarFerramenta(ferramenta.id, { ...formularioDaFerramenta(ferramenta, linha, assinatura), valor: '60,00' }, { motivoDoValor: 'Reajuste', hoje: HOJE });
      expect((await dela(ferramenta.id)).map((titulo) => titulo.valor)).toEqual([60, 77, 60]);
    });

    it('trocar de plano cancela as previstas do antigo e gera as do novo', async () => {
      const ferramenta = await criarFerramenta(paga({ periodicidade: 'anual' }), HOJE);
      const linha = await repositorios.ferramenta_contexto.listar({ onde: { ferramenta_id: ferramenta.id } });
      const assinatura = (await repositorios.assinatura_ferramenta.listar({ onde: { ferramenta_id: ferramenta.id } }))[0]!;
      await salvarFerramenta(ferramenta.id, { ...formularioDaFerramenta(ferramenta, linha, assinatura), plano: 'Max', valor: '90,00', proxima_cobranca: '2026-12-01' }, { trocarPlano: true, hoje: HOJE });
      expect((await dela(ferramenta.id)).map((titulo) => [titulo.valor, titulo.situacao])).toEqual([
        [50, 'cancelado'],
        [90, 'previsto'],
      ]);
    });

    it('RN-04.10: cancelar a ferramenta cancela os futuros não pagos, e mostra antes quais', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const [primeiro] = await dela(ferramenta.id);
      await registrarPagamento(primeiro!.id, pagamento({ valorMoeda: 50, valorBrl: 50 }), HOJE);
      expect((await titulosFuturosDaFerramenta(ferramenta.id, '2026-12-01')).map((titulo) => titulo.vencimento)).toEqual(['2026-12-20', '2027-01-20']);
      await cancelarFerramenta(ferramenta.id, { data: '2026-12-01', motivo: 'Não usamos' });
      const titulos = await dela(ferramenta.id);
      expect(titulos.map((titulo) => titulo.situacao)).toEqual(['quitado', 'cancelado', 'cancelado']);
      expect(titulos[1]?.cancelado_motivo).toContain('Não usamos');
    });
  });

  describe('rotinas do dia', () => {
    it('previsto que chegou no vencimento passa a em aberto', async () => {
      const antes = (await repositorios.titulo.listar({ onde: { situacao: 'previsto' } }));
      const primeiro = antes.sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0]!;
      expect(await atualizarSituacoesDosTitulos(primeiro.vencimento)).toBe(1);
      expect((await repositorios.titulo.obter(primeiro.id))?.situacao).toBe('aberto');
    });

    it('"Rodar rotinas" faz isso, sem repetir', async () => {
      const primeiro = (await repositorios.titulo.listar({ onde: { situacao: 'previsto' } }))[0]!;
      await repositorios.titulo.atualizar(primeiro.id, { vencimento: '2026-11-01' });
      await executarRotinas({ manual: true });
      expect((await repositorios.titulo.obter(primeiro.id))?.situacao).toBe('aberto');
    });

    it('quem abre depois do dia 1 não perde a extensão da programação', async () => {
      gravarMeta({ ultima_rotina_em: '2026-10-20T12:00:00.000Z' });
      const ferramenta = await criarFerramenta({ ...formularioFerramentaVazio(ID_KIMBERLY, ID_CONSOLIDADA, { tecnica: ID_CAMILA, financeira: ID_KIMBERLY }), nome: 'Sem títulos ainda', categoria_id: 'c', finalidade: 'x', contextos: [ID_INSTITUCIONAL], modalidade: 'paga', plano: 'Pro', valor: '10,00', periodicidade: 'mensal', proxima_cobranca: '2026-11-20', renovacao: 'automatica', conta_financeira_id: ID_CONTA_KIMBERLY, categoria_financeira_id: categoria('IA') }, HOJE);
      armazenamento.setItem(chaveDaTabela('titulo'), JSON.stringify((await repositorios.titulo.listar()).filter((titulo) => titulo.ferramenta_id !== ferramenta.id)));
      await executarRotinas();
      expect(await repositorios.titulo.listar({ onde: { ferramenta_id: ferramenta.id } })).toHaveLength(3);
    });
  });

  describe('T05.01: lista', () => {
    it('vencidos primeiro, do mais antigo; depois a vencer, do mais próximo; e o que encerrou, do mais recente', async () => {
      const linhas = await filtrar();
      expect(linhas).toHaveLength(TITULOS_INICIAIS);
      const grupos = linhas.map((titulo) => (titulo.vencido ? 0 : titulo.situacao === 'quitado' || titulo.situacao === 'cancelado' ? 2 : 1));
      expect(grupos).toEqual([...grupos].sort((a, b) => a - b));
      const doGrupo = (grupo: number) => linhas.filter((_, indice) => grupos[indice] === grupo).map((titulo) => titulo.vencimento);
      expect(doGrupo(0)).toEqual([...doGrupo(0)].sort((a, b) => a.localeCompare(b)));
      expect(doGrupo(1)).toEqual([...doGrupo(1)].sort((a, b) => a.localeCompare(b)));
      expect(doGrupo(2)).toEqual([...doGrupo(2)].sort((a, b) => b.localeCompare(a)));
    });

    it('situação: as gravadas, mais Vencidos e Com saldo a pagar, que são derivadas', async () => {
      expect((await filtrar({ situacao: 'vencido' })).map((titulo) => titulo.descricao)).toEqual(['Certificado digital', 'Honorários de contabilidade']);
      // O parcial vencido aparece nos dois recortes: "vencido" é condição, não situação.
      expect((await filtrar({ situacao: 'parcial' })).map((titulo) => titulo.descricao)).toEqual(['Honorários de contabilidade']);
      expect((await filtrar({ situacao: 'parcial' }))[0]?.vencido).toBe(true);
      const comSaldo = await filtrar({ situacao: 'com_saldo' });
      expect(comSaldo.some((titulo) => titulo.situacao === 'quitado' || titulo.situacao === 'cancelado')).toBe(false);
      expect(comSaldo.some((titulo) => titulo.situacao === 'previsto')).toBe(true);
    });

    it('sem comprovante, reembolsos, responsável e vencimento ficam em "Mais filtros"', async () => {
      expect((await filtrar({ semComprovante: true })).map((titulo) => titulo.descricao)).toEqual(['Taxa de cartório']);
      expect((await filtrar({ reembolsos: true })).map((titulo) => titulo.origem)).toEqual(['reembolso']);
      expect((await filtrar({ responsavel: ID_CAMILA })).map((titulo) => titulo.descricao)).toEqual(['Taxa de cartório']);
      const proximos = await filtrar({ vencimentoDe: HOJE, vencimentoAte: '2026-12-06' });
      expect(proximos.length).toBeGreaterThan(0);
      expect(proximos.every((titulo) => titulo.vencimento >= HOJE && titulo.vencimento <= '2026-12-06')).toBe(true);
    });

    it('o botão conta só o que está dentro de "Mais filtros", e o intervalo de vencimento vale por um', () => {
      expect(quantosMaisFiltros(FILTROS_LANCAMENTOS_INICIAIS)).toBe(0);
      expect(quantosMaisFiltros({ ...FILTROS_LANCAMENTOS_INICIAIS, busca: 'x', competencia: '2026-11', situacao: 'vencido' })).toBe(0);
      expect(quantosMaisFiltros({ ...FILTROS_LANCAMENTOS_INICIAIS, vencimentoDe: HOJE, vencimentoAte: HOJE, moeda: 'USD', semComprovante: true })).toBe(3);
    });

    it('filtra pelo contexto global, sem refinamento próprio da tela', async () => {
      const zupi = await filtrar({}, ID_PRODUTO_ZUPI);
      expect(zupi.length).toBeGreaterThan(0);
      expect(zupi.every((titulo) => titulo.rateio.some((linha) => linha.produto_id === ID_PRODUTO_ZUPI))).toBe(true);
      expect((await filtrar({}, ID_INSTITUCIONAL)).every((titulo) => titulo.rateio.some((linha) => linha.produto_id === null))).toBe(true);
    });

    it('as competências vêm dos lançamentos, da mais recente para a mais antiga', async () => {
      const { titulos } = await carregarLancamentos(HOJE);
      const competencias = competenciasDosTitulos(titulos);
      expect(competencias).toEqual([...competencias].sort((a, b) => b.localeCompare(a)));
      expect(new Set(competencias).size).toBe(competencias.length);
      expect(rotuloDoMes('2026-11')).toBe('Novembro de 2026');
      expect(competenciasDosTitulos([{ competencia: '2026-01-01', arquivado_em: '2026-02-01T00:00:00Z' }])).toEqual([]);
    });

    it('filtra por situação, período, competência, categoria, conta, origem e moeda', async () => {
      expect((await filtrar({ situacao: 'cancelado' })).map((titulo) => titulo.descricao)).toEqual(['Brindes do evento']);
      expect((await filtrar({ vencimentoDe: '2026-11-01', vencimentoAte: '2026-11-06' })).every((titulo) => titulo.vencimento >= '2026-11-01' && titulo.vencimento <= '2026-11-06')).toBe(true);
      expect((await filtrar({ competencia: '2026-08' })).map((titulo) => titulo.descricao)).toEqual(['Taxa de cartório']);
      expect((await filtrar({ categoria: categoria('Contabilidade') })).map((titulo) => titulo.descricao)).toEqual(['Honorários de contabilidade']);
      expect((await filtrar({ conta: ID_CONTA_CAMILA })).map((titulo) => titulo.descricao).sort()).toEqual(['Nuvem Clara Hosting · Pro', 'Taxa de cartório']);
      expect((await filtrar({ origem: 'assinatura' })).length).toBe(3);
      expect((await filtrar({ moeda: 'USD' })).length).toBe(2);
    });

    it('busca por código e descrição, sem acento', async () => {
      expect((await filtrar({ busca: 'honorarios' })).length).toBe(1);
      const achado = (await filtrar({ busca: 'cartorio' }))[0]!;
      expect((await filtrar({ busca: achado.codigo })).map((titulo) => titulo.descricao)).toEqual(['Taxa de cartório']);
    });
  });

  describe('T05.01: totais', () => {
    const dados = () => carregarLancamentos(HOJE);

    it('em aberto soma o saldo confirmado, e vencido é parte dele', async () => {
      const { titulos, cambios } = await dados();
      const totais = totaisDosLancamentos(titulos, cambios, { de: '2026-11-01', ate: HOJE });
      // Decisão de 07/11/2026: os previstos (R$ 209,90 e US$ 20) ficam à parte; 1.151,95 − 209,90 = 942,05.
      expect(totais.emAbertoPagar).toBe(942.05);
      expect(totais.vencido).toBe(380);
      expect(totais.naoIncluidos).toBe(0);
      expect(totais.estimado).toBe(false);
    });

    it('com câmbio, entra como estimado', async () => {
      const { titulos } = await dados();
      const totais = totaisDosLancamentos(titulos, [{ moeda: 'USD', valor_brl: 5, data_referencia: '2026-11-01' }], { de: '2026-11-01', ate: HOJE });
      expect(totais.emAbertoPagar).toBe(942.05);
      expect(totais.previsto).toBe(309.9);
      expect(totais.estimado).toBe(true);
      expect(totais.naoIncluidos).toBe(0);
    });

    it('pago no período soma as baixas em reais e desconta estornos', async () => {
      const { titulos, cambios } = await dados();
      // Em outubro: Traço Editor 89,90, os 100 dos honorários, e o anúncio de 150 pago e estornado.
      expect(totaisDosLancamentos(titulos, cambios, { de: '2026-10-01', ate: '2026-10-31' }).pagoNoPeriodo).toBe(189.9);
      const estorno = totaisDosLancamentos(titulos.filter((titulo) => titulo.descricao.startsWith('Anúncio')), cambios, { de: '2026-01-01', ate: HOJE });
      expect(estorno.pagoNoPeriodo).toBe(0);
    });

    it('previstos ficam à parte do em aberto: ainda não são obrigação confirmada', async () => {
      const { titulos, cambios } = await dados();
      const totais = totaisDosLancamentos(titulos, cambios, { de: '2026-11-01', ate: HOJE });
      expect(totais.previsto).toBe(209.9);
      expect(totais.emAbertoPagar).toBe(942.05);
      expect(totais.quantos).toBe(TITULOS_INICIAIS);
    });

    it('moeda sem câmbio fica de fora com o valor à vista, nunca somada aos reais', async () => {
      const { titulos, cambios } = await dados();
      const totais = totaisDosLancamentos(titulos, cambios, { de: '2026-11-01', ate: HOJE });
      // O único título em USD sem câmbio é previsto: aparece no cartão Previstos, não no em aberto.
      expect(totais.semConversao).toEqual([]);
      expect(totais.previstoSemConversao).toEqual([{ moeda: 'USD', valor: 20 }]);
      expect(totais.vencidoSemConversao).toEqual([]);
      expect(totais.estimados).toEqual([]);
      const comCambio = totaisDosLancamentos(titulos, [{ moeda: 'USD', valor_brl: 5, data_referencia: '2026-11-01' }], { de: '2026-11-01', ate: HOJE });
      expect(comCambio.semConversao).toEqual([]);
      expect(comCambio.estimados).toEqual([]);
      expect(comCambio.previstoEstimados).toEqual([{ moeda: 'USD', valor: 20 }]);
      expect(comCambio.previsto).toBe(309.9);
    });

    it('moedas diferentes sem câmbio ficam separadas, e o vencido sem câmbio também aparece', () => {
      const linha = (moeda: string, saldo: number, vencido: boolean) => ({ natureza: 'pagar', situacao: 'aberto', moeda, saldo, vencido, baixas: [], rateio: [] }) as unknown as LinhaDoTitulo;
      const totais = totaisDosLancamentos([linha('USD', 20, true), linha('EUR', 5, false), linha('USD', 1.5, false), linha('BRL', 100, true)], [], { de: '2026-11-01', ate: HOJE });
      expect(totais.emAbertoPagar).toBe(100);
      expect(totais.vencido).toBe(100);
      expect(totais.semConversao).toEqual([{ moeda: 'USD', valor: 21.5 }, { moeda: 'EUR', valor: 5 }]);
      expect(totais.vencidoSemConversao).toEqual([{ moeda: 'USD', valor: 20 }]);
    });

    it('o pago já é o valor efetivo em reais, mesmo em título de outra moeda', async () => {
      const { titulos, cambios } = await dados();
      const nuvem = titulos.filter((titulo) => titulo.descricao === 'Nuvem Clara Hosting · Pro' && titulo.situacao === 'quitado');
      expect(totaisDosLancamentos(nuvem, cambios, { de: '2026-01-01', ate: HOJE }).pagoNoPeriodo).toBe(112.05);
    });

    it('o pago é pela data da baixa: sem "Data do pagamento", é o mês corrente; o vencimento não muda o período', () => {
      expect(periodoDosTotais({ pagamentoDe: '', pagamentoAte: '' }, HOJE)).toEqual({ de: '2026-11-01', ate: HOJE, doMes: true });
      const comVencimento = { ...FILTROS_LANCAMENTOS_INICIAIS, vencimentoDe: '2026-01-01' };
      expect(periodoDosTotais(comVencimento, HOJE).doMes).toBe(true);
      expect(periodoDosTotais({ pagamentoDe: '2026-10-01', pagamentoAte: '' }, HOJE)).toEqual({ de: '2026-10-01', ate: '9999-12-31', doMes: false });
    });

    it('títulos da competência: o que foi pago deles, em qualquer data', async () => {
      const { titulos, cambios } = await dados();
      const novembro = titulos.filter((titulo) => titulo.competencia.startsWith('2026-11'));
      const totais = totaisDosLancamentos(novembro, cambios, { de: '2026-11-01', ate: HOJE });
      const esperado = novembro.filter((titulo) => titulo.origem !== 'reembolso').flatMap((titulo) => titulo.baixas).filter((baixa) => !baixa.arquivado_em).reduce((soma, baixa) => soma + (baixa.tipo === 'estorno' ? -baixa.valor_brl : baixa.valor_brl), 0);
      expect(totais.pagoDosTitulos).toBeCloseTo(esperado);
      // Os honorários foram pagos em parte (R$ 100) antes do mês corrente: não entram no "Pago em novembro", mas contam como pago do título.
      const honorarios = titulos.filter((titulo) => titulo.descricao === 'Honorários de contabilidade');
      expect(honorarios[0]!.baixas[0]!.data < '2026-11-01').toBe(true);
      expect(totaisDosLancamentos(honorarios, cambios, { de: '2026-11-01', ate: HOJE })).toMatchObject({ pagoNoPeriodo: 0, pagoDosTitulos: 100 });
    });

    it('RN-05.07: o pagamento do reembolso à sócia fica fora do pago e aparece à parte', async () => {
      const { titulos, cambios } = await dados();
      const reembolsos = titulos.filter((titulo) => titulo.origem === 'reembolso');
      expect(reembolsos.length).toBeGreaterThan(0);
      const pagoDoReembolso = reembolsos.flatMap((titulo) => titulo.baixas).filter((baixa) => !baixa.arquivado_em).reduce((soma, baixa) => soma + (baixa.tipo === 'estorno' ? -baixa.valor_brl : baixa.valor_brl), 0);
      const totais = totaisDosLancamentos(reembolsos, cambios, { de: '0000-01-01', ate: '9999-12-31' });
      expect(totais.pagoNoPeriodo).toBe(0);
      expect(totais.pagoDosTitulos).toBe(0);
      expect(totais.reembolsosNoPeriodo).toBeCloseTo(pagoDoReembolso);
    });

    it('RN-05.09: com um produto no contexto, o rateado conta pela parte do produto', () => {
      const rateio = [
        { produto_id: ID_PRODUTO_ZUPI, percentual: 25 },
        { produto_id: null, percentual: 75 },
      ];
      const linha = { natureza: 'pagar', situacao: 'aberto', moeda: 'BRL', saldo: 400, vencido: false, origem: 'manual', rateio, baixas: [{ tipo: 'pagamento', valor_brl: 200, data: '2026-11-02', arquivado_em: null }] } as unknown as LinhaDoTitulo;
      expect(parteDoContexto(linha, ID_PRODUTO_ZUPI)).toBe(0.25);
      expect(parteDoContexto(linha, ID_INSTITUCIONAL)).toBe(0.75);
      expect(parteDoContexto(linha, ID_CONSOLIDADA)).toBe(1);
      expect(parteDoContexto({ rateio: [] }, ID_PRODUTO_ZUPI)).toBe(1);
      expect(totaisDosLancamentos([linha], [], { de: '2026-11-01', ate: HOJE }, ID_PRODUTO_ZUPI)).toMatchObject({ emAbertoPagar: 100, pagoNoPeriodo: 50 });
      expect(totaisDosLancamentos([linha], [], { de: '2026-11-01', ate: HOJE })).toMatchObject({ emAbertoPagar: 400, pagoNoPeriodo: 200 });
    });

    it('"Pago de/até" recorta a lista pela data da baixa e conta em "Mais filtros"', async () => {
      const { titulos } = await dados();
      const outubro = filtrarTitulos(titulos, { ...FILTROS_LANCAMENTOS_INICIAIS, pagamentoDe: '2026-10-01', pagamentoAte: '2026-10-31' }, { contextoGlobalId: ID_CONSOLIDADA, hoje: HOJE, nomeDaContraparte: () => '' });
      expect(outubro.length).toBeGreaterThan(0);
      expect(outubro.every((titulo) => titulo.baixas.some((baixa) => baixa.tipo === 'pagamento' && baixa.data >= '2026-10-01' && baixa.data <= '2026-10-31'))).toBe(true);
      expect(quantosMaisFiltros({ ...FILTROS_LANCAMENTOS_INICIAIS, pagamentoDe: '2026-10-01', pagamentoAte: '2026-10-31' })).toBe(1);
    });
  });

  describe('T05.01: valor, pagamentos e comprovante', () => {
    const achar = async (descricao: string) => (await carregarLancamentos(HOJE)).titulos.find((titulo) => titulo.descricao === descricao) as LinhaDoTitulo;

    it('parcial: valor original, pagamentos e saldo são três números, e o título também está vencido', async () => {
      const titulo = await achar('Honorários de contabilidade');
      expect([titulo.valor, pagoDoTitulo(titulo), titulo.saldo]).toEqual([300, 100, 200]);
      expect(titulo.situacao).toBe('parcial');
      expect(titulo.vencido).toBe(true);
    });

    it('pagamento estornado não conta como pago nem como comprovado', async () => {
      const titulo = await achar('Anúncio de lançamento do Zupi');
      expect(pagoDoTitulo(titulo)).toBe(0);
      expect(titulo.saldo).toBe(150);
      expect(comprovanteDoTitulo(titulo).estado).toBe('nao_se_aplica');
    });

    it('D17: anexado, exceção com o motivo, ou pendente', async () => {
      expect(comprovanteDoTitulo(await achar('Taxa de cartório'))).toEqual({ estado: 'excecao', motivo: 'Pago em dinheiro, sem recibo.' });
      expect(comprovanteDoTitulo(await achar('Certificado digital')).estado).toBe('nao_se_aplica');
      const honorarios = await achar('Honorários de contabilidade');
      expect(comprovanteDoTitulo(honorarios).estado).toBe('anexado');
      const semNada = { baixas: [{ ...honorarios.baixas[0], comprovante_url: null, sem_comprovante_motivo: null }] } as Pick<LinhaDoTitulo, 'baixas'>;
      expect(comprovanteDoTitulo(semNada).estado).toBe('pendente');
    });
  });

  describe('vínculos nos outros cadastros', () => {
    it('conta com pagamentos não arquiva: encerra', async () => {
      const conta = await repositorios.conta_financeira.criar({ nome: 'Conta com baixa', tipo: 'caixa', titular_entidade_id: ID_ENTIDADE_PLANEJADA, titular_pessoa_id: null, instituicao: null, final_numero: null, moeda: 'BRL', saldo_inicial: null, data_saldo_inicial: null, situacao: 'ativa' });
      await criarDespesa(novaDespesa({ conta_id: conta.id, tratamento: '' }), ID_KIMBERLY, HOJE);
      await expect(arquivarConta(conta.id)).rejects.toThrow('encerre a conta');
    });

    it('quem responde por lançamento em aberto não sai sem passar a responsabilidade', async () => {
      expect((await vinculosDaPessoa(ID_KIMBERLY)).join(' ')).toContain('lançamentos em aberto');
    });
  });

  describe('Limpar exemplos', () => {
    it('leva os lançamentos fictícios, com rateios, baixas e movimentos', async () => {
      await limparExemplos();
      expect(await repositorios.titulo.listar({ incluirArquivados: true })).toEqual([]);
      expect(await repositorios.titulo_rateio.listar({ incluirArquivados: true })).toEqual([]);
      expect(await repositorios.baixa.listar({ incluirArquivados: true })).toEqual([]);
      expect(await repositorios.movimento_societario.listar({ incluirArquivados: true })).toEqual([]);
    });

    it('lançamento de verdade fica, e a conta de exemplo que pagou também, sem a marca', async () => {
      const titulo = await criarDespesa(novaDespesa(), ID_KIMBERLY, HOJE);
      await limparExemplos();
      expect(await repositorios.titulo.obter(titulo.id)).toMatchObject({ situacao: 'quitado' });
      expect(await repositorios.baixa.listar({ onde: { titulo_id: titulo.id } })).toHaveLength(1);
      expect(await repositorios.conta_financeira.obter(ID_CONTA_KIMBERLY)).toMatchObject({ exemplo: false });
      expect(await repositorios.conta_financeira.obter(ID_CONTA_CAMILA)).toBeNull();
    });
  });
});
