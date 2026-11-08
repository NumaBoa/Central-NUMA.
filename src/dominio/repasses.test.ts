import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { CATEGORIAS_INICIAIS, ID_CONTA_KIMBERLY, ID_CONTRAPARTE_CONTABILIDADE, ID_ENTIDADE_PLANEJADA, ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { ContratoVersao, ItemContrato } from '@/dados/tipos/contrato';
import { criarContrato } from './contratos';
import { ID_INSTITUCIONAL } from './contextos';
import { calcularPrevia, cancelarRepasse, gerarRepasse, linhaDoRepasse, rateioDoRepasse, salvarTermosDeRepasse, salvarVenda, termosNaData } from './repasses';
import { registrarPagamento } from './titulos';

const versao = (id: string, numero: number, data_efeito: string, situacao: ContratoVersao['situacao'] = 'publicada') => ({ id, numero, data_efeito, situacao }) as ContratoVersao;
const item = (id: string, versao_id: string, parcial: Partial<ItemContrato> = {}) => ({ id, versao_id, descricao: id, item_origem_id: null, arquivado_em: null, produto_id: null, percentual_repasse: 20, base_repasse: 'bruta', retencao: 10, ...parcial }) as ItemContrato;

describe('T05.13: repasses a parceiros (RN-05.22, RN-11.26)', () => {
  it('a venda usa os termos da versão vigente na data dela, seguindo a cópia do item', () => {
    const versoes = [versao('v1', 1, '2026-01-01'), versao('v2', 2, '2026-06-01'), versao('v3', 3, '2026-09-01', 'em_elaboracao')];
    const itens = [item('a1', 'v1'), item('a2', 'v2', { item_origem_id: 'a1', percentual_repasse: 30, base_repasse: 'liquida', retencao: null }), item('a3', 'v3', { item_origem_id: 'a2', percentual_repasse: 50 })];
    const antes = termosNaData('a2', '2026-03-10', versoes, itens);
    const depois = termosNaData('a1', '2026-10-10', versoes, itens);
    expect(typeof antes !== 'string' && [antes.versao.numero, antes.percentual, antes.base, antes.retencao]).toEqual([1, 20, 'bruta', 10]);
    expect(typeof depois !== 'string' && [depois.versao.numero, depois.percentual, depois.base, depois.retencao]).toEqual([2, 30, 'liquida', 0]);
    expect(termosNaData('a1', '2025-12-31', versoes, itens)).toMatch('não tinha versão assinada');
    expect(termosNaData('a1', '2026-03-10', versoes, [item('a1', 'v1', { percentual_repasse: null })])).toMatch('não tem termos');
  });

  it('base bruta ou líquida, retenção sobre o repasse, e rateio pelo produto da venda', () => {
    const termos = { versao: { numero: 1 }, percentual: 20, base: 'liquida' as const, retencao: 10 };
    expect(linhaDoRepasse({ id: 'x', data: '2026-10-01', valor_bruto: 1000, taxas: 100 }, termos)).toEqual({ venda_id: 'x', data: '2026-10-01', versao_numero: 1, base: 900, percentual: 20, retencao: 18, valor: 162 });
    const rateio = rateioDoRepasse({ valor: 300, linhas: [{ venda_id: 'a', valor: 100 }, { venda_id: 'b', valor: 200 }] as never, vendas: [{ id: 'a', produto_id: ID_PRODUTO_KIPI }, { id: 'b', produto_id: null }] as never });
    expect(rateio).toEqual([{ contexto: ID_PRODUTO_KIPI, percentual: 33.33 }, { contexto: ID_INSTITUCIONAL, percentual: 66.67 }]);
  });

  describe('com os dados', () => {
    beforeEach(() => {
      usarDriverDeTeste(criarArmazenamentoEmMemoria());
      esquecerMetaEmMemoria();
      vi.useFakeTimers({ now: new Date('2026-11-08T15:00:00.000Z'), toFake: ['Date'] });
      garantirCarga();
    });
    afterEach(() => {
      vi.useRealTimers();
      usarDriverDeTeste(null);
    });

    const contratoDeParceiro = async () => {
      const contrato = await criarContrato({ titulo: 'Parceria Kipi', familia: 'parceiro', tipo: 'parceria', entidade_id: ID_ENTIDADE_PLANEJADA, contraparte_id: ID_CONTRAPARTE_CONTABILIDADE, responsavel_id: ID_KIMBERLY, participantes: [] });
      const versaoId = contrato.versao_elaboracao_id as string;
      const criado = await repositorios.item_contrato.criar({ versao_id: versaoId, produto_id: ID_PRODUTO_KIPI, tipo_item: 'sob_medida', oferta_id: null, preco_versao_id: null, canal_id: null, descricao: 'Revenda do Kipi', quantidade: 1, valor_unitario: null, justificativa_valor: null, desconto_percentual: null, desconto: null, desconto_justificativa: null, desconto_por: null, desconto_em: null, valor_total: null, recorrente: false, periodicidade: null, inicio: null, fim: null, item_origem_id: null, proposta_item_id: null, ordem: 0 });
      await salvarTermosDeRepasse(criado.id, { percentual: '20', base: 'bruta', retencao: '10' });
      await repositorios.contrato_versao.atualizar(versaoId, { situacao: 'publicada', data_efeito: '2026-01-01' });
      return { contrato, itemId: criado.id };
    };
    const venda = (contratoId: string, itemId: string, data: string, valor: string) => salvarVenda({ contrato_id: contratoId, item_contrato_id: itemId, data, descricao: `Vendas ${data}`, moeda: '', valor_bruto: valor, taxas: '', referencia: '' });
    const categoria = () => CATEGORIAS_INICIAIS.find((linha) => linha.nome === 'Outros')!.id;

    it('termos só com base, e só no rascunho de contrato de parceiro', async () => {
      const { itemId } = await contratoDeParceiro();
      await expect(salvarTermosDeRepasse(itemId, { percentual: '25', base: 'bruta', retencao: '' })).rejects.toThrow('Só o rascunho');
      const outro = await criarContrato({ titulo: 'Cliente', familia: 'cliente_negociado', tipo: 'assinatura', entidade_id: ID_ENTIDADE_PLANEJADA, contraparte_id: ID_CONTRAPARTE_CONTABILIDADE, responsavel_id: ID_KIMBERLY, participantes: [] });
      const doCliente = await repositorios.item_contrato.criar({ ...(await repositorios.item_contrato.obter(itemId))!, id: undefined as never, versao_id: outro.versao_elaboracao_id as string });
      await expect(salvarTermosDeRepasse(doCliente.id, { percentual: '25', base: 'bruta', retencao: '' })).rejects.toThrow('contrato de parceiro');
    });

    it('prévia, título a pagar aberto, idempotência por parceiro × período e cancelamento', async () => {
      const { contrato, itemId } = await contratoDeParceiro();
      await venda(contrato.id, itemId, '2026-10-05', '1000');
      await venda(contrato.id, itemId, '2026-10-20', '500,00');
      await venda(contrato.id, itemId, '2026-11-02', '700');
      await expect(venda(contrato.id, itemId, '2025-12-20', '100')).rejects.toThrow('não tinha versão assinada');

      const previa = await calcularPrevia(ID_CONTRAPARTE_CONTABILIDADE, '2026-10-01', '2026-10-31');
      expect([previa.base, previa.percentual, previa.retencao, previa.valor, previa.linhas.length]).toEqual([1500, 20, 30, 270, 2]);

      await expect(gerarRepasse({ parceiroId: ID_CONTRAPARTE_CONTABILIDADE, inicio: '2026-10-01', fim: '2026-10-31', vencimento: '', categoriaId: categoria() }, ID_KIMBERLY)).rejects.toThrow('vencimento');
      const repasse = await gerarRepasse({ parceiroId: ID_CONTRAPARTE_CONTABILIDADE, inicio: '2026-10-01', fim: '2026-10-31', vencimento: '2026-11-15', categoriaId: categoria() }, ID_KIMBERLY);
      const titulo = (await repositorios.titulo.obter(repasse.titulo_id!))!;
      expect([titulo.natureza, titulo.situacao, titulo.valor, titulo.origem, titulo.contraparte_id]).toEqual(['pagar', 'aberto', 270, 'repasse', ID_CONTRAPARTE_CONTABILIDADE]);
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo.id } })).map((linha) => [linha.produto_id, linha.percentual])).toEqual([[ID_PRODUTO_KIPI, 100]]);
      expect((await repositorios.venda_parceiro.listar()).filter((linha) => linha.repasse_id === repasse.id)).toHaveLength(2);

      await expect(calcularPrevia(ID_CONTRAPARTE_CONTABILIDADE, '2026-10-01', '2026-10-31')).rejects.toThrow('Já há repasse');
      await expect(salvarVenda({ contrato_id: contrato.id, item_contrato_id: itemId, data: '2026-10-05', descricao: 'x', moeda: '', valor_bruto: '1', taxas: '', referencia: '' }, (await repositorios.venda_parceiro.listar())[0]!.id)).rejects.toThrow('já entrou num repasse');

      await cancelarRepasse(repasse.id, 'Relatório do parceiro corrigido');
      expect((await repositorios.titulo.obter(titulo.id))!.situacao).toBe('cancelado');
      expect((await repositorios.venda_parceiro.listar()).every((linha) => linha.repasse_id === null)).toBe(true);
      const refeito = await gerarRepasse({ parceiroId: ID_CONTRAPARTE_CONTABILIDADE, inicio: '2026-10-01', fim: '2026-10-31', vencimento: '2026-11-15', categoriaId: categoria() }, ID_KIMBERLY);
      expect(refeito.valor).toBe(270);
    });

    it('com pagamento, não se cancela', async () => {
      const { contrato, itemId } = await contratoDeParceiro();
      await venda(contrato.id, itemId, '2026-10-05', '1000');
      const repasse = await gerarRepasse({ parceiroId: ID_CONTRAPARTE_CONTABILIDADE, inicio: '2026-10-01', fim: '2026-10-31', vencimento: '2026-11-15', categoriaId: categoria() }, ID_KIMBERLY);
      await registrarPagamento(repasse.titulo_id!, { data: '2026-11-08', contaId: ID_CONTA_KIMBERLY, valorMoeda: 180, cambio: null, iofBrl: null, valorBrl: 180, comprovanteUrl: 'https://drive.google.com/file/d/x/view', semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null, pagoAMais: false, motivo: null }, '2026-11-08');
      await expect(cancelarRepasse(repasse.id, 'x')).rejects.toThrow('já tem pagamento');
    });
  });
});
