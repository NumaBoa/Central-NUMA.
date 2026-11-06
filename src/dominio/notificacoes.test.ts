import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_BRUNA, ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { concluirAtividade, adiarAtividade, trocarResponsavel } from './atividades';
import { criarAtividade, formularioAtividadeVazio } from './atividades-formulario';
import { comentar, editarComentario } from './atividades-painel';
import { ID_CONSOLIDADA } from './contextos';
import { limparExemplos, resumoDosDados } from './dados';
import { REGISTROS_INICIAIS } from './apoio-testes';
import { caminhoDaNotificacao, carregarNotificacoes, marcarComoLida, marcarTodasComoLidas, sincronizarNotificacoes } from './notificacoes';
import { executarRotinas } from './rotinas';
import { listarHistorico } from '@/dados/historico';

const pessoas = [
  { id: ID_KIMBERLY, nome_completo: 'Kimberly Grebe' },
  { id: ID_CAMILA, nome_completo: 'Camila Lima' },
  { id: ID_BRUNA, nome_completo: 'Bruna Alves' },
];

describe('T13.04: o sino', () => {
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

  const novaAtividade = (alteracoes = {}) => criarAtividade({ ...formularioAtividadeVazio('tarefa', ID_KIMBERLY, ID_CONSOLIDADA), titulo: 'Uma atividade', ...alteracoes });
  const titulos = async (pessoa: string) => (await carregarNotificacoes(pessoa)).map((notificacao) => notificacao.titulo);

  describe('carga inicial', () => {
    it('as menções dos comentários de exemplo já estão lá', async () => {
      expect(await titulos(ID_KIMBERLY)).toEqual(['Camila mencionou você em Definir o preço da oferta anual']);
      expect(await titulos(ID_CAMILA)).toEqual(['Kimberly mencionou você em Definir o preço da oferta anual']);
    });

    it('não contam como registro', async () => {
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS);
    });
  });

  describe('menções (RN-03.22)', () => {
    it('quem foi mencionado recebe, menos quem escreveu', async () => {
      const { id } = await novaAtividade();
      await comentar(id, '@camila @kimberly olhem isso', ID_KIMBERLY, pessoas);
      expect((await titulos(ID_CAMILA))[0]).toBe('Kimberly mencionou você em Uma atividade');
      expect(await titulos(ID_KIMBERLY)).toHaveLength(1);
      const [nova] = await carregarNotificacoes(ID_CAMILA);
      expect(nova).toMatchObject({ tipo: 'mencao', registro_tipo: 'atividade', registro_id: id, lida_em: null });
      expect(caminhoDaNotificacao(nova!)).toBe(`/meu-dia?atividade=${id}`);
    });

    it('editar só avisa quem entrou agora', async () => {
      const { id } = await novaAtividade();
      const comentario = await comentar(id, 'Fala @camila', ID_KIMBERLY, pessoas);
      await editarComentario(comentario.id, 'Fala @camila e @bruna', pessoas, ID_KIMBERLY);
      expect((await titulos(ID_CAMILA)).filter((titulo) => titulo.endsWith('Uma atividade'))).toHaveLength(1);
      expect(await titulos(ID_BRUNA)).toEqual(['Kimberly mencionou você em Uma atividade']);
    });

    it('sem menção, nada', async () => {
      const antes = (await repositorios.notificacao.listar()).length;
      const { id } = await novaAtividade();
      await comentar(id, 'Sem chamar ninguém', ID_KIMBERLY, pessoas);
      expect((await repositorios.notificacao.listar()).length).toBe(antes);
    });
  });

  describe('alertas e lembretes', () => {
    it('o alerta aberto vai para a responsável, uma vez só', async () => {
      await sincronizarNotificacoes();
      const alerta = (await carregarNotificacoes(ID_CAMILA)).find((notificacao) => notificacao.tipo === 'alerta');
      expect(alerta).toMatchObject({ titulo: 'Exportar os dados da Central', exemplo: true });
      const total = (await repositorios.notificacao.listar()).length;
      await sincronizarNotificacoes();
      expect((await repositorios.notificacao.listar()).length).toBe(total);
    });

    it('quem assume o alerta recebe também', async () => {
      await sincronizarNotificacoes();
      const alerta = (await repositorios.atividade.listar({ onde: { tipo: 'alerta' } }))[0]!;
      await trocarResponsavel(alerta.id, ID_KIMBERLY);
      await sincronizarNotificacoes();
      expect(await titulos(ID_KIMBERLY)).toContain('Exportar os dados da Central');
    });

    it('alerta resolvido sai das não lidas, e continua no sino como lido', async () => {
      await sincronizarNotificacoes();
      const alerta = (await repositorios.atividade.listar({ onde: { tipo: 'alerta' } }))[0]!;
      await concluirAtividade(alerta.id, ID_CAMILA);
      await sincronizarNotificacoes();
      const linha = (await carregarNotificacoes(ID_CAMILA)).find((notificacao) => notificacao.tipo === 'alerta');
      expect(linha?.lida_em).toBe('2026-11-06T15:00:00.000Z');
    });

    it('o lembrete dispara na hora, nem antes nem duas vezes (RN-03.21)', async () => {
      const lembrete = await novaAtividade({ tipo: 'lembrete', titulo: 'Ligar para o contador', aviso_dia: '2026-11-06', aviso_hora: '14:00' });
      await sincronizarNotificacoes(new Date('2026-11-06T16:59:00.000Z'));
      expect(await titulos(ID_KIMBERLY)).not.toContain('Ligar para o contador');
      await sincronizarNotificacoes(new Date('2026-11-06T17:00:00.000Z'));
      await sincronizarNotificacoes(new Date('2026-11-06T17:01:00.000Z'));
      const delas = (await carregarNotificacoes(ID_KIMBERLY)).filter((notificacao) => notificacao.titulo === 'Ligar para o contador');
      expect(delas).toHaveLength(1);
      expect(delas[0]).toMatchObject({ tipo: 'lembrete', registro_id: lembrete.id });
    });

    it('adiar o lembrete faz disparar de novo, no novo horário', async () => {
      const lembrete = await novaAtividade({ tipo: 'lembrete', titulo: 'Ligar para o contador', aviso_dia: '2026-11-06', aviso_hora: '09:00' });
      await sincronizarNotificacoes();
      await adiarAtividade(lembrete.id, '2026-11-07', '2026-11-06');
      await sincronizarNotificacoes(new Date('2026-11-07T13:00:00.000Z'));
      expect((await carregarNotificacoes(ID_KIMBERLY)).filter((notificacao) => notificacao.titulo === 'Ligar para o contador')).toHaveLength(2);
    });

    it('lembrete concluído antes da hora não dispara', async () => {
      const lembrete = await novaAtividade({ tipo: 'lembrete', titulo: 'Ligar para o contador', aviso_dia: '2026-11-06', aviso_hora: '14:00' });
      await concluirAtividade(lembrete.id, ID_KIMBERLY);
      await sincronizarNotificacoes(new Date('2026-11-06T18:00:00.000Z'));
      expect(await titulos(ID_KIMBERLY)).not.toContain('Ligar para o contador');
    });

    it('o aviso de tarefa também dispara', async () => {
      await novaAtividade({ titulo: 'Tarefa com aviso', prazo: '2026-11-10', aviso_dia: '2026-11-06', aviso_hora: '10:00' });
      await sincronizarNotificacoes();
      expect(await titulos(ID_KIMBERLY)).toContain('Tarefa com aviso');
    });

    it('duas ao mesmo tempo não repetem', async () => {
      await Promise.all([sincronizarNotificacoes(), sincronizarNotificacoes()]);
      expect((await repositorios.notificacao.listar()).filter((notificacao) => notificacao.tipo === 'alerta')).toHaveLength(1);
    });
  });

  describe('falhas das rotinas do dia', () => {
    it('vão para a responsável de Tecnologia, abrindo a tela de Dados', async () => {
      const quebrada = { nome: 'Gerar alertas', executar: async () => Promise.reject(new Error('falhou')) };
      await executarRotinas({ rotinas: [quebrada] });
      const [falha] = await carregarNotificacoes(ID_CAMILA);
      expect(falha).toMatchObject({ tipo: 'job', titulo: 'A rotina do dia “Gerar alertas” não terminou' });
      expect(caminhoDaNotificacao(falha!)).toBe('/configuracoes/dados');
      await executarRotinas({ rotinas: [quebrada] });
      expect((await carregarNotificacoes(ID_CAMILA)).filter((notificacao) => notificacao.tipo === 'job')).toHaveLength(1);
    });
  });

  describe('o sino', () => {
    it('marcar como lida e marcar todas, só as da pessoa', async () => {
      const [primeira] = await carregarNotificacoes(ID_KIMBERLY);
      await marcarComoLida(primeira!.id);
      expect((await carregarNotificacoes(ID_KIMBERLY))[0]?.lida_em).toBe('2026-11-06T15:00:00.000Z');
      const { id } = await novaAtividade();
      await comentar(id, '@kimberly @bruna', ID_CAMILA, pessoas);
      await marcarTodasComoLidas(ID_KIMBERLY);
      expect((await carregarNotificacoes(ID_KIMBERLY)).every((notificacao) => notificacao.lida_em)).toBe(true);
      expect((await carregarNotificacoes(ID_BRUNA)).every((notificacao) => !notificacao.lida_em)).toBe(true);
    });

    it('lidas somem depois de 30 dias; não lidas ficam', async () => {
      const [lida] = await carregarNotificacoes(ID_KIMBERLY);
      await marcarComoLida(lida!.id);
      const { id } = await novaAtividade();
      await comentar(id, '@kimberly', ID_CAMILA, pessoas);
      expect(await carregarNotificacoes(ID_KIMBERLY, new Date('2026-12-06T15:00:00.000Z'))).toHaveLength(2);
      const depois = await carregarNotificacoes(ID_KIMBERLY, new Date('2026-12-07T15:00:00.000Z'));
      expect(depois.map((notificacao) => notificacao.titulo)).toEqual(['Camila mencionou você em Uma atividade']);
    });

    it('a mais recente primeiro', async () => {
      const { id } = await novaAtividade({ titulo: 'Mais nova' });
      await comentar(id, '@kimberly', ID_CAMILA, pessoas);
      expect((await titulos(ID_KIMBERLY))[0]).toBe('Camila mencionou você em Mais nova');
    });

    it('não entra no histórico (16 §0)', async () => {
      const antes = (await listarHistorico()).length;
      const [primeira] = await carregarNotificacoes(ID_KIMBERLY);
      await marcarComoLida(primeira!.id);
      await sincronizarNotificacoes();
      expect((await listarHistorico()).length).toBe(antes);
    });

    it('sem registro, só informa', () => {
      expect(caminhoDaNotificacao({ registro_tipo: null, registro_id: null })).toBeNull();
    });
  });

  describe('limpar exemplos', () => {
    it('leva as de exemplo, as de quem saiu e as de registros que saíram', async () => {
      await sincronizarNotificacoes();
      const real = await novaAtividade({ titulo: 'De verdade' });
      await comentar(real.id, '@camila @bruna', ID_KIMBERLY, pessoas);
      const exemplo = (await repositorios.atividade.listar()).find((atividade) => atividade.exemplo)!;
      await comentar(exemplo.id, '@camila', ID_KIMBERLY, pessoas);
      await limparExemplos();
      const restantes = await repositorios.notificacao.listar();
      expect(restantes.map((notificacao) => [notificacao.usuario_id, notificacao.titulo])).toEqual([[ID_CAMILA, 'Kimberly mencionou você em De verdade']]);
    });
  });
});
