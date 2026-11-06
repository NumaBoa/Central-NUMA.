import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { CATEGORIAS_INICIAIS, ID_CONTA_CAMILA, ID_CONTA_KIMBERLY, ID_ENTIDADE_PLANEJADA, ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Baixa } from '@/dados/tipos/titulo';
import {
  alterarTratamento,
  cancelarTitulo,
  carregarFichaDoTitulo,
  confirmarTitulo,
  criarEsquemaBaixa,
  edicaoPedeMotivo,
  editarRateioDoTitulo,
  erroDoLote,
  estornarBaixa,
  formularioBaixaVazio,
  formularioDoTitulo,
  pagamentosEstornaveis,
  registrarBaixa,
  registrarBaixaEmLote,
  salvarTitulo,
  sugestaoEmReais,
  type FormularioBaixa,
} from './baixas';
import { buscarNaCentral } from './busca';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { historicoDoTitulo } from './historico';
import { criarDespesa, estenderProgramacao, formularioDespesaVazio, formularioParaDuplicar, registrarPagamento, type DadosDoPagamento, type FormularioDespesa } from './titulos';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const categoria = (nome: string) => CATEGORIAS_INICIAIS.find((item) => item.nome === nome)!.id;

function despesa(alteracoes: Partial<FormularioDespesa> = {}): FormularioDespesa {
  return { ...formularioDespesaVazio(ID_CONSOLIDADA, 'BRL', HOJE), descricao: 'Despesa de teste', valor: '100,00', categoria_id: categoria('IA'), contextos: [ID_INSTITUCIONAL], pago: false, vencimento: '2026-12-10', ...alteracoes };
}
const emAberto = () => criarDespesa(despesa(), ID_KIMBERLY, HOJE);
const pagamento = (alteracoes: Partial<DadosDoPagamento> = {}): DadosDoPagamento => ({ data: HOJE, contaId: ID_CONTA_KIMBERLY, valorMoeda: 100, cambio: null, iofBrl: null, valorBrl: 100, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null, pagoAMais: false, motivo: null, ...alteracoes });
const baixasDe = (id: string) => repositorios.baixa.listar({ onde: { titulo_id: id } });

function formulario(alteracoes: Partial<FormularioBaixa> = {}): FormularioBaixa {
  return { ...formularioBaixaVazio({ moeda: 'BRL' }, 100, HOJE), conta_id: ID_CONTA_KIMBERLY, tratamento: 'aporte', comprovante_url: DRIVE, ...alteracoes };
}

const CONTAS = [
  { id: ID_CONTA_KIMBERLY, tipo: 'pessoal_socia' as const },
  { id: 'banco', tipo: 'banco' as const },
];
const problemas = (dados: FormularioBaixa, titulo: { moeda: string; origem: 'manual' | 'reembolso' } = { moeda: 'BRL', origem: 'manual' }, saldo = 100) => {
  const resultado = criarEsquemaBaixa(titulo, saldo, CONTAS, HOJE).safeParse(dados);
  return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join('.'), problema.message]));
};

describe('T05.03 e T05.04: baixas e ficha do título', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('T05.04: formulário', () => {
    it('o saldo já vem como valor, e a data é hoje', () => {
      expect(formularioBaixaVazio({ moeda: 'BRL' }, 40, HOJE)).toMatchObject({ valor: '40,00', valor_brl: '40,00', data: HOJE });
    });

    it('pagamento com o básico passa', () => {
      expect(problemas(formulario())).toEqual({});
    });

    it('data não futura, conta, valor e comprovante', () => {
      const erros = problemas(formulario({ data: '2026-11-07', conta_id: '', valor: '', comprovante_url: '' }));
      expect(erros).toMatchObject({ data: 'A data não pode ser futura.', conta_id: 'Escolha a conta.', valor: 'Informe o valor, como 0,00.', comprovante_url: 'Cole o link do comprovante, ou marque que não tem.' });
    });

    it('RN-05.03: mais que o saldo só marcando "valor pago maior"', () => {
      expect(problemas(formulario({ valor: '120,00' })).valor).toContain('É mais que o saldo');
      expect(problemas(formulario({ valor: '120,00', pago_a_mais: true }))).toEqual({});
    });

    it('moeda estrangeira pede câmbio e valor em reais', () => {
      const erros = problemas(formulario({ valor_brl: '' }), { moeda: 'USD', origem: 'manual' });
      expect(erros).toMatchObject({ cambio: 'Informe o câmbio pago.', valor_brl: 'Informe o valor efetivo em reais.' });
    });

    it('RN-05.06: conta de sócia pede o tratamento; o reembolso é pago pela empresa', () => {
      expect(problemas(formulario({ tratamento: '' })).tratamento).toBe('Conta de sócia: escolha entre aporte e reembolso.');
      expect(problemas(formulario({ tratamento: 'reembolso' })).vencimento_reembolso).toBe('Informe quando a Numa vai reembolsar.');
      expect(problemas(formulario({ tratamento: '' }), { moeda: 'BRL', origem: 'reembolso' }).conta_id).toContain('conta da empresa');
      expect(problemas(formulario({ conta_id: 'banco', tratamento: '' }))).toEqual({});
    });

    it('estorno pede o pagamento e o motivo, e nada mais', () => {
      expect(problemas(formulario({ tipo: 'estorno', conta_id: '', valor: '', comprovante_url: '' }))).toEqual({ baixa_original_id: 'Escolha o pagamento a estornar.', motivo: 'Diga por que está estornando.' });
    });

    it('ajuste pede o motivo, e pode passar do saldo', () => {
      expect(problemas(formulario({ tipo: 'ajuste', valor: '500,00' })).motivo).toBe('Diga do que é o ajuste.');
      expect(problemas(formulario({ tipo: 'ajuste', valor: '500,00', motivo: 'Multa' }))).toEqual({});
    });

    it('RN-05.05: sugere o valor em reais', () => {
      expect(sugestaoEmReais({ valor: '20,00', cambio: '5,40', iof: '4,05' })).toBe('112,05');
      expect(sugestaoEmReais({ valor: '20,00', cambio: '', iof: '' })).toBeNull();
      // RT-07: câmbio tem até 6 casas.
      expect(sugestaoEmReais({ valor: '20,00', cambio: '5,4321', iof: '' })).toBe('108,64');
      expect(problemas(formulario({ valor_brl: '108,64', cambio: '5,4321' }), { moeda: 'USD', origem: 'manual' })).not.toHaveProperty('cambio');
      expect(problemas(formulario({ valor_brl: '108,64', cambio: '5,4321000' }), { moeda: 'USD', origem: 'manual' })).toHaveProperty('cambio');
    });
  });

  describe('CA-05.03: parcial e estorno', () => {
    it('R$ 60 de R$ 100: saldo R$ 40 e parcial; estornar volta a R$ 100, com as duas baixas', async () => {
      const titulo = await emAberto();
      await registrarBaixa(titulo, formulario({ valor: '60,00' }), HOJE);
      let ficha = (await carregarFichaDoTitulo(titulo.id, HOJE))!;
      expect(ficha.titulo).toMatchObject({ saldo: 40, situacao: 'parcial' });
      const [pago] = await baixasDe(titulo.id);
      await registrarBaixa(titulo, formulario({ tipo: 'estorno', baixa_original_id: pago!.id, motivo: 'Pago errado' }), HOJE);
      ficha = (await carregarFichaDoTitulo(titulo.id, HOJE))!;
      expect(ficha.titulo).toMatchObject({ saldo: 100, situacao: 'aberto' });
      expect((await baixasDe(titulo.id)).map((baixa) => baixa.tipo)).toEqual(['pagamento', 'estorno']);
      const [, estorno] = await baixasDe(titulo.id);
      expect(estorno).toMatchObject({ baixa_original_id: pago!.id, valor_moeda: 60, motivo: 'Pago errado', data: HOJE });
    });

    it('não estorna duas vezes, nem sem motivo', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento(), HOJE);
      await expect(estornarBaixa(baixa.id, ' ', HOJE)).rejects.toThrow('Diga por que');
      await estornarBaixa(baixa.id, 'Errado', HOJE);
      await expect(estornarBaixa(baixa.id, 'De novo', HOJE)).rejects.toThrow('já foi estornado');
    });

    it('só oferece estornar o que ainda não foi estornado', async () => {
      const titulo = await emAberto();
      const primeira = await registrarPagamento(titulo.id, pagamento({ valorMoeda: 30, valorBrl: 30 }), HOJE);
      const segunda = await registrarPagamento(titulo.id, pagamento({ valorMoeda: 20, valorBrl: 20 }), HOJE);
      await estornarBaixa(primeira.id, 'Errado', HOJE);
      expect(pagamentosEstornaveis(await baixasDe(titulo.id)).map((baixa: Baixa) => baixa.id)).toEqual([segunda.id]);
    });
  });

  describe('o que nasce da baixa', () => {
    it('estornar um aporte desfaz o aporte', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento(), HOJE);
      expect(await repositorios.movimento_societario.obter(baixa.movimento_societario_id as string)).toMatchObject({ arquivado_em: null });
      await estornarBaixa(baixa.id, 'Errado', HOJE);
      expect((await repositorios.movimento_societario.obter(baixa.movimento_societario_id as string))?.arquivado_em).not.toBeNull();
    });

    it('estornar um reembolso em aberto cancela o reembolso', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento({ tratamento: 'reembolso', vencimentoReembolso: '2026-12-01' }), HOJE);
      await estornarBaixa(baixa.id, 'Errado', HOJE);
      expect(await repositorios.titulo.obter(baixa.titulo_reembolso_id as string)).toMatchObject({ situacao: 'cancelado', cancelado_motivo: 'Errado' });
    });

    it('reembolso já pago segura o estorno da despesa', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento({ tratamento: 'reembolso', vencimentoReembolso: '2026-12-01' }), HOJE);
      const banco = await repositorios.conta_financeira.criar({ nome: 'Banco', tipo: 'banco', titular_entidade_id: ID_ENTIDADE_PLANEJADA, titular_pessoa_id: null, instituicao: null, final_numero: null, moeda: 'BRL', saldo_inicial: null, data_saldo_inicial: null, situacao: 'ativa' });
      await registrarPagamento(baixa.titulo_reembolso_id as string, pagamento({ contaId: banco.id, tratamento: null }), HOJE);
      await expect(estornarBaixa(baixa.id, 'Errado', HOJE)).rejects.toThrow('O reembolso já foi pago');
    });

    it('RN-05.06: de aporte para reembolso, desfaz um e cria o outro', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento(), HOJE);
      await alterarTratamento(baixa.id, 'reembolso', '2026-12-05', 'Combinamos reembolsar');
      const depois = (await repositorios.baixa.obter(baixa.id))!;
      expect(depois).toMatchObject({ tratamento: 'reembolso', movimento_societario_id: null });
      expect((await repositorios.movimento_societario.obter(baixa.movimento_societario_id as string))?.arquivado_em).not.toBeNull();
      expect(await repositorios.titulo.obter(depois.titulo_reembolso_id as string)).toMatchObject({ situacao: 'aberto', valor: 100, vencimento: '2026-12-05', origem_id: titulo.id });
    });

    it('RN-05.06: de reembolso para aporte, cancela o título e cria o aporte', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento({ tratamento: 'reembolso', vencimentoReembolso: '2026-12-01' }), HOJE);
      await alterarTratamento(baixa.id, 'aporte', null, 'Virou aporte');
      const depois = (await repositorios.baixa.obter(baixa.id))!;
      expect(depois).toMatchObject({ tratamento: 'aporte', titulo_reembolso_id: null });
      expect((await repositorios.titulo.obter(baixa.titulo_reembolso_id as string))?.situacao).toBe('cancelado');
      expect(await repositorios.movimento_societario.obter(depois.movimento_societario_id as string)).toMatchObject({ tipo: 'aporte', valor_brl: 100 });
    });

    it('alterar pede motivo, e o reembolso pede o vencimento', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento(), HOJE);
      await expect(alterarTratamento(baixa.id, 'reembolso', '2026-12-05', ' ')).rejects.toThrow('Diga por que');
      await expect(alterarTratamento(baixa.id, 'reembolso', null, 'Motivo')).rejects.toThrow('Informe o vencimento do reembolso.');
    });

    it('estornar um pagamento a mais leva o ajuste junto', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento({ valorMoeda: 110, valorBrl: 110, pagoAMais: true }), HOJE);
      await estornarBaixa(baixa.id, 'Errado', HOJE);
      expect((await baixasDe(titulo.id)).map((item) => item.tipo).sort()).toEqual(['estorno', 'pagamento']);
    });
  });

  describe('ajuste', () => {
    it('sai do caixa e não mexe no saldo', async () => {
      const titulo = await emAberto();
      await registrarBaixa(titulo, formulario({ tipo: 'ajuste', valor: '5,00', motivo: 'Tarifa' }), HOJE);
      expect((await carregarFichaDoTitulo(titulo.id, HOJE))!.titulo).toMatchObject({ saldo: 100, situacao: 'aberto' });
      expect((await baixasDe(titulo.id))[0]).toMatchObject({ tipo: 'ajuste', valor_brl: 5, motivo: 'Tarifa' });
    });
  });

  describe('baixa em lote', () => {
    it('registra o saldo de cada um, com a mesma conta e data', async () => {
      const uma = await emAberto();
      const outra = await criarDespesa(despesa({ valor: '40,00' }), ID_KIMBERLY, HOJE);
      await registrarPagamento(uma.id, pagamento({ valorMoeda: 30, valorBrl: 30 }), HOJE);
      await registrarBaixaEmLote([uma.id, outra.id], { data: HOJE, contaId: ID_CONTA_KIMBERLY, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null }, HOJE);
      expect((await repositorios.titulo.obter(uma.id))?.situacao).toBe('quitado');
      expect((await repositorios.titulo.obter(outra.id))?.situacao).toBe('quitado');
      expect((await baixasDe(uma.id)).map((baixa) => baixa.valor_moeda)).toEqual([30, 70]);
    });

    it('ou todos, ou nenhum', async () => {
      const uma = await emAberto();
      await expect(registrarBaixaEmLote([uma.id], { data: '2026-11-07', contaId: ID_CONTA_KIMBERLY, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null }, HOJE)).rejects.toThrow('não pode ser futura');
      expect(await baixasDe(uma.id)).toEqual([]);
    });

    it('diz por que não dá', () => {
      const ok = { moeda: 'BRL', saldo: 10, situacao: 'aberto' as const, origem: 'manual' as const };
      expect(erroDoLote([], false)).toBe('Selecione ao menos um título.');
      expect(erroDoLote([{ ...ok, moeda: 'USD' }], false)).toContain('cada baixa tem o próprio câmbio');
      expect(erroDoLote([{ ...ok, saldo: 0 }], false)).toContain('sem saldo');
      expect(erroDoLote([{ ...ok, origem: 'reembolso' }], true)).toContain('conta da empresa');
      expect(erroDoLote([ok], false)).toBeNull();
    });
  });

  describe('T05.03: editar', () => {
    it('lê de volta o que está salvo, e grava', async () => {
      const titulo = await emAberto();
      const salvo = await salvarTitulo(titulo.id, { ...formularioDoTitulo(titulo), descricao: 'Outra', valor: '120,00', competencia: '2026-12', vencimento: '2026-12-15' });
      expect(salvo).toMatchObject({ descricao: 'Outra', valor: 120, competencia: '2026-12-01', vencimento: '2026-12-15', ajustado_manualmente: false });
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } }))[0]?.valor).toBe(120);
    });

    it('não baixa o valor para menos que o já pago, e a situação acompanha', async () => {
      const titulo = await emAberto();
      await registrarPagamento(titulo.id, pagamento({ valorMoeda: 60, valorBrl: 60 }), HOJE);
      const atual = (await repositorios.titulo.obter(titulo.id))!;
      await expect(salvarTitulo(titulo.id, { ...formularioDoTitulo(atual), valor: '50,00' })).rejects.toThrow('menor que o que já foi pago');
      expect(await salvarTitulo(titulo.id, { ...formularioDoTitulo(atual), valor: '60,00' })).toMatchObject({ situacao: 'quitado' });
    });

    it('RN-05.13: título gerado pede motivo, e fica ajustado à mão', async () => {
      const previsto = (await repositorios.titulo.listar({ onde: { situacao: 'previsto' } }))[0]!;
      const novo = { ...formularioDoTitulo(previsto), valor: '999,00' };
      expect(edicaoPedeMotivo(previsto, novo)).toBe(true);
      expect(edicaoPedeMotivo(previsto, formularioDoTitulo(previsto))).toBe(false);
      await expect(salvarTitulo(previsto.id, novo)).rejects.toThrow('Diga por que');
      expect(await salvarTitulo(previsto.id, { ...novo, motivo: 'A fatura veio maior' })).toMatchObject({ valor: 999, ajustado_manualmente: true });
    });

    it('manual não pede motivo', async () => {
      const titulo = await emAberto();
      expect(edicaoPedeMotivo(titulo, { valor: '500,00', vencimento: titulo.vencimento })).toBe(false);
    });

    it('quitado e cancelado não se editam', async () => {
      const quitado = (await repositorios.titulo.listar({ onde: { situacao: 'quitado' } }))[0]!;
      await expect(salvarTitulo(quitado.id, formularioDoTitulo(quitado))).rejects.toThrow('não se edita');
    });
  });

  describe('T05.03: confirmar e cancelar', () => {
    it('previsto vira em aberto; o resto não precisa', async () => {
      const previsto = (await repositorios.titulo.listar({ onde: { situacao: 'previsto' } }))[0]!;
      await confirmarTitulo(previsto.id);
      expect((await repositorios.titulo.obter(previsto.id))?.situacao).toBe('aberto');
      await expect(confirmarTitulo(previsto.id)).rejects.toThrow('Só título previsto');
    });

    it('RN-05.14: cancelar exige motivo, e com baixa é preciso estornar antes', async () => {
      const titulo = await emAberto();
      await expect(cancelarTitulo(titulo.id, ' ')).rejects.toThrow('Diga por que');
      const baixa = await registrarPagamento(titulo.id, pagamento({ valorMoeda: 10, valorBrl: 10 }), HOJE);
      await expect(cancelarTitulo(titulo.id, 'Motivo')).rejects.toThrow('Estorne antes');
      await estornarBaixa(baixa.id, 'Errado', HOJE);
      await cancelarTitulo(titulo.id, 'Motivo');
      expect(await repositorios.titulo.obter(titulo.id)).toMatchObject({ situacao: 'cancelado', cancelado_motivo: 'Motivo' });
    });

    it('previsto cancelado à mão a geração não traz de volta (RN-05.13)', async () => {
      const previsto = (await repositorios.titulo.listar({ onde: { situacao: 'previsto' } })).find((titulo) => titulo.descricao.startsWith('Estúdio Verde'))!;
      await cancelarTitulo(previsto.id, 'Não vamos renovar');
      await estenderProgramacao(HOJE);
      const dela = await repositorios.titulo.listar({ onde: { assinatura_id: previsto.assinatura_id as string } });
      expect(dela).toHaveLength(1);
      expect(dela[0]?.situacao).toBe('cancelado');
    });
  });

  describe('T05.03: rateio', () => {
    it('edita os percentuais e recalcula os valores, com o último fechando o total', async () => {
      const titulo = await criarDespesa(despesa({ contextos: [ID_PRODUTO_KIPI, ID_INSTITUCIONAL], percentuais: { [ID_PRODUTO_KIPI]: '50', [ID_INSTITUCIONAL]: '50' } }), ID_KIMBERLY, HOJE);
      const linhas = await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } });
      await editarRateioDoTitulo(titulo.id, [
        { ligacaoId: linhas[0]!.id, percentual: '33,33' },
        { ligacaoId: linhas[1]!.id, percentual: '66,67' },
      ]);
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } })).map((linha) => [linha.percentual, linha.valor])).toEqual([
        [33.33, 33.33],
        [66.67, 66.67],
      ]);
    });

    it('soma errada não grava', async () => {
      const titulo = await criarDespesa(despesa({ contextos: [ID_PRODUTO_KIPI, ID_INSTITUCIONAL], percentuais: { [ID_PRODUTO_KIPI]: '50', [ID_INSTITUCIONAL]: '50' } }), ID_KIMBERLY, HOJE);
      const linhas = await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } });
      await expect(editarRateioDoTitulo(titulo.id, linhas.map((linha) => ({ ligacaoId: linha.id, percentual: '10' })))).rejects.toThrow('A soma precisa dar 100%');
    });
  });

  describe('T05.03: duplicar', () => {
    it('leva os dados e o rateio, em aberto, sem data nem pagamento', async () => {
      const titulo = await criarDespesa(despesa({ contextos: [ID_PRODUTO_KIPI, ID_INSTITUCIONAL], percentuais: { [ID_PRODUTO_KIPI]: '70', [ID_INSTITUCIONAL]: '30' } }), ID_KIMBERLY, HOJE);
      const ficha = (await carregarFichaDoTitulo(titulo.id, HOJE))!;
      const copia = formularioParaDuplicar(ficha.titulo, HOJE);
      expect(copia).toMatchObject({ descricao: 'Despesa de teste', valor: '100,00', pago: false, vencimento: '', contextos: [ID_PRODUTO_KIPI, ID_INSTITUCIONAL], categoria_id: categoria('IA') });
      expect(copia.percentuais[ID_PRODUTO_KIPI]).toBe('70,00');
    });
  });

  describe('ficha e histórico', () => {
    it('mostra de onde um reembolso nasceu, e para onde foi', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento({ tratamento: 'reembolso', vencimentoReembolso: '2026-12-01' }), HOJE);
      expect((await carregarFichaDoTitulo(titulo.id, HOJE))?.reembolsos.map((item) => item.id)).toEqual([baixa.titulo_reembolso_id]);
      expect((await carregarFichaDoTitulo(baixa.titulo_reembolso_id as string, HOJE))?.origem?.id).toBe(titulo.id);
    });

    it('o histórico conta a baixa e o estorno, por extenso', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento({ valorMoeda: 60, valorBrl: 60 }), HOJE);
      await estornarBaixa(baixa.id, 'Pago errado', HOJE);
      const textos = (await historicoDoTitulo(titulo.id)).map((linha) => linha.texto).join(' | ');
      expect(textos).toContain('o lançamento Despesa de teste');
      expect(textos).toContain('uma baixa de Despesa de teste');
      expect(textos).toContain('Pago errado');
    });

    it('a busca global acha pelo código e pela descrição', async () => {
      const titulo = await emAberto();
      const grupo = async (termo: string) => (await buscarNaCentral(termo)).find((item) => item.tipo === 'titulos');
      expect((await grupo('Despesa de teste'))?.itens[0]).toMatchObject({ titulo: 'Despesa de teste', href: `/financeiro/${titulo.id}` });
      expect((await grupo(titulo.codigo))?.itens[0]?.codigo).toBe(titulo.codigo);
    });

    it('a sócia certa em cada aporte', async () => {
      const titulo = await emAberto();
      const baixa = await registrarPagamento(titulo.id, pagamento({ contaId: ID_CONTA_CAMILA }), HOJE);
      expect((await repositorios.conta_financeira.obter(ID_CONTA_CAMILA))?.titular_pessoa_id).toBe((await repositorios.movimento_societario.obter(baixa.movimento_societario_id as string))?.socia_id);
    });
  });
});
