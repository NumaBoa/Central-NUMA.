import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assinarDados, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from './armazenamento';
import { listarHistorico } from './historico';
import { esquecerMetaEmMemoria } from './meta';
import { repositorios } from './repositorios';
import { emTransacao } from './transacao';

const AREA = { nome: 'Nova', responsavel_padrao_id: null, compartilhada: true, ordem: 99 };

describe('emTransacao', () => {
  let armazenamento: Driver;

  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
  });

  it('dentro da transação, as leituras já veem o que foi gravado', async () => {
    await emTransacao(async () => {
      const area = await repositorios.area.criar(AREA);
      expect(await repositorios.area.obter(area.id)).not.toBeNull();
    });
  });

  it('no fim, grava tudo, com o histórico junto', async () => {
    const antes = (await listarHistorico()).length;
    await emTransacao(async () => {
      const area = await repositorios.area.criar(AREA);
      await repositorios.area.atualizar(area.id, { nome: 'Nova 2' });
    });
    expect((await repositorios.area.listar()).map((area) => area.nome)).toContain('Nova 2');
    expect(await listarHistorico()).toHaveLength(antes + 2);
  });

  it('se o corpo falhar, nada muda, nem o histórico', async () => {
    const areas = await repositorios.area.listar();
    const antes = (await listarHistorico()).length;
    await expect(
      emTransacao(async () => {
        await repositorios.area.criar(AREA);
        throw new Error('falhou no meio');
      }),
    ).rejects.toThrow('falhou no meio');
    expect(await repositorios.area.listar()).toEqual(areas);
    expect(await listarHistorico()).toHaveLength(antes);
  });

  it('avisa as telas uma vez só, no fim', async () => {
    await repositorios.area.listar();
    const avisar = vi.fn();
    const cancelar = assinarDados(avisar);
    await emTransacao(async () => {
      await repositorios.area.criar(AREA);
      await repositorios.area.criar({ ...AREA, nome: 'Outra' });
      expect(avisar).not.toHaveBeenCalled();
    });
    expect(avisar).toHaveBeenCalledTimes(1);
    cancelar();
  });

  it('sem nada gravado, não avisa', async () => {
    await repositorios.area.listar();
    const avisar = vi.fn();
    const cancelar = assinarDados(avisar);
    await emTransacao(async () => {
      await repositorios.area.listar();
    });
    expect(avisar).not.toHaveBeenCalled();
    cancelar();
  });

  it('transação dentro de transação vale como uma só', async () => {
    const areas = (await repositorios.area.listar()).length;
    await expect(
      emTransacao(async () => {
        await emTransacao(async () => {
          await repositorios.area.criar(AREA);
        });
        throw new Error('falhou depois');
      }),
    ).rejects.toThrow('falhou depois');
    expect(await repositorios.area.listar()).toHaveLength(areas);
  });

  it('sem espaço no navegador, nada fica pela metade', async () => {
    const areas = await repositorios.area.listar();
    const setItem = armazenamento.setItem.bind(armazenamento);
    armazenamento.setItem = (chave: string, valor: string) => {
      if (chave.endsWith(':auditoria')) throw new DOMException('cheio', 'QuotaExceededError');
      setItem(chave, valor);
    };
    await expect(
      emTransacao(async () => {
        await repositorios.area.criar(AREA);
      }),
    ).rejects.toMatchObject({ tipo: 'armazenamento' });
    armazenamento.setItem = setItem;
    expect(await repositorios.area.listar()).toEqual(areas);
  });
});
