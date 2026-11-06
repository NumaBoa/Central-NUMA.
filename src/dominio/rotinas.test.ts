import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { listarHistorico } from '@/dados/historico';
import { esquecerMetaEmMemoria, lerMeta } from '@/dados/meta';
import { executarRotinas, mensagemDasRotinas, ROTINAS_DO_DIA, type Rotina } from './rotinas';

function rotinaQueConta(nome: string, novos = 0, extra: Partial<Rotina> = {}) {
  const executar = vi.fn(async () => novos);
  return { nome, executar, ...extra };
}

describe('rotinas do dia', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-05T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  it('seguem a ordem da especificação (02 §0.5)', () => {
    expect(ROTINAS_DO_DIA.map((r) => r.nome)).toEqual(['Gerar alertas', 'Gerar ocorrências de rotinas', 'Atualizar situações', 'Estender programação']);
  });

  it('rodam ao abrir e não repetem no mesmo dia', async () => {
    const rotina = rotinaQueConta('Gerar alertas', 2);
    expect(await executarRotinas({ rotinas: [rotina] })).toEqual({ executou: true, novos: 2, falhas: [], novidades: [] });
    expect(await executarRotinas({ rotinas: [rotina] })).toEqual({ executou: false, novos: 0, falhas: [], novidades: [] });
    expect(rotina.executar).toHaveBeenCalledTimes(1);
    expect(lerMeta().ultima_rotina_em).toBe('2026-11-05T15:00:00.000Z');
  });

  it('voltam a rodar no dia seguinte, no fuso de São Paulo', async () => {
    const rotina = rotinaQueConta('Gerar alertas');
    await executarRotinas({ rotinas: [rotina] });
    vi.setSystemTime(new Date('2026-11-06T02:59:00.000Z')); // ainda dia 5 em São Paulo
    await executarRotinas({ rotinas: [rotina] });
    expect(rotina.executar).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-11-06T03:01:00.000Z')); // já dia 6
    await executarRotinas({ rotinas: [rotina] });
    expect(rotina.executar).toHaveBeenCalledTimes(2);
  });

  it('duas rodadas ao mesmo tempo não geram em dobro', async () => {
    const rotina = rotinaQueConta('Gerar alertas', 1);
    const [primeira, segunda] = await Promise.all([executarRotinas({ rotinas: [rotina] }), executarRotinas({ rotinas: [rotina] })]);
    expect(rotina.executar).toHaveBeenCalledTimes(1);
    expect(primeira.executou).toBe(true);
    expect(segunda.executou).toBe(false);
  });

  it('"Rodar rotinas agora" durante outra rodada espera a vez e roda, em vez de dizer "nada novo"', async () => {
    const rotina = rotinaQueConta('Gerar alertas', 1);
    const [automatica, manual] = await Promise.all([executarRotinas({ rotinas: [rotina] }), executarRotinas({ rotinas: [rotina], manual: true })]);
    expect(automatica.executou).toBe(true);
    expect(manual).toMatchObject({ executou: true, novos: 1 });
    expect(rotina.executar).toHaveBeenCalledTimes(2);
  });

  it('o botão "Rodar rotinas agora" roda mesmo se já rodaram hoje', async () => {
    const rotina = rotinaQueConta('Gerar alertas');
    await executarRotinas({ rotinas: [rotina] });
    await executarRotinas({ rotinas: [rotina], manual: true });
    expect(rotina.executar).toHaveBeenCalledTimes(2);
  });

  it('a extensão da programação só roda no dia 1', async () => {
    const mensal = rotinaQueConta('Estender programação', 0, { soNoDiaPrimeiro: true });
    await executarRotinas({ rotinas: [mensal] });
    expect(mensal.executar).not.toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-12-01T15:00:00.000Z'));
    await executarRotinas({ rotinas: [mensal] });
    expect(mensal.executar).toHaveBeenCalledTimes(1);
  });

  it('uma rotina com falha não impede as outras, e o dia fica para tentar de novo', async () => {
    const quebrada: Rotina = {
      nome: 'Atualizar situações',
      executar: async () => {
        throw new Error('falhou');
      },
    };
    const depois = rotinaQueConta('Estender', 1);
    expect(await executarRotinas({ rotinas: [quebrada, depois] })).toEqual({ executou: true, novos: 1, falhas: ['Atualizar situações'], novidades: [] });
    expect(depois.executar).toHaveBeenCalled();
    expect(lerMeta().ultima_rotina_em).toBeNull();
  });

  it('registra no histórico só o que importa: abertura sem novidade não suja', async () => {
    const antes = (await listarHistorico()).length;
    await executarRotinas({ rotinas: [rotinaQueConta('Nada')] });
    expect(await listarHistorico()).toHaveLength(antes);

    await executarRotinas({ rotinas: [rotinaQueConta('Nada')], manual: true });
    const [evento] = await listarHistorico();
    expect(evento?.depois).toMatchObject({ funcao: 'rodar_rotinas', novos: 0 });
    expect(evento?.usuario_id).not.toBeNull();
  });
});

describe('mensagemDasRotinas', () => {
  it('fala como a especificação', () => {
    expect(mensagemDasRotinas({ novidades: ['3 alertas novos'], falhas: [] })).toBe('Rotinas do dia executadas: 3 alertas novos.');
    expect(mensagemDasRotinas({ novidades: ['1 alerta novo', '9 ocorrências novas'], falhas: [] })).toBe('Rotinas do dia executadas: 1 alerta novo e 9 ocorrências novas.');
    expect(mensagemDasRotinas({ novidades: [], falhas: [] })).toBe('Rotinas do dia executadas: nada novo.');
    expect(mensagemDasRotinas({ novidades: [], falhas: ['Gerar alertas'] })).toContain('Gerar alertas');
  });
});
