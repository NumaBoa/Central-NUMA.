import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { listarHistorico } from '@/dados/historico';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { REGISTROS_INICIAIS } from './apoio-testes';
import { adicionarCambio, CAMPOS_NOVO_CAMBIO, esquemaNovoCambio, lerCotacao, listarCambios, removerCambio, type NovoCambio } from './cambio';
import { aplicarImportacao, exportarTudo, resumoDosDados, type ArquivoDeDados } from './dados';
import { historicoRecente } from './historico';

function novo(alteracoes: Partial<NovoCambio> = {}): NovoCambio {
  return { moeda: 'USD', cotacao: '5,42', data_referencia: '2026-11-05', fonte: 'Banco Central', ...alteracoes };
}

function mensagens(alteracoes: Partial<NovoCambio>): string[] {
  const resultado = esquemaNovoCambio.safeParse(novo(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

describe('câmbio de referência', () => {
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

  describe('validação', () => {
    it('moeda, cotação e data são obrigatórias; fonte, não', () => {
      expect(mensagens({ fonte: '' })).toEqual([]);
      expect(mensagens({ cotacao: '' })).toEqual(['Informe a cotação em reais.']);
      expect(mensagens({ data_referencia: '' })).toEqual(['Informe a data de referência.']);
      expect(mensagens({ moeda: '' })).toEqual(['Escolha a moeda.']);
    });

    it('o formulário começa vazio, sem cotação nem data sugeridas', () => {
      expect(CAMPOS_NOVO_CAMBIO).toMatchObject({ cotacao: '', data_referencia: '', fonte: '' });
    });

    it('aceita vírgula ou ponto, com até 6 casas (RT-07)', () => {
      expect(mensagens({ cotacao: '5,42' })).toEqual([]);
      expect(mensagens({ cotacao: '5.42' })).toEqual([]);
      expect(mensagens({ cotacao: '0,000001' })).toEqual([]);
      expect(mensagens({ cotacao: '999999,999999' })).toEqual([]);
      expect(lerCotacao('5,42')).toBe(5.42);
      expect(lerCotacao(' 5.123456 ')).toBe(5.123456);
    });

    it('recusa o que não é número ou passa de numeric(12,6)', () => {
      for (const ruim of ['cinco', '1.234,56', '5,1234567', '1234567', '-5', 'R$ 5']) {
        expect(mensagens({ cotacao: ruim })).toEqual(['Use só números, como 0,00.']);
      }
    });

    it('cotação precisa ser maior que zero', () => {
      expect(mensagens({ cotacao: '0' })).toEqual(['A cotação precisa ser maior que zero.']);
      expect(mensagens({ cotacao: '0,00' })).toEqual(['A cotação precisa ser maior que zero.']);
    });

    it('o real não entra: a cotação já é em reais', () => {
      expect(mensagens({ moeda: 'BRL' })).toEqual(['A cotação já é em reais: escolha outra moeda.']);
    });
  });

  describe('adicionar', () => {
    it('grava com o valor numérico e a fonte, sem marcar como exemplo', async () => {
      const resultado = await adicionarCambio(novo());
      expect(resultado.ok).toBe(true);
      expect(await listarCambios()).toMatchObject([{ moeda: 'USD', valor_brl: 5.42, data_referencia: '2026-11-05', fonte: 'Banco Central', exemplo: false }]);
    });

    it('sem fonte, fica vazio', async () => {
      await adicionarCambio(novo({ fonte: '' }));
      expect((await listarCambios())[0]?.fonte).toBeNull();
    });

    it('a mesma moeda na mesma data não entra duas vezes', async () => {
      await adicionarCambio(novo());
      expect(await adicionarCambio(novo({ cotacao: '6' }))).toEqual({ ok: false, repetido: true });
      expect(await listarCambios()).toHaveLength(1);
      expect((await listarCambios())[0]?.valor_brl).toBe(5.42);
    });

    it('outra moeda ou outra data pode', async () => {
      await adicionarCambio(novo());
      expect((await adicionarCambio(novo({ moeda: 'EUR' }))).ok).toBe(true);
      expect((await adicionarCambio(novo({ data_referencia: '2026-11-06' }))).ok).toBe(true);
      expect(await listarCambios()).toHaveLength(3);
    });

    it('registra no histórico quem adicionou o quê', async () => {
      await adicionarCambio(novo());
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe adicionou o câmbio de USD de 05/11/2026');
    });
  });

  describe('listar', () => {
    it('mais recentes primeiro; na mesma data, por moeda', async () => {
      await adicionarCambio(novo({ moeda: 'USD', data_referencia: '2026-10-01' }));
      await adicionarCambio(novo({ moeda: 'USD', data_referencia: '2026-11-05' }));
      await adicionarCambio(novo({ moeda: 'EUR', data_referencia: '2026-11-05' }));
      expect((await listarCambios()).map((cambio) => `${cambio.moeda} ${cambio.data_referencia}`)).toEqual(['EUR 2026-11-05', 'USD 2026-11-05', 'USD 2026-10-01']);
    });
  });

  describe('remover', () => {
    async function adicionado() {
      const resultado = await adicionarCambio(novo());
      if (!resultado.ok) throw new Error('não entrou');
      return resultado.cambio;
    }

    it('sai da lista, mas fica guardado como arquivado (RT-03)', async () => {
      const { id } = await adicionado();
      await removerCambio(id);
      expect(await listarCambios()).toEqual([]);
      expect((await repositorios.cambio_referencia.obter(id))?.arquivado_em).not.toBeNull();
    });

    it('registra no histórico quem removeu o quê, sem pedir motivo', async () => {
      const { id } = await adicionado();
      await removerCambio(id);
      const [evento] = await listarHistorico({ tabela: 'cambio_referencia' });
      expect(evento).toMatchObject({ acao: 'arquivou', motivo: null });
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe removeu o câmbio de USD de 05/11/2026');
    });

    it('o que foi removido deixa de contar como registro, aqui e ao importar', async () => {
      const { id } = await adicionado();
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS + 1);
      await removerCambio(id);
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS);
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      expect(await aplicarImportacao(arquivo)).toBe(REGISTROS_INICIAIS);
    });

    it('depois de removido, dá para lançar de novo a mesma moeda e data', async () => {
      const { id } = await adicionado();
      await removerCambio(id);
      expect((await adicionarCambio(novo({ cotacao: '5,50' }))).ok).toBe(true);
      expect(await listarCambios()).toMatchObject([{ valor_brl: 5.5 }]);
    });
  });
});
