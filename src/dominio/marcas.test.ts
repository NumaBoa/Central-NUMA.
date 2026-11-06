import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { ID_KIMBERLY, ID_MARCA_KIPI, ID_MARCA_NUMA, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { REGISTROS_INICIAIS } from './apoio-testes';
import { contrasteComLinho, corVisivel, tintaDaCor } from './cores';
import { acharContexto, carregarContextos, montarContextos, nomeCurto } from './contextos';
import { aplicarImportacao, exportarTudo, limparExemplos, restaurarExemplos, resumoDosDados, type ArquivoDeDados } from './dados';
import { historicoRecente } from './historico';
import { arquivarMarca, carregarMarcas, esquemaFormularioMarca, FORMULARIO_MARCA_VAZIO, restaurarMarca, salvarMarca, type FormularioMarca } from './marcas';
import { inativarPessoa, vinculosDaPessoa } from './pessoas';
import {
  arquivarProduto,
  conferirProduto,
  dadosDoProduto,
  esquemaFormularioProduto,
  exigeMotivo,
  formularioDoProduto,
  formularioProdutoVazio,
  responsavelDisponivel,
  restaurarProduto,
  salvarProduto,
  usaFila,
  type FormularioProduto,
  type FormularioProdutoValidado,
} from './produtos';

function novaMarca(alteracoes: Partial<FormularioMarca> = {}): FormularioMarca {
  return { ...FORMULARIO_MARCA_VAZIO, nome: 'Lumi', cor_hex: '#884EA0', ...alteracoes };
}

function mensagensMarca(alteracoes: Partial<FormularioMarca>): string[] {
  const resultado = esquemaFormularioMarca.safeParse(novaMarca(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

function novoProduto(alteracoes: Partial<FormularioProduto> = {}): FormularioProduto {
  return { ...formularioProdutoVazio(ID_MARCA_KIPI), nome: 'Kipi Web', codigo_curto: 'KWEB', responsavel_id: ID_KIMBERLY, ...alteracoes };
}

function validado(alteracoes: Partial<FormularioProduto> = {}): FormularioProdutoValidado {
  return esquemaFormularioProduto.parse(novoProduto(alteracoes));
}

function mensagensProduto(alteracoes: Partial<FormularioProduto>): string[] {
  const resultado = esquemaFormularioProduto.safeParse(novoProduto(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

describe('T02.04 Marcas e produtos', () => {
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

  describe('carga inicial (T02.04, M07 §6 e 18 §3.2)', () => {
    it('as 6 marcas, com as cores oficiais', async () => {
      const { marcas } = await carregarMarcas();
      expect(marcas.map((marca) => [marca.nome, marca.cor_hex, marca.provisorio, marca.institucional])).toEqual([
        ['Numa', '#6366F1', false, true],
        ['Sobrevivência Urbana', '#D9962B', false, false],
        ['Kipi', '#A8693A', false, false],
        ['Zupi', '#4E9A72', false, false],
        ['Zarpa', '#3478B8', true, false],
        ['Mimo', '#C2668A', true, false],
      ]);
    });

    it('os 5 produtos, com estágio e fila', async () => {
      const { produtos } = await carregarMarcas();
      expect(produtos.map((produto) => [produto.nome, produto.codigo_curto, produto.estagio, produto.ordem_fila])).toEqual([
        ['Sobrevivência Urbana', 'SURB', 'em_uso', null],
        ['Kipi', 'KIPI', 'em_uso', null],
        ['Zupi', 'ZUPI', 'ideia', 1],
        ['Zarpa', 'ZARPA', 'ideia', 2],
        ['Mimo', 'MIMO', 'ideia', 3],
      ]);
    });

    it('são dados reais, e nada inventa quem é a responsável', async () => {
      const { marcas, produtos } = await carregarMarcas();
      expect([...marcas, ...produtos].every((linha) => !linha.exemplo)).toBe(true);
      expect(produtos.every((produto) => produto.responsavel_id === null)).toBe(true);
    });

    it('Kipi tem usuários reais (CA-09.01); produtos em ideia, não', async () => {
      const { produtos } = await carregarMarcas();
      expect(produtos.find((produto) => produto.nome === 'Kipi')?.tem_usuarios_reais).toBe(true);
      expect(produtos.find((produto) => produto.nome === 'Zupi')?.tem_usuarios_reais).toBe(false);
    });

    it('contam como registros', async () => {
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS);
    });
  });

  describe('cores', () => {
    it('todas as cores oficiais passam na validação de contraste', () => {
      for (const cor of ['#6366F1', '#D9962B', '#A8693A', '#4E9A72', '#3478B8', '#C2668A']) expect(corVisivel(cor)).toBe(true);
    });

    it('cor clara demais não aparece nas etiquetas', () => {
      expect(corVisivel('#F0EDE8')).toBe(false);
      expect(corVisivel('#FFEEAA')).toBe(false);
      expect(contrasteComLinho('#000000')).toBeGreaterThan(15);
    });

    it('as tintas oficiais vêm dos tokens, sem conta', () => {
      expect(tintaDaCor('#D9962B')).toBe('var(--t-urb)');
      expect(tintaDaCor('#d9962b')).toBe('var(--t-urb)');
    });

    it('para outra cor, a tinta é a cor a ~14% sobre o linho', () => {
      expect(tintaDaCor('#000000')).toBe('#d5d4d0');
    });
  });

  describe('contexto (CA-02.03)', () => {
    it('lista exatamente os produtos ativos + Numa institucional + Numa consolidada', async () => {
      const contextos = await carregarContextos();
      expect(contextos.map((contexto) => contexto.nome)).toEqual(['Numa consolidada', 'Numa institucional', 'Sobrevivência Urbana', 'Kipi', 'Zupi', 'Zarpa', 'Mimo']);
    });

    it('produto pausado, descontinuado ou arquivado sai', async () => {
      const { marcas, produtos } = await carregarMarcas();
      const [urbana, kipi, zupi, ...resto] = produtos;
      const alterados = [{ ...urbana!, situacao: 'pausado' as const }, { ...kipi!, situacao: 'descontinuado' as const }, { ...zupi!, arquivado_em: '2026-11-06T15:00:00.000Z' }, ...resto];
      expect(montarContextos(marcas, alterados).map((contexto) => contexto.nome)).toEqual(['Numa consolidada', 'Numa institucional', 'Zarpa', 'Mimo']);
    });

    it('produto novo entra sozinho', async () => {
      await salvarProduto(validado());
      expect((await carregarContextos()).map((contexto) => contexto.nome)).toContain('Kipi Web');
    });

    it('a cor e o provisório vêm da marca', async () => {
      const contextos = await carregarContextos();
      expect(contextos.find((contexto) => contexto.nome === 'Zarpa')).toMatchObject({ provisorio: true, cor: '#3478B8', tinta: 'var(--t-zarpa)' });
      expect(contextos.find((contexto) => contexto.nome === 'Kipi')).toMatchObject({ provisorio: false, cor: '#A8693A' });
    });

    it('as visões da Numa usam a cor da marca institucional', async () => {
      await salvarMarca({ ...novaMarca({ nome: 'Numa', cor_hex: '#884EA0' }) }, ID_MARCA_NUMA);
      expect((await carregarContextos())[0]).toMatchObject({ cor: '#884EA0' });
    });

    it('nome curto para a pílula do celular', () => {
      expect(nomeCurto('Sobrevivência Urbana')).toBe('S. Urbana');
      expect(nomeCurto('Kipi')).toBeUndefined();
    });

    it('contexto que saiu da lista volta à visão consolidada', async () => {
      const contextos = await carregarContextos();
      expect(acharContexto(contextos, 'nao-existe').nome).toBe('Numa consolidada');
      expect(acharContexto(contextos, ID_PRODUTO_KIPI).nome).toBe('Kipi');
    });
  });

  describe('marca', () => {
    it('nome e cor são obrigatórios; a cor precisa aparecer', () => {
      expect(mensagensMarca({ nome: ' ' })).toEqual(['Informe o nome da marca.']);
      expect(mensagensMarca({ cor_hex: 'azul' })).toEqual(['Use uma cor no formato #RRGGBB.']);
      expect(mensagensMarca({ cor_hex: '#FFFFFF' })).toEqual(['Esta cor é clara demais para aparecer nas etiquetas. Escolha uma mais forte.']);
      expect(mensagensMarca({})).toEqual([]);
    });

    it('logotipo só aceita link do Drive', () => {
      expect(mensagensMarca({ logo_url: 'https://exemplo.com/logo.png' })).toEqual(['Use um link de drive.google.com ou docs.google.com.']);
      expect(mensagensMarca({ logo_url: 'https://drive.google.com/file/d/abc' })).toEqual([]);
    });

    it('cria sempre como não institucional e registra', async () => {
      const marca = await salvarMarca(novaMarca({ cor_hex: '#884ea0' }));
      expect(marca).toMatchObject({ institucional: false, cor_hex: '#884EA0', logo_url: null, exemplo: false });
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe criou a marca Lumi');
    });

    it('nome é único, sem considerar acentos e maiúsculas', async () => {
      await expect(salvarMarca(novaMarca({ nome: 'KIPI' }))).rejects.toThrow('Já existe uma marca com esse nome.');
      await expect(salvarMarca(novaMarca({ nome: 'sobrevivencia urbana' }))).rejects.toThrow('Já existe uma marca com esse nome.');
    });

    it('editar registra o que mudou', async () => {
      await salvarMarca(novaMarca({ nome: 'Kipi', cor_hex: '#884EA0' }), ID_MARCA_KIPI);
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe alterou a marca Kipi: Cor principal: de #A8693A para #884EA0');
    });

    it('a institucional fica sempre ativa e não é provisória', async () => {
      const marca = await salvarMarca(novaMarca({ nome: 'Numa', situacao: 'encerrada', provisorio: true }), ID_MARCA_NUMA);
      expect(marca).toMatchObject({ situacao: 'ativa', provisorio: false, institucional: true });
    });

    it('a institucional não pode ser arquivada', async () => {
      await expect(arquivarMarca(ID_MARCA_NUMA)).rejects.toThrow('A marca institucional não pode ser arquivada.');
    });

    it('com produtos, fica bloqueada e diz quais', async () => {
      await expect(arquivarMarca(ID_MARCA_KIPI)).rejects.toThrow('Esta marca tem um produto: Kipi. Arquive antes.');
    });

    it('sem produtos, arquiva e restaura', async () => {
      const marca = await salvarMarca(novaMarca());
      await arquivarMarca(marca.id);
      expect((await repositorios.marca.listar()).map((item) => item.nome)).not.toContain('Lumi');
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe arquivou a marca Lumi');
      await restaurarMarca(marca.id);
      expect((await repositorios.marca.listar()).map((item) => item.nome)).toContain('Lumi');
    });

    it('não restaura se o nome já voltou a ser usado', async () => {
      const antiga = await salvarMarca(novaMarca());
      await arquivarMarca(antiga.id);
      await salvarMarca(novaMarca());
      await expect(restaurarMarca(antiga.id)).rejects.toThrow('Já existe uma marca com esse nome.');
    });
  });

  describe('produto: validação', () => {
    it('os obrigatórios da especificação', () => {
      expect(mensagensProduto({})).toEqual([]);
      expect(mensagensProduto({ nome: '' })).toEqual(['Informe o nome do produto.']);
      expect(mensagensProduto({ marca_id: '' })).toEqual(['Escolha a marca.']);
      expect(mensagensProduto({ responsavel_id: '' })).toEqual(['Escolha a pessoa responsável pelo produto.']);
    });

    it('código de 3 a 6 letras, sempre em maiúsculas', () => {
      expect(validado({ codigo_curto: 'kipi' }).codigo_curto).toBe('KIPI');
      for (const ruim of ['', 'AB', 'ABCDEFG', 'K1PI', 'KI PI', 'KÍPI']) expect(mensagensProduto({ codigo_curto: ruim })).toEqual(['Use de 3 a 6 letras, como KIPI.']);
    });

    it('descrição curta até 200 caracteres', () => {
      expect(mensagensProduto({ descricao_curta: 'x'.repeat(200) })).toEqual([]);
      expect(mensagensProduto({ descricao_curta: 'x'.repeat(201) })).toEqual(['Use até 200 caracteres.']);
    });

    it('fila só com números', () => {
      expect(mensagensProduto({ ordem_fila: '2' })).toEqual([]);
      expect(mensagensProduto({ ordem_fila: 'primeiro' })).toEqual(['Use só números, como 1.']);
    });
  });

  describe('produto: regras', () => {
    it('estágio padrão é Ideia, e o novo não tem entidade (RN-02.06)', async () => {
      const produto = await salvarProduto(validado());
      expect(produto).toMatchObject({ estagio: 'ideia', entidade_id: null, situacao: 'ativo', exemplo: false });
    });

    it('a fila só vale para Ideia e Validação', () => {
      expect(usaFila('ideia')).toBe(true);
      expect(usaFila('validacao')).toBe(true);
      expect(usaFila('em_uso')).toBe(false);
      expect(dadosDoProduto(validado({ estagio: 'em_uso', ordem_fila: '2' })).ordem_fila).toBeNull();
      expect(dadosDoProduto(validado({ estagio: 'ideia', ordem_fila: '2' })).ordem_fila).toBe(2);
      expect(dadosDoProduto(validado({ estagio: 'ideia', ordem_fila: '' })).ordem_fila).toBeNull();
    });

    it('vazio é vazio (RT-08)', () => {
      expect(dadosDoProduto(validado())).toMatchObject({ descricao_curta: null, data_inicio: null });
    });

    it('nome único na marca; em outra marca, pode', async () => {
      await expect(salvarProduto(validado({ nome: 'KIPI', codigo_curto: 'OUTRO' }))).rejects.toThrow('Esta marca já tem um produto com esse nome.');
      await expect(salvarProduto(validado({ nome: 'Kipi', codigo_curto: 'OUTRO', marca_id: ID_MARCA_NUMA }))).resolves.toBeTruthy();
    });

    it('código único em todo o sistema, mesmo arquivado', async () => {
      await expect(salvarProduto(validado({ codigo_curto: 'zupi' }))).rejects.toThrow('Este código já é de Zupi.');
      const novo = await salvarProduto(validado());
      await arquivarProduto(novo.id);
      expect((await conferirProduto(validado({ nome: 'Outro' }))).erroCodigo).toBe('Este código já é de Kipi Web.');
    });

    it('o próprio produto não conta como repetido', async () => {
      const novo = await salvarProduto(validado());
      await expect(salvarProduto(validado({ descricao_curta: 'Versão web' }), novo.id)).resolves.toMatchObject({ descricao_curta: 'Versão web' });
    });

    it('descrição ou motivo que parecem segredo pedem confirmação (RT-14)', async () => {
      expect((await conferirProduto(validado({ descricao_curta: 'token do painel' }))).avisos.join(' ')).toContain('senha ou um token');
      expect((await conferirProduto(validado({ motivo: 'senha: 123' }))).avisos.join(' ')).toContain('senha ou um token');
      expect((await conferirProduto(validado({ descricao_curta: 'App de receitas' }))).avisos).toEqual([]);
    });

    it('editar registra o que mudou, com os nomes por extenso', async () => {
      await salvarProduto(validado({ nome: 'Kipi', codigo_curto: 'KIPI', tipo: 'web', estagio: 'em_uso' }), ID_PRODUTO_KIPI);
      expect((await historicoRecente(2)).map((linha) => linha.texto)).toContain('Kimberly Grebe alterou o produto Kipi: Tipo: de App mobile para Web; Responsável: de não informado para Kimberly Grebe; Tem usuários reais: de sim para não');
    });
  });

  describe('descontinuar', () => {
    it('só exige motivo ao entrar em descontinuado', () => {
      expect(exigeMotivo('descontinuado', 'ativo')).toBe(true);
      expect(exigeMotivo('descontinuado', 'descontinuado')).toBe(false);
      expect(exigeMotivo('pausado', 'ativo')).toBe(false);
    });

    it('sem motivo, não descontinua', async () => {
      await expect(salvarProduto(validado({ nome: 'Kipi', codigo_curto: 'KIPI', situacao: 'descontinuado' }), ID_PRODUTO_KIPI)).rejects.toThrow('Informe o motivo para descontinuar.');
      expect((await repositorios.produto.obter(ID_PRODUTO_KIPI))?.situacao).toBe('ativo');
    });

    it('com motivo, registra no histórico e sai do contexto', async () => {
      await salvarProduto(validado({ nome: 'Kipi', codigo_curto: 'KIPI', estagio: 'em_uso', tem_usuarios_reais: true, responsavel_id: ID_KIMBERLY, situacao: 'descontinuado', motivo: 'Mudança de foco' }), ID_PRODUTO_KIPI);
      expect((await historicoRecente(1))[0]?.texto).toContain('Situação: de Ativo para Descontinuado');
      expect((await historicoRecente(1))[0]?.texto).toContain('Motivo: Mudança de foco');
      expect((await carregarContextos()).map((contexto) => contexto.nome)).not.toContain('Kipi');
    });
  });

  describe('responsável', () => {
    it('a carga inicial fica sem responsável, e o formulário pede', async () => {
      const { produtos, pessoas } = await carregarMarcas();
      const kipi = produtos.find((produto) => produto.id === ID_PRODUTO_KIPI)!;
      expect(responsavelDisponivel(kipi, pessoas)).toBe(false);
      expect(formularioDoProduto(kipi, pessoas).responsavel_id).toBe('');
    });

    it('quem é responsável por um produto tem vínculo, e não pode ser arquivada', async () => {
      await salvarProduto(validado({ nome: 'Kipi', codigo_curto: 'KIPI', estagio: 'em_uso' }), ID_PRODUTO_KIPI);
      expect(await vinculosDaPessoa(ID_KIMBERLY)).toContain('Responsável pelo produto Kipi');
    });

    it('inativar a responsável não troca sozinho: o formulário pede outra', async () => {
      await salvarProduto(validado({ nome: 'Kipi', codigo_curto: 'KIPI', responsavel_id: ID_KIMBERLY }), ID_PRODUTO_KIPI);
      await inativarPessoa(ID_KIMBERLY);
      const { produtos, pessoas } = await carregarMarcas();
      const kipi = produtos.find((produto) => produto.id === ID_PRODUTO_KIPI)!;
      expect(kipi.responsavel_id).toBe(ID_KIMBERLY);
      expect(formularioDoProduto(kipi, pessoas).responsavel_id).toBe('');
    });
  });

  describe('com os outros dados', () => {
    it('arquivar e restaurar um produto', async () => {
      await arquivarProduto(ID_PRODUTO_KIPI);
      expect((await repositorios.produto.listar()).map((produto) => produto.nome)).not.toContain('Kipi');
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe arquivou o produto Kipi');
      await restaurarProduto(ID_PRODUTO_KIPI);
      expect((await repositorios.produto.listar()).map((produto) => produto.nome)).toContain('Kipi');
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe restaurou o produto Kipi');
    });

    it('limpar exemplos não mexe em marcas e produtos', async () => {
      await limparExemplos();
      expect((await carregarMarcas()).marcas).toHaveLength(6);
      expect((await carregarMarcas()).produtos).toHaveLength(5);
    });

    it('restaurar exemplos volta à carga inicial', async () => {
      await salvarMarca(novaMarca());
      await restaurarExemplos();
      expect((await carregarMarcas()).marcas).toHaveLength(6);
    });

    it('exportar e importar levam tudo', async () => {
      await salvarMarca(novaMarca());
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      await restaurarExemplos();
      await aplicarImportacao(arquivo);
      expect((await carregarMarcas()).marcas.map((marca) => marca.nome)).toContain('Lumi');
    });

    it('backup anterior recebe a carga inicial', async () => {
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      delete arquivo.tabelas.marca;
      delete arquivo.tabelas.produto;
      arquivo.versao_dados = 3;
      await aplicarImportacao(arquivo);
      expect((await carregarMarcas()).marcas).toHaveLength(6);
      expect((await carregarMarcas()).produtos).toHaveLength(5);
    });
  });

  describe('dados da versão anterior', () => {
    it('acrescenta marcas e produtos sem tocar no que existia', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      armazenamento.removeItem(chaveDaTabela('marca'));
      armazenamento.removeItem(chaveDaTabela('produto'));
      gravarMeta({ versao_dados: 3 });
      esquecerMetaEmMemoria();
      expect((await carregarMarcas()).marcas).toHaveLength(6);
      expect((await repositorios.configuracao.ler()).organizacao_nome).toBe('Numa Planejada');
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });

    it('quem tinha um produto escolhido no contexto continua nele', async () => {
      await repositorios.marca.listar();
      armazenamento.removeItem(chaveDaTabela('marca'));
      armazenamento.removeItem(chaveDaTabela('produto'));
      gravarMeta({ versao_dados: 3, contexto_id: 'kipi' });
      esquecerMetaEmMemoria();
      await carregarMarcas();
      expect(lerMeta().contexto_id).toBe(ID_PRODUTO_KIPI);
    });
  });
});
