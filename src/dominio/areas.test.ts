import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { AREAS_INICIAIS, ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { arquivarArea, carregarAreas, esquemaFormularioArea, FORMULARIO_AREA_VAZIO, nomeDeAreaRepetido, pessoasDaArea, responsavelForaDaLista, restaurarArea, salvarArea, type FormularioArea } from './areas';
import { analisarArquivo, aplicarImportacao, contagensAtuais, exportarTudo, limparExemplos, restaurarExemplos, resumoDosDados, type ArquivoDeDados } from './dados';
import { historicoRecente } from './historico';
import { inativarPessoa, salvarPessoa, FORMULARIO_PESSOA_VAZIO } from './pessoas';

const ID_BRUNA = '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03';
const ID_RAFAEL = '3ea04f85-6c9b-4d4e-8a5f-8b1d0f7c4d04';

function nova(alteracoes: Partial<FormularioArea> = {}): FormularioArea {
  return { ...FORMULARIO_AREA_VAZIO, nome: 'Design', responsavel_padrao_id: ID_KIMBERLY, ...alteracoes };
}

function mensagens(alteracoes: Partial<FormularioArea>): string[] {
  const resultado = esquemaFormularioArea.safeParse(nova(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

async function porNome(nome: string) {
  const area = (await repositorios.area.listar({ incluirArquivados: true })).find((item) => item.nome === nome);
  if (!area) throw new Error(`não achou ${nome}`);
  return area;
}

describe('T02.03 Áreas', () => {
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

  describe('carga inicial (T02.03 e D11)', () => {
    it('as 7 áreas da especificação, na ordem, com as responsáveis certas', async () => {
      const { areas } = await carregarAreas();
      expect(areas.map((area) => [area.nome, area.responsavel_padrao_id, area.compartilhada])).toEqual([
        ['Tecnologia', ID_CAMILA, false],
        ['Financeiro', ID_KIMBERLY, false],
        ['Social media / Marketing', ID_KIMBERLY, false],
        ['Jurídico e privacidade', ID_KIMBERLY, false],
        ['Comercial', null, true],
        ['Gestão geral', null, true],
        ['Produto', null, true],
      ]);
    });

    it('são dados reais, não exemplos', async () => {
      const { areas, ligacoes } = await carregarAreas();
      expect(areas.every((area) => !area.exemplo)).toBe(true);
      expect(ligacoes.every((ligacao) => !ligacao.exemplo)).toBe(true);
    });

    it('áreas compartilhadas são das duas sócias; Bruna e Rafael ficam sem áreas', async () => {
      const { pessoas, ligacoes } = await carregarAreas();
      const nomes = (id: string) => pessoasDaArea(id, pessoas, ligacoes).map((pessoa) => pessoa.nome_completo);
      for (const area of AREAS_INICIAIS.filter((item) => item.compartilhada)) expect(nomes(area.id)).toEqual(['Kimberly Grebe', 'Camila Lima']);
      expect(nomes(AREAS_INICIAIS[0].id)).toEqual(['Camila Lima']);
      expect(ligacoes.map((ligacao) => ligacao.pessoa_id)).not.toContain(ID_BRUNA);
      expect(ligacoes.map((ligacao) => ligacao.pessoa_id)).not.toContain(ID_RAFAEL);
    });
  });

  describe('validação', () => {
    it('nome é obrigatório', () => {
      expect(mensagens({ nome: ' ' })).toEqual(['Informe o nome da área.']);
    });

    it('área não compartilhada exige responsável', () => {
      expect(mensagens({ responsavel_padrao_id: '' })).toEqual(['Escolha a responsável padrão, ou marque a área como compartilhada.']);
    });

    it('área compartilhada dispensa responsável', () => {
      expect(mensagens({ compartilhada: true, responsavel_padrao_id: '' })).toEqual([]);
    });
  });

  describe('salvar', () => {
    it('cria no fim da lista e registra no histórico', async () => {
      const area = await salvarArea(nova());
      expect(area.ordem).toBe(8);
      expect((await carregarAreas()).areas.at(-1)?.nome).toBe('Design');
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe criou a área Design');
    });

    it('compartilhada fica sem responsável, mesmo se vier uma no formulário', async () => {
      const area = await salvarArea(nova({ compartilhada: true }));
      expect(area.responsavel_padrao_id).toBeNull();
    });

    it('editar registra de quem para quem', async () => {
      const area = await porNome('Tecnologia');
      await salvarArea(nova({ nome: 'Tecnologia', responsavel_padrao_id: ID_KIMBERLY }), area.id);
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe alterou a área Tecnologia: Responsável padrão: de Camila Lima para Kimberly Grebe');
    });

    it('virar compartilhada aparece no histórico por extenso', async () => {
      const area = await porNome('Tecnologia');
      await salvarArea(nova({ nome: 'Tecnologia', compartilhada: true }), area.id);
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe alterou a área Tecnologia: Responsável padrão: de Camila Lima para não informado; Compartilhada: de não para sim');
    });

    it('não repete nome, sem considerar acentos e maiúsculas', async () => {
      await expect(salvarArea(nova({ nome: 'TECNOLOGIA' }))).rejects.toThrow('Já existe uma área com esse nome.');
      await expect(salvarArea(nova({ nome: 'juridico e privacidade' }))).rejects.toThrow('Já existe uma área com esse nome.');
    });

    it('a própria área não conta como repetida', async () => {
      const area = await porNome('Tecnologia');
      await expect(salvarArea(nova({ nome: 'Tecnologia', responsavel_padrao_id: ID_CAMILA }), area.id)).resolves.toBeTruthy();
    });

    it('nome de área arquivada pode voltar a ser usado', async () => {
      const area = await salvarArea(nova());
      await arquivarArea(area.id);
      expect(nomeDeAreaRepetido('Design', await repositorios.area.listar({ incluirArquivados: true }))).toBe(false);
      await expect(salvarArea(nova())).resolves.toBeTruthy();
    });
  });

  describe('responsável fora da lista', () => {
    it('inativar a responsável não troca sozinho: a tela avisa', async () => {
      await inativarPessoa(ID_CAMILA);
      const area = await porNome('Tecnologia');
      const { pessoas } = await carregarAreas();
      expect(area.responsavel_padrao_id).toBe(ID_CAMILA);
      expect(responsavelForaDaLista(area, pessoas)).toBe(true);
    });

    it('compartilhada nunca fica fora da lista', async () => {
      const { pessoas } = await carregarAreas();
      expect(responsavelForaDaLista(await porNome('Comercial'), pessoas)).toBe(false);
      expect(responsavelForaDaLista(await porNome('Tecnologia'), pessoas)).toBe(false);
    });

    it('limpar exemplos com a responsável fictícia também avisa', async () => {
      const area = await salvarArea(nova({ responsavel_padrao_id: ID_BRUNA }));
      await limparExemplos();
      const { pessoas } = await carregarAreas();
      expect(responsavelForaDaLista({ ...area }, pessoas)).toBe(true);
    });
  });

  describe('arquivar ("não excluídas se em uso")', () => {
    it('em uso, fica bloqueada e diz por quem', async () => {
      const area = await porNome('Comercial');
      await expect(arquivarArea(area.id)).rejects.toThrow('Esta área está em uso: Kimberly Grebe, Camila Lima atuam nela.');
      expect((await porNome('Comercial')).arquivado_em).toBeNull();
    });

    it('sem uso, arquiva e restaura', async () => {
      const area = await salvarArea(nova());
      await arquivarArea(area.id);
      expect((await repositorios.area.listar()).map((item) => item.nome)).not.toContain('Design');
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe arquivou a área Design');
      await restaurarArea(area.id);
      expect((await repositorios.area.listar()).map((item) => item.nome)).toContain('Design');
      expect((await historicoRecente(1))[0]?.texto).toBe('Kimberly Grebe restaurou a área Design');
    });

    it('não restaura se o nome já voltou a ser usado', async () => {
      const antiga = await salvarArea(nova());
      await arquivarArea(antiga.id);
      await salvarArea(nova());
      await expect(restaurarArea(antiga.id)).rejects.toThrow('Já existe uma área com esse nome.');
    });

    it('tirar a pessoa da área libera o arquivo', async () => {
      const area = await salvarArea(nova());
      const dora = await salvarPessoa({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Dora Nunes', areas: [area.id] });
      await expect(arquivarArea(area.id)).rejects.toThrow('Dora Nunes atua nela');
      await salvarPessoa({ ...FORMULARIO_PESSOA_VAZIO, nome_completo: 'Dora Nunes', areas: [] }, dora.id);
      await expect(arquivarArea(area.id)).resolves.toBeUndefined();
    });
  });

  describe('com os outros dados', () => {
    it('áreas contam como cadastros; as ligações, não', async () => {
      expect((await resumoDosDados()).registros).toBe(11);
    });

    it('restaurar exemplos volta às áreas iniciais', async () => {
      await salvarArea(nova());
      await restaurarExemplos();
      expect((await carregarAreas()).areas.map((area) => area.nome)).not.toContain('Design');
      expect((await carregarAreas()).areas).toHaveLength(7);
    });

    it('limpar exemplos não mexe nas áreas', async () => {
      await limparExemplos();
      expect((await carregarAreas()).areas).toHaveLength(7);
    });

    it('exportar e importar levam as áreas e as ligações', async () => {
      await salvarArea(nova());
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      await restaurarExemplos();
      await aplicarImportacao(arquivo);
      expect((await carregarAreas()).areas.map((area) => area.nome)).toContain('Design');
    });

    it('backup sem as áreas volta às iniciais e avisa', async () => {
      const arquivo = JSON.parse((await exportarTudo()).conteudo) as ArquivoDeDados;
      delete arquivo.tabelas.area;
      delete arquivo.tabelas.pessoa_area;
      arquivo.versao_dados = 2;
      const analise = analisarArquivo(JSON.stringify(arquivo), contagensAtuais());
      expect(analise.ok && analise.avisos.join(' ')).toContain('Áreas, Pessoas nas áreas. Essas partes voltam aos valores iniciais.');
      await aplicarImportacao(arquivo);
      const { areas, ligacoes } = await carregarAreas();
      expect(areas).toHaveLength(7);
      expect(ligacoes.length).toBeGreaterThan(0);
    });
  });

  describe('dados da versão anterior', () => {
    it('acrescenta as áreas sem tocar no que existia', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      armazenamento.removeItem(chaveDaTabela('area'));
      armazenamento.removeItem(chaveDaTabela('pessoa_area'));
      gravarMeta({ versao_dados: 2 });
      esquecerMetaEmMemoria();
      expect((await carregarAreas()).areas).toHaveLength(7);
      expect((await repositorios.configuracao.ler()).organizacao_nome).toBe('Numa Planejada');
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });
  });
});
