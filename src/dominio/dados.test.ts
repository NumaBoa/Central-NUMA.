import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { listarHistorico } from '@/dados/historico';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { NOMES_TABELAS, VERSAO_DADOS } from '@/dados/tabelas';
import { REGISTROS_INICIAIS } from './apoio-testes';
import {
  aplicarImportacao,
  analisarArquivo,
  contagensAtuais,
  copiaDoEstadoAtual,
  existemDadosDeExemplo,
  exportarTudo,
  importarComCopia,
  limparExemplos,
  restaurarExemplos,
  resumoDosDados,
  type ArquivoDeDados,
} from './dados';

let armazenamento: Driver;

function arquivoExportado(conteudo: string) {
  return JSON.parse(conteudo) as ArquivoDeDados;
}

async function analisar(alterar: (arquivo: Record<string, unknown>) => void) {
  const arquivo = JSON.parse((await exportarTudo()).conteudo) as Record<string, unknown>;
  alterar(arquivo);
  return analisarArquivo(JSON.stringify(arquivo), contagensAtuais());
}

describe('Configurações › Dados', () => {
  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-05T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  describe('resumo', () => {
    it('conta registros e exemplos, e ainda não há backup', async () => {
      const resumo = await resumoDosDados();
      expect(resumo).toMatchObject({ registros: REGISTROS_INICIAIS, exemplos: 2, ultimoBackup: null });
      expect(resumo.usoEmCaracteres).toBeGreaterThan(0);
    });

    it('sabe se ainda há exemplos', async () => {
      expect(await existemDadosDeExemplo()).toBe(true);
      await limparExemplos();
      expect(await existemDadosDeExemplo()).toBe(false);
    });
  });

  describe('exportar', () => {
    it('gera o arquivo com todas as tabelas e o nome com a data', async () => {
      const { nome, conteudo } = await exportarTudo();
      const arquivo = arquivoExportado(conteudo);
      expect(nome).toBe('central-numa-2026-11-05.json');
      expect(arquivo).toMatchObject({ formato: 'central-numa', versao_dados: VERSAO_DADOS, exportado_em: '2026-11-05T15:00:00.000Z', exportado_por: { id: ID_KIMBERLY, nome: 'Kimberly Grebe' } });
      expect(Object.keys(arquivo.tabelas).sort()).toEqual([...NOMES_TABELAS].sort());
      expect(arquivo.tabelas.pessoa).toHaveLength(4);
    });

    it('registra quem exportou e quando: "Último backup" (T02.11)', async () => {
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      await exportarTudo();
      expect((await resumoDosDados()).ultimoBackup).toEqual({ em: '2026-11-05T15:00:00.000Z', por: 'Camila Lima' });
      const [evento] = await listarHistorico();
      expect(evento).toMatchObject({ acao: 'exportou', usuario_id: ID_CAMILA });
    });

    it('exportar não aumenta o número de registros mostrado', async () => {
      await exportarTudo();
      await exportarTudo();
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS);
    });

    it('a própria cópia já leva o registro do backup', async () => {
      const arquivo = arquivoExportado((await exportarTudo()).conteudo);
      expect(arquivo.tabelas.backup_registro).toHaveLength(1);
    });

    it('o backup mais recente é o que vale', async () => {
      await exportarTudo();
      vi.setSystemTime(new Date('2026-11-10T15:00:00.000Z'));
      await exportarTudo();
      expect((await resumoDosDados()).ultimoBackup?.em).toBe('2026-11-10T15:00:00.000Z');
    });
  });

  describe('importar: analisar', () => {
    it('não grava nada ao analisar', async () => {
      const { conteudo } = await exportarTudo();
      const antes = await listarHistorico();
      expect(analisarArquivo(conteudo, contagensAtuais()).ok).toBe(true);
      expect(await listarHistorico()).toEqual(antes);
    });

    it('mostra a prévia: o que há aqui e o que há no arquivo (P6)', async () => {
      const { conteudo } = await exportarTudo();
      await limparExemplos();
      const analise = analisarArquivo(conteudo, contagensAtuais());
      expect(analise.ok && analise.previa.find((linha) => linha.tabela === 'pessoa')).toEqual({ tabela: 'pessoa', rotulo: 'Pessoas', neste: 2, noArquivo: 4 });
    });

    it('recusa o que não é JSON', () => {
      expect(analisarArquivo('isso não é json', contagensAtuais())).toEqual({ ok: false, erros: ['Este arquivo não é um JSON válido.'] });
    });

    it('recusa JSON que não veio da Central', () => {
      expect(analisarArquivo('{"qualquer":"coisa"}', contagensAtuais())).toEqual({ ok: false, erros: ['Este arquivo não é uma exportação da Central Numa.'] });
    });

    it('recusa arquivo de versão mais nova', async () => {
      const analise = await analisar((arquivo) => {
        arquivo.versao_dados = VERSAO_DADOS + 1;
      });
      expect(analise.ok).toBe(false);
      expect(!analise.ok && analise.erros[0]).toContain('versão mais nova');
    });

    it('aponta a linha e o campo inválidos, sem aceitar o arquivo', async () => {
      const analise = await analisar((arquivo) => {
        const tabelas = arquivo.tabelas as { pessoa: Array<Record<string, unknown>> };
        tabelas.pessoa[1]!.nome_completo = '';
        tabelas.pessoa[2]!.email = 'errado';
        tabelas.pessoa[2]!.situacao = 'talvez';
      });
      expect(analise).toEqual({
        ok: false,
        erros: ['Pessoas, linha 2: o campo nome_completo está inválido.', 'Pessoas, linha 3: os campos email, situacao estão inválidos.'],
      });
    });

    it('linha toda errada não vira uma lista enorme de campos', async () => {
      const analise = await analisar((arquivo) => {
        (arquivo.tabelas as { pessoa: unknown[] }).pessoa = [{ nome_completo: '' }];
      });
      expect(!analise.ok && analise.erros[0]).toMatch(/^Pessoas, linha 1: \d+ campos estão inválidos\.$/);
    });

    it('aponta registros repetidos', async () => {
      const analise = await analisar((arquivo) => {
        const tabelas = arquivo.tabelas as { pessoa: unknown[] };
        tabelas.pessoa.push(tabelas.pessoa[0]);
      });
      expect(!analise.ok && analise.erros).toEqual(['Pessoas, linha 5: registro repetido.']);
    });

    it('com muitos erros, lista os primeiros e diz quantos faltam', async () => {
      const analise = await analisar((arquivo) => {
        const tabelas = arquivo.tabelas as { pessoa: Array<Record<string, unknown>> };
        tabelas.pessoa = Array.from({ length: 11 }, () => ({ nome_completo: '' }));
      });
      expect(!analise.ok && analise.erros).toHaveLength(9);
      expect(!analise.ok && analise.erros[8]).toBe('E mais 3.');
    });

    it('avisa sobre partes faltando e partes desconhecidas', async () => {
      const analise = await analisar((arquivo) => {
        const tabelas = arquivo.tabelas as Record<string, unknown[]>;
        delete tabelas.backup_registro;
        tabelas.tabela_do_futuro = [];
      });
      expect(analise.ok && analise.avisos).toEqual([
        'O arquivo não traz: Backups registrados. Essas partes ficarão vazias.',
        'Partes do arquivo que esta versão não conhece serão ignoradas: tabela_do_futuro.',
      ]);
    });
  });

  describe('importar: aplicar', () => {
    it('devolve exatamente os dados exportados, e dá para repetir sem duplicar', async () => {
      const novaPessoa = await repositorios.pessoa.atualizar(ID_CAMILA, { funcao: 'Tecnologia' });
      const { conteudo } = await exportarTudo();
      await restaurarExemplos();
      expect((await repositorios.pessoa.obter(ID_CAMILA))?.funcao).toBe('Sócia');

      const arquivo = arquivoExportado(conteudo);
      expect(await aplicarImportacao(arquivo)).toBe(REGISTROS_INICIAIS);
      expect((await repositorios.pessoa.obter(ID_CAMILA))?.funcao).toBe(novaPessoa.funcao);

      await aplicarImportacao(arquivo);
      expect(await repositorios.pessoa.listar()).toHaveLength(4);
      expect((await resumoDosDados()).ultimoBackup).not.toBeNull();
    });

    it('traz o histórico do arquivo e acrescenta a própria importação', async () => {
      const arquivo = arquivoExportado((await exportarTudo()).conteudo);
      await aplicarImportacao(arquivo);
      const [ultimo, ...anteriores] = await listarHistorico();
      expect(ultimo?.depois).toMatchObject({ funcao: 'importar_dados', registros: REGISTROS_INICIAIS });
      expect(anteriores.some((evento) => evento.acao === 'exportou')).toBe(true);
    });

    it('não reutiliza códigos: os contadores só andam para a frente (RT-01)', async () => {
      gravarMeta({ contadores: { 'ATV-2026': 10, 'FER-2026': 2 } });
      const arquivo = arquivoExportado((await exportarTudo()).conteudo);
      await aplicarImportacao({ ...arquivo, contadores: { 'ATV-2026': 3, 'TIT-2026': 7 } });
      expect(lerMeta().contadores).toEqual({ 'ATV-2026': 10, 'FER-2026': 2, 'TIT-2026': 7 });
    });

    it('serve para recuperar dados danificados', async () => {
      const arquivo = arquivoExportado((await exportarTudo()).conteudo);
      armazenamento.setItem('numa-central:v1:pessoa', '{danificado');
      expect(contagensAtuais().pessoa).toBeNull();
      await expect(repositorios.pessoa.listar()).rejects.toMatchObject({ tipo: 'leitura' });
      await aplicarImportacao(arquivo);
      expect(await repositorios.pessoa.listar()).toHaveLength(4);
    });
  });

  describe('cópia antes de importar', () => {
    it('não grava nada: nem histórico, nem "Último backup"', async () => {
      await resumoDosDados();
      const historico = await listarHistorico();
      expect(copiaDoEstadoAtual()?.nome).toBe('central-numa-antes-de-importar-2026-11-05.json');
      expect(await listarHistorico()).toEqual(historico);
      expect((await resumoDosDados()).ultimoBackup).toBeNull();
    });

    it('pode ser importada de volta', async () => {
      const copia = copiaDoEstadoAtual()!;
      const analise = analisarArquivo(copia.conteudo, contagensAtuais());
      expect(analise.ok).toBe(true);
    });

    it('é baixada antes de mudar qualquer coisa, com o que havia', async () => {
      const arquivo = arquivoExportado((await exportarTudo()).conteudo);
      await limparExemplos();
      let pessoasAoBaixar: number | undefined;
      let copiaBaixada = '';
      const resultado = await importarComCopia(arquivo, (copia) => {
        copiaBaixada = copia.conteudo;
        pessoasAoBaixar = contagensAtuais().pessoa ?? undefined;
      });
      expect(pessoasAoBaixar).toBe(2);
      expect(arquivoExportado(copiaBaixada).tabelas.pessoa).toHaveLength(2);
      expect(resultado).toEqual({ registros: REGISTROS_INICIAIS, comCopia: true });
      expect(await repositorios.pessoa.listar()).toHaveLength(4);
      const [evento] = await listarHistorico();
      expect(evento?.depois).toMatchObject({ funcao: 'importar_dados', copia_antes: true });
    });

    it('se a importação falhar, a cópia já foi baixada e os dados continuam', async () => {
      const arquivo = arquivoExportado((await exportarTudo()).conteudo);
      const baixar = vi.fn();
      const setItem = armazenamento.setItem.bind(armazenamento);
      armazenamento.setItem = (chave: string, valor: string) => {
        if (chave.endsWith(':auditoria')) throw new DOMException('cheio', 'QuotaExceededError');
        setItem(chave, valor);
      };
      await expect(importarComCopia(arquivo, baixar)).rejects.toMatchObject({ tipo: 'armazenamento' });
      armazenamento.setItem = setItem;
      expect(baixar).toHaveBeenCalledTimes(1);
      expect(await repositorios.pessoa.listar()).toHaveLength(4);
    });

    it('com dados danificados, não há cópia, avisa na prévia e a importação ainda recupera', async () => {
      const arquivo = arquivoExportado((await exportarTudo()).conteudo);
      const texto = JSON.stringify(arquivo);
      armazenamento.setItem('numa-central:v1:pessoa', '{danificado');
      expect(copiaDoEstadoAtual()).toBeNull();

      const analise = analisarArquivo(texto, contagensAtuais());
      expect(analise.ok && analise.copiaPossivel).toBe(false);
      expect(analise.ok && analise.avisos.join(' ')).toContain('não dá para baixar uma cópia');

      const baixar = vi.fn();
      expect(await importarComCopia(arquivo, baixar)).toEqual({ registros: REGISTROS_INICIAIS, comCopia: false });
      expect(baixar).not.toHaveBeenCalled();
      expect(await repositorios.pessoa.listar()).toHaveLength(4);
    });

    it('com os dados inteiros, a prévia diz que a cópia é possível', async () => {
      const analise = analisarArquivo((await exportarTudo()).conteudo, contagensAtuais());
      expect(analise.ok && analise.copiaPossivel).toBe(true);
      expect(analise.ok && analise.avisos).toEqual([]);
    });
  });

  describe('restaurar exemplos', () => {
    it('apaga tudo o que foi cadastrado e volta ao início, deixando o registro', async () => {
      await repositorios.pessoa.atualizar(ID_KIMBERLY, { funcao: 'Alterada' });
      await exportarTudo();
      gravarMeta({ contadores: { 'ATV-2026': 9 } });

      await restaurarExemplos();

      expect((await repositorios.pessoa.obter(ID_KIMBERLY))?.funcao).toBe('Sócia');
      expect(await resumoDosDados()).toMatchObject({ registros: REGISTROS_INICIAIS, exemplos: 2, ultimoBackup: null });
      expect(lerMeta().contadores).toEqual({});
      const historico = await listarHistorico();
      expect(historico).toHaveLength(1);
      expect(historico[0]).toMatchObject({ usuario_id: ID_KIMBERLY, depois: { funcao: 'restaurar_exemplos' } });
    });

    it('funciona mesmo com os dados danificados', async () => {
      await resumoDosDados();
      armazenamento.setItem('numa-central:v1:pessoa', '{danificado');
      armazenamento.setItem('numa-central:v1:auditoria', '{danificado');
      await restaurarExemplos();
      expect(await repositorios.pessoa.listar()).toHaveLength(4);
    });
  });

  describe('limpar exemplos', () => {
    it('remove só o que tem exemplo: true e mantém as sócias e o histórico', async () => {
      const historicoAntes = (await listarHistorico()).length;
      expect(await limparExemplos()).toBe(2);
      expect((await repositorios.pessoa.listar()).map((p) => p.nome_completo)).toEqual(['Kimberly Grebe', 'Camila Lima']);
      const historico = await listarHistorico();
      expect(historico).toHaveLength(historicoAntes + 1);
      expect(historico[0]?.depois).toMatchObject({ funcao: 'limpar_exemplos', registros: 2 });
    });

    it('mantém o que foi cadastrado de verdade', async () => {
      const nova = await repositorios.pessoa.criar({
        nome_completo: 'Pessoa Real',
        nome_exibicao: null,
        tipo: 'externa',
        eh_socia: false,
        contraparte_id: null,
        papeis_contato: [],
        funcao: null,
        email: null,
        telefone: null,
        cpf: null,
        observacoes: null,
        situacao: 'ativa',
      });
      await limparExemplos();
      expect(await repositorios.pessoa.obter(nova.id)).not.toBeNull();
    });

    it('sem exemplos, não faz nada nem suja o histórico', async () => {
      await limparExemplos();
      const antes = (await listarHistorico()).length;
      expect(await limparExemplos()).toBe(0);
      expect(await listarHistorico()).toHaveLength(antes);
    });

    it('depois de limpar, os exemplos não voltam sozinhos ao abrir de novo', async () => {
      await limparExemplos();
      esquecerMetaEmMemoria();
      expect(await repositorios.pessoa.listar()).toHaveLength(2);
    });
  });
});
