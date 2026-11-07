import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, gravarTabelas, lerTabela, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { garantirCarga, tabelasIniciais } from '@/dados/carga';
import { ID_IDENTIDADE_NUMA } from '@/dados/carga-m08';
import { ID_KIMBERLY, ID_MARCA_KIPI, ID_MARCA_NUMA, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { listarHistorico } from '@/dados/historico';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { TABELAS, VERSAO_DADOS } from '@/dados/tabelas';
import { NOMES_TABELAS_M08 } from '@/dados/tabelas-m08';
import type { Inscrito } from '@/dados/tipos/marketing';
import { lerCsv } from '@/lib/ler-csv';
import { alertasDasPecas, alertasDosArquivos, gerarAlertasM08, MOTIVO_PUBLICACAO, sincronizarAlertasDasPecas } from './alertas-m08';
import { estaAberta } from './atividades';
import {
  acharDuplicado,
  arquivarArquivo,
  arquivosDoRegistro,
  carregarBiblioteca,
  classePadraoDoTipo,
  contadoresDasColecoes,
  criarArquivo,
  criarLote,
  desvincularArquivo,
  esquemaFormularioArquivo,
  filtrarArquivos,
  FILTROS_BIBLIOTECA_INICIAIS,
  formularioArquivoVazio,
  idDoDrive,
  lerLote,
  pastaSugerida,
  problemaDoLink,
  quantosVinculos,
  registrarNovaVersao,
  restaurarArquivo,
  salvarArquivo,
  edicaoDoArquivo,
  situacaoDosDireitos,
  textoDosDireitos,
  vincularArquivo,
  type FormularioArquivo,
} from './biblioteca';
import { carregarCampanhas, CRITERIO_DE_ORIGEM, criarCampanha, esquemaFormularioCampanha, esquemaResultadosCampanha, filtrarCampanhas, FILTROS_CAMPANHAS_INICIAIS, formularioCampanhaVazio, formularioDaCampanha, indicarCampanhaDaOportunidade, ligadosACampanha, salvarResultados, totaisDosTitulos, vincularLista, vincularTitulo } from './campanhas';
import { podeVerClasse } from './classes';
import { cancelarPeca, criarPeca, diaNoCalendario, esquemaFormularioPeca, filtrarPecas, FILTROS_CONTEUDO_INICIAIS, formularioDaPeca, formularioPecaVazio, moverPeca, mudarMes, salvarPeca, semanasDoMes, type FormularioPeca } from './conteudo';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { historicoDoRegistro } from './historico';
import { arquivosDaMarca, avaliarContraste, carregarIdentidades, formularioDaIdentidade, redesDaMarca, salvarIdentidade, TIPOS_DE_LOGO } from './identidade-marcas';
import {
  adicionarInscrito,
  carregarListas,
  confirmarImportacao,
  contadoresDaLista,
  criarLista,
  descadastrar,
  elegibilidadeDoInscrito,
  exportarInscritos,
  FORMULARIO_INSCRITO_VAZIO,
  inscritosPorOrigem,
  inscritosPorSemana,
  marcarConvertido,
  marcarConvidados,
  previaDaImportacao,
  publicarNovoTexto,
  registrarConsentimento,
  tratamentosDaLista,
} from './listas-espera';

const HOJE = '2026-11-07';
const drive = (numero: number) => `https://drive.google.com/file/d/1TesteCentralNuma${String(numero).padStart(6, '0')}xxxx/view`;

function arquivo(numero: number, dados: Partial<FormularioArquivo> = {}): FormularioArquivo {
  return { ...formularioArquivoVazio(ID_KIMBERLY, ID_PRODUTO_KIPI), link: drive(numero), titulo: `Arquivo ${numero}`, ...dados };
}

const peca = (dados: Partial<FormularioPeca> = {}): FormularioPeca => ({ ...formularioPecaVazio(ID_KIMBERLY, ID_PRODUTO_KIPI, '2026-11-20'), titulo: 'Peça de teste', ...dados });

describe('M08 Biblioteca, marcas e marketing', () => {
  let armazenamento: Driver;

  beforeEach(() => {
    armazenamento = criarArmazenamentoEmMemoria();
    usarDriverDeTeste(armazenamento);
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    usarDriverDeTeste(null);
  });

  describe('carga e migração', () => {
    it('a carga traz os exemplos com `exemplo: true` e a identidade da Numa sem essa marca', async () => {
      garantirCarga();
      for (const tabela of ['arquivo', 'campanha', 'peca_conteudo', 'lista_espera', 'inscrito', 'arquivo_versao', 'arquivo_contexto', 'consentimento_texto'] as const) {
        const linhas = lerTabela<{ exemplo: boolean }>(tabela);
        expect(linhas.length).toBeGreaterThan(0);
        expect(linhas.every((linha) => linha.exemplo)).toBe(true);
      }
      const [numa] = await repositorios.marca_identidade.listar({ onde: { marca_id: ID_MARCA_NUMA } });
      expect(numa?.exemplo).toBe(false);
      // 18 §3.1 prevalece sobre 02: linho é #F8F6F2 e o primário é #4F52D9.
      expect(numa?.paleta.find((cor) => cor.nome === 'Linho')?.hex).toBe('#F8F6F2');
      expect(numa?.paleta.find((cor) => cor.nome === 'Índigo escuro')?.hex).toBe('#4F52D9');
    });

    it('todas as linhas da carga passam pelo próprio esquema', () => {
      const iniciais = tabelasIniciais(new Date().toISOString()) as Record<string, readonly unknown[]>;
      for (const tabela of NOMES_TABELAS_M08) {
        for (const linha of iniciais[tabela] ?? []) {
          const conferido = TABELAS[tabela].esquema.safeParse(linha);
          expect(conferido.success, `${tabela}: ${JSON.stringify(conferido.error?.issues)}`).toBe(true);
        }
      }
    });

    it('nos exemplos, nada aparece como publicado no futuro', () => {
      garantirCarga();
      const publicadas = lerTabela<{ situacao: string; publicado_em: string | null; link_publicacao: string | null }>('peca_conteudo').filter((linha) => linha.situacao === 'publicado');
      expect(publicadas.length).toBeGreaterThan(0);
      for (const publicada of publicadas) {
        expect(publicada.publicado_em && publicada.publicado_em <= HOJE).toBe(true);
        expect(publicada.link_publicacao).toBeTruthy();
      }
    });

    it('migração de uma Central antiga: acrescenta as tabelas sem tocar no que existe', async () => {
      garantirCarga();
      const pessoasAntes = await repositorios.pessoa.listar();
      for (const tabela of NOMES_TABELAS_M08) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 17 });
      garantirCarga();
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
      expect(await repositorios.pessoa.listar()).toEqual(pessoasAntes);
      expect((await repositorios.arquivo.listar()).length).toBeGreaterThan(0);
      expect((await repositorios.marca_identidade.obter(ID_IDENTIDADE_NUMA))?.marca_id).toBe(ID_MARCA_NUMA);
    });

    it('migração: quem já limpou os exemplos não recebe exemplos novos, mas recebe a identidade da Numa', async () => {
      garantirCarga();
      gravarTabelas({ pessoa: lerTabela<{ exemplo: boolean }>('pessoa').filter((linha) => !linha.exemplo) });
      for (const tabela of NOMES_TABELAS_M08) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 17 });
      garantirCarga();
      expect(await repositorios.arquivo.listar()).toEqual([]);
      expect(await repositorios.inscrito.listar()).toEqual([]);
      expect((await repositorios.marca_identidade.listar()).length).toBe(1);
    });

    it('migração: não sobrescreve tabela do M08 que já tem dados', async () => {
      garantirCarga();
      const criado = await criarArquivo(arquivo(1));
      gravarMeta({ versao_dados: 17 });
      garantirCarga();
      expect(await repositorios.arquivo.obter(criado.id)).not.toBeNull();
    });
  });

  describe('link do Drive e duplicidade (RN-08.07, CA-08.02)', () => {
    it('extrai o ID das formas comuns de link', () => {
      expect(idDoDrive('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')).toBe('1AbCdEfGhIjKlMnOp');
      expect(idDoDrive('https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit#slide=id.p')).toBe('1AbCdEfGhIjKlMnOp');
      expect(idDoDrive('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp')).toBe('1AbCdEfGhIjKlMnOp');
      expect(idDoDrive('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp')).toBe('1AbCdEfGhIjKlMnOp');
    });

    it('recusa link de fora do Drive e link que não aponta um arquivo', () => {
      expect(problemaDoLink('https://exemplo.com/arquivo.pdf')).toMatch(/drive\.google\.com/);
      expect(problemaDoLink('https://drive.google.com/drive/my-drive')).toMatch(/não aponta um arquivo/);
      expect(problemaDoLink(drive(1))).toBeNull();
    });

    it('o mesmo ID em outra forma de link é duplicado, e a mensagem diz qual é o item', async () => {
      const criado = await criarArquivo(arquivo(1, { titulo: 'Logo original' }));
      const outraForma = `https://drive.google.com/open?id=${idDoDrive(drive(1))}`;
      await expect(criarArquivo(arquivo(2, { link: outraForma }))).rejects.toThrow(/Logo original/);
      expect((await repositorios.arquivo.listar()).filter((item) => item.id === criado.id)).toHaveLength(1);
      const { arquivos, versoes } = await carregarBiblioteca();
      expect(acharDuplicado(idDoDrive(outraForma), arquivos, versoes)?.arquivoId).toBe(criado.id);
    });

    it('link de uma versão antiga também é duplicado, e item arquivado é apontado', async () => {
      const criado = await criarArquivo(arquivo(1, { titulo: 'Manual' }));
      await registrarNovaVersao(criado.id, { link: drive(2), nota: '' });
      await expect(criarArquivo(arquivo(3, { link: drive(1) }))).rejects.toThrow(/versão 1 de Manual/);
      await arquivarArquivo(criado.id);
      await expect(criarArquivo(arquivo(4, { link: drive(2) }))).rejects.toThrow(/Arquivados/);
    });

    it('restaurar não cria duplicidade', async () => {
      const antigo = await criarArquivo(arquivo(1));
      await arquivarArquivo(antigo.id);
      const { id: _id, codigo: _codigo, ...resto } = (await repositorios.arquivo.obter(antigo.id))!;
      await repositorios.arquivo.criar({ ...resto, titulo: 'Outro com o mesmo arquivo' });
      await expect(restaurarArquivo(antigo.id)).rejects.toThrow(/Não dá para restaurar/);
    });
  });

  describe('versões (RN-08.04)', () => {
    it('nova versão troca o atual e preserva link e nota das anteriores', async () => {
      const criado = await criarArquivo(arquivo(1));
      const nova = await registrarNovaVersao(criado.id, { link: drive(2), nota: 'Cores corrigidas' });
      expect(nova.versao_atual).toBe(2);
      expect(nova.url_atual).toBe(drive(2));
      const versoes = (await repositorios.arquivo_versao.listar({ onde: { arquivo_id: criado.id } })).sort((a, b) => a.versao - b.versao);
      expect(versoes.map((versao) => [versao.versao, versao.url, versao.nota])).toEqual([
        [1, drive(1), null],
        [2, drive(2), 'Cores corrigidas'],
      ]);
    });

    it('recusa o mesmo link e o link de outro item, sem gravar nada', async () => {
      const a = await criarArquivo(arquivo(1));
      await criarArquivo(arquivo(2, { titulo: 'Outro' }));
      await expect(registrarNovaVersao(a.id, { link: drive(1), nota: '' })).rejects.toThrow(/versão atual/);
      await expect(registrarNovaVersao(a.id, { link: drive(2), nota: '' })).rejects.toThrow(/Outro/);
      expect((await repositorios.arquivo.obter(a.id))?.versao_atual).toBe(1);
      expect(await repositorios.arquivo_versao.listar({ onde: { arquivo_id: a.id } })).toHaveLength(1);
    });

    it('editar não muda o link', async () => {
      const criado = await criarArquivo(arquivo(1));
      const dados = await carregarBiblioteca();
      await salvarArquivo(criado.id, { ...edicaoDoArquivo(criado, dados.contextos, []), titulo: 'Novo título' });
      const salvo = await repositorios.arquivo.obter(criado.id);
      expect(salvo?.titulo).toBe('Novo título');
      expect(salvo?.url_atual).toBe(drive(1));
      expect(salvo?.versao_atual).toBe(1);
    });
  });

  describe('vínculos (RN-08.05)', () => {
    it('um arquivo em vários registros, sem duplicar', async () => {
      const criado = await criarArquivo(arquivo(1));
      await vincularArquivo(criado.id, 'produto', ID_PRODUTO_KIPI);
      await vincularArquivo(criado.id, 'campanha', 'campanha-1');
      await expect(vincularArquivo(criado.id, 'produto', ID_PRODUTO_KIPI)).rejects.toThrow(/já está vinculado/);
      const vinculos = await repositorios.arquivo_vinculo.listar({ onde: { arquivo_id: criado.id } });
      expect(quantosVinculos(criado.id, vinculos)).toBe(2);
      expect((await repositorios.arquivo.listar()).filter((item) => item.drive_file_id === criado.drive_file_id)).toHaveLength(1);
      expect((await arquivosDoRegistro('produto', ID_PRODUTO_KIPI)).map(({ arquivo: item }) => item.id)).toContain(criado.id);
    });

    it('tirar o vínculo mantém o arquivo', async () => {
      const criado = await criarArquivo(arquivo(1));
      const vinculo = await vincularArquivo(criado.id, 'produto', ID_PRODUTO_ZUPI);
      await desvincularArquivo(vinculo.id);
      expect(await repositorios.arquivo.obter(criado.id)).not.toBeNull();
      expect(await arquivosDoRegistro('produto', ID_PRODUTO_ZUPI)).toEqual([]);
    });
  });

  describe('classes (RN-08.03, RN-08.08, T08.08)', () => {
    it('padrão por tipo, com INT para o que a especificação não cita', () => {
      expect(classePadraoDoTipo('logo')).toBe('pub');
      expect(classePadraoDoTipo('imagem')).toBe('pub');
      expect(classePadraoDoTipo('apresentacao')).toBe('pub');
      expect(classePadraoDoTipo('modelo_documento')).toBe('int');
      expect(classePadraoDoTipo('documento_institucional')).toBe('int');
      expect(classePadraoDoTipo('contrato')).toBe('doc');
      expect(classePadraoDoTipo('video')).toBe('int');
    });

    it.each(['fin', 'doc'] as const)('%s exige a confirmação da pasta restrita', async (classe) => {
      await expect(criarArquivo(arquivo(1, { classe }))).rejects.toThrow(/pasta no Drive está restrita/);
      expect((await criarArquivo(arquivo(1, { classe, pasta_restrita_confirmada: true }))).pasta_restrita_confirmada).toBe(true);
    });

    it('a confirmação não fica gravada numa classe aberta', async () => {
      expect((await criarArquivo(arquivo(1, { classe: 'pub', pasta_restrita_confirmada: true }))).pasta_restrita_confirmada).toBe(false);
    });

    it('apresentação com dados FIN não pode ser PUB, nem na edição', async () => {
      const base = { tipo: 'apresentacao' as const, contem_fin: true };
      await expect(criarArquivo(arquivo(1, { ...base, classe: 'pub' }))).rejects.toThrow(/não pode ser PUB/);
      const criado = await criarArquivo(arquivo(1, { ...base, classe: 'fin', pasta_restrita_confirmada: true }));
      const dados = await carregarBiblioteca();
      await expect(salvarArquivo(criado.id, { ...edicaoDoArquivo(criado, dados.contextos, []), classe: 'pub' })).rejects.toThrow(/não pode ser PUB/);
      expect((await repositorios.arquivo.obter(criado.id))?.classe).toBe('fin');
    });

    it('a regra vale na tabela também, para arquivo importado', () => {
      garantirCarga();
      const linha = lerTabela<Record<string, unknown>>('arquivo')[0];
      expect(TABELAS.arquivo.esquema.safeParse(linha).success).toBe(true);
      expect(TABELAS.arquivo.esquema.safeParse({ ...linha, classe: 'pub', contem_fin: true }).success).toBe(false);
      expect(TABELAS.arquivo.esquema.safeParse({ ...linha, classe: 'doc', pasta_restrita_confirmada: false }).success).toBe(false);
    });

    it('contém preços pede a data dos preços', () => {
      const dados = arquivo(1, { tipo: 'apresentacao', contem_precos: 'sim' });
      expect(esquemaFormularioArquivo.safeParse(dados).success).toBe(false);
      expect(esquemaFormularioArquivo.safeParse({ ...dados, precos_data: HOJE }).success).toBe(true);
    });

    it('etapa local: a verificação existe em um lugar só e libera tudo (D27)', () => {
      expect(podeVerClasse('doc')).toBe(true);
      expect(podeVerClasse('fin')).toBe(true);
    });

    it('não oferece pasta como criada: é só uma sugestão por tipo e contexto (D19)', () => {
      const produtos = [{ id: ID_PRODUTO_KIPI, nome: 'Kipi' }];
      expect(pastaSugerida('contrato', [ID_PRODUTO_KIPI], produtos)).toBe('/Produtos/Kipi/Contratos');
      expect(pastaSugerida('apresentacao', [ID_PRODUTO_KIPI], produtos)).toBe('/Produtos/Kipi/Apresentações');
      expect(pastaSugerida('modelo_documento', [ID_PRODUTO_KIPI], produtos)).toBe('/Produtos/Kipi/Legal');
      expect(pastaSugerida('logo', [ID_INSTITUCIONAL], produtos)).toBe('/Numa/Institucional');
      expect(pastaSugerida('logo', [], produtos)).toBeNull();
    });
  });

  describe('direitos de uso (RN-08.06)', () => {
    it('vigentes, a vencer em até 30 dias e expirados, com texto', () => {
      expect(situacaoDosDireitos({ direitos_validade: null }, HOJE).estado).toBe('sem_validade');
      expect(situacaoDosDireitos({ direitos_validade: '2026-12-08' }, HOJE).estado).toBe('vigentes');
      expect(situacaoDosDireitos({ direitos_validade: '2026-12-07' }, HOJE).estado).toBe('a_vencer');
      expect(textoDosDireitos({ direitos_validade: '2026-11-27' }, HOJE)).toBe('Direitos a vencer em 20 dias');
      expect(textoDosDireitos({ direitos_validade: HOJE }, HOJE)).toBe('Direitos vencem hoje');
      expect(textoDosDireitos({ direitos_validade: '2026-11-02' }, HOJE)).toBe('Direitos expirados em 02/11/2026');
      expect(textoDosDireitos({ direitos_validade: '2027-01-01' }, HOJE)).toBeNull();
    });

    it('o alerta nasce 30 dias antes, fica depois de vencer e some com a nova validade', async () => {
      const criado = await criarArquivo(arquivo(1, { direitos_uso: 'Licença', direitos_validade: '2026-12-01' }));
      const alertas = async () => (await repositorios.atividade.listar({ onde: { origem_tipo: 'arquivo', origem_id: criado.id } })).filter(estaAberta);
      expect(await alertas()).toHaveLength(1);
      expect((await alertas())[0]?.responsavel_id).toBe(ID_KIMBERLY);
      const dados = await carregarBiblioteca();
      await salvarArquivo(criado.id, { ...edicaoDoArquivo(criado, dados.contextos, []), direitos_validade: '2028-01-01' });
      expect(await alertas()).toHaveLength(0);
    });

    it('alerta é o mesmo a cada rotina: não duplica', async () => {
      garantirCarga();
      await gerarAlertasM08();
      const depois = (await repositorios.atividade.listar()).length;
      await gerarAlertasM08();
      expect((await repositorios.atividade.listar()).length).toBe(depois);
    });

    it('fora da janela, sem alerta; item arquivado, sem alerta', () => {
      const base = { arquivado_em: null, direitos_validade: '2027-06-01', titulo: 'x', id: '1', responsavel_id: ID_KIMBERLY, exemplo: false } as never;
      expect(alertasDosArquivos([base], HOJE)).toEqual([]);
      expect(alertasDosArquivos([{ ...(base as object), direitos_validade: '2026-11-20', arquivado_em: '2026-11-01T00:00:00.000Z' } as never], HOJE)).toEqual([]);
      expect(alertasDosArquivos([{ ...(base as object), direitos_validade: '2026-11-20' } as never], HOJE)).toHaveLength(1);
    });
  });

  describe('filtros da biblioteca (T08.01)', () => {
    async function opcoes() {
      const dados = await carregarBiblioteca();
      return { dados, opcoes: { contextoGlobalId: ID_CONSOLIDADA, hoje: HOJE, dados } };
    }

    it('coleções, tipo, classe, direitos e busca usam a mesma função em grade e lista', async () => {
      const { dados, opcoes: op } = await opcoes();
      const f = (parcial: Partial<typeof FILTROS_BIBLIOTECA_INICIAIS>) => filtrarArquivos(dados.arquivos, { ...FILTROS_BIBLIOTECA_INICIAIS, ...parcial }, op);
      expect(f({}).length).toBe(8);
      expect(f({ colecao: 'apresentacoes' }).every((item) => item.tipo === 'apresentacao')).toBe(true);
      expect(f({ colecao: 'apresentacoes' }).length).toBe(3);
      expect(f({ colecao: 'marca' }).map((item) => item.tipo).sort()).toEqual(['identidade', 'logo']);
      expect(f({ classe: 'doc' }).length).toBe(1);
      expect(f({ direitos: 'a_vencer' }).length).toBe(1);
      expect(f({ direitos: 'expirados' }).length).toBe(1);
      expect(f({ busca: 'MANUAL de marca' }).length).toBe(1);
      expect(f({ vinculadoA: 'campanha' }).length).toBe(2);
    });

    it('o contexto global limita; um arquivo com dois produtos aparece nos dois', async () => {
      const { dados } = await opcoes();
      const de = (contextoGlobalId: string) => filtrarArquivos(dados.arquivos, FILTROS_BIBLIOTECA_INICIAIS, { contextoGlobalId, hoje: HOJE, dados }).map((item) => item.tipo);
      expect(de(ID_PRODUTO_ZUPI)).toContain('contrato');
      expect(de(ID_PRODUTO_KIPI)).toContain('contrato');
      expect(de(ID_INSTITUCIONAL)).not.toContain('contrato');
    });

    it('arquivados ficam à parte, e os contadores acompanham os outros filtros', async () => {
      const { dados, opcoes: op } = await opcoes();
      expect(contadoresDasColecoes(dados.arquivos, FILTROS_BIBLIOTECA_INICIAIS, op).todos).toBe(8);
      const alvo = dados.arquivos[0]!;
      await arquivarArquivo(alvo.id);
      const depois = await opcoes();
      expect(filtrarArquivos(depois.dados.arquivos, FILTROS_BIBLIOTECA_INICIAIS, depois.opcoes).map((item) => item.id)).not.toContain(alvo.id);
      expect(filtrarArquivos(depois.dados.arquivos, { ...FILTROS_BIBLIOTECA_INICIAIS, arquivados: true }, depois.opcoes).map((item) => item.id)).toEqual([alvo.id]);
      expect(contadoresDasColecoes(depois.dados.arquivos, { ...FILTROS_BIBLIOTECA_INICIAIS, classe: 'fin' }, depois.opcoes).apresentacoes).toBe(1);
    });
  });

  describe('cadastro em lote (T08.03)', () => {
    it('prévia aponta link inválido, repetido e duplicado, e aproveita o título colado', async () => {
      garantirCarga();
      const existente = await criarArquivo(arquivo(1, { titulo: 'Já existe' }));
      const dados = await carregarBiblioteca();
      const linhas = lerLote([`${drive(2)};Primeiro`, 'https://exemplo.com/x', drive(2), drive(1), `${drive(3)}\tTerceiro`].join('\n'), { arquivos: dados.arquivos, versoes: dados.versoes });
      expect(linhas.map((linha) => linha.problema === null)).toEqual([true, false, false, false, true]);
      expect(linhas[0]?.titulo).toBe('Primeiro');
      expect(linhas[2]?.problema).toMatch(/linha 1/);
      expect(linhas[3]?.duplicado?.arquivoId).toBe(existente.id);
      expect(linhas[4]?.titulo).toBe('Terceiro');
    });

    it('cria só o que passou, tudo ou nada, com os mesmos bloqueios do cadastro individual', async () => {
      const comuns = { tipo: 'contrato' as const, contextos: [ID_PRODUTO_KIPI], classe: 'doc' as const, pasta_restrita_confirmada: false, responsavel_id: ID_KIMBERLY, etiquetas: [] };
      const linhas = [
        { link: drive(11), titulo: 'A', problema: null },
        { link: drive(12), titulo: 'B', problema: null },
        { link: 'x', titulo: 'C', problema: 'ruim' },
      ];
      const antes = (await repositorios.arquivo.listar()).length;
      await expect(criarLote(linhas, comuns)).rejects.toThrow(/pasta no Drive está restrita/);
      await expect(criarLote([{ link: drive(11), titulo: '', problema: null }], { ...comuns, pasta_restrita_confirmada: true })).rejects.toThrow(/título/);
      expect((await repositorios.arquivo.listar()).length).toBe(antes);
      expect(await criarLote(linhas, { ...comuns, pasta_restrita_confirmada: true })).toBe(2);
      expect((await repositorios.arquivo.listar()).length).toBe(antes + 2);
      expect((await repositorios.arquivo_versao.listar({ onde: { url: drive(11) } }))).toHaveLength(1);
    });
  });

  describe('identidade das marcas (T08.04)', () => {
    it('contraste: as combinações oficiais de 18 §3.4', () => {
      expect(avaliarContraste('#2B2421', '#F8F6F2').nivel).toBe('suficiente');
      expect(avaliarContraste('#FFFFFF', '#4F52D9').nivel).toBe('suficiente');
      expect(avaliarContraste('#FFFFFF', '#6366F1').nivel).toBe('so_texto_grande');
      expect(avaliarContraste('#958B84', '#F8F6F2').nivel).toBe('so_texto_grande');
      expect(avaliarContraste('#EFEAE3', '#F8F6F2').nivel).toBe('insuficiente');
    });

    it('uma identidade por marca: salvar de novo atualiza, não cria outra', async () => {
      const antes = formularioDaIdentidade(null);
      const criada = await salvarIdentidade(ID_MARCA_KIPI, { ...antes, proposta: 'Primeira', tom_faca: 'Falar simples\n\nSem jargão', paleta: [{ nome: 'Caramelo', hex: '#a8693a', uso: '' }] });
      expect(criada.tom_faca).toEqual(['Falar simples', 'Sem jargão']);
      expect(criada.paleta[0]?.hex).toBe('#A8693A');
      expect(criada.publico).toBeNull();
      const atualizada = await salvarIdentidade(ID_MARCA_KIPI, { ...formularioDaIdentidade(criada), proposta: 'Segunda' });
      expect(atualizada.id).toBe(criada.id);
      expect(await repositorios.marca_identidade.listar({ onde: { marca_id: ID_MARCA_KIPI } })).toHaveLength(1);
    });

    it('recusa cor inválida e manual fora do Drive', async () => {
      await expect(salvarIdentidade(ID_MARCA_KIPI, { ...formularioDaIdentidade(null), paleta: [{ nome: 'x', hex: 'azul', uso: '' }] })).rejects.toThrow(/#RRGGBB/);
      await expect(salvarIdentidade(ID_MARCA_KIPI, { ...formularioDaIdentidade(null), manual_url: 'https://exemplo.com' })).rejects.toThrow(/drive\.google\.com/);
    });

    it('logos vêm da biblioteca e redes do M04, pelo contexto da marca', async () => {
      const dados = await carregarIdentidades();
      const kipi = dados.marcas.find((marca) => marca.id === ID_MARCA_KIPI)!;
      const numa = dados.marcas.find((marca) => marca.id === ID_MARCA_NUMA)!;
      expect(arquivosDaMarca(kipi, TIPOS_DE_LOGO, dados).map((item) => item.titulo)).toEqual(['Logo Kipi horizontal (exemplo)']);
      expect(arquivosDaMarca(numa, TIPOS_DE_LOGO, dados)).toEqual([]);
      const redes = redesDaMarca(numa, dados);
      expect(redes.every((ativo) => ativo.tipo === 'rede_social' && ativo.produto_id === null)).toBe(true);
    });
  });

  describe('conteúdo (T08.05, RN-08.11)', () => {
    it.each([
      ['sem data realizada', { link_publicacao: 'https://rede.com/p/1' }, /data em que foi ao ar/],
      ['sem link', { publicado_em: HOJE }, /link da publicação/],
    ])('publicado %s é recusado', async (_nome, dados, erro) => {
      const resultado = esquemaFormularioPeca.safeParse(peca({ situacao: 'publicado', ...dados }));
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues.map((falha) => falha.message).join(' ')).toMatch(erro);
      await expect(criarPeca(peca({ situacao: 'publicado', ...dados }))).rejects.toThrow();
    });

    it('publicação futura não pode ser marcada como realizada', () => {
      const resultado = esquemaFormularioPeca.safeParse(peca({ situacao: 'publicado', link_publicacao: 'https://rede.com/p/1', publicado_em: '2026-11-08' }));
      expect(resultado.success).toBe(false);
    });

    it('data prevista e data realizada são distintas, e o calendário usa a realizada', async () => {
      const criada = await criarPeca(peca({ data_prevista: '2026-11-03', situacao: 'publicado', publicado_em: '2026-11-05', link_publicacao: 'https://rede.com/p/1' }));
      expect(criada.data_prevista).toBe('2026-11-03');
      expect(criada.publicado_em).toBe('2026-11-05');
      expect(diaNoCalendario(criada)).toBe('2026-11-05');
    });

    it('resultados são manuais, precisam da data da medição e só valem depois de publicar', () => {
      const publicada = peca({ situacao: 'publicado', publicado_em: '2026-11-05', link_publicacao: 'https://rede.com/p/1', alcance: '120' });
      expect(esquemaFormularioPeca.safeParse(publicada).success).toBe(false);
      expect(esquemaFormularioPeca.safeParse({ ...publicada, medido_em: '2026-11-06' }).success).toBe(true);
      expect(esquemaFormularioPeca.safeParse({ ...publicada, medido_em: '2026-11-04' }).success).toBe(false);
      expect(esquemaFormularioPeca.safeParse(peca({ alcance: '120', medido_em: HOJE })).success).toBe(false);
    });

    it('sem resultado é vazio, nunca zero', async () => {
      const criada = await criarPeca(peca({ situacao: 'publicado', publicado_em: HOJE, link_publicacao: 'https://rede.com/p/1' }));
      expect(criada.resultados.alcance).toBeNull();
      expect(criada.resultados.cliques).toBeNull();
    });

    it('o quadro não publica nem cancela sem os dados', async () => {
      const criada = await criarPeca(peca());
      await expect(moverPeca(criada.id, 'publicado')).rejects.toThrow(/data realizada/);
      await expect(moverPeca(criada.id, 'cancelado')).rejects.toThrow(/motivo/);
      await moverPeca(criada.id, 'revisao');
      expect((await repositorios.peca_conteudo.obter(criada.id))?.situacao).toBe('revisao');
    });

    it('cancelar preserva o registro e o histórico, e resolve o alerta', async () => {
      const criada = await criarPeca(peca({ data_prevista: '2026-11-08' }));
      const abertos = async () => (await repositorios.atividade.listar({ onde: { origem_tipo: 'peca_conteudo', origem_id: criada.id } })).filter(estaAberta);
      expect(await abertos()).toHaveLength(1);
      await cancelarPeca(criada.id, 'Adiada');
      const cancelada = await repositorios.peca_conteudo.obter(criada.id);
      expect(cancelada?.situacao).toBe('cancelado');
      expect(cancelada?.cancelado_motivo).toBe('Adiada');
      expect(await abertos()).toHaveLength(0);
      expect((await historicoDoRegistro('peca_conteudo', criada.id)).length).toBeGreaterThanOrEqual(2);
      expect(filtrarPecas([cancelada!], FILTROS_CONTEUDO_INICIAIS, ID_CONSOLIDADA)).toEqual([]);
      expect(filtrarPecas([cancelada!], { ...FILTROS_CONTEUDO_INICIAIS, incluirCanceladas: true }, ID_CONSOLIDADA)).toHaveLength(1);
    });

    it('véspera: alerta para a responsável, só um aviso, sem publicar; publicar resolve', async () => {
      const criada = await criarPeca(peca({ data_prevista: '2026-11-08' }));
      const lista = await repositorios.atividade.listar({ onde: { origem_tipo: 'peca_conteudo', origem_id: criada.id } });
      expect(lista).toHaveLength(1);
      expect(lista[0]?.titulo).toMatch(/^Publicação amanhã: /);
      expect(lista[0]?.alerta_motivo).toBe(MOTIVO_PUBLICACAO);
      expect((await repositorios.peca_conteudo.obter(criada.id))?.situacao).toBe('ideia');
      await sincronizarAlertasDasPecas();
      expect(await repositorios.atividade.listar({ onde: { origem_tipo: 'peca_conteudo', origem_id: criada.id } })).toHaveLength(1);
      await salvarPeca(criada.id, { ...formularioDaPeca(criada, []), situacao: 'publicado', publicado_em: HOJE, link_publicacao: 'https://rede.com/p/1' });
      expect((await repositorios.atividade.listar({ onde: { origem_tipo: 'peca_conteudo', origem_id: criada.id } })).filter(estaAberta)).toHaveLength(0);
    });

    it('alerta: antes da véspera, nada; depois do dia, atrasada', () => {
      const base = { arquivado_em: null, situacao: 'ideia', titulo: 'x', id: '1', responsavel_id: ID_KIMBERLY, exemplo: false } as never;
      const com = (data_prevista: string) => alertasDasPecas([{ ...(base as object), data_prevista } as never], HOJE);
      expect(com('2026-11-09')).toEqual([]);
      expect(com('2026-11-08')[0]?.titulo).toMatch(/amanhã/);
      expect(com(HOJE)[0]?.titulo).toMatch(/hoje/);
      expect(com('2026-11-01')[0]?.titulo).toMatch(/atrasada/);
    });

    it('arquivos vêm da biblioteca, sem duplicar', async () => {
      const item = await criarArquivo(arquivo(1));
      const criada = await criarPeca(peca({ arquivos: [item.id] }));
      expect((await arquivosDoRegistro('peca_conteudo', criada.id)).map(({ arquivo: a }) => a.id)).toEqual([item.id]);
      await salvarPeca(criada.id, { ...formularioDaPeca(criada, [item.id]), arquivos: [] });
      expect(await arquivosDoRegistro('peca_conteudo', criada.id)).toEqual([]);
      expect(await repositorios.arquivo.obter(item.id)).not.toBeNull();
    });

    it('semanas do mês: de segunda a domingo, cobrindo novembro de 2026', () => {
      const semanas = semanasDoMes('2026-11');
      expect(semanas[0]?.[0]).toBe('2026-10-26');
      expect(semanas[0]?.[6]).toBe('2026-11-01');
      expect(semanas.at(-1)?.[0]).toBe('2026-11-30');
      expect(semanas.every((semana) => semana.length === 7)).toBe(true);
      expect(mudarMes('2026-12', 1)).toBe('2027-01');
      expect(mudarMes('2026-01', -1)).toBe('2025-12');
    });
  });

  describe('campanhas (T08.06, RN-08.12)', () => {
    const nova = (dados: Partial<ReturnType<typeof formularioCampanhaVazio>> = {}) => ({ ...formularioCampanhaVazio(ID_KIMBERLY, ID_PRODUTO_KIPI), nome: 'Campanha de teste', ...dados });

    it('orçamento e resultados vazios ficam vazios, não zero', async () => {
      const criada = await criarCampanha(nova());
      expect(criada.orcamento).toBeNull();
      expect(criada.resultados.inscritos).toBeNull();
      expect(formularioDaCampanha(criada).orcamento).toBe('');
      const comValor = await criarCampanha(nova({ nome: 'Com valor', orcamento: '1.500,50' }));
      expect(comValor.orcamento).toBe(1500.5);
      expect(formularioDaCampanha(comValor).orcamento).toBe('1.500,50');
    });

    it('período e orçamento inválidos são recusados', () => {
      expect(esquemaFormularioCampanha.safeParse(nova({ inicio: '2026-11-10', fim: '2026-11-01' })).success).toBe(false);
      expect(esquemaFormularioCampanha.safeParse(nova({ orcamento: 'muito' })).success).toBe(false);
      expect(esquemaFormularioCampanha.safeParse(nova({ situacao: 'em_andamento' })).success).toBe(false);
    });

    it('não há financeiro paralelo: vincular título não cria nem muda título', async () => {
      const criada = await criarCampanha(nova());
      const titulos = await repositorios.titulo.listar();
      const alvo = titulos[0]!;
      await vincularTitulo(criada.id, alvo.id);
      await expect(vincularTitulo(criada.id, alvo.id)).rejects.toThrow(/já existe/);
      expect(await repositorios.titulo.listar()).toEqual(titulos);
      const dados = await carregarCampanhas();
      expect(ligadosACampanha(criada.id, dados).titulos.map((item) => item.id)).toEqual([alvo.id]);
    });

    it('não soma moedas, e cancelado não entra', () => {
      const base = { arquivado_em: null } as const;
      expect(totaisDosTitulos([{ ...base, valor: 100, moeda: 'BRL', situacao: 'aberto' }, { ...base, valor: 50.5, moeda: 'BRL', situacao: 'quitado' }, { ...base, valor: 20, moeda: 'USD', situacao: 'aberto' }, { ...base, valor: 999, moeda: 'BRL', situacao: 'cancelado' }])).toEqual([
        { moeda: 'BRL', valor: 150.5, quantos: 2 },
        { moeda: 'USD', valor: 20, quantos: 1 },
      ]);
    });

    it('oportunidade: indica a origem pelo campo do M10, com o critério no histórico', async () => {
      const criada = await criarCampanha(nova());
      const contraparte = (await repositorios.contraparte.listar())[0]!;
      const oportunidade = await repositorios.oportunidade.criar({ contraparte_id: contraparte.id, titulo: 'Op', tipo: 'assinatura', origem: 'site', campanha_id: null, valor_estimado: null, valor_periodicidade: null, moeda: 'BRL', probabilidade: null, fechamento_previsto: null, etapa: 'novo', etapa_desde: HOJE, responsavel_id: ID_KIMBERLY, necessidade: null, motivo_perda: null, motivo_perda_texto: null, ganha_em: null, perdida_em: null, adesao_padrao: false } as never);
      await indicarCampanhaDaOportunidade(oportunidade.id, criada.id);
      expect((await repositorios.oportunidade.obter(oportunidade.id))?.campanha_id).toBe(criada.id);
      const eventos = await listarHistorico({ tabela: 'oportunidade', registroId: oportunidade.id });
      expect(eventos[0]?.motivo).toMatch(/manualmente/);
      expect(CRITERIO_DE_ORIGEM).toMatch(/não comprova/);
      const dados = await carregarCampanhas();
      expect(ligadosACampanha(criada.id, dados).oportunidades).toHaveLength(1);
    });

    it('resultados manuais pedem a data da medição', async () => {
      const criada = await criarCampanha(nova());
      const base = { inscritos: '10', contatos: '', oportunidades: '', vendas: '', medido_em: '', observacao: '' };
      expect(esquemaResultadosCampanha.safeParse(base).success).toBe(false);
      await salvarResultados(criada.id, { ...base, medido_em: HOJE });
      const salva = await repositorios.campanha.obter(criada.id);
      expect(salva?.resultados.inscritos).toBe(10);
      expect(salva?.resultados.contatos).toBeNull();
    });

    it('lista vinculada e filtros', async () => {
      const dados = await carregarCampanhas();
      const [lista] = dados.listas;
      const criada = await criarCampanha(nova());
      await vincularLista(criada.id, lista!.id);
      expect(ligadosACampanha(criada.id, await carregarCampanhas()).listas).toHaveLength(1);
      const todas = await repositorios.campanha.listar();
      expect(filtrarCampanhas(todas, FILTROS_CAMPANHAS_INICIAIS, ID_PRODUTO_ZUPI).every((item) => item.produto_id === ID_PRODUTO_ZUPI)).toBe(true);
      expect(filtrarCampanhas(todas, { ...FILTROS_CAMPANHAS_INICIAIS, situacao: 'planejada' }, ID_CONSOLIDADA).every((item) => item.situacao === 'planejada')).toBe(true);
    });
  });

  describe('listas de espera (T08.07, RN-08.09, RN-08.10)', () => {
    async function novaLista() {
      const lista = await criarLista({ produto_id: ID_PRODUTO_KIPI, nome: 'Lista de teste', texto: 'Aceito receber novidades.', vigente_desde: '2026-01-01' });
      const [texto] = await repositorios.consentimento_texto.listar({ onde: { lista_id: lista.id } });
      return { lista, texto: texto! };
    }
    const csv = (...linhas: string[]) => ['nome;email;origem;consentimento_versao;consentido_em;campanha', ...linhas].join('\n');
    async function previa(listaId: string, texto: string) {
      const dados = await carregarListas();
      return previaDaImportacao(texto, dados.textos.filter((item) => item.lista_id === listaId), dados.inscritos.filter((item) => item.lista_id === listaId), dados.campanhas, HOJE);
    }

    it('sem consentimento, não há elegibilidade; a situação continua Ativo', () => {
      const semConsentimento = { situacao: 'ativo', consentimento_versao_id: null, consentido_em: null } as const;
      expect(elegibilidadeDoInscrito(semConsentimento)).toBe('pendente_consentimento');
      expect(elegibilidadeDoInscrito({ ...semConsentimento, consentimento_versao_id: 'v', consentido_em: HOJE })).toBe('apto');
      expect(elegibilidadeDoInscrito({ situacao: 'descadastrado', consentimento_versao_id: 'v', consentido_em: HOJE })).toBe('descadastrado');
    });

    it('a tabela só aceita as quatro situações; pendente nunca é gravado', () => {
      garantirCarga();
      const linha = lerTabela<Record<string, unknown>>('inscrito')[0];
      expect(TABELAS.inscrito.esquema.safeParse(linha).success).toBe(true);
      expect(TABELAS.inscrito.esquema.safeParse({ ...linha, situacao: 'pendente' }).success).toBe(false);
      expect(TABELAS.inscrito.esquema.safeParse({ ...linha, consentido_em: null, consentimento_versao_id: 'v' }).success).toBe(false);
    });

    it('contadores: cada pessoa em uma situação, sem dupla contagem', async () => {
      const dados = await carregarListas();
      const daLista = dados.inscritos.filter((item) => item.lista_id === dados.listas[0]?.id);
      const total = contadoresDaLista(daLista);
      expect(total.ativos + total.convidados + total.convertidos + total.descadastrados).toBe(total.total);
      expect(total).toMatchObject({ total: 6, ativos: 3, convidados: 1, convertidos: 1, descadastrados: 1, aptos: 4, pendentes: 1 });
    });

    it('lista nasce com a versão 1 do texto; nova versão não altera quem aceitou a anterior', async () => {
      const { lista, texto } = await novaLista();
      expect(texto.versao).toBe(1);
      const pessoa = await adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'a@teste.com', consentimento_versao_id: texto.id, consentido_em: '2026-02-01' });
      const nova = await publicarNovoTexto(lista.id, { texto: 'Novo texto.', vigente_desde: '2026-10-01' });
      expect(nova.versao).toBe(2);
      expect((await repositorios.consentimento_texto.obter(texto.id))?.texto).toBe('Aceito receber novidades.');
      expect((await repositorios.inscrito.obter(pessoa.id))?.consentimento_versao_id).toBe(texto.id);
      await expect(publicarNovoTexto(lista.id, { texto: 'Antiga', vigente_desde: '2026-09-01' })).rejects.toThrow(/não pode valer antes/);
    });

    it('inclusão manual: e-mail único sem diferenciar maiúsculas, versão e data juntas', async () => {
      const { lista, texto } = await novaLista();
      await adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'Pessoa@Teste.com' });
      await expect(adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'pessoa@teste.com ' })).rejects.toThrow(/já está nesta lista/);
      await expect(adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'b@teste.com', consentimento_versao_id: texto.id })).rejects.toThrow();
      await expect(adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'c@teste.com', consentimento_versao_id: texto.id, consentido_em: '2025-01-01' })).rejects.toThrow(/só vale desde/);
      await expect(adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'invalido' })).rejects.toThrow();
    });

    it('CA-08.03: importação sem as colunas de consentimento é bloqueada, com explicação', async () => {
      const { lista } = await novaLista();
      const semData = await previa(lista.id, 'email;consentimento_versao\na@teste.com;1');
      expect(semData.erroGeral).toMatch(/data do consentimento/);
      expect(semData.linhas).toEqual([]);
      const semVersao = await previa(lista.id, 'email;consentido_em\na@teste.com;01/02/2026');
      expect(semVersao.erroGeral).toMatch(/versão do consentimento/);
      await expect(confirmarImportacao(lista.id, semVersao)).rejects.toThrow(/bloqueada/);
      expect(await repositorios.inscrito.listar({ onde: { lista_id: lista.id } })).toEqual([]);
    });

    it('prévia com erros por linha; só grava o que passou e só depois de confirmar', async () => {
      const { lista } = await novaLista();
      const resultado = await previa(
        lista.id,
        csv('Ana;ana@teste.com;Site;1;01/02/2026;', 'Sem e-mail;invalido;;1;01/02/2026;', 'Sem data;b@teste.com;;1;;', 'Data ruim;c@teste.com;;1;32/13/2026;', 'Futuro;d@teste.com;;1;08/11/2026;', 'Versão;e@teste.com;;9;01/02/2026;', 'Antes;f@teste.com;;1;01/02/2025;', 'Repetida;ANA@teste.com;;1;01/02/2026;', 'Camp;g@teste.com;;1;01/02/2026;Inexistente'),
      );
      expect(resultado.erroGeral).toBeNull();
      expect(resultado.resumo).toMatchObject({ novo: 1, erro: 8 });
      expect(resultado.linhas.map((linha) => linha.numero)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(resultado.linhas[7]?.mensagem).toMatch(/linha 2/);
      expect(await repositorios.inscrito.listar({ onde: { lista_id: lista.id } })).toEqual([]);
      expect(await confirmarImportacao(lista.id, resultado)).toEqual({ novos: 1, consentimentos: 0 });
      const [gravada] = await repositorios.inscrito.listar({ onde: { lista_id: lista.id } });
      expect(gravada).toMatchObject({ email: 'ana@teste.com', origem: 'site', consentido_em: '2026-02-01', situacao: 'ativo' });
    });

    it('CA-08.04: descadastrado não volta por reimportação, nem por inclusão manual', async () => {
      const { lista } = await novaLista();
      const primeira = await previa(lista.id, csv('Ana;ana@teste.com;Site;1;01/02/2026;'));
      await confirmarImportacao(lista.id, primeira);
      const [pessoa] = await repositorios.inscrito.listar({ onde: { lista_id: lista.id } });
      await descadastrar(pessoa!.id, HOJE);
      const reimportada = await previa(lista.id, csv('Ana;ANA@teste.com;Site;1;01/03/2026;'));
      expect(reimportada.linhas[0]?.resultado).toBe('descadastrado');
      await confirmarImportacao(lista.id, reimportada);
      const depois = await repositorios.inscrito.obter(pessoa!.id);
      expect(depois?.situacao).toBe('descadastrado');
      expect(depois?.consentido_em).toBe('2026-02-01');
      await expect(adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'ana@teste.com' })).rejects.toThrow(/descadastrou/);
      await expect(registrarConsentimento(pessoa!.id, 'x', HOJE)).rejects.toThrow(/descadastrou/);
      await expect(marcarConvertido(pessoa!.id)).rejects.toThrow(/descadastrou/);
      expect(await marcarConvidados([pessoa!.id], HOJE)).toEqual({ marcados: 0, ignorados: 1 });
    });

    it('descadastro vale para aquela lista: o mesmo e-mail pode estar em outra', async () => {
      const { lista } = await novaLista();
      const outra = await criarLista({ produto_id: ID_PRODUTO_ZUPI, nome: 'Outra', texto: 'Aceito.', vigente_desde: '2026-01-01' });
      const pessoa = await adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'x@teste.com' });
      await descadastrar(pessoa.id, HOJE);
      expect((await adicionarInscrito(outra.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'x@teste.com' })).situacao).toBe('ativo');
    });

    it('reimportar quem já consentiu não altera; quem estava pendente recebe o consentimento', async () => {
      const { lista, texto } = await novaLista();
      const consentiu = await adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'a@teste.com', consentimento_versao_id: texto.id, consentido_em: '2026-02-01' });
      const pendente = await adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'b@teste.com' });
      const resultado = await previa(lista.id, csv('A;a@teste.com;;1;01/03/2026;', 'B;b@teste.com;;1;01/03/2026;'));
      expect(resultado.linhas.map((linha) => linha.resultado)).toEqual(['ja_inscrito', 'consentimento']);
      expect(await confirmarImportacao(lista.id, resultado)).toEqual({ novos: 0, consentimentos: 1 });
      expect((await repositorios.inscrito.obter(consentiu.id))?.consentido_em).toBe('2026-02-01');
      expect((await repositorios.inscrito.obter(pendente.id))?.consentido_em).toBe('2026-03-01');
      expect(elegibilidadeDoInscrito((await repositorios.inscrito.obter(pendente.id))!)).toBe('apto');
    });

    it('marcar convidados: só ativos com consentimento, e diz quantos ficaram de fora', async () => {
      const { lista, texto } = await novaLista();
      const apto = await adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'a@teste.com', consentimento_versao_id: texto.id, consentido_em: '2026-02-01' });
      const pendente = await adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'b@teste.com' });
      expect(await marcarConvidados([apto.id, pendente.id], HOJE)).toEqual({ marcados: 1, ignorados: 1 });
      expect((await repositorios.inscrito.obter(apto.id))?.situacao).toBe('convidado');
      expect((await repositorios.inscrito.obter(pendente.id))?.situacao).toBe('ativo');
    });

    it('a exportação é auditada, sem os e-mails no histórico', async () => {
      garantirCarga();
      const dados = await carregarListas();
      const lista = dados.listas[0]!;
      const inscritos: Inscrito[] = dados.inscritos.filter((item) => item.lista_id === lista.id);
      const gerado = exportarInscritos(lista, inscritos, dados.textos, dados.campanhas);
      expect(gerado).toContain('marina@exemplo.com.br');
      expect(gerado).toContain('Pendente de consentimento');
      const [evento] = await listarHistorico({ tabela: 'lista_espera', registroId: lista.id });
      expect(evento?.acao).toBe('exportou');
      expect(JSON.stringify(evento)).not.toContain('@');
      const [linha] = await historicoDoRegistro('lista_espera', lista.id);
      expect(linha?.texto).toMatch(/exportou 6 inscritos da lista/);
    });

    it('a importação fica no histórico, e dado pessoal do inscrito não aparece por extenso', async () => {
      const { lista } = await novaLista();
      await confirmarImportacao(lista.id, await previa(lista.id, csv('Ana;ana@teste.com;;1;01/02/2026;')));
      const [linha] = await historicoDoRegistro('lista_espera', lista.id);
      expect(linha?.texto).toMatch(/importou inscritos: 1 novo/);
      const [inscrito] = await repositorios.inscrito.listar({ onde: { lista_id: lista.id } });
      const historico = await historicoDoRegistro('inscrito', inscrito!.id);
      expect(historico.map((item) => item.texto).join(' ')).not.toContain('ana@teste.com');
    });

    it('lista encerrada não recebe gente nova', async () => {
      const { lista } = await novaLista();
      await repositorios.lista_espera.atualizar(lista.id, { situacao: 'encerrada' });
      await expect(adicionarInscrito(lista.id, { ...FORMULARIO_INSCRITO_VAZIO, email: 'a@teste.com' })).rejects.toThrow(/encerrada/);
    });

    it('indicadores por origem e por semana contam cada pessoa uma vez', async () => {
      const dados = await carregarListas();
      const daLista = dados.inscritos.filter((item) => item.lista_id === dados.listas[0]?.id);
      expect(inscritosPorOrigem(daLista).reduce((soma, item) => soma + item.quantidade, 0)).toBe(daLista.length);
      expect(inscritosPorSemana(daLista, 52).reduce((soma, item) => soma + item.quantidade, 0)).toBe(daLista.length);
    });

    it('M09: confere se o inventário já cobre os inscritos do produto, sem criar cadastro', () => {
      const base = { arquivado_em: null, nome: 'Tratamento' };
      const tratamentos = [
        { ...base, id: '1', produto_id: ID_PRODUTO_KIPI, titulares: ['inscritos_lista'] as const },
        { ...base, id: '2', produto_id: null, titulares: ['inscritos_lista'] as const },
        { ...base, id: '3', produto_id: ID_PRODUTO_ZUPI, titulares: ['inscritos_lista'] as const },
        { ...base, id: '4', produto_id: ID_PRODUTO_KIPI, titulares: ['usuarios_app'] as const },
      ];
      expect(tratamentosDaLista({ produto_id: ID_PRODUTO_KIPI }, tratamentos as never).map((item) => item.id)).toEqual(['1', '2']);
    });

    it('CSV: vírgula ou ponto e vírgula, aspas, BOM e linhas em branco', () => {
      expect(lerCsv('﻿nome,email\n"Silva, Ana",a@b.com\r\n\n"Diz ""oi""",c@d.com')).toEqual({
        cabecalho: ['nome', 'email'],
        linhas: [
          { numero: 2, celulas: ['Silva, Ana', 'a@b.com'] },
          { numero: 4, celulas: ['Diz "oi"', 'c@d.com'] },
        ],
      });
      expect(lerCsv('a;b\n1;2').linhas[0]?.celulas).toEqual(['1', '2']);
    });
  });
});
