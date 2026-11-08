import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_CONTA_KIMBERLY, ID_CONTRAPARTE_CONTABILIDADE, ID_ENTIDADE_PLANEJADA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { cancelarFerramenta, carregarFerramentas, criarFerramenta, esquemaFormularioFerramenta, formularioDaFerramenta, formularioFerramentaVazio, salvarFerramenta, type FormularioFerramenta } from './ferramentas';
import { lancamentosParaVincular, numaTemEntidadeAtiva, pagamentoEfetivo, pendenciasDaFerramenta, previaDasCobrancas, previaDoCancelamento, proximoEmAberto, titularidade, ultimoPagamento, vincularLancamento } from './ferramentas-ficha';
import { chaveDaCobranca, titulosFuturosDaFerramenta } from './titulos';

const HOJE = '2026-11-07';
const categoriaFinanceira = (nome: string) => CATEGORIAS_INICIAIS.find((categoria) => categoria.nome === nome)!.id;

function nova(alteracoes: Partial<FormularioFerramenta> = {}): FormularioFerramenta {
  return {
    ...formularioFerramentaVazio(ID_KIMBERLY, ID_CONSOLIDADA, { tecnica: ID_CAMILA, financeira: ID_KIMBERLY }),
    nome: 'Banco de dados',
    categoria_id: 'categoria',
    finalidade: 'Guardar os dados dos apps',
    contextos: [ID_INSTITUCIONAL],
    situacao: 'ativa',
    ...alteracoes,
  };
}

const paga = (alteracoes: Partial<FormularioFerramenta> = {}) =>
  nova({ modalidade: 'paga', plano: 'Pro', valor: '25,00', moeda: 'USD', periodicidade: 'mensal', proxima_cobranca: '2026-11-20', renovacao: 'automatica', conta_financeira_id: ID_CONTA_KIMBERLY, categoria_financeira_id: categoriaFinanceira('IA'), fornecedor_id: ID_CONTRAPARTE_CONTABILIDADE, ...alteracoes });

const titulosDa = async (ferramentaId: string) => (await repositorios.titulo.listar({ onde: { ferramenta_id: ferramentaId } })).sort((a, b) => a.vencimento.localeCompare(b.vencimento));

function baixa(alteracoes: Partial<Baixa>): Baixa {
  return { id: 'b1', titulo_id: 't1', tipo: 'pagamento', baixa_original_id: null, data: '2026-10-20', conta_financeira_id: ID_CONTA_KIMBERLY, valor_moeda: 25, cambio: 5.3, iof_brl: null, valor_brl: 132.5, comprovante_url: null, sem_comprovante_motivo: null, tratamento: null, movimento_societario_id: null, titulo_reembolso_id: null, motivo: null, registrado_por: null, criado_em: '', atualizado_em: '', arquivado_em: null, exemplo: false, ...alteracoes } as Baixa;
}

async function despesaManual(alteracoes: Partial<Titulo> = {}): Promise<Titulo> {
  return repositorios.titulo.criar({
    natureza: 'pagar',
    descricao: 'Fatura do banco de dados',
    contraparte_id: ID_CONTRAPARTE_CONTABILIDADE,
    beneficiario_pessoa_id: null,
    categoria_id: categoriaFinanceira('IA'),
    competencia: '2026-11-01',
    vencimento: '2026-11-21',
    valor: 25,
    moeda: 'USD',
    situacao: 'aberto',
    responsavel_id: ID_KIMBERLY,
    entidade_id: null,
    origem: 'manual',
    origem_id: null,
    chave_idempotencia: null,
    ajustado_manualmente: false,
    ferramenta_id: null,
    assinatura_id: null,
    periodo_inicio: null,
    periodo_fim: null,
    suspenso: false,
    cancelado_motivo: null,
    observacao: null,
    ...alteracoes,
  });
}

describe('revisão do M04: ficha da ferramenta', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('prévia das cobranças', () => {
    const base = { modalidade: 'paga' as const, valor: 25, moeda: 'USD', periodicidade: 'mensal' as const, proxima_cobranca: '2026-11-20', gerar_titulos: true };

    it('mensal: até três meses à frente; anual: só a próxima, mesmo com a referência mensal', () => {
      expect(previaDasCobrancas(base, [], null, HOJE).map((item) => [item.dia, item.estado])).toEqual([
        ['2026-11-20', 'a_gerar'],
        ['2026-12-20', 'a_gerar'],
        ['2027-01-20', 'a_gerar'],
      ]);
      expect(previaDasCobrancas({ ...base, periodicidade: 'anual', proxima_cobranca: '2026-12-20' }, [], null, HOJE).map((item) => item.dia)).toEqual(['2026-12-20']);
    });

    it('gratuita, teste e geração desligada não preveem nada; paga sem valor aguarda, sem virar zero', () => {
      expect(previaDasCobrancas({ ...base, modalidade: 'gratuita' }, [], null, HOJE)).toEqual([]);
      expect(previaDasCobrancas({ ...base, modalidade: 'teste' }, [], null, HOJE)).toEqual([]);
      expect(previaDasCobrancas({ ...base, gerar_titulos: false }, [], null, HOJE)).toEqual([]);
      const semValor = previaDasCobrancas({ ...base, valor: null }, [], null, HOJE);
      expect(semValor.every((item) => item.estado === 'sem_valor' && item.valor === null)).toBe(true);
    });

    it('a cobrança já lançada (mesma chave ou até 3 dias) aparece como já lançada; cancelada não conta', () => {
      const existentes = [
        { vencimento: '2026-11-22', situacao: 'aberto' as const, codigo: 'TIT-0099', chave_idempotencia: null },
        { vencimento: '2026-12-20', situacao: 'cancelado' as const, codigo: 'TIT-0100', chave_idempotencia: chaveDaCobranca('a1', '2026-12-20') },
      ];
      expect(previaDasCobrancas(base, existentes, 'a1', HOJE).map((item) => [item.estado, item.codigo])).toEqual([
        ['ja_existe', 'TIT-0099'],
        ['a_gerar', null],
        ['a_gerar', null],
      ]);
    });

    it('bate com a geração: salvar de novo não cria o que a prévia diz que já existe', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const linha = (await carregarFerramentas()).ferramentas.find((item) => item.id === ferramenta.id)!;
      const previa = previaDasCobrancas(linha.assinatura!, await titulosDa(ferramenta.id), linha.assinatura!.id, HOJE);
      expect(previa.map((item) => item.estado)).toEqual(['ja_existe', 'ja_existe', 'ja_existe']);
      await salvarFerramenta(ferramenta.id, formularioDaFerramenta(linha, linha.contextos, linha.assinatura), { hoje: HOJE });
      expect(await titulosDa(ferramenta.id)).toHaveLength(3);
    });

    it('CA-04.03: gratuita não gera lançamento, nem de zero; custo a definir também não', async () => {
      const gratuita = await criarFerramenta(nova({ modalidade: 'gratuita' }), HOJE);
      const aDefinir = await criarFerramenta(nova({ nome: 'Outra', modalidade: '' }), HOJE);
      expect(await titulosDa(gratuita.id)).toEqual([]);
      expect(await titulosDa(aDefinir.id)).toEqual([]);
      expect((await carregarFerramentas()).ferramentas.find((item) => item.id === aDefinir.id)!.assinatura).toBeNull();
    });

    it('paga com valor vazio fica a confirmar e não gera lançamento', async () => {
      const ferramenta = await criarFerramenta(paga({ valor: '' }), HOJE);
      const linha = (await carregarFerramentas()).ferramentas.find((item) => item.id === ferramenta.id)!;
      expect(linha.assinatura?.valor).toBeNull();
      expect(linha.equivalenteMensal).toBeNull();
      expect(await titulosDa(ferramenta.id)).toEqual([]);
    });
  });

  describe('pagamento efetivo', () => {
    it('é o valor em reais das baixas, distinto do previsto, com a data do pagamento', () => {
      expect(pagamentoEfetivo([baixa({})])).toEqual({ data: '2026-10-20', valorBrl: 132.5, valorMoeda: 25 });
    });

    it('estorno anula o pagamento; nenhuma baixa, nenhum pagamento', () => {
      expect(pagamentoEfetivo([baixa({}), baixa({ id: 'b2', tipo: 'estorno', baixa_original_id: 'b1', data: '2026-10-21' })])).toBeNull();
      expect(pagamentoEfetivo([])).toBeNull();
    });

    it('último pagamento e próximo em aberto', () => {
      const t = (id: string, vencimento: string, situacao: Titulo['situacao'], baixas: Baixa[], saldo: number) => ({ id, vencimento, situacao, baixas, saldo, natureza: 'pagar' as const, arquivado_em: null }) as unknown as Titulo & { baixas: Baixa[]; saldo: number };
      const titulos = [t('t1', '2026-09-20', 'quitado', [baixa({ data: '2026-09-19' })], 0), t('t2', '2026-10-20', 'quitado', [baixa({ id: 'b9', data: '2026-10-22', valor_brl: 131 })], 0), t('t3', '2026-11-20', 'previsto', [], 25), t('t4', '2026-12-20', 'cancelado', [], 25)];
      expect(ultimoPagamento(titulos)?.titulo.id).toBe('t2');
      expect(ultimoPagamento(titulos)?.pagamento.valorBrl).toBe(131);
      expect(proximoEmAberto(titulos)?.id).toBe('t3');
      expect(proximoEmAberto(titulos.filter((titulo) => titulo.id !== 't3'))).toBeNull();
    });
  });

  describe('prévia do cancelamento (RN-04.10)', () => {
    it('cancela só os futuros não pagos depois da data efetiva; o vencimento do próprio dia e os pagos ficam', () => {
      const t = (vencimento: string, situacao: Titulo['situacao']) => ({ vencimento, situacao });
      const previa = previaDoCancelamento([t('2026-11-20', 'previsto'), t('2026-10-20', 'quitado'), t('2026-11-15', 'aberto'), t('2026-12-20', 'parcial'), t('2026-12-20', 'cancelado')], '2026-11-15');
      expect(previa.map((item) => [item.titulo.vencimento, item.efeito])).toEqual([
        ['2026-10-20', 'preservado_pago'],
        ['2026-11-15', 'preservado_anterior'],
        ['2026-11-20', 'sera_cancelado'],
        ['2026-12-20', 'preservado_pago'],
        ['2026-12-20', 'ja_cancelado'],
      ]);
    });

    it('bate com o cancelamento de verdade, que preserva o pago e o histórico', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const [primeiro] = await titulosDa(ferramenta.id);
      await repositorios.titulo.atualizar(primeiro!.id, { situacao: 'quitado' });
      const previa = previaDoCancelamento(await titulosDa(ferramenta.id), '2026-11-25');
      const futuros = await titulosFuturosDaFerramenta(ferramenta.id, '2026-11-25');
      expect(previa.filter((item) => item.efeito === 'sera_cancelado').map((item) => item.titulo.id)).toEqual(futuros.map((titulo) => titulo.id));
      await cancelarFerramenta(ferramenta.id, { data: '2026-11-25', motivo: 'Trocamos de serviço' });
      const depois = await titulosDa(ferramenta.id);
      expect(depois.map((titulo) => titulo.situacao)).toEqual(['quitado', 'cancelado', 'cancelado']);
    });
  });

  describe('titularidade (RN-04.14)', () => {
    const pessoas = [{ id: ID_KIMBERLY, nome_completo: 'Kimberly Grebe' }];
    const pf = { titular_atual_tipo: 'pessoa_fisica' as const, titular_atual_pessoa_id: ID_KIMBERLY, titular_atual_texto: null, titular_desejado: 'Numa' };

    it('sem entidade PJ ativa, a transferência para a Numa fica a planejar, sem presumir que a Numa já existe', async () => {
      const entidades = await repositorios.entidade.listar();
      expect(entidades.find((entidade) => entidade.id === ID_ENTIDADE_PLANEJADA)?.situacao).toBe('planejada');
      expect(numaTemEntidadeAtiva(entidades)).toBe(false);
      expect(titularidade(pf, pessoas, entidades).estado).toBe('aguarda_entidade');
    });

    it('com entidade PJ ativa, fica pendente; o titular atual igual ao desejado não pede nada', () => {
      const ativa = [{ tipo_pessoa: 'pj' as const, situacao: 'ativa' as const, arquivado_em: null }];
      expect(titularidade(pf, pessoas, ativa).estado).toBe('pendente');
      expect(titularidade({ ...pf, titular_atual_tipo: 'numa', titular_atual_pessoa_id: null }, pessoas, ativa).estado).toBe('igual');
      expect(titularidade({ ...pf, titular_desejado: 'Kimberly Grebe' }, pessoas, []).estado).toBe('igual');
    });

    it('escolher o titular desejado não muda o atual', async () => {
      const ferramenta = await criarFerramenta(nova({ modalidade: 'gratuita', titular_atual_tipo: 'pessoa_fisica', titular_atual_pessoa_id: ID_KIMBERLY, titular_desejado: 'Numa' }), HOJE);
      expect(ferramenta.titular_atual_tipo).toBe('pessoa_fisica');
      expect(ferramenta.titular_atual_pessoa_id).toBe(ID_KIMBERLY);
    });
  });

  describe('pendências', () => {
    const base = { situacao: 'ativa' as const, critica: false, caminho_recuperacao: null, mfa_conta: 'sim' as const, trata_dados_pessoais: false, acordo_dados_situacao: null, arquivado_em: null, titular_atual_tipo: 'numa' as const, titular_atual_pessoa_id: null, titular_atual_texto: null, titular_desejado: 'Numa', assinatura: { modalidade: 'gratuita' as const, valor: null } };
    const ids = (alteracoes: Partial<typeof base> | Record<string, unknown>) => pendenciasDaFerramenta({ ...base, ...alteracoes } as typeof base, [], []).map((pendencia) => pendencia.id);

    it('crítica sem caminho de recuperação é recomendação, e o formulário salva sem ele', () => {
      expect(ids({ critica: true })).toEqual(['recuperacao']);
      expect(pendenciasDaFerramenta({ ...base, critica: true }, [], [])[0]?.tom).toBe('info');
      expect(esquemaFormularioFerramenta.safeParse(nova({ critica: true, caminho_recuperacao: '', modalidade: 'gratuita' })).success).toBe(true);
    });

    it('acordo não avaliado não conta como concluído; valor a confirmar e custo a definir aparecem', () => {
      expect(ids({ trata_dados_pessoais: true, acordo_dados_situacao: 'nao_avaliado' })).toEqual(['acordo']);
      expect(ids({ trata_dados_pessoais: true, acordo_dados_situacao: 'termos_padrao' })).toEqual([]);
      expect(ids({ assinatura: { modalidade: 'paga', valor: null } })).toEqual(['valor']);
      expect(ids({ assinatura: null })).toEqual(['custo']);
    });

    it('cancelada e arquivada não têm pendências', () => {
      expect(ids({ situacao: 'cancelada', critica: true })).toEqual([]);
      expect(ids({ arquivado_em: '2026-11-01T00:00:00.000Z', critica: true })).toEqual([]);
    });
  });

  describe('vincular lançamento existente (RN-04.04)', () => {
    it('liga a despesa à assinatura, tira a cobrança gerada da mesma data, e salvar de novo não a recria', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const manual = await despesaManual();
      expect((await lancamentosParaVincular(ferramenta.id)).map((titulo) => titulo.id)).toContain(manual.id);

      expect(await vincularLancamento(manual.id, ferramenta.id, HOJE)).toEqual({ substituidos: 1 });
      const vinculado = (await repositorios.titulo.obter(manual.id))!;
      const linha = (await carregarFerramentas()).ferramentas.find((item) => item.id === ferramenta.id)!;
      expect(vinculado).toMatchObject({ ferramenta_id: ferramenta.id, assinatura_id: linha.assinatura!.id, situacao: 'aberto', valor: 25 });
      const emUso = (await titulosDa(ferramenta.id)).filter((titulo) => titulo.situacao !== 'cancelado');
      expect(emUso.map((titulo) => titulo.vencimento)).toEqual(['2026-11-21', '2026-12-20', '2027-01-20']);

      await salvarFerramenta(ferramenta.id, formularioDaFerramenta(linha, linha.contextos, linha.assinatura), { hoje: HOJE });
      expect((await titulosDa(ferramenta.id)).filter((titulo) => titulo.situacao !== 'cancelado')).toHaveLength(3);
      expect((await lancamentosParaVincular(ferramenta.id)).map((titulo) => titulo.id)).not.toContain(manual.id);
    });

    it('não vincula o que já pertence a uma assinatura, nem a uma ferramenta gratuita ou cancelada', async () => {
      const ferramenta = await criarFerramenta(paga(), HOJE);
      const manual = await despesaManual();
      await vincularLancamento(manual.id, ferramenta.id, HOJE);
      await expect(vincularLancamento(manual.id, ferramenta.id, HOJE)).rejects.toThrow('já está vinculado');
      const gratuita = await criarFerramenta(nova({ nome: 'Gratuita', modalidade: 'gratuita' }), HOJE);
      await expect(vincularLancamento((await despesaManual()).id, gratuita.id, HOJE)).rejects.toThrow('assinatura paga');
      await cancelarFerramenta(ferramenta.id, { data: HOJE, motivo: 'Fim' });
      await expect(vincularLancamento((await despesaManual()).id, ferramenta.id, HOJE)).rejects.toThrow('cancelada');
    });
  });
});
