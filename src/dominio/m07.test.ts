import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_MIMO, ID_PRODUTO_URBANA, ID_PRODUTO_ZARPA, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { TABELAS, VERSAO_DADOS } from '@/dados/tabelas';
import { REGISTROS_INICIAIS } from './apoio-testes';
import { concluirAtividade, estaAberta } from './atividades';
import { calcularCustoMedio, competenciasDaMedia, linhasDeCustoDoProduto, type FontesDeCusto } from './custos-produto';
import { decisoesDoProduto, novaDecisaoVazia, type EntradaDecisao } from './decisoes';
import { carregarKpis, lerValorDeKpi, salvarKpiMensal, salvarKpiProprio, serieDoKpi, ultimoValorDoKpi } from './kpis';
import { areasDisponiveis, carregarPortfolio, errosDaMudanca, filtrarPortfolio, FILTROS_PORTFOLIO_INICIAIS, ITENS_DE_DESCONTINUAR, moverNaFila, mudarEstagio, produtosDaFila, reordenarFila, type DadosDaMudanca } from './portfolio';
import { alertaDoCanal, aprovarPreco, avaliarPiso, canalParaSimulacao, compararSimulacoes, criarRascunhoDaSimulacao, criarRascunhoDePreco, entradasVazias, esquemaFormularioCanal, faseDaVersao, FORMULARIO_CANAL_VAZIO, FORMULARIO_OFERTA_VAZIO, lerPercentual, lerValorDoCampo, ofertasDoProduto, precoVigente, premissasDasEntradas, salvarCanal, salvarOferta, salvarRascunhoDePreco, salvarSimulacao, situacaoEfetivaDaOferta, type DadosDaAprovacao } from './precificacao';
import { atividadesAbertasDoProduto, atividadesDoProduto, criarPlanoDeEncerramento, pendenciasParaAlertas } from './produto-atividades';
import { arquivarProduto } from './produtos';
import { calcularSimulacao, premissasVazias } from './simulador';
import type { Premissas } from '@/dados/tipos/precificacao';

const HOJE = '2026-11-06';

function decisaoNova(dados: Partial<Extract<EntradaDecisao, { modo: 'registrar' }>> = {}): EntradaDecisao {
  return { ...novaDecisaoVazia(HOJE, [ID_KIMBERLY]), titulo: 'Decisão de teste', descricao: 'O que foi decidido', ...dados };
}

async function novoCanal(nome = 'Canal de teste', percentual = '15', fixa = '0,00') {
  return salvarCanal(esquemaFormularioCanal.parse({ ...FORMULARIO_CANAL_VAZIO, nome, taxa_percentual: percentual, taxa_fixa: fixa, verificado_em: '2026-10-01', fonte_url: 'https://exemplo.com.br/taxas' }));
}

async function novaOferta(produtoId = ID_PRODUTO_KIPI, dados: Partial<typeof FORMULARIO_OFERTA_VAZIO> = {}) {
  return salvarOferta(produtoId, { ...FORMULARIO_OFERTA_VAZIO, nome: 'Essencial', ...dados });
}

function premissasDe(canalId: string, nome = 'Canal de teste', dados: Partial<Premissas> = {}): Premissas {
  return { ...premissasVazias(), cf: 300, cf_calculado: 300, cv: 2, tributos_pct: 6, margem_pct: 20, horas: 0, valor_hora: 50, canais: [{ canal_id: canalId, nome, taxa_percentual: 15, taxa_fixa: 0, taxa_fixa_original: 0, taxa_fixa_moeda: 'BRL', cambio: null, verificado_em: '2026-10-01', fonte_url: 'https://exemplo.com.br/taxas' }], volumes: [10, 50, 200], preco_teste: 15, principal: { canal_id: canalId, volume: 50 }, ...dados };
}

async function novaSimulacao(produtoId: string, canalId: string, dados: Partial<Premissas> = {}, ofertaId: string | null = null) {
  return salvarSimulacao({ produto_id: produtoId, oferta_id: ofertaId, nome: 'Cenário', observacao: '', premissas: premissasDe(canalId, 'Canal de teste', dados), anterior_id: null });
}

function aprovacao(canalId: string | null, simulacaoId: string | null, dados: Partial<DadosDaAprovacao> = {}): DadosDaAprovacao {
  return { canal_id: canalId, valor: 15, moeda: 'BRL', periodicidade: 'mensal', valido_de: '2026-11-01', simulacao_id: simulacaoId, decisao: decisaoNova(), justificativa_excecao: '', ...dados };
}

/** Oferta, canal, simulação e rascunho prontos para aprovar. */
async function cenarioDePreco() {
  const canal = await novoCanal();
  const oferta = await novaOferta();
  const simulacao = await novaSimulacao(ID_PRODUTO_KIPI, canal.id);
  const rascunho = await criarRascunhoDePreco(oferta.id, { canal_id: canal.id, valor: 15, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: simulacao.id });
  return { canal, oferta, simulacao, rascunho };
}

function mudanca(dados: Partial<DadosDaMudanca> = {}): DadosDaMudanca {
  return { novo: 'validacao', criterio: 'Dez entrevistas feitas', metrica: '', resultado: '', data: HOJE, decisao: decisaoNova(), plano: null, checklist: [], ...dados };
}

describe('M07 Produtos e precificação', () => {
  let armazenamento: Driver;

  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-06T15:00:00.000Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    usarDriverDeTeste(null);
  });

  describe('carga e migração', () => {
    it('M07 §6: estágios e fila da carga inicial, sem nenhum preço, oferta ou canal', async () => {
      const produtos = await repositorios.produto.listar();
      expect(produtos.map((produto) => [produto.nome, produto.estagio, produto.ordem_fila])).toEqual([
        ['Sobrevivência Urbana', 'em_uso', null],
        ['Kipi', 'em_uso', null],
        ['Zupi', 'ideia', 1],
        ['Zarpa', 'ideia', 2],
        ['Mimo', 'ideia', 3],
      ]);
      for (const tabela of ['oferta', 'preco_versao', 'canal_venda', 'simulacao', 'decisao', 'kpi_mensal'] as const) expect(await repositorios[tabela].listar()).toEqual([]);
    });

    it('as tabelas novas entram sem mudar a contagem da carga', () => {
      expect(Object.keys(TABELAS)).toEqual(expect.arrayContaining(['decisao', 'oferta', 'preco_versao', 'simulacao', 'canal_venda', 'kpi_mensal']));
      expect(REGISTROS_INICIAIS).toBeGreaterThan(0);
    });

    it('quem já usa a Central recebe as tabelas vazias, sem perder nada', async () => {
      await repositorios.produto.atualizar(ID_PRODUTO_KIPI, { descricao_curta: 'Meu texto' });
      armazenamento.removeItem(chaveDaTabela('oferta'));
      armazenamento.removeItem(chaveDaTabela('preco_versao'));
      gravarMeta({ versao_dados: 15 });
      expect(await repositorios.oferta.listar()).toEqual([]);
      expect(armazenamento.getItem(chaveDaTabela('oferta'))).toBe('[]');
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
      expect((await repositorios.produto.obter(ID_PRODUTO_KIPI))?.descricao_curta).toBe('Meu texto');
    });
  });

  describe('leitura dos campos: vazio, zero e inválido', () => {
    it('valor', () => {
      expect(lerValorDoCampo('')).toBeNull();
      expect(lerValorDoCampo('0')).toBe(0);
      expect(lerValorDoCampo('0,00')).toBe(0);
      expect(lerValorDoCampo('19,90')).toBe(19.9);
      expect(lerValorDoCampo('1.234,56')).toBe(1234.56);
      expect(lerValorDoCampo('abc')).toBeUndefined();
      expect(lerValorDoCampo('-5')).toBeUndefined();
    });

    it('percentual', () => {
      expect(lerPercentual('')).toBeNull();
      expect(lerPercentual('0')).toBe(0);
      expect(lerPercentual('3,5')).toBe(3.5);
      expect(lerPercentual('15%')).toBe(15);
      expect(lerPercentual('100')).toBe(100);
      expect(lerPercentual('100,5')).toBeUndefined();
      expect(lerPercentual('x')).toBeUndefined();
    });

    it('as entradas da tela viram premissas, com erro junto do campo, sem virar zero', () => {
      const { premissas, erros } = premissasDasEntradas({ ...entradasVazias(null), cf: '300', cv: 'abc', tributos: '200' }, { canais: [], cambios: [], cfCalculado: null });
      expect(premissas.cv).toBeNull();
      expect(premissas.tributos_pct).toBeNull();
      expect(erros.cv).toBeTruthy();
      expect(erros.tributos).toBeTruthy();
      expect(erros.cf_justificativa).toContain('justificativa');
    });

    it('o custo médio pré-carregado não pede justificativa; muda, e pede', () => {
      expect(premissasDasEntradas(entradasVazias(300), { canais: [], cambios: [], cfCalculado: 300 }).erros.cf_justificativa).toBeUndefined();
      expect(premissasDasEntradas({ ...entradasVazias(300), cf: '350' }, { canais: [], cambios: [], cfCalculado: 300 }).erros.cf_justificativa).toBeTruthy();
    });

    it('volumes: inteiros, sem repetir, até 5', () => {
      const { premissas, erros } = premissasDasEntradas({ ...entradasVazias(null), volumes: ['50', '10', '50'] }, { canais: [], cambios: [], cfCalculado: null });
      expect(premissas.volumes).toEqual([10, 50]);
      expect(erros.volumes).toBeUndefined();
      expect(premissasDasEntradas({ ...entradasVazias(null), volumes: ['1', '2', '3', '4', '5', '6'] }, { canais: [], cambios: [], cfCalculado: null }).erros.volumes).toContain('até 5');
      expect(premissasDasEntradas({ ...entradasVazias(null), volumes: ['0'] }, { canais: [], cambios: [], cfCalculado: null }).erros.volumes).toBeTruthy();
    });
  });

  describe('T07.05 Canais: RN-07.09', () => {
    it('taxa informada exige fonte e data; sem taxa, pode ficar vazio', () => {
      expect(esquemaFormularioCanal.safeParse({ ...FORMULARIO_CANAL_VAZIO, nome: 'Loja' }).success).toBe(true);
      const semOrigem = esquemaFormularioCanal.safeParse({ ...FORMULARIO_CANAL_VAZIO, nome: 'Loja', taxa_percentual: '15' });
      expect(semOrigem.success).toBe(false);
      expect(semOrigem.error?.issues.map((falha) => falha.path[0])).toEqual(['verificado_em', 'fonte_url']);
    });

    it('vazio fica vazio, e zero fica zero', async () => {
      const vazio = await salvarCanal(esquemaFormularioCanal.parse({ ...FORMULARIO_CANAL_VAZIO, nome: 'Patrocínio', tipo: 'patrocinio' }));
      expect(vazio).toMatchObject({ taxa_percentual: null, taxa_fixa: null, verificado_em: null });
      const zero = await novoCanal('Direto', '0', '0,00');
      expect(zero).toMatchObject({ taxa_percentual: 0, taxa_fixa: 0 });
    });

    it('alerta depois de 12 meses', () => {
      expect(alertaDoCanal({ verificado_em: null }, HOJE)).toBe('sem_verificacao');
      expect(alertaDoCanal({ verificado_em: '2025-11-06' }, HOJE)).toBeNull();
      expect(alertaDoCanal({ verificado_em: '2025-11-05' }, HOJE)).toBe('vencida');
    });

    it('nome único', async () => {
      await novoCanal('Web');
      await expect(novoCanal('WEB')).rejects.toThrow('Já existe um canal com esse nome.');
    });

    it('taxa em outra moeda só entra convertida', async () => {
      const canal = await salvarCanal(esquemaFormularioCanal.parse({ ...FORMULARIO_CANAL_VAZIO, nome: 'Global', taxa_percentual: '3', taxa_fixa: '0,30', taxa_fixa_moeda: 'USD', verificado_em: '2026-10-01', fonte_url: 'https://exemplo.com.br' }));
      expect(canalParaSimulacao(canal, []).taxa_fixa).toBeNull();
      expect(canalParaSimulacao(canal, [{ moeda: 'USD', valor_brl: 5, data_referencia: '2026-10-01' }]).taxa_fixa).toBeCloseTo(1.5, 10);
    });
  });

  describe('T07.04 Ofertas', () => {
    it('RN-07.02: nasce Em estudo e sem preço', async () => {
      const oferta = await novaOferta();
      expect(oferta.situacao).toBe('em_estudo');
      const { ofertas } = await ofertasDoProduto(ID_PRODUTO_KIPI, HOJE);
      expect(ofertas[0]).toMatchObject({ situacaoEfetiva: 'em_estudo', vigentes: [] });
    });

    it('RN-07.01: cada produto tem as suas; nome único só no produto', async () => {
      await novaOferta(ID_PRODUTO_KIPI);
      await expect(novaOferta(ID_PRODUTO_KIPI, { nome: 'ESSENCIAL' })).rejects.toThrow('Este produto já tem uma oferta com esse nome.');
      await expect(novaOferta(ID_PRODUTO_ZUPI)).resolves.toBeTruthy();
      expect((await ofertasDoProduto(ID_PRODUTO_ZUPI, HOJE)).ofertas).toHaveLength(1);
      expect((await ofertasDoProduto(ID_PRODUTO_ZARPA, HOJE)).ofertas).toHaveLength(0);
    });

    it('recursos entram, mudam e saem junto com a oferta', async () => {
      const oferta = await novaOferta(ID_PRODUTO_KIPI, { recursos: [{ id: '', nome: 'Pedidos', incluido: true, limite: 'até 3 revendedores', observacao: '' }, { id: '', nome: 'Relatórios', incluido: false, limite: '', observacao: '' }] });
      const recursos = await repositorios.oferta_recurso.listar({ onde: { oferta_id: oferta.id } });
      expect(recursos.map((recurso) => recurso.nome)).toEqual(['Pedidos', 'Relatórios']);
      await salvarOferta(ID_PRODUTO_KIPI, { ...FORMULARIO_OFERTA_VAZIO, nome: 'Essencial', recursos: [{ id: recursos[0]!.id, nome: 'Pedidos e estoque', incluido: true, limite: '', observacao: '' }] }, oferta.id);
      expect((await repositorios.oferta_recurso.listar({ onde: { oferta_id: oferta.id } })).map((recurso) => recurso.nome)).toEqual(['Pedidos e estoque']);
    });
  });

  describe('versões de preço', () => {
    it('não definido é diferente de zero, e zero só em Gratuidade', async () => {
      const oferta = await novaOferta();
      const rascunho = await criarRascunhoDePreco(oferta.id, { canal_id: null, valor: null, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: null });
      expect(rascunho.valor).toBeNull();
      await expect(criarRascunhoDePreco(oferta.id, { canal_id: null, valor: 0, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: null })).rejects.toThrow('R$ 0,00 só vale para Gratuidade');
      const gratis = await novaOferta(ID_PRODUTO_KIPI, { nome: 'Grátis', tipo: 'gratuidade' });
      await expect(criarRascunhoDePreco(gratis.id, { canal_id: null, valor: 5, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: null })).rejects.toThrow('Gratuidade tem preço R$ 0,00.');
      await expect(criarRascunhoDePreco(gratis.id, { canal_id: null, valor: 0, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: null })).resolves.toMatchObject({ valor: 0 });
    });

    it('o valor "Não definido" não pode ser aprovado', async () => {
      const { rascunho, canal, simulacao } = await cenarioDePreco();
      await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { valor: null }), ID_KIMBERLY, HOJE)).rejects.toThrow('Não definido');
    });

    it('RN-07.04: exige início, simulação e decisão, e não grava nada pela metade', async () => {
      const { rascunho, canal, simulacao } = await cenarioDePreco();
      await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { valido_de: null }), ID_KIMBERLY, HOJE)).rejects.toThrow('início da validade');
      await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, null), ID_KIMBERLY, HOJE)).rejects.toThrow('Vincule a simulação');
      await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { decisao: null }), ID_KIMBERLY, HOJE)).rejects.toThrow('decisão');
      await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id), null, HOJE)).rejects.toThrow('Você é');
      expect((await repositorios.preco_versao.obter(rascunho.id))?.situacao).toBe('rascunho');
      expect(await repositorios.decisao.listar()).toEqual([]);
    });

    it('RN-07.03: Gratuidade dispensa só a simulação', async () => {
      const gratis = await novaOferta(ID_PRODUTO_KIPI, { nome: 'Grátis', tipo: 'gratuidade' });
      const rascunho = await criarRascunhoDePreco(gratis.id, { canal_id: null, valor: 0, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: null });
      await expect(aprovarPreco(rascunho.id, aprovacao(null, null, { valor: 0, decisao: null }), ID_KIMBERLY, HOJE)).rejects.toThrow('decisão');
      const aprovada = await aprovarPreco(rascunho.id, aprovacao(null, null, { valor: 0 }), ID_KIMBERLY, HOJE);
      expect(aprovada).toMatchObject({ valor: 0, situacao: 'aprovada', simulacao_id: null });
    });

    it('registra quem aprovou, a decisão e o snapshot, e aprova a oferta', async () => {
      const { rascunho, canal, simulacao, oferta } = await cenarioDePreco();
      const aprovada = await aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id), ID_CAMILA, HOJE);
      expect(aprovada).toMatchObject({ situacao: 'aprovada', aprovado_por: ID_CAMILA, valor: 15, valido_ate: null });
      expect(aprovada.decisao_id).toBeTruthy();
      expect(aprovada.snapshot).toMatchObject({ abaixo_do_piso: false, aprovado_por_nome: 'Camila Lima', simulacao: { id: simulacao.id, codigo: simulacao.codigo } });
      expect((await repositorios.oferta.obter(oferta.id))?.situacao).toBe('aprovada');
      expect((await decisoesDoProduto(ID_PRODUTO_KIPI))[0]).toMatchObject({ assunto: 'preco', decisores: ['Kimberly Grebe'] });
    });

    it('salvar simulação não aprova; usar como base cria só um rascunho, sem repetir', async () => {
      const canal = await novoCanal();
      const oferta = await novaOferta();
      const simulacao = await novaSimulacao(ID_PRODUTO_KIPI, canal.id);
      expect(await repositorios.preco_versao.listar()).toEqual([]);
      const rascunho = await criarRascunhoDaSimulacao(simulacao.id, oferta.id);
      expect(rascunho).toMatchObject({ situacao: 'rascunho', valor: 15, canal_id: canal.id, simulacao_id: simulacao.id, valido_de: null });
      expect((await criarRascunhoDaSimulacao(simulacao.id, oferta.id)).id).toBe(rascunho.id);
      expect((await repositorios.oferta.obter(oferta.id))?.situacao).toBe('em_estudo');
    });

    it('RN-07.07: preço aprovado para o futuro não aprova a oferta antes da vigência', async () => {
      const { rascunho, canal, simulacao, oferta } = await cenarioDePreco();
      await aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { valido_de: '2026-12-01' }), ID_KIMBERLY, HOJE);
      const atual = (await repositorios.oferta.obter(oferta.id))!;
      const precos = await repositorios.preco_versao.listar({ onde: { oferta_id: oferta.id } });
      expect(atual.situacao).toBe('em_estudo');
      expect(situacaoEfetivaDaOferta(atual, precos, HOJE)).toBe('em_estudo');
      expect(situacaoEfetivaDaOferta(atual, precos, '2026-12-01')).toBe('aprovada');
      expect(precoVigente(precos, canal.id, HOJE)).toBeNull();
      expect(precoVigente(precos, canal.id, '2026-12-01')?.valor).toBe(15);
    });

    it('RN-07.05: a nova versão encerra a anterior no dia anterior, só na mesma oferta e canal', async () => {
      const { rascunho, canal, simulacao, oferta } = await cenarioDePreco();
      const outro = await novoCanal('Outro canal', '3', '0,50');
      const simOutro = await salvarSimulacao({ produto_id: ID_PRODUTO_KIPI, oferta_id: null, nome: 'Outro', observacao: '', premissas: premissasDe(outro.id, 'Outro canal'), anterior_id: null });
      const v1 = await aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { valido_de: '2026-10-01' }), ID_KIMBERLY, HOJE);
      const noOutro = await criarRascunhoDePreco(oferta.id, { canal_id: outro.id, valor: 16, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: simOutro.id });
      const outroAprovado = await aprovarPreco(noOutro.id, aprovacao(outro.id, simOutro.id, { valor: 16, valido_de: '2026-10-01' }), ID_KIMBERLY, HOJE);
      const r2 = await criarRascunhoDePreco(oferta.id, { canal_id: canal.id, valor: 18, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: simulacao.id });
      expect(r2.versao).toBe(2);
      const v2 = await aprovarPreco(r2.id, aprovacao(canal.id, simulacao.id, { valor: 18, valido_de: '2026-12-01' }), ID_KIMBERLY, HOJE);

      const v1Depois = (await repositorios.preco_versao.obter(v1.id))!;
      expect(v1Depois).toMatchObject({ situacao: 'substituida', valido_ate: '2026-11-30', valor: 15 });
      expect(v1Depois.snapshot).toEqual(v1.snapshot);
      expect((await repositorios.preco_versao.obter(outroAprovado.id))).toMatchObject({ situacao: 'aprovada', valido_ate: null });
      expect(v2.snapshot).toMatchObject({ substituiu: { id: v1.id, valido_ate: '2026-11-30' } });

      const precos = await repositorios.preco_versao.listar({ onde: { oferta_id: oferta.id } });
      expect(precoVigente(precos, canal.id, '2026-11-30')?.valor).toBe(15);
      expect(precoVigente(precos, canal.id, '2026-12-01')?.valor).toBe(18);
      expect(faseDaVersao(v1Depois, '2026-11-30')).toBe('vigente');
      expect(faseDaVersao(v1Depois, '2026-12-01')).toBe('encerrada');
      // No máximo uma por oferta, canal e data.
      for (const dia of ['2026-10-01', '2026-11-30', '2026-12-01', '2027-06-01']) expect(precos.filter((preco) => preco.canal_id === canal.id && preco.situacao !== 'rascunho' && preco.valido_de! <= dia && (!preco.valido_ate || dia <= preco.valido_ate))).toHaveLength(1);
    });

    it('a nova versão precisa começar depois da última aprovada', async () => {
      const { rascunho, canal, simulacao, oferta } = await cenarioDePreco();
      await aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { valido_de: '2026-11-01' }), ID_KIMBERLY, HOJE);
      const r2 = await criarRascunhoDePreco(oferta.id, { canal_id: canal.id, valor: 18, moeda: 'BRL', periodicidade: 'mensal', valido_de: null, simulacao_id: simulacao.id });
      await expect(aprovarPreco(r2.id, aprovacao(canal.id, simulacao.id, { valido_de: '2026-11-01' }), ID_KIMBERLY, HOJE)).rejects.toThrow('Precisa começar depois');
    });

    it('CA-07.02: versão aprovada não muda; só um rascunho se edita', async () => {
      const { rascunho, canal, simulacao } = await cenarioDePreco();
      const dados = { canal_id: canal.id, valor: 99, moeda: 'BRL', periodicidade: 'mensal' as const, valido_de: null, simulacao_id: simulacao.id };
      await expect(salvarRascunhoDePreco(rascunho.id, dados)).resolves.toMatchObject({ valor: 99 });
      await aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id), ID_KIMBERLY, HOJE);
      await expect(salvarRascunhoDePreco(rascunho.id, dados)).rejects.toThrow('Versão aprovada não muda');
      await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id), ID_KIMBERLY, HOJE)).rejects.toThrow('já foi aprovada');
    });

    describe('RN-07.06: abaixo do piso', () => {
      it('compara em precisão completa: 10,13 está acima de 10,1265…; 10,12, abaixo', async () => {
        const canal = await novoCanal();
        const simulacao = await novaSimulacao(ID_PRODUTO_KIPI, canal.id);
        expect(avaliarPiso({ canal_id: canal.id, valor: 10.13, moeda: 'BRL', periodicidade: 'mensal' }, simulacao).abaixo).toBe(false);
        expect(avaliarPiso({ canal_id: canal.id, valor: 10.12, moeda: 'BRL', periodicidade: 'mensal' }, simulacao).abaixo).toBe(true);
      });

      it('exige justificativa e decisão específica de exceção', async () => {
        const { rascunho, canal, simulacao } = await cenarioDePreco();
        const barato = { valor: 9 };
        await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, barato), ID_KIMBERLY, HOJE)).rejects.toThrow('exige justificativa');

        // Uma decisão comum, já registrada, não serve.
        const comum = await repositorios.decisao.criar({ titulo: 'Preço', descricao: 'Comum', motivo: null, alternativas: null, impacto: null, data: HOJE, area_id: null, produto_id: ID_PRODUTO_KIPI, reuniao_id: null, situacao: 'registrada', substituida_por_id: null, assunto: 'preco' });
        await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { ...barato, justificativa_excecao: 'Lançamento', decisao: { modo: 'vincular', decisao_id: comum.id } }), ID_KIMBERLY, HOJE)).rejects.toThrow('exceção de preço');

        const aprovada = await aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { ...barato, justificativa_excecao: 'Lançamento' }), ID_KIMBERLY, HOJE);
        expect(aprovada).toMatchObject({ justificativa_excecao: 'Lançamento', snapshot: { abaixo_do_piso: true } });
        expect((await repositorios.decisao.obter(aprovada.decisao_id!))?.assunto).toBe('excecao_preco');
      });

      it('sem o canal na simulação, ou com faltas, não dá para comparar', async () => {
        const { rascunho, simulacao } = await cenarioDePreco();
        const outro = await novoCanal('Outro');
        await expect(aprovarPreco(rascunho.id, aprovacao(outro.id, simulacao.id), ID_KIMBERLY, HOJE)).rejects.toThrow('não inclui este canal');
      });

      it('moeda e periodicidade diferentes da simulação não passam', async () => {
        const { rascunho, canal, simulacao } = await cenarioDePreco();
        await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { moeda: 'USD' }), ID_KIMBERLY, HOJE)).rejects.toThrow('não dá para comparar');
        await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id, { periodicidade: 'anual' }), ID_KIMBERLY, HOJE)).rejects.toThrow('mesma periodicidade');
      });

      it('em "todos os canais", vale o maior piso', async () => {
        const premissas = premissasDe('a', 'A');
        premissas.canais.push({ ...premissas.canais[0]!, canal_id: 'b', nome: 'B', taxa_percentual: 30 });
        const resultados = calcularSimulacao(premissas);
        expect(avaliarPiso({ canal_id: null, valor: 11, moeda: 'BRL', periodicidade: 'mensal' }, { premissas, resultados })).toMatchObject({ abaixo: true });
        expect(avaliarPiso({ canal_id: 'a', valor: 11, moeda: 'BRL', periodicidade: 'mensal' }, { premissas, resultados })).toMatchObject({ abaixo: false });
      });
    });

    it('RN-07.01: simulação de outro produto não vale', async () => {
      const { rascunho, canal } = await cenarioDePreco();
      const deOutro = await novaSimulacao(ID_PRODUTO_ZUPI, canal.id);
      await expect(aprovarPreco(rascunho.id, aprovacao(canal.id, deOutro.id), ID_KIMBERLY, HOJE)).rejects.toThrow('de outro produto');
    });
  });

  describe('T07.07 Simulações: RN-07.15', () => {
    it('o snapshot não muda quando o canal muda depois', async () => {
      const canal = await novoCanal();
      const simulacao = await novaSimulacao(ID_PRODUTO_KIPI, canal.id);
      await salvarCanal(esquemaFormularioCanal.parse({ ...FORMULARIO_CANAL_VAZIO, nome: canal.nome, taxa_percentual: '40', taxa_fixa: '9,00', verificado_em: '2026-11-01', fonte_url: 'https://exemplo.com.br/nova' }), canal.id);
      const lida = (await repositorios.simulacao.obter(simulacao.id))!;
      expect(lida.premissas.canais[0]).toMatchObject({ taxa_percentual: 15, taxa_fixa: 0 });
      expect(lida.resultados.linhas[1]?.preco_sugerido).toBeCloseTo(8 / 0.59, 10);
    });

    it('recalcular cria outra versão, ligada à anterior, e a anterior fica igual', async () => {
      const canal = await novoCanal();
      const v1 = await novaSimulacao(ID_PRODUTO_KIPI, canal.id, { cf: 350, cf_calculado: 350 });
      const v2 = await salvarSimulacao({ produto_id: ID_PRODUTO_KIPI, oferta_id: null, nome: 'Cenário', observacao: '', premissas: premissasDe(canal.id), anterior_id: v1.id });
      expect(v2).toMatchObject({ versao: 2, simulacao_anterior_id: v1.id });
      expect(v2.codigo).not.toBe(v1.codigo);
      expect(await repositorios.simulacao.obter(v1.id)).toEqual(v1);
    });

    it('não confia nos resultados da tela: calcula de novo ao salvar', async () => {
      const canal = await novoCanal();
      const salva = await novaSimulacao(ID_PRODUTO_KIPI, canal.id);
      expect(salva.resultados).toEqual(calcularSimulacao(salva.premissas));
    });

    it('RN-07.12 e RN-07.11: bloqueada ou sem justificativa não salva', async () => {
      const canal = await novoCanal();
      await expect(novaSimulacao(ID_PRODUTO_KIPI, canal.id, { margem_pct: 80 })).rejects.toThrow('somam 100% ou mais');
      await expect(novaSimulacao(ID_PRODUTO_KIPI, canal.id, { cf: 350, cf_calculado: 300 })).rejects.toThrow('justificativa');
      await expect(novaSimulacao(ID_PRODUTO_KIPI, canal.id, { cf: 350, cf_calculado: 300, cf_justificativa: 'Inclui a agência' })).resolves.toBeTruthy();
    });

    it('a comparação mostra o que mudou, a partir dos snapshots', async () => {
      const canal = await novoCanal();
      const a = await novaSimulacao(ID_PRODUTO_KIPI, canal.id, { cf: 350, cf_calculado: 350 });
      const b = await novaSimulacao(ID_PRODUTO_KIPI, canal.id);
      const linhas = compararSimulacoes(a, b);
      const preco = linhas.find((linha) => linha.rotulo === 'Preço sugerido')!;
      expect(preco.diferente).toBe(true);
      expect(Math.round(preco.a as number * 100) / 100).toBe(15.25);
      expect(Math.round(preco.b as number * 100) / 100).toBe(13.56);
      expect(Math.round(preco.diferenca! * 100) / 100).toBe(-1.69);
      expect(linhas.find((linha) => linha.rotulo === 'Custo variável por cliente')?.diferente).toBe(false);
    });
  });

  describe('T07.03 Mudar estágio: RN-07.08', () => {
    it('exige critério e decisão, e não grava nada sem eles', async () => {
      await expect(mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ criterio: ' ' }), HOJE)).rejects.toThrow('critério');
      await expect(mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ decisao: null }), HOJE)).rejects.toThrow('decisão');
      await expect(mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ decisao: decisaoNova({ decisores: [] }) }), HOJE)).rejects.toThrow('quem decidiu');
      await expect(mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ novo: 'ideia' }), HOJE)).rejects.toThrow('já está neste estágio');
      expect((await repositorios.produto.obter(ID_PRODUTO_ZUPI))?.estagio).toBe('ideia');
      expect(await repositorios.decisao.listar()).toEqual([]);
    });

    it('registra o histórico com a decisão; a métrica é opcional', async () => {
      const linha = await mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ metrica: 'Entrevistas', resultado: '12' }), HOJE);
      expect(linha).toMatchObject({ estagio_anterior: 'ideia', estagio_novo: 'validacao', metrica: 'Entrevistas', resultado: '12' });
      expect((await repositorios.decisao.obter(linha.decisao_id))?.assunto).toBe('estagio');
      expect((await repositorios.produto.obter(ID_PRODUTO_ZUPI))).toMatchObject({ estagio: 'validacao', ordem_fila: 1, situacao: 'ativo' });
    });

    it('sair da fila renumera; voltar entra no fim', async () => {
      await mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ novo: 'mvp' }), HOJE);
      expect((await repositorios.produto.obter(ID_PRODUTO_ZUPI))?.ordem_fila).toBeNull();
      expect((await repositorios.produto.obter(ID_PRODUTO_ZARPA))?.ordem_fila).toBe(1);
      expect((await repositorios.produto.obter(ID_PRODUTO_MIMO))?.ordem_fila).toBe(2);
      await mudarEstagio(ID_PRODUTO_KIPI, mudanca({ novo: 'validacao' }), HOJE);
      expect((await repositorios.produto.obter(ID_PRODUTO_KIPI))?.ordem_fila).toBe(3);
    });

    it('decisão substituída ou de outro produto não vale', async () => {
      const decisao = await repositorios.decisao.criar({ titulo: 'Antiga', descricao: 'x', motivo: null, alternativas: null, impacto: null, data: HOJE, area_id: null, produto_id: ID_PRODUTO_KIPI, reuniao_id: null, situacao: 'registrada', substituida_por_id: null, assunto: 'geral' });
      await expect(mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ decisao: { modo: 'vincular', decisao_id: decisao.id } }), HOJE)).rejects.toThrow('outro produto');
      await repositorios.decisao.atualizar(decisao.id, { situacao: 'substituida' });
      await expect(mudarEstagio(ID_PRODUTO_KIPI, mudanca({ novo: 'crescimento', decisao: { modo: 'vincular', decisao_id: decisao.id } }), HOJE)).rejects.toThrow('substituída');
    });

    describe('descontinuar', () => {
      const conferido = ITENS_DE_DESCONTINUAR.map((item) => item.id);

      it('exige o plano e a revisão: sem eles, o produto continua', async () => {
        expect(errosDaMudanca('em_uso', mudanca({ novo: 'descontinuado', checklist: conferido }), HOJE).plano).toContain('plano de encerramento');
        await expect(mudarEstagio(ID_PRODUTO_KIPI, mudanca({ novo: 'descontinuado', checklist: conferido }), HOJE)).rejects.toThrow('plano de encerramento');
        await expect(mudarEstagio(ID_PRODUTO_KIPI, mudanca({ novo: 'descontinuado', plano: { modo: 'nova', titulo: 'Encerrar', responsavel_id: ID_KIMBERLY, prazo: '2026-12-01' }, checklist: [] }), HOJE)).rejects.toThrow('Falta conferir');
        expect((await repositorios.produto.obter(ID_PRODUTO_KIPI))?.situacao).toBe('ativo');
      });

      it('o plano novo é uma atividade de verdade no Meu dia, do produto, sem cópia', async () => {
        const antes = (await repositorios.atividade.listar()).length;
        const linha = await mudarEstagio(ID_PRODUTO_KIPI, mudanca({ novo: 'descontinuado', plano: { modo: 'nova', titulo: 'Plano de encerramento do Kipi', responsavel_id: ID_KIMBERLY, prazo: '2026-12-01' }, checklist: conferido }), HOJE);
        expect((await repositorios.atividade.listar()).length).toBe(antes + 1);
        const atividade = await repositorios.atividade.obter(linha.atividade_encerramento_id!);
        expect(atividade).toMatchObject({ titulo: 'Plano de encerramento do Kipi', tipo: 'tarefa', responsavel_id: ID_KIMBERLY, prazo: '2026-12-01' });
        expect((await atividadesDoProduto(ID_PRODUTO_KIPI)).map((item) => item.id)).toContain(atividade!.id);
        expect(await repositorios.produto.obter(ID_PRODUTO_KIPI)).toMatchObject({ estagio: 'descontinuado', situacao: 'descontinuado' });
      });

      it('se a mudança falhar, a atividade do plano não fica criada', async () => {
        const antes = (await repositorios.atividade.listar()).length;
        const espiao = vi.spyOn(repositorios.produto_estagio_historico, 'criar').mockRejectedValueOnce(new Error('falhou'));
        await expect(mudarEstagio(ID_PRODUTO_KIPI, mudanca({ novo: 'descontinuado', plano: { modo: 'nova', titulo: 'Encerrar', responsavel_id: ID_KIMBERLY, prazo: '2026-12-01' }, checklist: conferido }), HOJE)).rejects.toThrow('falhou');
        espiao.mockRestore();
        expect((await repositorios.atividade.listar()).length).toBe(antes);
        expect((await repositorios.produto.obter(ID_PRODUTO_KIPI))?.situacao).toBe('ativo');
      });

      it('atividade existente precisa estar aberta e ser deste produto', async () => {
        const plano = await criarPlanoDeEncerramento(ID_PRODUTO_ZUPI, { titulo: 'Plano do Zupi', responsavel_id: ID_KIMBERLY, prazo: '2026-12-01' });
        await expect(mudarEstagio(ID_PRODUTO_KIPI, mudanca({ novo: 'descontinuado', plano: { modo: 'existente', atividade_id: plano.id }, checklist: conferido }), HOJE)).rejects.toThrow('não está aberta neste produto');
        await concluirAtividade(plano.id, ID_KIMBERLY);
        await expect(mudarEstagio(ID_PRODUTO_ZUPI, mudanca({ novo: 'descontinuado', plano: { modo: 'existente', atividade_id: plano.id }, checklist: conferido }), HOJE)).rejects.toThrow('não está aberta neste produto');
      });
    });
  });

  describe('T07.01 Fila', () => {
    const FILA = [ID_PRODUTO_ZUPI, ID_PRODUTO_ZARPA, ID_PRODUTO_MIMO];

    it('só Ideia e Validação, na ordem', async () => {
      expect(produtosDaFila(await repositorios.produto.listar()).map((produto) => produto.nome)).toEqual(['Zupi', 'Zarpa', 'Mimo']);
    });

    it('Subir e Descer, sem sair dos limites', () => {
      expect(moverNaFila(FILA, ID_PRODUTO_MIMO, -1)).toEqual([ID_PRODUTO_ZUPI, ID_PRODUTO_MIMO, ID_PRODUTO_ZARPA]);
      expect(moverNaFila(FILA, ID_PRODUTO_ZUPI, -1)).toEqual(FILA);
      expect(moverNaFila(FILA, ID_PRODUTO_MIMO, 1)).toEqual(FILA);
    });

    it('reordenar exige decisão, e não muda nada sem ela', async () => {
      const nova = [ID_PRODUTO_MIMO, ID_PRODUTO_ZUPI, ID_PRODUTO_ZARPA];
      await expect(reordenarFila(nova, null, HOJE)).rejects.toThrow('decisão');
      expect((await repositorios.produto.obter(ID_PRODUTO_MIMO))?.ordem_fila).toBe(3);
      await reordenarFila(nova, decisaoNova(), HOJE);
      expect(produtosDaFila(await repositorios.produto.listar()).map((produto) => produto.nome)).toEqual(['Mimo', 'Zupi', 'Zarpa']);
      expect((await repositorios.decisao.listar())[0]?.assunto).toBe('fila');
      // A decisão aparece na ficha de cada produto da fila, pelo vínculo: pelo id, e não pelo nome.
      for (const id of FILA) expect((await decisoesDoProduto(id)).map((decisao) => decisao.assunto)).toEqual(['fila']);
    });

    it('a mesma ordem, ou uma lista que não é a fila, não passa', async () => {
      await expect(reordenarFila(FILA, decisaoNova(), HOJE)).rejects.toThrow('A ordem não mudou.');
      await expect(reordenarFila([ID_PRODUTO_KIPI, ...FILA], decisaoNova(), HOJE)).rejects.toThrow('A fila mudou');
    });
  });

  describe('T07.01 Portfólio', () => {
    it('sem dado, sem número: nada vira zero', async () => {
      const { linhas } = await carregarPortfolio(HOJE);
      const zarpa = linhas.find((linha) => linha.id === ID_PRODUTO_ZARPA)!;
      expect(zarpa).toMatchObject({ responsavel: null, ofertasAprovadas: 0, ofertasEmEstudo: 0, usuariosAtivos: null });
      expect(zarpa.custo).toMatchObject({ valor: null, situacao: 'sem_historico' });
    });

    it('filtra por estágio, responsável e contexto', async () => {
      const { linhas } = await carregarPortfolio(HOJE);
      expect(filtrarPortfolio(linhas, { ...FILTROS_PORTFOLIO_INICIAIS, estagio: 'em_uso' }, 'consolidada').map((linha) => linha.nome)).toEqual(['Sobrevivência Urbana', 'Kipi']);
      expect(filtrarPortfolio(linhas, { ...FILTROS_PORTFOLIO_INICIAIS, responsavel: 'a_definir' }, 'consolidada')).toHaveLength(5);
      expect(filtrarPortfolio(linhas, { ...FILTROS_PORTFOLIO_INICIAIS, busca: 'SOBREVIVENCIA' }, 'consolidada').map((linha) => linha.id)).toEqual([ID_PRODUTO_URBANA]);
      expect(filtrarPortfolio(linhas, FILTROS_PORTFOLIO_INICIAIS, ID_PRODUTO_KIPI).map((linha) => linha.id)).toEqual([ID_PRODUTO_KIPI]);
      expect(filtrarPortfolio(linhas, FILTROS_PORTFOLIO_INICIAIS, 'institucional')).toEqual([]);
    });

    it('Clientes e Assinantes ficam fora até serem construídas; Contrato (T07.10, F1) já aparece, em qualquer fase', () => {
      const ids = areasDisponiveis().map((area) => area.id);
      expect(ids).not.toContain('clientes');
      expect(ids).not.toContain('assinantes');
      expect(ids).toContain('contrato');
      expect(areasDisponiveis().filter((area) => area.grupo === 'principal').map((area) => area.rotulo)).toEqual(['Visão geral', 'Estágio e decisões', 'Ofertas e preços', 'Simulações', 'Indicadores']);
    });

    it('produto com oferta não arquiva', async () => {
      const { marca_id } = (await repositorios.produto.obter(ID_PRODUTO_MIMO))!;
      const produto = await repositorios.produto.criar({ marca_id, nome: 'Sem vínculos', codigo_curto: 'SEMVIN', tipo: 'outro', descricao_curta: null, estagio: 'ideia', ordem_fila: null, responsavel_id: null, entidade_id: null, tem_usuarios_reais: false, data_inicio: null, situacao: 'ativo' });
      await novaOferta(produto.id);
      await expect(arquivarProduto(produto.id)).rejects.toThrow('ofertas, simulações ou indicadores');
    });
  });

  describe('Custos (M05): RN-07.11', () => {
    const categoria = (id: string, natureza: 'investimento' | null = null) => ({ id, nome: id, natureza_custo: natureza }) as FontesDeCusto['categorias'][number];
    const titulo = (id: string, competencia: string, dados: Record<string, unknown> = {}) => ({ id, competencia, natureza: 'pagar', situacao: 'aberto', suspenso: false, origem: 'manual', moeda: 'BRL', categoria_id: 'cat', arquivado_em: null, ...dados }) as unknown as FontesDeCusto['titulos'][number];
    const rateio = (tituloId: string, valor: number, dados: Record<string, unknown> = {}) => ({ titulo_id: tituloId, produto_id: 'p', percentual: 100, valor, ...dados }) as unknown as FontesDeCusto['rateios'][number];
    const fontes = (dados: Partial<FontesDeCusto>): FontesDeCusto => ({ titulos: [], rateios: [], baixas: [], categorias: [categoria('cat'), categoria('inv', 'investimento')], cambios: [], ...dados });

    it('a janela são os 3 meses completos antes do atual', () => {
      expect(competenciasDaMedia(HOJE)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    });

    it('sem lançamento, sem histórico: nunca zero', () => {
      expect(calcularCustoMedio('p', fontes({}), HOJE)).toMatchObject({ valor: null, situacao: 'sem_historico' });
    });

    it('média de 3 meses, sem investimento, sem reembolso, sem cancelado e sem outro produto', () => {
      const resultado = calcularCustoMedio(
        'p',
        fontes({
          titulos: [titulo('a', '2026-08-01'), titulo('b', '2026-09-01'), titulo('c', '2026-10-01'), titulo('inv', '2026-10-01', { categoria_id: 'inv' }), titulo('reemb', '2026-10-01', { origem: 'reembolso' }), titulo('canc', '2026-10-01', { situacao: 'cancelado' }), titulo('fora', '2026-11-01'), titulo('outro', '2026-10-01')],
          rateios: [rateio('a', 100), rateio('b', 200), rateio('c', 300), rateio('inv', 5000), rateio('reemb', 700), rateio('canc', 900), rateio('fora', 800), rateio('outro', 999, { produto_id: 'q' })],
        }),
        HOJE,
      );
      expect(resultado).toMatchObject({ valor: 200, situacao: 'calculado', mesesComCusto: 3, estimado: false });
    });

    it('mês sem lançamento não entra como zero, e a tela sabe quantos meses valeram', () => {
      expect(calcularCustoMedio('p', fontes({ titulos: [titulo('c', '2026-10-01')], rateios: [rateio('c', 300)] }), HOJE)).toMatchObject({ valor: 300, mesesComCusto: 1 });
    });

    it('moeda sem câmbio não vira zero; com câmbio, é estimativa; pago usa o que saiu', () => {
      const dolar = titulo('d', '2026-10-01', { moeda: 'USD' });
      expect(calcularCustoMedio('p', fontes({ titulos: [dolar], rateios: [rateio('d', 10)] }), HOJE)).toMatchObject({ valor: null, situacao: 'sem_cambio', moedasSemCambio: ['USD'] });
      expect(calcularCustoMedio('p', fontes({ titulos: [dolar], rateios: [rateio('d', 10)], cambios: [{ moeda: 'USD', valor_brl: 5, data_referencia: '2026-10-01' }] }), HOJE)).toMatchObject({ valor: 50, estimado: true });
      const baixas = [{ titulo_id: 'd', tipo: 'pagamento', valor_brl: 62 }, { titulo_id: 'd', tipo: 'estorno', valor_brl: 2 }] as unknown as FontesDeCusto['baixas'];
      expect(linhasDeCustoDoProduto('p', fontes({ titulos: [titulo('d', '2026-10-01', { moeda: 'USD', situacao: 'quitado' })], rateios: [rateio('d', 10, { percentual: 50 })], baixas }))[0]).toMatchObject({ valor: 30, estimado: false });
    });
  });

  describe('T07.08 KPIs: RN-07.10', () => {
    const mes = (valores: Record<string, string>, competencia = '2026-10-01') => ({ competencia, valores, observacao: '', fonte_url: '' });

    it('um registro por produto e competência: salvar de novo altera', async () => {
      await salvarKpiMensal(ID_PRODUTO_KIPI, mes({ usuarios_ativos: '100' }), HOJE);
      await salvarKpiMensal(ID_PRODUTO_KIPI, mes({ usuarios_ativos: '120', novos_usuarios: '5' }), HOJE);
      await salvarKpiMensal(ID_PRODUTO_ZUPI, mes({ usuarios_ativos: '7' }), HOJE);
      const { registros } = await carregarKpis(ID_PRODUTO_KIPI);
      expect(registros).toHaveLength(1);
      expect(registros[0]?.valores).toMatchObject({ usuarios_ativos: 120, novos_usuarios: 5 });
      expect((await carregarKpis(ID_PRODUTO_ZUPI)).registros[0]?.valores.usuarios_ativos).toBe(7);
    });

    it('zero é valor; vazio fica vazio; inválido não grava', async () => {
      expect(lerValorDeKpi('', 'inteiro')).toBeNull();
      expect(lerValorDeKpi('0', 'inteiro')).toBe(0);
      expect(lerValorDeKpi('1.200', 'inteiro')).toBe(1200);
      expect(lerValorDeKpi('4,5', 'inteiro')).toBeUndefined();
      expect(lerValorDeKpi('4,5', 'decimal')).toBe(4.5);
      const salvo = await salvarKpiMensal(ID_PRODUTO_KIPI, mes({ usuarios_ativos: '0', novos_usuarios: '' }), HOJE);
      expect(salvo.valores).toMatchObject({ usuarios_ativos: 0, novos_usuarios: null });
      await expect(salvarKpiMensal(ID_PRODUTO_KIPI, mes({ avaliacao_media: '6' }), HOJE)).rejects.toThrow('de 0 a 5');
      await expect(salvarKpiMensal(ID_PRODUTO_KIPI, mes({ usuarios_ativos: 'muitos' }), HOJE)).rejects.toThrow('inteiro');
      await expect(salvarKpiMensal(ID_PRODUTO_KIPI, mes({}, '2026-12-01'), HOJE)).rejects.toThrow('até o mês atual');
    });

    it('a série tem 12 meses, com buracos e sem zeros inventados', async () => {
      await salvarKpiMensal(ID_PRODUTO_KIPI, mes({ usuarios_ativos: '100' }), HOJE);
      const { registros } = await carregarKpis(ID_PRODUTO_KIPI);
      const serie = serieDoKpi(registros, 'usuarios_ativos', HOJE);
      expect(serie).toHaveLength(12);
      expect(serie.at(-2)).toEqual({ competencia: '2026-10-01', valor: 100 });
      expect(serie.at(-1)).toEqual({ competencia: '2026-11-01', valor: null });
      expect(ultimoValorDoKpi(registros, 'usuarios_ativos')).toEqual({ competencia: '2026-10-01', valor: 100 });
    });

    it('até 5 indicadores próprios por produto, com nome único', async () => {
      for (const nome of ['A', 'B', 'C', 'D', 'E']) await salvarKpiProprio(ID_PRODUTO_URBANA, { nome, unidade: '', definicao: '' });
      await expect(salvarKpiProprio(ID_PRODUTO_URBANA, { nome: 'F', unidade: '', definicao: '' })).rejects.toThrow('até 5');
      await expect(salvarKpiProprio(ID_PRODUTO_URBANA, { nome: 'a', unidade: '', definicao: '' })).rejects.toThrow('com esse nome');
      await expect(salvarKpiProprio(ID_PRODUTO_KIPI, { nome: 'F', unidade: '', definicao: '' })).resolves.toBeTruthy();
    });
  });

  describe('Integração com o Meu dia', () => {
    it('concluir no Meu dia aparece no produto: é o mesmo registro', async () => {
      const atividade = await criarPlanoDeEncerramento(ID_PRODUTO_ZUPI, { titulo: 'Atividade do produto', responsavel_id: ID_KIMBERLY, prazo: '2026-12-01' });
      expect((await atividadesAbertasDoProduto(ID_PRODUTO_ZUPI, HOJE)).map((item) => item.id)).toContain(atividade.id);
      await concluirAtividade(atividade.id, ID_KIMBERLY);
      expect((await atividadesAbertasDoProduto(ID_PRODUTO_ZUPI, HOJE)).map((item) => item.id)).not.toContain(atividade.id);
      const naFicha = (await atividadesDoProduto(ID_PRODUTO_ZUPI)).find((item) => item.id === atividade.id)!;
      expect(estaAberta(naFicha)).toBe(false);
      expect(naFicha).toEqual(await repositorios.atividade.obter(atividade.id));
    });

    it('as telas do M07 não geram atividade sozinhas', async () => {
      const antes = (await repositorios.atividade.listar()).length;
      const canal = await novoCanal();
      const oferta = await novaOferta();
      const simulacao = await novaSimulacao(ID_PRODUTO_KIPI, canal.id);
      const rascunho = await criarRascunhoDaSimulacao(simulacao.id, oferta.id);
      await aprovarPreco(rascunho.id, aprovacao(canal.id, simulacao.id), ID_KIMBERLY, HOJE);
      await mudarEstagio(ID_PRODUTO_ZUPI, mudanca(), HOJE);
      await reordenarFila([ID_PRODUTO_ZARPA, ID_PRODUTO_ZUPI, ID_PRODUTO_MIMO], decisaoNova(), HOJE);
      await salvarKpiMensal(ID_PRODUTO_KIPI, { competencia: '2026-10-01', valores: {}, observacao: '', fonte_url: '' }, HOJE);
      expect((await repositorios.atividade.listar()).length).toBe(antes);
    });

    it('o contrato de alertas: canal vencido e KPI em falta só a partir do dia 10', async () => {
      await salvarCanal(esquemaFormularioCanal.parse({ ...FORMULARIO_CANAL_VAZIO, nome: 'Velho', taxa_percentual: '3', verificado_em: '2025-01-01', fonte_url: 'https://exemplo.com.br' }));
      const antesDoDia10 = await pendenciasParaAlertas(HOJE);
      expect(antesDoDia10.map((item) => item.motivo)).toEqual(['canal_sem_verificacao']);
      await salvarKpiMensal(ID_PRODUTO_KIPI, { competencia: '2026-10-01', valores: {}, observacao: '', fonte_url: '' }, HOJE);
      const depois = await pendenciasParaAlertas('2026-11-10');
      expect(depois.filter((item) => item.motivo === 'kpi_nao_preenchido')).toHaveLength(4);
      expect(depois.some((item) => item.origem_id === ID_PRODUTO_KIPI)).toBe(false);
    });
  });
});
