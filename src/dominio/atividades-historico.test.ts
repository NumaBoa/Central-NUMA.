import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_BRUNA, ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { carregarMeuDia, concluirAtividade, FILTROS_MEU_DIA_INICIAIS, atividadesDaBase, reabrirAtividade, cancelarAtividade, type OpcoesDosFiltros } from './atividades';
import { atividadesDoHistorico, CONCLUIDA_PELO_SISTEMA, encerradaEm, FILTROS_HISTORICO_INICIAIS, type FiltrosHistorico } from './atividades-historico';
import { ID_CONSOLIDADA } from './contextos';

const HOJE = '2026-11-06';
const OPCOES: OpcoesDosFiltros = { hoje: HOJE, pessoaAtualId: ID_KIMBERLY, contextoGlobalId: ID_CONSOLIDADA, nomeDaPessoa: () => '' };

describe('T03.04: Histórico', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-06T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  const titulos = async (alteracoes: Partial<FiltrosHistorico> = {}, opcoes: Partial<OpcoesDosFiltros> = {}) => {
    const { atividades } = await carregarMeuDia();
    return atividadesDoHistorico(atividades, { ...FILTROS_HISTORICO_INICIAIS, ...alteracoes }, { ...OPCOES, ...opcoes }).map((atividade) => atividade.titulo);
  };

  it('concluídas e canceladas, as mais recentes primeiro', async () => {
    expect(await titulos()).toEqual(['Enviar o logotipo final do Zupi', 'Conferir as faturas de hospedagem', 'Atualizar a lista de fornecedores', 'Testar outra plataforma de e-mail', 'Conferir o extrato do cartão']);
  });

  it('concluída ontem não está no quadro de hoje, mas está no Histórico (CA-03.08)', async () => {
    const { atividades } = await carregarMeuDia();
    const noQuadro = atividadesDaBase(atividades, FILTROS_MEU_DIA_INICIAIS, OPCOES).map((atividade) => atividade.titulo);
    expect(noQuadro).not.toContain('Atualizar a lista de fornecedores');
    expect(await titulos()).toContain('Atualizar a lista de fornecedores');
    // A de hoje está nos dois.
    expect(noQuadro).toContain('Enviar o logotipo final do Zupi');
    expect(await titulos()).toContain('Enviar o logotipo final do Zupi');
  });

  it('por situação', async () => {
    expect(await titulos({ situacao: 'cancelada' })).toEqual(['Testar outra plataforma de e-mail']);
    expect(await titulos({ situacao: 'concluida' })).not.toContain('Testar outra plataforma de e-mail');
  });

  it('pelo período, contando o cancelamento', async () => {
    expect(await titulos({ conclusao: 'hoje' })).toEqual(['Enviar o logotipo final do Zupi', 'Conferir as faturas de hospedagem']);
    expect(await titulos({ conclusao: '7dias' })).toEqual(['Enviar o logotipo final do Zupi', 'Conferir as faturas de hospedagem', 'Atualizar a lista de fornecedores', 'Testar outra plataforma de e-mail']);
    expect(await titulos({ conclusao: '30dias' })).toContain('Conferir o extrato do cartão');
    expect(await titulos({ conclusao: 'mes' })).not.toContain('Conferir o extrato do cartão');
    expect(await titulos({ conclusao: 'intervalo', conclusaoDe: '2026-10-01', conclusaoAte: '2026-10-31' })).toEqual(['Conferir o extrato do cartão']);
    expect(await titulos({ conclusao: 'intervalo', conclusaoDe: '2026-11-05' })).toContain('Atualizar a lista de fornecedores');
    expect(await titulos({ conclusao: 'intervalo', conclusaoAte: '2026-10-31' })).toEqual(['Conferir o extrato do cartão']);
  });

  it('por quem concluiu', async () => {
    expect(await titulos({ concluidaPor: ID_CAMILA })).toEqual(['Atualizar a lista de fornecedores']);
    expect(await titulos({ concluidaPor: ID_BRUNA })).toEqual(['Enviar o logotipo final do Zupi']);
    expect(await titulos({ concluidaPor: CONCLUIDA_PELO_SISTEMA })).toEqual([]);
  });

  it('com os filtros do Meu dia', async () => {
    expect(await titulos({ busca: 'logotipo' })).toEqual(['Enviar o logotipo final do Zupi']);
    expect(await titulos({ pessoa: ID_CAMILA })).toEqual(['Atualizar a lista de fornecedores']);
    expect(await titulos({ contextos: [ID_PRODUTO_ZUPI] })).toEqual(['Enviar o logotipo final do Zupi']);
    expect(await titulos({}, { contextoGlobalId: ID_PRODUTO_ZUPI })).toEqual(['Enviar o logotipo final do Zupi']);
    expect(await titulos({ prioridades: ['urgente'] })).toEqual([]);
  });

  it('reabrir tira do Histórico; o motivo do cancelamento não fica para trás', async () => {
    const { atividades } = await carregarMeuDia();
    const cancelada = atividades.find((atividade) => atividade.situacao === 'cancelada')!;
    await reabrirAtividade(cancelada.id, 'Vamos testar de novo');
    expect(await titulos()).not.toContain(cancelada.titulo);
    const depois = (await carregarMeuDia()).atividades.find((atividade) => atividade.id === cancelada.id)!;
    expect(depois).toMatchObject({ situacao: 'a_fazer', cancelada_motivo: null, dispensada_motivo: null });
  });

  it('a data do encerramento', async () => {
    const { atividades } = await carregarMeuDia();
    const aberta = atividades.find((atividade) => atividade.situacao === 'a_fazer')!;
    await concluirAtividade(aberta.id, ID_KIMBERLY);
    const concluida = (await carregarMeuDia()).atividades.find((atividade) => atividade.id === aberta.id)!;
    expect(encerradaEm(concluida)).toBe(concluida.concluida_em);
    const outra = atividades.find((atividade) => atividade.situacao === 'em_andamento')!;
    await cancelarAtividade(outra.id, 'Fim');
    const cancelada = (await carregarMeuDia()).atividades.find((atividade) => atividade.id === outra.id)!;
    expect(encerradaEm(cancelada)).toBe(cancelada.atualizado_em);
  });
});
