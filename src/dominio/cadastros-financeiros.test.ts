import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_CONTA_KIMBERLY, ID_ENTIDADE_PLANEJADA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { domingoDePascoa, feriadosDoAno, feriadosDoRio, feriadosNacionais } from '@/dados/referencia/feriados';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import { formatarDinheiro } from '@/lib/formatacao';
import { EXEMPLOS_INICIAIS, FERIADOS_INICIAIS, REGISTROS_INICIAIS } from './apoio-testes';
import {
  arquivarCategoria,
  arvoreDeCategorias,
  carregarCategorias,
  categoriasParaSeletor,
  conferirCategoria,
  contagemPorTipo,
  dadosDaCategoria,
  entraNoResultado,
  esquemaFormularioCategoria,
  FILTRO_SEM_NATUREZA,
  FILTROS_CATEGORIAS_INICIAIS,
  formularioCategoriaVazio,
  formularioDaCategoria,
  gruposParaEscolher,
  restaurarCategoria,
  salvarCategoria,
  semNatureza,
  vinculosDaCategoria,
  type FormularioCategoria,
} from './categorias';
import {
  arquivarConta,
  carregarContas,
  conferirConta,
  controlaSaldo,
  dadosDaConta,
  esquemaFormularioConta,
  exigeMotivoParaEncerrar,
  filtrarContas,
  FILTROS_CONTAS_INICIAIS,
  formularioContaVazio,
  formularioDaConta,
  nomeDoTitular,
  opcoesDeTitular,
  restaurarConta,
  salvarConta,
  sociasParaConta,
  temNumeroCompleto,
  titularDisponivel,
  type FormularioConta,
} from './contas';
import { aplicarImportacao, exportarTudo, limparExemplos, restaurarExemplos, resumoDosDados, type ArquivoDeDados } from './dados';
import { lerValor, valorParaCampo } from './dinheiro';
import { arquivarEntidade, FORMULARIO_ENTIDADE_VAZIO, salvarEntidade, vinculosDaEntidade } from './entidades';
import {
  arquivarEtiqueta,
  carregarEtiquetas,
  conferirNomeDaEtiqueta,
  dadosDaEtiqueta,
  esquemaFormularioEtiqueta,
  etiquetasDoModulo,
  filtrarEtiquetas,
  FORMULARIO_ETIQUETA_VAZIO,
  formularioDaEtiqueta,
  mesclarEtiquetas,
  restaurarEtiqueta,
  rotuloDosModulos,
  salvarEtiqueta,
  usosDaEtiqueta,
  type FormularioEtiqueta,
} from './etiquetas';
import {
  anosDoCalendario,
  avisoDeVencimento,
  carregarFeriadosDoAno,
  carregarTelaFeriados,
  dadosDoFeriado,
  diaDaSemana,
  ehDiaUtil,
  esquemaFormularioFeriado,
  feriadoRepetido,
  feriadosQueValem,
  filtrarFeriados,
  formularioFeriadoVazio,
  localDoFeriado,
  previaDoAno,
  proximoDiaUtil,
  removerFeriado,
  salvarFeriado,
  type FormularioFeriado,
} from './feriados';
import { historicoDoRegistro, historicoRecente } from './historico';
import { vinculosDaPessoa } from './pessoas';

const RIO = { uf: 'RJ', municipio: 'Rio de Janeiro' };

function novaCategoria(alteracoes: Partial<FormularioCategoria> = {}): FormularioCategoria {
  return { ...formularioCategoriaVazio(), nome: 'Categoria Teste', natureza_custo: 'compartilhado', pai_id: grupoInfra().id, ...alteracoes };
}

const grupoInfra = () => CATEGORIAS_INICIAIS.find((categoria) => categoria.nome === 'Infraestrutura e software')!;
const grupoReceitas = () => CATEGORIAS_INICIAIS.find((categoria) => categoria.nome === 'Receitas')!;
const hospedagem = () => CATEGORIAS_INICIAIS.find((categoria) => categoria.nome === 'Hospedagem e nuvem')!;
/** Nenhuma assinatura de exemplo usa: dá para arquivar. */
const bancoDeDados = () => CATEGORIAS_INICIAIS.find((categoria) => categoria.nome === 'Banco de dados')!;

function novaConta(alteracoes: Partial<FormularioConta> = {}): FormularioConta {
  return { ...formularioContaVazio('BRL'), nome: 'Conta PJ Numa', tipo: 'banco', titular: `entidade:${ID_ENTIDADE_PLANEJADA}`, saldo_inicial: '1.000,00', data_saldo_inicial: '2026-11-01', ...alteracoes };
}

function mensagensConta(alteracoes: Partial<FormularioConta>): string[] {
  const resultado = esquemaFormularioConta.safeParse(novaConta(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

function novoFeriado(alteracoes: Partial<FormularioFeriado> = {}): FormularioFeriado {
  return { ...formularioFeriadoVazio(RIO), data: '2026-12-08', nome: 'Feriado Teste', ...alteracoes };
}

function novaEtiqueta(alteracoes: Partial<FormularioEtiqueta> = {}): FormularioEtiqueta {
  return { ...FORMULARIO_ETIQUETA_VAZIO, nome: 'Urgente', ...alteracoes };
}

describe('T02.07 a T02.10', () => {
  let armazenamento: Driver;

  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-06T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  describe('T02.07: carga inicial', () => {
    it('8 grupos e 35 categorias, como a especificação sugere', async () => {
      const categorias = await carregarCategorias();
      expect(categorias.filter((categoria) => !categoria.pai_id)).toHaveLength(8);
      expect(categorias.filter((categoria) => categoria.pai_id)).toHaveLength(35);
      expect(categorias.every((categoria) => !categoria.exemplo)).toBe(true);
    });

    it('tipo vindo do grupo, e natureza vazia: a especificação não diz qual é', async () => {
      const categorias = await carregarCategorias();
      const contagem = contagemPorTipo(categorias, FILTROS_CATEGORIAS_INICIAIS);
      expect(contagem).toEqual({ todos: 35, despesa: 25, receita: 6, movimento_societario: 3, transferencia: 1 });
      expect(categorias.every((categoria) => categoria.natureza_custo === null)).toBe(true);
      expect(categorias.filter(semNatureza)).toHaveLength(25);
    });

    it('o que entra no resultado', () => {
      expect(entraNoResultado('despesa')).toBe(true);
      expect(entraNoResultado('receita')).toBe(true);
      expect(entraNoResultado('movimento_societario')).toBe(false);
      expect(entraNoResultado('transferencia')).toBe(false);
    });
  });

  describe('T02.07: formulário e conferência', () => {
    it('nome obrigatório; despesa em grupo pede a natureza; grupo não', () => {
      expect(esquemaFormularioCategoria.safeParse(novaCategoria({ nome: ' ' })).success).toBe(false);
      expect(esquemaFormularioCategoria.safeParse(novaCategoria({ natureza_custo: '' })).success).toBe(false);
      expect(esquemaFormularioCategoria.safeParse(novaCategoria({ natureza_custo: '', pai_id: '' })).success).toBe(true);
      expect(esquemaFormularioCategoria.safeParse(novaCategoria({ tipo: 'receita', natureza_custo: '' })).success).toBe(true);
    });

    it('só despesa guarda a natureza', () => {
      expect(dadosDaCategoria(novaCategoria({ tipo: 'receita' })).natureza_custo).toBeNull();
      expect(dadosDaCategoria(novaCategoria()).natureza_custo).toBe('compartilhado');
    });

    it('a categoria nova começa com o tipo do grupo', async () => {
      const receitas = (await carregarCategorias()).find((categoria) => categoria.id === grupoReceitas().id)!;
      expect(formularioCategoriaVazio(receitas)).toMatchObject({ tipo: 'receita', pai_id: receitas.id });
    });

    it('nome único no grupo, sem ligar para acento ou maiúscula', async () => {
      expect((await conferirCategoria(novaCategoria({ nome: 'hospedagem E NUVEM' }))).erroNome).toBe('Já existe “Hospedagem e nuvem” neste grupo.');
      expect((await conferirCategoria(novaCategoria({ nome: 'Hospedagem e nuvem', pai_id: grupoReceitas().id, tipo: 'receita', natureza_custo: '' }))).erroNome).toBeNull();
      expect((await conferirCategoria(novaCategoria({ nome: 'marketing', pai_id: '' }))).erroNome).toBe('Já existe um grupo “Marketing”.');
      await expect(salvarCategoria(novaCategoria({ nome: 'Domínios' }))).rejects.toThrow('Já existe “Domínios” neste grupo.');
    });

    it('a própria categoria não conta como repetida', async () => {
      const atual = (await carregarCategorias()).find((categoria) => categoria.id === hospedagem().id)!;
      expect((await conferirCategoria({ ...formularioDaCategoria(atual), natureza_custo: 'direto' }, atual.id)).erroNome).toBeNull();
    });

    it('uma arquivada segura o nome e diz onde está', async () => {
      await arquivarCategoria(bancoDeDados().id);
      expect((await conferirCategoria(novaCategoria({ nome: 'Banco de dados' }))).erroNome).toContain('em Arquivados');
    });

    it('só 2 níveis: categoria não vira grupo de outra, e grupo com categorias não entra em outro', async () => {
      expect((await conferirCategoria(novaCategoria({ pai_id: hospedagem().id }))).erroGrupo).toBe('A árvore tem 2 níveis: escolha um grupo, não uma categoria.');
      const grupo = (await carregarCategorias()).find((categoria) => categoria.id === grupoInfra().id)!;
      const movido = { ...formularioDaCategoria(grupo), pai_id: grupoReceitas().id };
      expect((await conferirCategoria(movido, grupo.id)).erroGrupo).toContain('Este grupo tem categorias');
      await expect(salvarCategoria(movido, grupo.id)).rejects.toThrow('Este grupo tem categorias');
      expect((await conferirCategoria({ ...movido, pai_id: grupo.id }, grupo.id)).erroGrupo).toBe('Uma categoria não pode ficar dentro dela mesma.');
    });

    it('tipo diferente do grupo só avisa', async () => {
      const { avisos, erroNome, erroGrupo } = await conferirCategoria(novaCategoria({ tipo: 'receita', natureza_custo: '' }));
      expect(avisos).toEqual(['O grupo Infraestrutura e software é de Despesa, e esta categoria é de Receita.']);
      expect(erroNome ?? erroGrupo).toBeNull();
    });

    it('grava e registra por extenso', async () => {
      const salva = await salvarCategoria(novaCategoria({ nome: 'CDN' }));
      await salvarCategoria({ ...formularioDaCategoria(salva), natureza_custo: 'direto' }, salva.id);
      const historico = await historicoDoRegistro('categoria_financeira', salva.id);
      expect(historico.map((linha) => linha.texto)).toEqual([expect.stringContaining('alterou a categoria CDN: Natureza do custo: de Compartilhado para Direto do produto'), expect.stringContaining('criou a categoria CDN')]);
    });
  });

  describe('T02.07: vínculos e seletores (RN-02.04)', () => {
    it('grupo com categorias não arquiva e diz quais', async () => {
      expect(await vinculosDaCategoria(grupoReceitas().id)).toContain('Categoria Assinaturas');
      await expect(arquivarCategoria(grupoReceitas().id)).rejects.toThrow('Este grupo tem categorias');
    });

    it('sem vínculos, arquiva e restaura', async () => {
      await arquivarCategoria(bancoDeDados().id);
      expect((await carregarCategorias()).find((categoria) => categoria.id === bancoDeDados().id)?.arquivado_em).not.toBeNull();
      await restaurarCategoria(bancoDeDados().id);
      expect((await carregarCategorias()).find((categoria) => categoria.id === bancoDeDados().id)?.arquivado_em).toBeNull();
    });

    it('categoria de uma assinatura ativa não arquiva e diz qual', async () => {
      expect(await vinculosDaCategoria(hospedagem().id)).toContain('Assinatura de Nuvem Clara Hosting');
      await expect(arquivarCategoria(hospedagem().id)).rejects.toThrow('Esta categoria está em uso: Assinatura de Nuvem Clara Hosting');
    });

    it('categoria não volta para um grupo arquivado', async () => {
      const categorias = await carregarCategorias();
      const grupo = await salvarCategoria(novaCategoria({ nome: 'Grupo Novo', pai_id: '' }));
      const filha = await salvarCategoria(novaCategoria({ nome: 'Filha', pai_id: grupo.id }));
      await arquivarCategoria(filha.id);
      await arquivarCategoria(grupo.id);
      await expect(restaurarCategoria(filha.id)).rejects.toThrow('O grupo Grupo Novo está arquivado.');
      await restaurarCategoria(grupo.id);
      await restaurarCategoria(filha.id);
      expect((await carregarCategorias()).length).toBe(categorias.length + 2);
    });

    it('inativa não aparece no seletor, e grupo inativo leva as suas', async () => {
      let categorias = await carregarCategorias();
      expect(categoriasParaSeletor(categorias, 'receita').map((categoria) => categoria.nome)).toContain('Assinaturas');
      const grupo = categorias.find((categoria) => categoria.id === grupoReceitas().id)!;
      await salvarCategoria({ ...formularioDaCategoria(grupo), situacao: 'inativa' }, grupo.id);
      categorias = await carregarCategorias();
      expect(categoriasParaSeletor(categorias, 'receita')).toEqual([]);
      const filha = categorias.find((categoria) => categoria.id === hospedagem().id)!;
      await salvarCategoria({ ...formularioDaCategoria(filha), natureza_custo: 'direto', situacao: 'inativa' }, filha.id);
      expect(categoriasParaSeletor(await carregarCategorias(), 'despesa').map((categoria) => categoria.nome)).not.toContain('Hospedagem e nuvem');
    });

    it('grupo com categorias não é escolhido; sem categorias, é', async () => {
      const novo = await salvarCategoria(novaCategoria({ nome: 'Avulsa', pai_id: '', natureza_custo: 'operacional' }));
      const nomes = categoriasParaSeletor(await carregarCategorias(), 'despesa').map((categoria) => categoria.nome);
      expect(nomes).toContain(novo.nome);
      expect(nomes).not.toContain('Marketing');
    });

    it('o seletor de grupos fica só com grupos ativos, sem a própria linha', async () => {
      const categorias = await carregarCategorias();
      const grupo = categorias.find((categoria) => categoria.id === grupoInfra().id)!;
      await salvarCategoria({ ...formularioDaCategoria(grupo), situacao: 'inativa' }, grupo.id);
      const depois = await carregarCategorias();
      expect(gruposParaEscolher(depois).map((categoria) => categoria.id)).not.toContain(grupo.id);
      expect(gruposParaEscolher(depois, { grupoAtual: grupo.id }).map((categoria) => categoria.id)).toContain(grupo.id);
      expect(gruposParaEscolher(depois, { idAtual: grupoReceitas().id }).map((categoria) => categoria.id)).not.toContain(grupoReceitas().id);
      expect(gruposParaEscolher(depois).every((categoria) => categoria.pai_id === null)).toBe(true);
    });
  });

  describe('T02.07: árvore e filtros', () => {
    const arvore = async (filtros = {}) => arvoreDeCategorias(await carregarCategorias(), { ...FILTROS_CATEGORIAS_INICIAIS, ...filtros });

    it('sem filtro, todos os grupos, na ordem da carga', async () => {
      const grupos = await arvore();
      expect(grupos.map(({ grupo }) => grupo.nome)).toEqual(['Infraestrutura e software', 'Serviços de terceiros', 'Marketing', 'Administrativo', 'Pessoal / sócias', 'Receitas', 'Movimentos societários', 'Transferências']);
      expect(grupos[0]?.categorias).toHaveLength(9);
    });

    it('busca pela categoria mostra só ela; pelo grupo, todas as dele', async () => {
      const porCategoria = await arvore({ busca: 'dominios' });
      expect(porCategoria.map(({ grupo, categorias }) => [grupo.nome, categorias.map((categoria) => categoria.nome)])).toEqual([['Infraestrutura e software', ['Domínios']]]);
      const porGrupo = await arvore({ busca: 'marketing' });
      expect(porGrupo[0]?.categorias).toHaveLength(4);
    });

    it('filtra por tipo, situação e natureza', async () => {
      expect((await arvore({ tipo: 'transferencia' })).map(({ grupo }) => grupo.nome)).toEqual(['Transferências']);
      expect(await arvore({ situacao: 'inativa' })).toEqual([]);
      expect((await arvore({ natureza: FILTRO_SEM_NATUREZA })).flatMap(({ categorias }) => categorias)).toHaveLength(25);
      expect(await arvore({ natureza: 'direto' })).toEqual([]);
      const filha = (await carregarCategorias()).find((categoria) => categoria.id === hospedagem().id) as CategoriaFinanceira;
      await salvarCategoria({ ...formularioDaCategoria(filha), natureza_custo: 'direto' }, filha.id);
      expect((await arvore({ natureza: 'direto' })).flatMap(({ categorias }) => categorias).map((categoria) => categoria.nome)).toEqual(['Hospedagem e nuvem']);
    });

    it('grupo inativo aparece ao filtrar inativas, mesmo com as categorias ativas', async () => {
      const grupo = (await carregarCategorias()).find((categoria) => categoria.id === grupoReceitas().id)!;
      await salvarCategoria({ ...formularioDaCategoria(grupo), situacao: 'inativa' }, grupo.id);
      expect(await arvore({ situacao: 'inativa' })).toEqual([expect.objectContaining({ categorias: [] })]);
    });

    it('arquivada sai da árvore', async () => {
      await arquivarCategoria(bancoDeDados().id);
      expect((await arvore())[0]?.categorias.map((categoria) => categoria.nome)).not.toContain('Banco de dados');
    });
  });

  describe('dinheiro (RT-07)', () => {
    it('lê como quem digita no Brasil', () => {
      expect(lerValor('1.234,56')).toBe(1234.56);
      expect(lerValor('1234,56')).toBe(1234.56);
      expect(lerValor('1234.56')).toBe(1234.56);
      expect(lerValor('1.234')).toBe(1234);
      expect(lerValor('0,00')).toBe(0);
      expect(lerValor('-50')).toBe(-50);
      expect(lerValor(' 1.234.567,8 ')).toBe(1234567.8);
    });

    it('recusa o que não dá para ter certeza', () => {
      for (const texto of ['', 'abc', '1,234.56', '12.34.56', '1,234', '1.234,567', '9999999999999,00']) expect(lerValor(texto)).toBeNull();
    });

    it('mostra na moeda do registro', () => {
      expect(formatarDinheiro(1234.5, 'BRL')).toBe('R$ 1.234,50');
      expect(formatarDinheiro(10, 'USD')).toBe('US$ 10,00');
      expect(valorParaCampo(1234.5)).toBe('1.234,50');
    });
  });

  describe('T02.08: carga e validação', () => {
    it('uma conta pessoal de cada sócia, de exemplo, sem dado inventado', async () => {
      const { contas } = await carregarContas();
      expect(contas.map((conta) => conta.nome)).toEqual(['Cartão pessoal — Kimberly', 'Cartão pessoal — Camila']);
      expect(contas.every((conta) => conta.exemplo && conta.tipo === 'pessoal_socia' && conta.instituicao === null && conta.final_numero === null && conta.saldo_inicial === null)).toBe(true);
      expect(contas.map((conta) => conta.titular_pessoa_id)).toEqual([ID_KIMBERLY, ID_CAMILA]);
    });

    it('os obrigatórios', () => {
      expect(mensagensConta({ nome: '' })).toEqual(['Informe o nome.']);
      expect(mensagensConta({ titular: '' })).toEqual(['Escolha o titular.']);
      expect(mensagensConta({ tipo: 'pessoal_socia', titular: '' })).toEqual(['Escolha a sócia.']);
      expect(mensagensConta({ moeda: '' })).toEqual(['Escolha a moeda.']);
    });

    it('conta pessoal é de uma sócia', () => {
      expect(mensagensConta({ tipo: 'pessoal_socia' })).toEqual(['Conta pessoal é de uma sócia.']);
      expect(mensagensConta({ tipo: 'pessoal_socia', titular: `pessoa:${ID_KIMBERLY}` })).toEqual([]);
    });

    it('nunca o número completo (RT-14)', () => {
      expect(temNumeroCompleto('4111 1111 1111 1111')).toBe(true);
      expect(temNumeroCompleto('4111111111111111')).toBe(true);
      expect(temNumeroCompleto('Conta 1234')).toBe(false);
      expect(mensagensConta({ nome: 'Cartão 4111 1111 1111 1111' })).toEqual(['Não guarde o número completo: use só os 4 últimos dígitos, no campo Final.']);
      expect(mensagensConta({ instituicao: '5500-0000-0000-0004' })).toHaveLength(1);
      expect(mensagensConta({ final_numero: '123' })).toEqual(['Use os 4 últimos dígitos.']);
      expect(mensagensConta({ final_numero: '1234' })).toEqual([]);
    });

    it('saldo e data só em conta bancária e caixa', () => {
      expect(controlaSaldo('banco') && controlaSaldo('caixa')).toBe(true);
      expect(controlaSaldo('cartao') || controlaSaldo('carteira') || controlaSaldo('pessoal_socia')).toBe(false);
      expect(mensagensConta({ saldo_inicial: '', data_saldo_inicial: '' })).toEqual(['Informe o saldo inicial.', 'Informe a data do saldo.']);
      expect(mensagensConta({ saldo_inicial: 'abc' })).toEqual(['Use só números, como 1.234,56.']);
      expect(mensagensConta({ saldo_inicial: '0,00' })).toEqual([]);
      expect(mensagensConta({ tipo: 'cartao', saldo_inicial: '', data_saldo_inicial: '' })).toEqual([]);
    });

    it('cartão não guarda saldo, mesmo que venha preenchido', () => {
      expect(dadosDaConta(novaConta({ tipo: 'cartao' }))).toMatchObject({ saldo_inicial: null, data_saldo_inicial: null });
      expect(dadosDaConta(novaConta())).toMatchObject({ saldo_inicial: 1000, data_saldo_inicial: '2026-11-01', titular_entidade_id: ID_ENTIDADE_PLANEJADA, titular_pessoa_id: null });
    });
  });

  describe('T02.08: titular', () => {
    it('só sócias internas e ativas; conta pessoal não oferece entidade', async () => {
      const dados = await carregarContas();
      expect(sociasParaConta(dados.pessoas).map((pessoa) => pessoa.nome_completo)).toEqual(['Kimberly Grebe', 'Camila Lima']);
      expect(opcoesDeTitular('pessoal_socia', dados).entidades).toEqual([]);
      expect(opcoesDeTitular('banco', dados).entidades.map((entidade) => entidade.id)).toEqual([ID_ENTIDADE_PLANEJADA]);
    });

    it('titular fora da lista: o formulário pede outro, sem trocar sozinho', async () => {
      const dados = await carregarContas();
      const conta = dados.contas.find((item) => item.id === ID_CONTA_KIMBERLY)!;
      expect(titularDisponivel(conta, dados)).toBe(true);
      const semSocia = { ...dados, pessoas: dados.pessoas.map((pessoa) => (pessoa.id === ID_KIMBERLY ? { ...pessoa, situacao: 'inativa' as const } : pessoa)) };
      expect(titularDisponivel(conta, semSocia)).toBe(false);
      expect(formularioDaConta(conta, semSocia).titular).toBe('');
      expect(nomeDoTitular(conta, semSocia)).toBe('Kimberly Grebe');
    });

    it('a sócia e a entidade têm vínculo com a conta', async () => {
      expect(await vinculosDaPessoa(ID_KIMBERLY)).toContain('Titular da conta Cartão pessoal — Kimberly');
      await salvarConta(novaConta());
      expect(await vinculosDaEntidade(ID_ENTIDADE_PLANEJADA)).toEqual(['Conta Conta PJ Numa']);
      await expect(arquivarEntidade(ID_ENTIDADE_PLANEJADA)).rejects.toThrow('Esta entidade está em uso: Conta Conta PJ Numa.');
    });

    it('não grava uma pessoa que não é sócia como titular', async () => {
      await expect(salvarConta(novaConta({ titular: 'pessoa:2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03' }))).rejects.toThrow('O titular precisa ser uma sócia ou uma entidade.');
    });
  });

  describe('T02.08: encerrar', () => {
    it('com saldo, pede motivo; com saldo zero ou sem saldo controlado, não', async () => {
      const conta = await salvarConta(novaConta());
      expect(exigeMotivoParaEncerrar(novaConta({ situacao: 'encerrada' }), conta)).toBe(true);
      expect(exigeMotivoParaEncerrar(novaConta({ situacao: 'encerrada', saldo_inicial: '0,00' }), conta)).toBe(false);
      expect(exigeMotivoParaEncerrar(novaConta({ situacao: 'encerrada', tipo: 'cartao' }), conta)).toBe(false);
      expect(exigeMotivoParaEncerrar(novaConta(), conta)).toBe(false);
    });

    it('quem já está encerrada não pede de novo', async () => {
      const conta = await salvarConta(novaConta({ saldo_inicial: '0,00' }));
      const encerrada = await salvarConta(novaConta({ saldo_inicial: '0,00', situacao: 'encerrada' }), conta.id);
      expect(exigeMotivoParaEncerrar(novaConta({ situacao: 'encerrada' }), encerrada)).toBe(false);
    });

    it('o motivo vai para o histórico', async () => {
      const conta = await salvarConta(novaConta());
      await expect(salvarConta(novaConta({ situacao: 'encerrada' }), conta.id)).rejects.toThrow('Informe o motivo para encerrar uma conta com saldo.');
      await salvarConta(novaConta({ situacao: 'encerrada', motivo: 'Banco fechou a agência' }), conta.id);
      const [ultimo] = await historicoDoRegistro('conta_financeira', conta.id);
      expect(ultimo?.texto).toContain('Situação: de Ativa para Encerrada. Motivo: Banco fechou a agência');
    });
  });

  describe('T02.08: conferência, lista e arquivo', () => {
    it('nome igual e texto que parece segredo só avisam', async () => {
      expect(await conferirConta(novaConta({ nome: 'cartao pessoal — kimberly' }))).toEqual(['Já existe uma conta chamada cartao pessoal — kimberly.']);
      expect((await conferirConta(novaConta({ instituicao: 'senha: abc123' })))[0]).toContain('senha ou um token');
      expect(await conferirConta(novaConta())).toEqual([]);
    });

    it('o histórico não mostra o final nem o saldo', async () => {
      const conta = await salvarConta(novaConta());
      await salvarConta(novaConta({ final_numero: '1234', saldo_inicial: '2.000,00', instituicao: 'Banco Teste' }), conta.id);
      const [ultimo] = await historicoDoRegistro('conta_financeira', conta.id);
      expect(ultimo?.texto).toContain('Instituição: de não informado para Banco Teste');
      expect(ultimo?.texto).toContain('Final');
      expect(ultimo?.texto).toContain('Saldo inicial');
      expect(ultimo?.texto).not.toContain('1234');
      expect(ultimo?.texto).not.toContain('2000');
    });

    it('busca, filtra e arquiva', async () => {
      await salvarConta(novaConta({ nome: 'Caixa da Numa', tipo: 'caixa', instituicao: 'Própria', final_numero: '9876' }));
      const lista = async (filtros = {}) => {
        const dados = await carregarContas();
        return filtrarContas(dados.contas, { ...FILTROS_CONTAS_INICIAIS, ...filtros }, dados).map((conta) => conta.nome);
      };
      expect(await lista()).toEqual(['Caixa da Numa', 'Cartão pessoal — Camila', 'Cartão pessoal — Kimberly']);
      expect(await lista({ busca: '9876' })).toEqual(['Caixa da Numa']);
      expect(await lista({ busca: 'propria' })).toEqual(['Caixa da Numa']);
      expect(await lista({ busca: 'camila' })).toEqual(['Cartão pessoal — Camila']);
      expect(await lista({ tipo: 'pessoal_socia' })).toHaveLength(2);
      expect(await lista({ situacao: 'encerrada' })).toEqual([]);
      const caixa = (await carregarContas()).contas.find((conta) => conta.nome === 'Caixa da Numa')!;
      await arquivarConta(caixa.id);
      expect(await lista({ arquivadas: true })).toEqual(['Caixa da Numa']);
      await restaurarConta(caixa.id);
      expect(await lista({ arquivadas: true })).toEqual([]);
    });

    it('conta de pagamento de uma assinatura ativa não arquiva e diz de qual', async () => {
      await expect(arquivarConta(ID_CONTA_KIMBERLY)).rejects.toThrow('Esta conta está em uso: Conta de pagamento de Estúdio Verde Registro');
    });
  });

  describe('T02.09: lista do ano', () => {
    it('a Páscoa bate com os anos conhecidos', () => {
      expect(domingoDePascoa(2025)).toBe('2025-04-20');
      expect(domingoDePascoa(2026)).toBe('2026-04-05');
      expect(domingoDePascoa(2027)).toBe('2027-03-28');
      expect(domingoDePascoa(2028)).toBe('2028-04-16');
      expect(domingoDePascoa(2038)).toBe('2038-04-25');
    });

    it('2026 bate com o calendário do TJRJ', () => {
      const porData = Object.fromEntries(feriadosDoAno(2026, RIO).map((feriado) => [feriado.data, feriado.nome]));
      expect(porData).toMatchObject({
        '2026-01-01': 'Confraternização Universal',
        '2026-01-20': 'Dia de São Sebastião',
        '2026-02-16': 'Carnaval (segunda-feira)',
        '2026-02-17': 'Carnaval (terça-feira)',
        '2026-04-03': 'Sexta-feira Santa',
        '2026-04-21': 'Tiradentes',
        '2026-04-23': 'Dia de São Jorge',
        '2026-05-01': 'Dia do Trabalho',
        '2026-06-04': 'Corpus Christi',
        '2026-09-07': 'Independência do Brasil',
        '2026-10-12': 'Nossa Senhora Aparecida',
        '2026-11-02': 'Finados',
        '2026-11-15': 'Proclamação da República',
        '2026-11-20': 'Dia Nacional de Zumbi e da Consciência Negra',
        '2026-12-25': 'Natal',
      });
      expect(feriadosDoAno(2026, RIO)).toHaveLength(FERIADOS_INICIAIS);
    });

    it('as datas móveis mudam com o ano', () => {
      const de2027 = Object.fromEntries(feriadosNacionais(2027).map((feriado) => [feriado.nome, feriado.data]));
      expect(de2027).toMatchObject({ 'Carnaval (segunda-feira)': '2027-02-08', 'Carnaval (terça-feira)': '2027-02-09', 'Sexta-feira Santa': '2027-03-26', 'Corpus Christi': '2027-05-27' });
    });

    it('fora do Rio, só os nacionais; em outro município do RJ, sem o municipal', () => {
      expect(feriadosDoAno(2026, { uf: 'SP', municipio: 'São Paulo' })).toHaveLength(13);
      expect(feriadosDoAno(2026, { uf: 'RJ', municipio: 'Niterói' }).map((feriado) => feriado.nome)).toContain('Dia de São Jorge');
      expect(feriadosDoAno(2026, { uf: 'RJ', municipio: 'Niterói' }).map((feriado) => feriado.nome)).not.toContain('Dia de São Sebastião');
      expect(feriadosDoRio(2026).map((feriado) => feriado.abrangencia)).toEqual(['municipal', 'estadual']);
    });

    it('a carga inicial traz o ano atual, sem marcar como exemplo', async () => {
      const { feriados } = await carregarTelaFeriados();
      expect(feriados).toHaveLength(FERIADOS_INICIAIS);
      expect(feriados.every((feriado) => feriado.data.startsWith('2026') && !feriado.exemplo)).toBe(true);
    });

    it('a prévia diz o que já existe; carregar só traz o que falta, de uma vez', async () => {
      await removerFeriado((await repositorios.feriado.listar({ onde: { nome: 'Natal' } }))[0]!.id);
      const previa = previaDoAno(2026, await repositorios.feriado.listar(), RIO);
      expect(previa.filter((linha) => !linha.jaCadastrado).map((linha) => linha.nome)).toEqual(['Natal']);
      expect(await carregarFeriadosDoAno(2026, RIO)).toBe(1);
      expect(await carregarFeriadosDoAno(2026, RIO)).toBe(0);
      expect(await carregarFeriadosDoAno(2027, RIO)).toBe(FERIADOS_INICIAIS);
      expect((await repositorios.feriado.listar()).filter((feriado) => feriado.data.startsWith('2027'))).toHaveLength(FERIADOS_INICIAIS);
    });

    it('anos e filtros', async () => {
      const { feriados } = await carregarTelaFeriados();
      expect(anosDoCalendario(feriados, 2026)).toEqual([2026, 2027]);
      expect(filtrarFeriados(feriados, { ano: 2026, abrangencia: 'todas' })[0]?.nome).toBe('Confraternização Universal');
      expect(filtrarFeriados(feriados, { ano: 2026, abrangencia: 'municipal' }).map((feriado) => feriado.nome)).toEqual(['Dia de São Sebastião']);
      expect(filtrarFeriados(feriados, { ano: 2027, abrangencia: 'todas' })).toEqual([]);
    });
  });

  describe('T02.09: formulário', () => {
    const mensagens = (alteracoes: Partial<FormularioFeriado>) => {
      const resultado = esquemaFormularioFeriado.safeParse(novoFeriado(alteracoes));
      return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
    };

    it('os obrigatórios', () => {
      expect(mensagens({ data: '' })).toEqual(['Informe a data.']);
      expect(mensagens({ nome: '' })).toEqual(['Informe o nome.']);
      expect(mensagens({ abrangencia: 'estadual', uf: '' })).toEqual(['Escolha o estado.']);
      expect(mensagens({ abrangencia: 'municipal', municipio: '' })).toEqual(['Escolha o município.']);
    });

    it('o local só fica quando a abrangência pede', () => {
      expect(dadosDoFeriado(novoFeriado())).toMatchObject({ uf: null, municipio: null });
      expect(dadosDoFeriado(novoFeriado({ abrangencia: 'estadual' }))).toMatchObject({ uf: 'RJ', municipio: null });
      expect(dadosDoFeriado(novoFeriado({ abrangencia: 'municipal' }))).toMatchObject({ uf: 'RJ', municipio: 'Rio de Janeiro' });
      expect(localDoFeriado({ uf: 'RJ', municipio: 'Rio de Janeiro' })).toBe('Rio de Janeiro · RJ');
    });

    it('não repete o mesmo feriado; quem foi removido pode voltar', async () => {
      expect(await feriadoRepetido(novoFeriado({ data: '2026-12-25', nome: 'natal' }))).toBe(true);
      await expect(salvarFeriado(novoFeriado({ data: '2026-12-25', nome: 'natal' }))).rejects.toThrow('Já existe esse feriado nessa data.');
      await removerFeriado((await repositorios.feriado.listar({ onde: { nome: 'Natal' } }))[0]!.id);
      expect(await feriadoRepetido(novoFeriado({ data: '2026-12-25', nome: 'natal' }))).toBe(false);
    });

    it('grava e registra por extenso', async () => {
      const salvo = await salvarFeriado(novoFeriado({ abrangencia: 'municipal', nome: 'Feriado Municipal' }));
      await salvarFeriado(novoFeriado({ abrangencia: 'municipal', nome: 'Feriado Municipal', data: '2026-12-09' }), salvo.id);
      const [ultimo] = await historicoDoRegistro('feriado', salvo.id);
      expect(ultimo?.texto).toContain('alterou o feriado Feriado Municipal: Data: de 08/12/2026 para 09/12/2026');
    });
  });

  describe('T02.09: dias úteis', () => {
    const feriados = [{ data: '2026-04-21', nome: 'Tiradentes' }];

    it('o dia da semana por extenso', () => {
      expect(diaDaSemana('2026-11-06')).toBe('sexta-feira');
    });

    it('fim de semana e feriado não são úteis', () => {
      expect(ehDiaUtil('2026-11-06', feriados)).toBe(true);
      expect(ehDiaUtil('2026-11-07', feriados)).toBe(false);
      expect(ehDiaUtil('2026-11-08', feriados)).toBe(false);
      expect(ehDiaUtil('2026-04-21', feriados)).toBe(false);
    });

    it('o próximo dia útil pula tudo', () => {
      expect(proximoDiaUtil('2026-11-06', feriados)).toBe('2026-11-09');
      expect(proximoDiaUtil('2026-04-20', feriados)).toBe('2026-04-22');
    });

    it('o aviso de vencimento só informa', () => {
      expect(avisoDeVencimento('2026-11-08', feriados)).toBe('Vence num domingo — pagamento provavelmente no próximo dia útil');
      expect(avisoDeVencimento('2026-11-07', feriados)).toBe('Vence num sábado — pagamento provavelmente no próximo dia útil');
      expect(avisoDeVencimento('2026-04-21', feriados)).toBe('Vence num feriado (Tiradentes) — pagamento provavelmente no próximo dia útil');
      expect(avisoDeVencimento('2026-11-06', feriados)).toBeNull();
    });

    it('vale só o local padrão (D16)', async () => {
      const paulista = await salvarFeriado(novoFeriado({ abrangencia: 'estadual', uf: 'SP', nome: 'Revolução Constitucionalista', data: '2026-07-09' }));
      const niteroi = await salvarFeriado(novoFeriado({ abrangencia: 'municipal', nome: 'Feriado de Niterói', municipio: 'Niterói', data: '2026-11-22' }));
      const { feriados: todos } = await carregarTelaFeriados();
      const valem = feriadosQueValem(todos, RIO).map((feriado) => feriado.id);
      expect(valem).not.toContain(paulista.id);
      expect(valem).not.toContain(niteroi.id);
      expect(valem).toHaveLength(FERIADOS_INICIAIS);
    });
  });

  describe('T02.10: etiquetas', () => {
    const vincular = (etiquetaId: string, registroId: string) => repositorios.etiqueta_vinculo.criar({ etiqueta_id: etiquetaId, registro_tipo: 'pessoa', registro_id: registroId });

    it('começam vazias: a especificação não traz nenhuma', async () => {
      expect(await carregarEtiquetas()).toEqual({ etiquetas: [], vinculos: [] });
    });

    it('validação', () => {
      const mensagens = (alteracoes: Partial<FormularioEtiqueta>) => {
        const resultado = esquemaFormularioEtiqueta.safeParse(novaEtiqueta(alteracoes));
        return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
      };
      expect(mensagens({ nome: '' })).toEqual(['Informe o nome.']);
      expect(mensagens({ cor: 'azul' })).toEqual(['Use o formato #RRGGBB.']);
      expect(mensagens({ cor: '#FFFFFF' })[0]).toContain('clara demais');
      expect(mensagens({ cor: '#3478B8' })).toEqual([]);
      expect(mensagens({ escopo: 'alguns' })).toEqual(['Escolha pelo menos um módulo.']);
      expect(mensagens({ escopo: 'alguns', modulos: ['financeiro'] })).toEqual([]);
    });

    it('todos por padrão: vazio vale para qualquer módulo', async () => {
      expect(dadosDaEtiqueta(novaEtiqueta({ cor: '#3478b8' }))).toEqual({ nome: 'Urgente', cor: '#3478B8', modulos: [] });
      expect(dadosDaEtiqueta(novaEtiqueta({ escopo: 'todos', modulos: ['financeiro'] })).modulos).toEqual([]);
      const todas = await salvarEtiqueta(novaEtiqueta());
      const so = await salvarEtiqueta(novaEtiqueta({ nome: 'Só financeiro', escopo: 'alguns', modulos: ['financeiro'] }));
      expect(rotuloDosModulos(todas.modulos)).toBe('Todos os módulos');
      expect(rotuloDosModulos(so.modulos)).toBe('Financeiro');
      expect(formularioDaEtiqueta(so)).toMatchObject({ escopo: 'alguns', modulos: ['financeiro'] });
      const { etiquetas } = await carregarEtiquetas();
      expect(etiquetasDoModulo(etiquetas, 'financeiro').map((etiqueta) => etiqueta.nome)).toEqual(['Urgente', 'Só financeiro']);
      expect(etiquetasDoModulo(etiquetas, 'atividades').map((etiqueta) => etiqueta.nome)).toEqual(['Urgente']);
    });

    it('nome único, até entre as arquivadas', async () => {
      const etiqueta = await salvarEtiqueta(novaEtiqueta());
      expect(await conferirNomeDaEtiqueta('URGENTE')).toBe('Já existe “Urgente”.');
      expect(await conferirNomeDaEtiqueta('Urgente', etiqueta.id)).toBeNull();
      await expect(salvarEtiqueta(novaEtiqueta({ nome: 'urgente' }))).rejects.toThrow('Já existe');
      await arquivarEtiqueta(etiqueta.id);
      expect(await conferirNomeDaEtiqueta('Urgente')).toContain('em Arquivados');
    });

    it('em uso não arquiva; sem uso, arquiva e restaura', async () => {
      const etiqueta = await salvarEtiqueta(novaEtiqueta());
      const vinculo = await vincular(etiqueta.id, ID_KIMBERLY);
      await expect(arquivarEtiqueta(etiqueta.id)).rejects.toThrow('Esta etiqueta está em 1 registro.');
      await repositorios.etiqueta_vinculo.arquivar(vinculo.id);
      await arquivarEtiqueta(etiqueta.id);
      expect(filtrarEtiquetas((await carregarEtiquetas()).etiquetas, '', true).map((item) => item.nome)).toEqual(['Urgente']);
      await restaurarEtiqueta(etiqueta.id);
      expect(filtrarEtiquetas((await carregarEtiquetas()).etiquetas, 'urg', false).map((item) => item.nome)).toEqual(['Urgente']);
    });

    it('mesclar move os vínculos, sem repetir, e arquiva a de origem', async () => {
      const origem = await salvarEtiqueta(novaEtiqueta({ nome: 'Urgentíssimo' }));
      const destino = await salvarEtiqueta(novaEtiqueta());
      await vincular(origem.id, ID_KIMBERLY);
      await vincular(origem.id, ID_CAMILA);
      await vincular(destino.id, ID_CAMILA);
      expect(await mesclarEtiquetas(origem.id, destino.id)).toBe(2);
      const { etiquetas, vinculos } = await carregarEtiquetas();
      expect(usosDaEtiqueta(origem.id, vinculos)).toBe(0);
      expect(vinculos.filter((vinculo) => vinculo.etiqueta_id === destino.id).map((vinculo) => vinculo.registro_id).sort()).toEqual([ID_KIMBERLY, ID_CAMILA].sort());
      expect(etiquetas.find((etiqueta) => etiqueta.id === origem.id)?.arquivado_em).not.toBeNull();
      const textos = (await historicoRecente(10)).map((linha) => linha.texto);
      expect(textos.some((texto) => texto.includes('arquivou a etiqueta Urgentíssimo. Motivo: Mesclada em Urgente'))).toBe(true);
      expect(textos.some((texto) => texto.includes('moveu um registro para a etiqueta Urgente'))).toBe(true);
    });

    it('não mescla com ela mesma nem com uma arquivada', async () => {
      const origem = await salvarEtiqueta(novaEtiqueta());
      const outra = await salvarEtiqueta(novaEtiqueta({ nome: 'Outra' }));
      await expect(mesclarEtiquetas(origem.id, origem.id)).rejects.toThrow('Escolha outra etiqueta');
      await arquivarEtiqueta(outra.id);
      await expect(mesclarEtiquetas(origem.id, outra.id)).rejects.toThrow('não está mais na lista');
    });

    it('limpar exemplos tira o vínculo com um registro fictício, e a etiqueta fica', async () => {
      const etiqueta = await salvarEtiqueta(novaEtiqueta());
      await vincular(etiqueta.id, '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03');
      await vincular(etiqueta.id, ID_KIMBERLY);
      await limparExemplos();
      const { etiquetas, vinculos } = await carregarEtiquetas();
      expect(etiquetas).toHaveLength(1);
      expect(vinculos.map((vinculo) => vinculo.registro_id)).toEqual([ID_KIMBERLY]);
    });
  });

  describe('com os outros dados', () => {
    it('as contas de exemplo contam; os vínculos de etiqueta, não', async () => {
      const etiqueta = await salvarEtiqueta(novaEtiqueta());
      await repositorios.etiqueta_vinculo.criar({ etiqueta_id: etiqueta.id, registro_tipo: 'pessoa', registro_id: ID_KIMBERLY });
      expect(await resumoDosDados()).toMatchObject({ registros: REGISTROS_INICIAIS + 1, exemplos: EXEMPLOS_INICIAIS });
    });

    it('limpar exemplos tira as contas fictícias e deixa categorias e feriados', async () => {
      await limparExemplos();
      expect((await carregarContas()).contas).toEqual([]);
      expect((await carregarCategorias()).length).toBe(CATEGORIAS_INICIAIS.length);
      expect((await carregarTelaFeriados()).feriados).toHaveLength(FERIADOS_INICIAIS);
    });

    it('restaurar exemplos volta à carga inicial', async () => {
      await salvarEtiqueta(novaEtiqueta());
      await salvarCategoria(novaCategoria({ nome: 'CDN' }));
      await restaurarExemplos();
      expect((await carregarEtiquetas()).etiquetas).toEqual([]);
      expect((await carregarCategorias()).length).toBe(CATEGORIAS_INICIAIS.length);
    });

    it('exportar e importar levam tudo', async () => {
      await salvarEtiqueta(novaEtiqueta());
      await salvarConta(novaConta());
      await salvarFeriado(novoFeriado());
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      await restaurarExemplos();
      await aplicarImportacao(arquivo);
      expect((await carregarEtiquetas()).etiquetas.map((etiqueta) => etiqueta.nome)).toEqual(['Urgente']);
      expect((await carregarContas()).contas.map((conta) => conta.nome)).toContain('Conta PJ Numa');
      expect((await carregarTelaFeriados()).feriados.map((feriado) => feriado.nome)).toContain('Feriado Teste');
    });

    it('backup anterior: categorias e feriados voltam aos iniciais; contas e etiquetas ficam vazias', async () => {
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      for (const tabela of ['categoria_financeira', 'conta_financeira', 'feriado', 'etiqueta', 'etiqueta_vinculo'] as const) delete arquivo.tabelas[tabela];
      arquivo.versao_dados = 5;
      await aplicarImportacao(arquivo);
      expect((await carregarCategorias()).length).toBe(CATEGORIAS_INICIAIS.length);
      expect((await carregarTelaFeriados()).feriados).toHaveLength(FERIADOS_INICIAIS);
      expect((await carregarContas()).contas).toEqual([]);
      expect((await carregarEtiquetas()).etiquetas).toEqual([]);
    });
  });

  describe('dados da versão anterior', () => {
    function voltarParaVersao5() {
      for (const tabela of ['categoria_financeira', 'conta_financeira', 'feriado', 'etiqueta', 'etiqueta_vinculo']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 5 });
      esquecerMetaEmMemoria();
    }

    it('acrescenta sem tocar no que existia', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      voltarParaVersao5();
      expect((await carregarCategorias()).length).toBe(CATEGORIAS_INICIAIS.length);
      expect((await carregarContas()).contas).toHaveLength(2);
      expect((await carregarTelaFeriados()).feriados).toHaveLength(FERIADOS_INICIAIS);
      expect(await carregarEtiquetas()).toEqual({ etiquetas: [], vinculos: [] });
      expect((await repositorios.configuracao.ler()).organizacao_nome).toBe('Numa Planejada');
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });

    it('quem já limpou os exemplos não recebe contas de exemplo', async () => {
      await limparExemplos();
      voltarParaVersao5();
      expect((await carregarContas()).contas).toEqual([]);
      expect((await carregarCategorias()).length).toBe(CATEGORIAS_INICIAIS.length);
    });
  });

  it('entidade nova com conta: arquivar segue barrado, e sem conta passa', async () => {
    const entidade = await salvarEntidade({ ...FORMULARIO_ENTIDADE_VAZIO, nome: 'Numa Tecnologia Ltda' });
    await arquivarEntidade(entidade.id);
    expect((await carregarContas()).entidades.find((item) => item.id === entidade.id)?.arquivado_em).not.toBeNull();
  });
});
