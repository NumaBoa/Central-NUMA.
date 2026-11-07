import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_BRUNA, ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { criarAtividade, formularioAtividadeVazio, type FormularioAtividade } from './atividades-formulario';
import { carregarPainel } from './atividades-painel';
import { errosDoRascunho, mudancasDoRascunho, rascunhoDoPainel, salvarRascunho, temMudancas, type RascunhoDaAtividade } from './atividades-rascunho';
import { ID_CONSOLIDADA } from './contextos';
import { historicoDaAtividade } from './historico';
import { criarRotina, modeloVazio } from './recorrencias';

const novo = (alteracoes: Partial<FormularioAtividade> = {}): FormularioAtividade => ({ ...formularioAtividadeVazio('tarefa', ID_KIMBERLY, ID_CONSOLIDADA), titulo: 'Atividade nova', ...alteracoes });

describe('T03.02: o rascunho da janela da atividade', () => {
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

  const painelDe = async (id: string) => (await carregarPainel(id))!;
  const textos = async (id: string) => (await historicoDaAtividade(id)).map((linha) => linha.texto);

  it('sem mudar nada, não há o que salvar', async () => {
    const { id } = await criarAtividade(novo({ prazo: '2026-11-10', descricao: 'Com descrição' }));
    const painel = await painelDe(id);
    expect(temMudancas(mudancasDoRascunho(painel, rascunhoDoPainel(painel)))).toBe(false);
    // Espaços nas pontas e a ordem das pessoas não contam como mudança.
    const parecido: RascunhoDaAtividade = { ...rascunhoDoPainel(painel), titulo: ' Atividade nova ', descricao: 'Com descrição ' };
    expect(temMudancas(mudancasDoRascunho(painel, parecido))).toBe(false);
  });

  it('o que mudou, separado do que uma rotina guarda', async () => {
    const { id } = await criarAtividade(novo({ prazo: '2026-11-10' }));
    const painel = await painelDe(id);
    const mudancas = mudancasDoRascunho(painel, { ...rascunhoDoPainel(painel), titulo: 'Outro', prioridade: 'alta', produtos: [ID_PRODUTO_KIPI], participantes: [ID_CAMILA] });
    expect(mudancas).toEqual({ campos: { titulo: 'Outro', prioridade: 'alta', produtos: [ID_PRODUTO_KIPI], participantes: [ID_CAMILA] }, datas: false, acompanhamento: false, etiquetas: false });
    expect(mudancasDoRascunho(painel, { ...rascunhoDoPainel(painel), prazo: '2026-11-20' })).toMatchObject({ campos: {}, datas: true });
  });

  it('confere o que a tela pede, com a mensagem de cada campo', async () => {
    const { id } = await criarAtividade(novo());
    const base = rascunhoDoPainel(await painelDe(id));
    expect(errosDoRascunho(base, 'tarefa')).toEqual({});
    expect(errosDoRascunho({ ...base, titulo: '  ' }, 'tarefa')).toEqual({ titulo: 'Informe o título.' });
    expect(errosDoRascunho({ ...base, titulo: 'x'.repeat(141) }, 'tarefa')).toEqual({ titulo: 'Use até 140 caracteres.' });
    expect(errosDoRascunho({ ...base, responsavel_id: '' }, 'tarefa')).toEqual({ responsavel_id: 'Escolha a responsável.' });
    expect(errosDoRascunho({ ...base, solicitante_pessoa_id: '', solicitante_texto: ' ' }, 'demanda')).toEqual({ solicitante_texto: 'Diga quem pediu.' });
    expect(errosDoRascunho({ ...base, solicitante_pessoa_id: '', solicitante_texto: 'Cliente' }, 'demanda')).toEqual({});
    expect(errosDoRascunho(base, 'lembrete')).toEqual({ aviso_dia: 'Informe a data do aviso.', aviso_hora: 'Informe a hora do aviso.' });
    expect(errosDoRascunho({ ...base, aviso_dia: '2026-11-09' }, 'tarefa')).toEqual({ aviso_hora: 'Informe o dia e a hora do aviso.' });
    expect(errosDoRascunho({ ...base, prazo_hora: '10:00' }, 'tarefa')).toEqual({ prazo: 'Informe o dia do prazo.' });
    expect(errosDoRascunho({ ...base, prazo: '2026-11-10', inicio: '2026-11-11' }, 'tarefa')).toEqual({ inicio: 'O início precisa ser antes do prazo.' });
    expect(errosDoRascunho({ ...base, prazo: '2026-11-10', aviso_dia: '2026-11-11', aviso_hora: '08:00' }, 'tarefa')).toEqual({ aviso_dia: 'O aviso precisa ser antes do prazo.' });
  });

  it('salva tudo de uma vez, com o prazo anterior no histórico (CA-03.05)', async () => {
    const { id } = await criarAtividade(novo({ prazo: '2026-11-10' }));
    const painel = await painelDe(id);
    await salvarRascunho(id, painel, { ...rascunhoDoPainel(painel), titulo: 'Outro título', descricao: 'Nova', prazo: '2026-11-20', prazo_hora: '10:00', participantes: [ID_BRUNA] }, 'esta');
    const depois = await painelDe(id);
    expect(depois.atividade).toMatchObject({ titulo: 'Outro título', descricao: 'Nova', prazo: '2026-11-20', prazo_hora: '10:00', adiamentos: 1 });
    expect(depois.participantes).toEqual([ID_BRUNA]);
    const historico = (await textos(id)).join(' | ');
    expect(historico).toContain('Prazo: de 10/11/2026 para 20/11/2026');
    expect(historico).toContain('Título: de Atividade nova para Outro título');
  });

  it('mudar juntos o prazo e o aviso, que um sozinho barraria', async () => {
    const { id } = await criarAtividade(novo({ prazo: '2026-11-20', aviso_dia: '2026-11-18', aviso_hora: '08:00' }));
    const painel = await painelDe(id);
    await salvarRascunho(id, painel, { ...rascunhoDoPainel(painel), prazo: '2026-11-10', aviso_dia: '2026-11-09' }, 'esta');
    const { atividade } = await painelDe(id);
    expect(atividade.prazo).toBe('2026-11-10');
    expect(atividade.aviso_em).toBe('2026-11-09T11:00:00.000Z');
  });

  it('se uma parte falha, nada muda (AR-02)', async () => {
    const { id } = await criarAtividade(novo({ prazo: '2026-11-10' }));
    const painel = await painelDe(id);
    await expect(salvarRascunho(id, painel, { ...rascunhoDoPainel(painel), titulo: 'Outro', inicio: '2026-11-11' }, 'esta')).rejects.toThrow('O início precisa ser antes do prazo.');
    expect((await painelDe(id)).atividade).toMatchObject({ titulo: 'Atividade nova', inicio: null });
  });

  it('numa ocorrência, a data é só dela, e os campos seguem o escopo (RN-03.17)', async () => {
    const { rotina, primeira } = await criarRotina({ titulo: 'Rotina', responsavel_id: ID_KIMBERLY, modelo: modeloVazio('tarefa'), regra: { frequencia: 'semanal', intervalo: 1, dias_semana: [1], dia_mes: null, ultimo_dia: false, mes: null, hora: null, inicio: '2026-11-09', fim_data: null, fim_ocorrencias: null } });
    const id = primeira!.id;
    const painel = await painelDe(id);
    await salvarRascunho(id, painel, { ...rascunhoDoPainel(painel), prazo: '2026-11-12' }, 'esta');
    expect((await painelDe(id)).atividade).toMatchObject({ prazo: '2026-11-12', editada_individualmente: true });
    expect((await repositorios.recorrencia.obter(rotina.id))?.situacao).toBe('ativa');

    const depois = await painelDe(id);
    await salvarRascunho(id, depois, { ...rascunhoDoPainel(depois), descricao: 'Vale daqui em diante' }, 'proximas');
    expect((await repositorios.recorrencia.obter(rotina.id))?.situacao).toBe('encerrada');
    const novaRotina = (await repositorios.recorrencia.listar()).find((item) => item.substitui_id === rotina.id);
    expect(novaRotina?.modelo.descricao).toBe('Vale daqui em diante');
  });
});
