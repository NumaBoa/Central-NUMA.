import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportarTudo, limparExemplos } from '@/dominio/dados';
import { CHAVE_META, chaveDaTabela, criarArmazenamentoEmMemoria, gravarTabelas, lerTabela, usarDriverDeTeste, type Driver } from '../armazenamento';
import { garantirCarga } from '../carga';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '../meta';
import { repositorios } from '../repositorios';
import { NOMES_TABELAS } from '../tabelas';
import { emTransacao } from '../transacao';
import { DriverNuvem, ID_META, TABELA_MARCAS, TABELA_META, type LinhaNuvem, type Lote } from './driver-nuvem';

/** Faz o papel do banco: mesma regra de `gravar_lote` (supabase/central.sql). */
function criarServidor() {
  const linhas = new Map<string, LinhaNuvem & { ordem: number }>();
  const lotes: Lote[] = [];
  let ordem = 0;
  return {
    lotes,
    aplicar(lote: Lote) {
      lotes.push(structuredClone(lote));
      for (const { tabela, id } of lote.remocoes) linhas.delete(`${tabela}\u0000${id}`);
      for (const { tabela, id, dados } of lote.upserts) {
        const chave = `${tabela}\u0000${id}`;
        const anterior = linhas.get(chave);
        linhas.set(chave, { tabela, id, dados: structuredClone(dados), ordem: anterior?.ordem ?? ++ordem });
      }
    },
    linhas(): LinhaNuvem[] {
      return [...linhas.values()].sort((a, b) => a.ordem - b.ordem).map(({ tabela, id, dados }) => ({ tabela, id, dados }));
    },
  };
}

const esperarEnvio = () => new Promise((pronto) => setTimeout(pronto, 0));

function dadosDePessoa(nome: string, email: string | null = null) {
  return {
    nome_completo: nome,
    nome_exibicao: null,
    tipo: 'externa' as const,
    eh_socia: false,
    contraparte_id: null,
    papeis_contato: [],
    funcao: null,
    email,
    telefone: null,
    cpf: null,
    observacoes: null,
    situacao: 'ativa' as const,
  };
}

describe('Central no Supabase (driver da nuvem)', () => {
  let servidor: ReturnType<typeof criarServidor>;
  let pessoal: Driver;
  let driver: DriverNuvem;

  beforeEach(() => {
    servidor = criarServidor();
    pessoal = criarArmazenamentoEmMemoria();
    driver = new DriverNuvem([], { enviar: (lote) => servidor.aplicar(lote), pessoal });
    usarDriverDeTeste(driver);
    esquecerMetaEmMemoria();
  });

  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
  });

  it('o que vai para o banco volta idêntico em outra entrada, depois de carga, cadastros, transação e limpeza', async () => {
    garantirCarga();
    await repositorios.pessoa.criar(dadosDePessoa('Ana Teste'));
    await emTransacao(async () => {
      const bia = await repositorios.pessoa.criar(dadosDePessoa('Bia Teste'));
      await repositorios.pessoa.atualizar(bia.id, { funcao: 'Financeiro' });
    });
    await exportarTudo();
    await limparExemplos();
    await esperarEnvio();

    const outraEntrada = new DriverNuvem(servidor.linhas(), { enviar: () => {}, pessoal: criarArmazenamentoEmMemoria() });
    for (const tabela of NOMES_TABELAS) {
      const chave = chaveDaTabela(tabela);
      expect(outraEntrada.getItem(chave), tabela).not.toBeNull();
      expect(JSON.parse(outraEntrada.getItem(chave) as string), tabela).toEqual(JSON.parse(driver.getItem(chave) as string));
    }
    const metaDaOutra = JSON.parse(outraEntrada.getItem(CHAVE_META) as string);
    expect(metaDaOutra.versao_dados).toBe(lerMeta().versao_dados);
    expect(metaDaOutra.contadores).toEqual(lerMeta().contadores);
  });

  it('a outra entrada não refaz a carga inicial nem envia nada', async () => {
    garantirCarga();
    await esperarEnvio();
    const enviados: Lote[] = [];
    usarDriverDeTeste(new DriverNuvem(servidor.linhas(), { enviar: (lote) => enviados.push(lote), pessoal: criarArmazenamentoEmMemoria() }));
    esquecerMetaEmMemoria();
    garantirCarga();
    await repositorios.pessoa.listar();
    await esperarEnvio();
    expect(enviados).toEqual([]);
  });

  it('envia só as linhas que mudaram, num lote só, junto com o histórico', async () => {
    garantirCarga();
    const ana = await repositorios.pessoa.criar(dadosDePessoa('Ana Teste'));
    await esperarEnvio();
    servidor.lotes.length = 0;

    await repositorios.pessoa.atualizar(ana.id, { funcao: 'Comercial' });
    await esperarEnvio();

    expect(servidor.lotes).toHaveLength(1);
    const [lote] = servidor.lotes;
    expect(lote?.remocoes).toEqual([]);
    expect(lote?.upserts.map(({ tabela, id }) => [tabela, id === ana.id ? 'ana' : 'evento'])).toEqual([
      ['pessoa', 'ana'],
      ['auditoria', 'evento'],
    ]);
  });

  it('remove do banco o que saiu da tabela', async () => {
    gravarTabelas({ etiqueta: [{ id: 'a' }, { id: 'b' }] });
    await esperarEnvio();
    gravarTabelas({ etiqueta: [{ id: 'b' }] });
    await esperarEnvio();
    expect(servidor.lotes.at(-1)).toEqual({ upserts: [], remocoes: [{ tabela: 'etiqueta', id: 'a' }] });
    expect(servidor.linhas().filter((linha) => linha.tabela === 'etiqueta')).toEqual([{ tabela: 'etiqueta', id: 'b', dados: { id: 'b' } }]);
  });

  it('tabela vazia continua existindo na próxima entrada', async () => {
    gravarTabelas({ etiqueta: [] });
    await esperarEnvio();
    expect(servidor.linhas()).toEqual([{ tabela: TABELA_MARCAS, id: 'etiqueta', dados: true }]);
    const outraEntrada = new DriverNuvem(servidor.linhas(), { enviar: () => {}, pessoal: criarArmazenamentoEmMemoria() });
    expect(outraEntrada.getItem(chaveDaTabela('etiqueta'))).toBe('[]');
    expect(outraEntrada.getItem(chaveDaTabela('marca'))).toBeNull();
  });

  it('versão, rotina e contadores valem para a Numa; o resto do meta fica neste navegador', async () => {
    gravarMeta({ versao_dados: 3, contadores: { 'ATV-2026': 4 }, menu_recolhido: true, pessoa_atual_id: 'p1' });
    await esperarEnvio();
    expect(servidor.linhas()).toEqual([{ tabela: TABELA_META, id: ID_META, dados: { versao_dados: 3, ultima_rotina_em: null, contadores: { 'ATV-2026': 4 } } }]);
    const doNavegador = JSON.parse(pessoal.getItem(CHAVE_META) as string);
    expect(doNavegador).toMatchObject({ menu_recolhido: true, pessoa_atual_id: 'p1' });
    expect(doNavegador).not.toHaveProperty('contadores');

    servidor.lotes.length = 0;
    gravarMeta({ menu_recolhido: false });
    await esperarEnvio();
    expect(servidor.lotes).toEqual([]);
  });

  it('aplica o que outra pessoa gravou e avisa o que mudou', () => {
    gravarTabelas({ etiqueta: [{ id: 'a', nome: 'x' }] });
    expect(driver.aplicarRemota({ tipo: 'upsert', linha: { tabela: 'etiqueta', id: 'a', dados: { id: 'a', nome: 'y' } } })).toBe('dados');
    expect(driver.aplicarRemota({ tipo: 'upsert', linha: { tabela: 'etiqueta', id: 'a', dados: { id: 'a', nome: 'y' } } })).toBeNull();
    expect(driver.aplicarRemota({ tipo: 'upsert', linha: { tabela: 'etiqueta', id: 'c', dados: { id: 'c' } } })).toBe('dados');
    expect(lerTabela('etiqueta')).toEqual([{ id: 'a', nome: 'y' }, { id: 'c' }]);
    expect(driver.aplicarRemota({ tipo: 'remocao', tabela: 'etiqueta', id: 'a' })).toBe('dados');
    expect(lerTabela('etiqueta')).toEqual([{ id: 'c' }]);
    expect(driver.aplicarRemota({ tipo: 'upsert', linha: { tabela: TABELA_META, id: ID_META, dados: { versao_dados: 9, menu_recolhido: true } } })).toBe('meta');
    esquecerMetaEmMemoria();
    expect(lerMeta().versao_dados).toBe(9);
    expect(lerMeta().menu_recolhido).toBe(false);
  });

  it('o que outra pessoa gravou não volta para o banco', async () => {
    gravarTabelas({ etiqueta: [{ id: 'a' }] });
    await esperarEnvio();
    servidor.lotes.length = 0;
    driver.aplicarRemota({ tipo: 'upsert', linha: { tabela: 'etiqueta', id: 'b', dados: { id: 'b' } } });
    gravarTabelas({ etiqueta: [...lerTabela<{ id: string }>('etiqueta'), { id: 'c' }] });
    await esperarEnvio();
    expect(servidor.lotes).toEqual([{ upserts: [{ tabela: 'etiqueta', id: 'c', dados: { id: 'c' } }], remocoes: [] }]);
  });

  it('copia as configurações para o navegador, onde a primeira pintura lê o fuso', () => {
    gravarTabelas({ configuracao: [{ id: 'f', chave: 'fuso', valor: 'America/Manaus' }] });
    expect(JSON.parse(pessoal.getItem(chaveDaTabela('configuracao')) as string)).toEqual([{ id: 'f', chave: 'fuso', valor: 'America/Manaus' }]);
  });

  it('linha sem id não vai para o banco', () => {
    expect(() => driver.setItem(chaveDaTabela('etiqueta'), JSON.stringify([{ nome: 'sem id' }]))).toThrow('Linha sem id');
  });
});
