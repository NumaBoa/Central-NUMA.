import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_CONTA_KIMBERLY, ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { garantirCompetenciaAberta } from './competencias';
import { CABECALHO_TITULOS, csvDosTitulos, montarPacote, registrarEnvio } from './contador';
import { carregarFechamento, competenciaPadrao, fecharCompetencia, marcarItem, reabrirCompetencia } from './fechamento';
import { criarDespesa, formularioDespesaVazio, registrarPagamento } from './titulos';

const HOJE = '2026-11-08';
const OUTUBRO = '2026-10';

describe('T05.10: fechamento mensal (RN-05.18, CA-05.04)', () => {
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

  const despesa = async (competencia: string) => {
    const categoria = (await repositorios.categoria_financeira.listar()).find((item) => item.tipo === 'despesa' && item.pai_id)!;
    return criarDespesa({ ...formularioDespesaVazio(ID_PRODUTO_KIPI, 'BRL', HOJE), descricao: 'Hospedagem', categoria_id: categoria.id, competencia, valor: '100,00', vencimento: '2026-11-20', pago: false }, ID_KIMBERLY, HOJE);
  };

  it('o mês padrão é o anterior; o checklist tem os 8 itens e os manuais começam pendentes', async () => {
    expect(competenciaPadrao(HOJE)).toBe(OUTUBRO);
    expect(competenciaPadrao('2026-01-15')).toBe('2025-12');
    const tela = await carregarFechamento(OUTUBRO);
    expect(tela.itens.map((item) => item.id)).toEqual(['despesas', 'comprovantes', 'saldos', 'rateios', 'receitas', 'reembolsos', 'kpis', 'contador']);
    expect(tela.itens.filter((item) => item.manual).every((item) => !item.ok)).toBe(true);
    expect(tela.itens.find((item) => item.id === 'saldos')?.detalhe).toBe('Nenhuma conta com saldo controlado');
  });

  it('marcar à mão grava quem marcou; o item automático não se marca', async () => {
    await marcarItem(OUTUBRO, 'rateios', true, ID_KIMBERLY);
    const tela = await carregarFechamento(OUTUBRO);
    expect(tela.itens.find((item) => item.id === 'rateios')).toMatchObject({ ok: true, marca: { por: ID_KIMBERLY } });
    await expect(marcarItem(OUTUBRO, 'saldos', true, ID_KIMBERLY)).rejects.toThrow('sozinha');
    await marcarItem(OUTUBRO, 'rateios', false, ID_KIMBERLY);
    expect((await carregarFechamento(OUTUBRO)).itens.find((item) => item.id === 'rateios')?.ok).toBe(false);
  });

  it('o mês corrente não fecha; com pendência, fechar exige o motivo', async () => {
    await expect(fecharCompetencia('2026-11', ID_KIMBERLY, '', HOJE)).rejects.toThrow('já terminou');
    await expect(fecharCompetencia(OUTUBRO, ID_KIMBERLY, '  ', HOJE)).rejects.toThrow('pendentes');
    await fecharCompetencia(OUTUBRO, ID_KIMBERLY, 'Contador pediu o fechamento hoje', HOJE);
    expect((await carregarFechamento(OUTUBRO)).registro).toMatchObject({ situacao: 'fechada', fechada_por: ID_KIMBERLY, fechada_com_pendencias: 'Contador pediu o fechamento hoje' });
    await expect(fecharCompetencia(OUTUBRO, ID_KIMBERLY, 'de novo', HOJE)).rejects.toThrow('já está fechada');
  });

  it('CA-05.04: competência fechada não aceita lançamento nem baixa; reabrir exige motivo', async () => {
    const titulo = await despesa('2026-11');
    await fecharCompetencia(OUTUBRO, ID_KIMBERLY, 'Teste', HOJE);
    await expect(despesa(OUTUBRO)).rejects.toThrow('10/2026 está fechada');
    await expect(garantirCompetenciaAberta('2026-10-15', 'baixa')).rejects.toThrow('lance um ajuste na competência aberta');
    await expect(registrarPagamento(titulo.id, { data: '2026-10-30', contaId: ID_CONTA_KIMBERLY, valorMoeda: 100, cambio: null, iofBrl: null, valorBrl: 100, comprovanteUrl: 'https://drive.google.com/file/d/x/view', semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null, pagoAMais: false, motivo: null }, HOJE)).rejects.toThrow('não aceita baixa');
    await expect(despesa('2026-11')).resolves.toBeTruthy();
    await expect(reabrirCompetencia(OUTUBRO, ' ', ID_KIMBERLY)).rejects.toThrow('motivo');
    await reabrirCompetencia(OUTUBRO, 'Faltou uma nota fiscal', ID_KIMBERLY);
    await expect(despesa(OUTUBRO)).resolves.toBeTruthy();
    expect((await carregarFechamento(OUTUBRO)).registro).toMatchObject({ situacao: 'aberta', reaberta_motivo: 'Faltou uma nota fiscal' });
  });

  it('T05.11: o pacote traz títulos e baixas do mês; o envio registrado marca o item 8', async () => {
    const titulo = await despesa(OUTUBRO);
    await registrarPagamento(titulo.id, { data: '2026-10-30', contaId: ID_CONTA_KIMBERLY, valorMoeda: 100, cambio: null, iofBrl: null, valorBrl: 100, comprovanteUrl: 'https://drive.google.com/file/d/x/view', semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null, pagoAMais: false, motivo: null }, HOJE);
    const pacote = await montarPacote(OUTUBRO);
    const daHospedagem = pacote.titulos.filter((linha) => linha[2] === 'Hospedagem');
    expect(daHospedagem.map((linha) => linha[1]).sort()).toEqual(['Pagamento', 'Título a pagar']);
    expect(daHospedagem.find((linha) => linha[1] === 'Pagamento')).toEqual(['30/10/2026', 'Pagamento', 'Hospedagem', '', '', expect.any(String), '100,00', expect.any(String), 'https://drive.google.com/file/d/x/view']);
    expect(pacote.comprovantes).toContain('https://drive.google.com/file/d/x/view');
    expect(csvDosTitulos(pacote).split(String.fromCharCode(13, 10))[0]).toContain(CABECALHO_TITULOS.join(';'));
    expect(pacote.movimentos.some((linha) => linha[0] === '30/10/2026' && linha[1] === 'Aporte' && linha[4] === '100,00')).toBe(true);
    await expect(registrarEnvio(OUTUBRO, { data: HOJE, para: '', como: 'E-mail' }, ID_KIMBERLY)).rejects.toThrow('para quem');
    await registrarEnvio(OUTUBRO, { data: HOJE, para: 'Souza Contabilidade', como: 'E-mail' }, ID_KIMBERLY);
    expect((await carregarFechamento(OUTUBRO)).itens.find((item) => item.id === 'contador')).toMatchObject({ ok: true, detalhe: 'Enviado em 08/11/2026 para Souza Contabilidade' });
  });
});
