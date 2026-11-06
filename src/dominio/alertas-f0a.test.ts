import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { AREAS_INICIAIS, CATEGORIAS_INICIAIS, ID_CAMILA, ID_CONTA_KIMBERLY, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Atividade } from '@/dados/tipos/atividade';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { AssinaturaFerramenta, Ferramenta } from '@/dados/tipos/ferramenta';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import { alertasDasFerramentas, alertasDosAtivos, alertasDosTitulos, gerarAlertas, MOTIVOS_DE_ALERTA, sincronizarAlertasDasFerramentas, sincronizarAlertasDosAtivos, sincronizarAlertasDosTitulos } from './alertas';
import { acaoDoAlerta, concluirAtividade, dispensarAlerta } from './atividades';
import { atividadesDoRegistro } from './atividades-painel';
import { formularioDoAtivo, salvarAtivo } from './ativos';
import { cancelarTitulo, estornarBaixa, formularioBaixaVazio, formularioDoTitulo, registrarBaixa, salvarTitulo } from './baixas';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { limparExemplos } from './dados';
import { cancelarFerramenta } from './ferramentas';
import { criarDespesa, formularioDespesaVazio, registrarPagamento, type FormularioDespesa } from './titulos';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const AREA_FINANCEIRO = AREAS_INICIAIS.find((area) => area.nome === 'Financeiro')!.id;
const AREA_TECNOLOGIA = AREAS_INICIAIS.find((area) => area.nome === 'Tecnologia')!.id;
const categoria = (nome: string) => CATEGORIAS_INICIAIS.find((item) => item.nome === nome)!.id;

const titulo = (alteracoes: Partial<Titulo> = {}) => ({ id: 't1', natureza: 'pagar', descricao: 'Hospedagem', situacao: 'aberto', valor: 100, vencimento: '2026-11-08', origem: 'manual', responsavel_id: ID_CAMILA, beneficiario_pessoa_id: null, criado_em: '2026-11-01T12:00:00.000Z', arquivado_em: null, exemplo: false, ...alteracoes }) as Titulo;
const opcoes = { hoje: HOJE, dias: 3, responsavelDoReembolso: ID_KIMBERLY, nomeDaPessoa: () => 'Camila Lima' };
const ferramenta = (alteracoes: Partial<Ferramenta> = {}) => ({ id: 'f1', nome: 'Hospedagem', situacao: 'ativa', responsavel_tecnico_id: ID_CAMILA, responsavel_financeiro_id: ID_KIMBERLY, arquivado_em: null, exemplo: false, ...alteracoes }) as Ferramenta;
const assinatura = (alteracoes: Partial<AssinaturaFerramenta> = {}) => ({ id: 'a1', ferramenta_id: 'f1', modalidade: 'paga', periodicidade: 'mensal', proxima_cobranca: '2026-11-16', renovacao: 'automatica', aviso_cancelamento_dias: null, fim_teste: null, situacao: 'ativa', arquivado_em: null, ...alteracoes }) as AssinaturaFerramenta;
const opcoesDasFerramentas = { hoje: HOJE, diasRenovacao: 15, diasTeste: 3 };
const motivos = (alertas: readonly { motivo: string }[]) => alertas.map((alerta) => alerta.motivo);

const despesa = (alteracoes: Partial<FormularioDespesa> = {}): FormularioDespesa => ({ ...formularioDespesaVazio(ID_CONSOLIDADA, 'BRL', HOJE), descricao: 'Hospedagem de teste', valor: '100,00', categoria_id: categoria('Hospedagem e nuvem'), contextos: [ID_INSTITUCIONAL], pago: false, vencimento: '2026-11-08', ...alteracoes });
const alertasDe = async (origemId: string): Promise<Atividade[]> => (await repositorios.atividade.listar({ onde: { origem_id: origemId }, incluirArquivados: true })).filter((atividade) => atividade.tipo === 'alerta');
const abertosDe = async (origemId: string) => (await alertasDe(origemId)).filter((atividade) => atividade.situacao === 'a_fazer');

async function pagar(id: string, valor = 100) {
  const atual = (await repositorios.titulo.obter(id))!;
  await registrarBaixa(atual, { ...formularioBaixaVazio(atual, valor, HOJE), valor: String(valor).replace('.', ',') + (String(valor).includes('.') ? '' : ',00'), conta_id: ID_CONTA_KIMBERLY, tratamento: 'aporte', comprovante_url: DRIVE }, HOJE);
}

describe('alertas da F0a (05-M03 §5)', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('título a pagar: vencimento próximo e vencido', () => {
    it('N dias antes, até o dia; antes disso, nada', () => {
      expect(alertasDosTitulos([titulo({ vencimento: '2026-11-09' })], [], [], opcoes)).toMatchObject([{ motivo: 'Vencimento próximo', data_referencia: '2026-11-09', titulo: 'Vencimento de Hospedagem', responsavel_id: ID_CAMILA, area_id: AREA_FINANCEIRO, acao: 'registrar_pagamento', origem_tipo: 'titulo', origem_id: 't1' }]);
      expect(alertasDosTitulos([titulo({ vencimento: HOJE })], [], [], opcoes)).toHaveLength(1);
      expect(alertasDosTitulos([titulo({ vencimento: '2026-11-10' })], [], [], opcoes)).toEqual([]);
      expect(alertasDosTitulos([titulo({ vencimento: '2026-11-10' })], [], [], { ...opcoes, dias: 4 })).toHaveLength(1);
    });

    it('no dia seguinte ao vencimento, é "Vencido", com a ação Registrar baixa', () => {
      expect(alertasDosTitulos([titulo({ vencimento: '2026-11-05' })], [], [], opcoes)).toMatchObject([{ motivo: 'Vencido', data_referencia: '2026-11-05', titulo: 'Pagamento vencido: Hospedagem', acao: 'registrar_baixa' }]);
      expect(alertasDosTitulos([titulo({ vencimento: '2026-11-05', natureza: 'receber' })], [], [], opcoes)).toMatchObject([{ motivo: 'Vencido', titulo: 'Recebimento vencido: Hospedagem' }]);
    });

    it('previsto e parcial pedem pagamento; quitado, cancelado, sem saldo e arquivado, não', () => {
      const pago = [{ titulo_id: 't1', tipo: 'pagamento', valor_moeda: 100, arquivado_em: null }] as Baixa[];
      const parte = [{ titulo_id: 't1', tipo: 'pagamento', valor_moeda: 40, arquivado_em: null }] as Baixa[];
      expect(alertasDosTitulos([titulo({ situacao: 'previsto' })], [], [], opcoes)).toHaveLength(1);
      expect(alertasDosTitulos([titulo({ situacao: 'parcial' })], parte, [], opcoes)).toHaveLength(1);
      expect(alertasDosTitulos([titulo({ situacao: 'quitado' })], pago, [], opcoes)).toEqual([]);
      expect(alertasDosTitulos([titulo({ situacao: 'aberto' })], pago, [], opcoes)).toEqual([]);
      expect(alertasDosTitulos([titulo({ situacao: 'cancelado' })], [], [], opcoes)).toEqual([]);
      expect(alertasDosTitulos([titulo({ arquivado_em: '2026-11-01T12:00:00.000Z' })], [], [], opcoes)).toEqual([]);
    });

    it('a receber não tem vencimento próximo na F0a, só vencido', () => {
      expect(alertasDosTitulos([titulo({ natureza: 'receber' })], [], [], opcoes)).toEqual([]);
    });

    it('o título longo cabe no limite da atividade', () => {
      const [alerta] = alertasDosTitulos([titulo({ descricao: 'x'.repeat(200) })], [], [], opcoes);
      expect(alerta!.titulo.length).toBeLessThanOrEqual(140);
      expect(alerta!.titulo.endsWith('…')).toBe(true);
    });

    it('o exemplo gera alerta de exemplo', () => {
      expect(alertasDosTitulos([titulo({ exemplo: true })], [], [], opcoes)[0]?.exemplo).toBe(true);
    });
  });

  describe('reembolso a sócia pendente há 30 dias', () => {
    const reembolso = (alteracoes: Partial<Titulo> = {}) => titulo({ origem: 'reembolso', descricao: 'Reembolso: Nuvem Clara Hosting · Pro', beneficiario_pessoa_id: ID_CAMILA, vencimento: '2026-12-20', criado_em: '2026-10-07T12:00:00.000Z', ...alteracoes });

    it('30 dias depois de criado, para Kimberly (a responsável do Financeiro)', () => {
      expect(alertasDosTitulos([reembolso()], [], [], opcoes)).toMatchObject([{ motivo: 'Reembolso pendente há 30 dias', data_referencia: '2026-11-06', responsavel_id: ID_KIMBERLY, titulo: 'Reembolso a Camila Lima pendente há 30 dias: Nuvem Clara Hosting · Pro', acao: 'registrar_pagamento' }]);
      expect(alertasDosTitulos([reembolso({ criado_em: '2026-10-08T12:00:00.000Z' })], [], [], opcoes)).toEqual([]);
    });

    it('sem responsável no Financeiro, a do título', () => {
      expect(alertasDosTitulos([reembolso()], [], [], { ...opcoes, responsavelDoReembolso: null })[0]?.responsavel_id).toBe(ID_CAMILA);
    });

    it('perto do vencimento, tem também o alerta de vencimento', () => {
      expect(motivos(alertasDosTitulos([reembolso({ vencimento: '2026-11-07' })], [], [], opcoes))).toEqual(['Vencimento próximo', 'Reembolso pendente há 30 dias']);
    });
  });

  describe('assinatura de ferramenta', () => {
    it('renovação N dias antes da próxima cobrança, para a responsável financeira', () => {
      expect(alertasDasFerramentas([ferramenta()], [assinatura()], [], opcoesDasFerramentas)).toMatchObject([{ origem_tipo: 'ferramenta', origem_id: 'f1', motivo: 'Renovação', data_referencia: '2026-11-16', titulo: 'Renovação de Hospedagem', responsavel_id: ID_KIMBERLY, area_id: AREA_FINANCEIRO, acao: 'revisar_renovacao' }]);
      expect(alertasDasFerramentas([ferramenta()], [assinatura({ proxima_cobranca: '2026-11-22' })], [], opcoesDasFerramentas)).toEqual([]);
    });

    it('sem responsável financeira, a técnica', () => {
      expect(alertasDasFerramentas([ferramenta({ responsavel_financeiro_id: null })], [assinatura()], [], opcoesDasFerramentas)[0]?.responsavel_id).toBe(ID_CAMILA);
    });

    it('depois da data, fica até ela mudar (renovação manual não anda sozinha)', () => {
      expect(motivos(alertasDasFerramentas([ferramenta()], [assinatura({ proxima_cobranca: '2026-11-01', renovacao: 'manual' })], [], opcoesDasFerramentas))).toEqual(['Renovação']);
    });

    it('gratuita, teste, cobrança única, por uso, cancelada e arquivada não renovam', () => {
      expect(alertasDasFerramentas([ferramenta()], [assinatura({ modalidade: 'gratuita' })], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta()], [assinatura({ periodicidade: 'unica' })], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta()], [assinatura({ periodicidade: 'por_uso', proxima_cobranca: null })], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta({ situacao: 'cancelada' })], [assinatura()], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta({ arquivado_em: '2026-11-01T12:00:00.000Z' })], [assinatura()], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta()], [assinatura({ situacao: 'encerrada' })], [], opcoesDasFerramentas)).toEqual([]);
    });

    it('prazo para cancelar: renovação − aviso − 3 dias, só na renovação automática com aviso informado', () => {
      const comAviso = assinatura({ proxima_cobranca: '2026-12-01', aviso_cancelamento_dias: 22 });
      expect(alertasDasFerramentas([ferramenta()], [comAviso], [], opcoesDasFerramentas)).toMatchObject([{ motivo: 'Prazo para cancelar', data_referencia: '2026-11-09', titulo: 'Prazo para cancelar Hospedagem', responsavel_id: ID_KIMBERLY, acao: 'cancelar_ou_manter' }]);
      expect(alertasDasFerramentas([ferramenta()], [{ ...comAviso, aviso_cancelamento_dias: 21 }], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta()], [{ ...comAviso, renovacao: 'manual' }], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta()], [{ ...comAviso, aviso_cancelamento_dias: null }], [], opcoesDasFerramentas)).toEqual([]);
    });

    it('fim do teste: N dias antes, para a responsável técnica; expirado continua (RN-04.09)', () => {
      const teste = assinatura({ modalidade: 'teste', fim_teste: '2026-11-09', proxima_cobranca: null });
      expect(alertasDasFerramentas([ferramenta({ situacao: 'teste' })], [teste], [], opcoesDasFerramentas)).toMatchObject([{ motivo: 'Fim do período de teste', data_referencia: '2026-11-09', titulo: 'Fim do teste de Hospedagem', responsavel_id: ID_CAMILA, area_id: AREA_TECNOLOGIA, acao: 'decidir_teste' }]);
      expect(alertasDasFerramentas([ferramenta({ situacao: 'teste' })], [{ ...teste, fim_teste: '2026-11-10' }], [], opcoesDasFerramentas)).toEqual([]);
      expect(alertasDasFerramentas([ferramenta({ situacao: 'teste_expirado' })], [{ ...teste, fim_teste: '2026-11-01' }], [], opcoesDasFerramentas)).toHaveLength(1);
      expect(alertasDasFerramentas([ferramenta({ situacao: 'ativa' })], [teste], [], opcoesDasFerramentas)).toEqual([]);
    });
  });

  describe('domínio', () => {
    const ativo = (alteracoes: Partial<AtivoDigital> = {}) => ({ id: 'd1', tipo: 'dominio', identificador: 'numa.com.br', vencimento: '2026-12-21', responsavel_id: ID_CAMILA, arquivado_em: null, exemplo: false, ...alteracoes }) as AtivoDigital;

    it('N dias antes do vencimento, para a responsável, e fica depois dele (RN-04.18)', () => {
      expect(alertasDosAtivos([ativo()], { hoje: HOJE, dias: 45 })).toMatchObject([{ origem_tipo: 'ativo', motivo: 'Vencimento', data_referencia: '2026-12-21', titulo: 'Renovar o domínio numa.com.br', responsavel_id: ID_CAMILA, area_id: AREA_TECNOLOGIA, acao: 'renovar_dominio' }]);
      expect(alertasDosAtivos([ativo({ vencimento: '2026-12-22' })], { hoje: HOJE, dias: 45 })).toEqual([]);
      expect(alertasDosAtivos([ativo({ vencimento: '2026-10-01' })], { hoje: HOJE, dias: 45 })).toHaveLength(1);
    });

    it('outros ativos e arquivados não', () => {
      expect(alertasDosAtivos([ativo({ tipo: 'conta_loja' as AtivoDigital['tipo'] })], { hoje: HOJE, dias: 45 })).toEqual([]);
      expect(alertasDosAtivos([ativo({ arquivado_em: '2026-11-01T12:00:00.000Z' })], { hoje: HOJE, dias: 45 })).toEqual([]);
    });
  });

  describe('no sistema, com os módulos', () => {
    it('CA-03.11: quitar conclui o alerta na hora, com a nota da origem e sem autor', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      expect(await sincronizarAlertasDosTitulos(undefined, HOJE)).toBeGreaterThanOrEqual(1);
      expect(await abertosDe(novo.id)).toHaveLength(1);
      await pagar(novo.id);
      expect(await alertasDe(novo.id)).toMatchObject([{ situacao: 'concluida', concluida_por: null, conclusao_nota: 'Concluído por Registrar pagamento em Financeiro.' }]);
    });

    it('pagamento parcial mantém o alerta aberto', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await sincronizarAlertasDosTitulos([novo.id], HOJE);
      await pagar(novo.id, 40);
      expect(await abertosDe(novo.id)).toHaveLength(1);
    });

    it('CA-03.12: concluir o alerta à mão não quita o título, e ele não volta no mesmo dia', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await sincronizarAlertasDosTitulos([novo.id], HOJE);
      const [alerta] = await abertosDe(novo.id);
      await concluirAtividade(alerta!.id, ID_KIMBERLY);
      expect((await repositorios.titulo.obter(novo.id))?.situacao).toBe('aberto');
      expect(await sincronizarAlertasDosTitulos([novo.id], HOJE)).toBe(0);
      expect(await abertosDe(novo.id)).toEqual([]);
    });

    it('CA-03.13: adiar o vencimento atualiza o alerta existente, mesmo para fora da janela', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await sincronizarAlertasDosTitulos([novo.id], HOJE);
      await salvarTitulo(novo.id, { ...formularioDoTitulo((await repositorios.titulo.obter(novo.id))!), vencimento: '2026-11-09' });
      expect(await alertasDe(novo.id)).toMatchObject([{ situacao: 'a_fazer', prazo: '2026-11-09', alerta_data_referencia: '2026-11-09' }]);
      await salvarTitulo(novo.id, { ...formularioDoTitulo((await repositorios.titulo.obter(novo.id))!), vencimento: '2026-12-20' });
      expect(await alertasDe(novo.id)).toMatchObject([{ situacao: 'a_fazer', prazo: '2026-12-20' }]);
      expect(await sincronizarAlertasDosTitulos(undefined, HOJE)).toBeGreaterThanOrEqual(0);
      expect(await alertasDe(novo.id)).toHaveLength(1);
    });

    it('vencido substitui o de vencimento próximo, e o estorno faz o alerta voltar', async () => {
      const novo = await criarDespesa(despesa({ vencimento: HOJE }), ID_KIMBERLY, HOJE);
      await sincronizarAlertasDosTitulos([novo.id], HOJE);
      vi.setSystemTime(new Date('2026-11-07T15:00:00.000Z'));
      await sincronizarAlertasDosTitulos([novo.id], '2026-11-07');
      const alertas = await alertasDe(novo.id);
      expect(alertas.find((alerta) => alerta.alerta_motivo === 'Vencimento próximo')).toMatchObject({ situacao: 'concluida', conclusao_nota: 'Substituído pelo alerta de vencido.' });
      expect(alertas.find((alerta) => alerta.alerta_motivo === 'Vencido')).toMatchObject({ situacao: 'a_fazer', prazo: HOJE });
      const atual = (await repositorios.titulo.obter(novo.id))!;
      await registrarBaixa(atual, { ...formularioBaixaVazio(atual, 100, '2026-11-07'), conta_id: ID_CONTA_KIMBERLY, tratamento: 'aporte', comprovante_url: DRIVE }, '2026-11-07');
      expect(await abertosDe(novo.id)).toEqual([]);
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: novo.id } });
      await estornarBaixa(baixa!.id, 'Lançado errado', '2026-11-07');
      expect(await abertosDe(novo.id)).toMatchObject([{ alerta_motivo: 'Vencido' }]);
    });

    it('dispensado não volta, nem depois de um estorno (RN-03.13)', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await sincronizarAlertasDosTitulos([novo.id], HOJE);
      const [alerta] = await abertosDe(novo.id);
      await dispensarAlerta(alerta!.id, 'Vamos pagar pelo boleto do banco');
      await pagar(novo.id);
      const [baixa] = await repositorios.baixa.listar({ onde: { titulo_id: novo.id } });
      await estornarBaixa(baixa!.id, 'Lançado errado', HOJE);
      expect(await abertosDe(novo.id)).toEqual([]);
    });

    it('cancelar o título conclui o alerta', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await sincronizarAlertasDosTitulos([novo.id], HOJE);
      await cancelarTitulo(novo.id, 'Lançado em dobro');
      expect(await alertasDe(novo.id)).toMatchObject([{ situacao: 'concluida', conclusao_nota: 'Concluído: o lançamento foi cancelado.' }]);
    });

    it('o alerta aparece na aba Atividades da ficha, e o botão leva à baixa', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await sincronizarAlertasDosTitulos([novo.id], HOJE);
      const [alerta] = await atividadesDoRegistro('titulo', novo.id);
      expect(alerta).toMatchObject({ tipo: 'alerta', alerta_motivo: 'Vencimento próximo' });
      expect(acaoDoAlerta(alerta!)).toEqual({ rotulo: 'Registrar pagamento', href: `/financeiro/${novo.id}?acao=baixa` });
    });

    it('a despesa já paga não gera alerta', async () => {
      const paga = await criarDespesa(despesa({ pago: true, data_pagamento: HOJE, conta_id: ID_CONTA_KIMBERLY, tratamento: 'aporte', comprovante_url: DRIVE }), ID_KIMBERLY, HOJE);
      expect((await repositorios.titulo.obter(paga.id))?.situacao).toBe('quitado');
      expect(await sincronizarAlertasDosTitulos([paga.id], HOJE)).toBe(0);
      expect(await alertasDe(paga.id)).toEqual([]);
    });

    it('cancelar a ferramenta conclui os alertas dela, com a nota', async () => {
      await repositorios.configuracao.salvar({ alerta_fim_teste_dias: 7 });
      const luma = (await repositorios.ferramenta.listar()).find((item) => item.nome === 'Luma IA')!;
      expect(await sincronizarAlertasDasFerramentas([luma.id], HOJE)).toBe(1);
      expect(await abertosDe(luma.id)).toMatchObject([{ alerta_motivo: 'Fim do período de teste', exemplo: true, responsavel_id: luma.responsavel_tecnico_id }]);
      await cancelarFerramenta(luma.id, { data: HOJE, motivo: 'Não serviu' });
      expect(await alertasDe(luma.id)).toMatchObject([{ situacao: 'concluida', conclusao_nota: 'Concluído por Cancelar ferramenta em Ferramentas.' }]);
    });

    it('a renovação que passou: a data anda, e o alerta se resolve no mesmo dia', async () => {
      const traco = (await repositorios.ferramenta.listar()).find((item) => item.nome === 'Traço Editor')!;
      await sincronizarAlertasDasFerramentas([traco.id], HOJE);
      const [aberto] = await abertosDe(traco.id);
      expect(aberto).toMatchObject({ alerta_motivo: 'Renovação' });
      const { atualizarSituacoesDasFerramentas } = await import('./ferramentas');
      const depois = aberto!.alerta_data_referencia as string;
      const diaSeguinte = new Date(`${depois}T15:00:00.000Z`);
      diaSeguinte.setUTCDate(diaSeguinte.getUTCDate() + 1);
      vi.setSystemTime(diaSeguinte);
      await atualizarSituacoesDasFerramentas(diaSeguinte.toISOString().slice(0, 10));
      expect((await alertasDe(traco.id))[0]).toMatchObject({ situacao: 'concluida', conclusao_nota: 'Concluído: a data de renovação foi atualizada.' });
    });

    it('renovar o domínio conclui o alerta dele', async () => {
      const dominio = (await repositorios.ativo_digital.listar()).find((item) => item.identificador === 'kipi-exemplo.com.br')!;
      expect(await sincronizarAlertasDosAtivos([dominio.id], HOJE)).toBe(1);
      const pessoas = await repositorios.pessoa.listar();
      await salvarAtivo(dominio.id, { ...formularioDoAtivo(dominio), vencimento: '2027-12-01' }, pessoas);
      expect(await alertasDe(dominio.id)).toMatchObject([{ situacao: 'concluida', conclusao_nota: 'Concluído: o vencimento do domínio foi atualizado.' }]);
    });

    it('os exemplos geram alertas de exemplo, que saem ao limpar os exemplos', async () => {
      const novos = await gerarAlertas();
      expect(novos).toBeGreaterThanOrEqual(5);
      const gerados = (await repositorios.atividade.listar({ onde: { tipo: 'alerta' } })).filter((atividade) => atividade.chave_idempotencia);
      expect(gerados.every((atividade) => atividade.exemplo)).toBe(true);
      expect(new Set(gerados.map((atividade) => atividade.alerta_motivo))).toEqual(new Set([MOTIVOS_DE_ALERTA.vencido, MOTIVOS_DE_ALERTA.renovacao, MOTIVOS_DE_ALERTA.dominio]));
      expect(await gerarAlertas()).toBe(0);
      await limparExemplos();
      expect(await repositorios.atividade.listar({ onde: { tipo: 'alerta' } })).toEqual([]);
    });

    it('um título de verdade gera alerta de verdade', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await gerarAlertas();
      expect(await abertosDe(novo.id)).toMatchObject([{ exemplo: false }]);
    });

    it('pagar pela despesa já lançada também resolve (registrarPagamento direto, pela rotina)', async () => {
      const novo = await criarDespesa(despesa(), ID_KIMBERLY, HOJE);
      await gerarAlertas();
      await registrarPagamento(novo.id, { data: HOJE, contaId: ID_CONTA_KIMBERLY, valorMoeda: 100, cambio: null, iofBrl: null, valorBrl: 100, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null, pagoAMais: false, motivo: null }, HOJE);
      await gerarAlertas();
      expect(await abertosDe(novo.id)).toEqual([]);
    });
  });
});
