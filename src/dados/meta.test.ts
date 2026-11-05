import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function armazenamentoFalso(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    dados,
  };
}

async function carregarMeta(localStorage?: unknown) {
  vi.resetModules();
  vi.stubGlobal('window', { localStorage, addEventListener: () => {}, removeEventListener: () => {} });
  return import('./meta');
}

describe('meta', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('começa com os valores iniciais quando não há nada salvo', async () => {
    const { lerMeta, META_INICIAL } = await carregarMeta(armazenamentoFalso());
    expect(lerMeta()).toEqual(META_INICIAL);
  });

  it('grava na chave da especificação e recupera ao recarregar', async () => {
    const falso = armazenamentoFalso();
    const { gravarMeta, CHAVE_META } = await carregarMeta(falso);
    gravarMeta({ pessoa_atual_id: 'camila-lima', menu_recolhido: true });
    expect(CHAVE_META).toBe('numa-central:v1:meta');

    const { lerMeta } = await carregarMeta(falso);
    expect(lerMeta().pessoa_atual_id).toBe('camila-lima');
    expect(lerMeta().menu_recolhido).toBe(true);
  });

  it('ignora conteúdo inválido em vez de quebrar', async () => {
    const { lerMeta, META_INICIAL, CHAVE_META } = await carregarMeta(armazenamentoFalso({ 'numa-central:v1:meta': '{quebrado' }));
    expect(CHAVE_META).toBeDefined();
    expect(lerMeta()).toEqual(META_INICIAL);
  });

  it('continua funcionando em memória com o armazenamento bloqueado', async () => {
    const bloqueado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const { gravarMeta, lerMeta } = await carregarMeta(bloqueado);
    gravarMeta({ contexto_id: 'kipi' });
    expect(lerMeta().contexto_id).toBe('kipi');
  });

  it('avisa quem assinou e para de avisar depois de cancelar', async () => {
    const { gravarMeta, assinarMeta } = await carregarMeta(armazenamentoFalso());
    const ouvinte = vi.fn();
    const cancelar = assinarMeta(ouvinte);
    gravarMeta({ contexto_id: 'zupi' });
    cancelar();
    gravarMeta({ contexto_id: 'kipi' });
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });
});
