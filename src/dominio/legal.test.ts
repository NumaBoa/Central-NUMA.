import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { AVISO_MODELO_SAAS, ID_MODELO_SAAS, ID_VERSAO_MODELO_SAAS } from '@/dados/carga-f1';
import { ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { BLOCOS_MOD_SAAS_LIC } from '@/dados/referencia/mod-saas-lic';
import { carregarDocumentosLegais, compararTextos, criarDocumentoLegal, decidirValidacao, documentosFaltandoNoProduto, encerrarSolicitacao, enviarParaValidacao, ferramentasSemOperacao, novaVersaoDoDocumento, pendenciasParaPublicar, prazoSugerido, produtosComPendenciaLegal, publicarVersao, registrarRevisaoSemAlteracoes, responderSolicitacao, salvarRascunhoDoDocumento, salvarSolicitacao, salvarTratamento, situacaoDoPrazo, sugestaoDoAnexoII, type FormularioSolicitacao, type FormularioTratamento } from './legal';
import { atualizarClausulaNoBloco, carregarClausulas, carregarModelos, criarClausula, criarModelo, moverBloco, novaVersaoDaClausula, novaVersaoDoModelo, novoBloco, pendenciasParaValidarModelo, renderizarVersao, salvarEstruturaDoModelo, salvarRascunhoDaClausula, type FormularioClausula } from './modelos';
import { sincronizarAlertasLegais } from './alertas-f1';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc/view';

const pendenteDe = async (registroId: string) => (await repositorios.validacao.listar({ onde: { registro_id: registroId, situacao: 'pendente' } }))[0]!;
const validar = async (tipo: Parameters<typeof enviarParaValidacao>[0], id: string) => {
  await enviarParaValidacao(tipo, id);
  await decidirValidacao((await pendenteDe(id)).id, 'validar', { observacoes: 'Conferido' }, HOJE);
};

async function documentoPublicavel(tipo: 'termos_uso' | 'privacidade' = 'termos_uso') {
  const documento = await criarDocumentoLegal({ produto_id: ID_PRODUTO_KIPI, tipo, responsavel_id: ID_KIMBERLY }, { texto: 'Texto V1' });
  const [versao] = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documento.id } });
  await salvarRascunhoDoDocumento(versao!.id, { texto: 'Texto V1', resumo_mudancas: '', arquivo_url: '', url_publica: 'https://kipi.exemplo/termos' });
  await validar('documento_legal_versao', versao!.id);
  return { documento, versaoId: versao!.id };
}

const TRATAMENTO: FormularioTratamento = { produto_id: ID_PRODUTO_ZUPI, nome: 'Cadastro', finalidade: 'Criar a conta', titulares: ['usuarios_app'], categorias_dados: ['identificacao'], justificativa_sensiveis: '', base_legal: 'execucao_contrato', ferramentas: ['ferramenta-a'], retencao: 'Enquanto durar a conta', transferencia_internacional: 'nao', medidas: '', compartilhamentos: [] };
const SOLICITACAO: FormularioSolicitacao = { produto_id: '', titular_nome: 'Ana', titular_contato: 'ana@exemplo.com', canal: '', tipo: 'acesso', recebida_em: HOJE, prazo: '', prazo_criterio: '', responsavel_id: ID_KIMBERLY, resposta: '', evidencia_url: '', acoes_tomadas: '' };
const CLAUSULA: FormularioClausula = { codigo: 'CL-REAJ-01', titulo: 'Reajuste', categoria: 'reajuste', alternativa_de_id: '', quando_usar: '', texto: 'Reajuste pelo {{contrato.reajuste_indice}}, versão um.' };

describe('M09', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
  });
  afterEach(() => usarDriverDeTeste(null));

  describe('MOD-SAAS-LIC na carga', () => {
    it('nasce em rascunho, com a ressalva, e com o texto-fonte', async () => {
      const [versao] = await repositorios.modelo_versao.listar({ onde: { modelo_id: ID_MODELO_SAAS } });
      expect(versao?.id).toBe(ID_VERSAO_MODELO_SAAS);
      expect(versao?.situacao).toBe('rascunho');
      expect(versao?.rotulo_versao).toBe('2.0');
      expect(versao?.aviso).toBe(AVISO_MODELO_SAAS);
      expect(versao?.estrutura).toHaveLength(BLOCOS_MOD_SAAS_LIC.length);
      expect((await repositorios.modelo_documento.obter(ID_MODELO_SAAS))?.exemplo).toBe(false);
    });
  });

  describe('T09.02', () => {
    it('um por produto e tipo', async () => {
      await criarDocumentoLegal({ produto_id: ID_PRODUTO_KIPI, tipo: 'termos_uso', responsavel_id: ID_KIMBERLY });
      await expect(criarDocumentoLegal({ produto_id: ID_PRODUTO_KIPI, tipo: 'termos_uso', responsavel_id: ID_KIMBERLY })).rejects.toThrow('Já existe');
    });

    it('sem texto não vai para validação (D23)', async () => {
      const documento = await criarDocumentoLegal({ produto_id: '', tipo: 'outro', responsavel_id: ID_KIMBERLY });
      const [versao] = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documento.id } });
      await expect(enviarParaValidacao('documento_legal_versao', versao!.id)).rejects.toThrow('Escreva o texto');
    });

    it('validação registra quem pediu e quem decidiu; devolver exige motivo e volta a rascunho (RN-09.01 e RN-09.03)', async () => {
      const documento = await criarDocumentoLegal({ produto_id: '', tipo: 'outro', responsavel_id: ID_KIMBERLY }, { texto: 'T' });
      const [versao] = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documento.id } });
      await enviarParaValidacao('documento_legal_versao', versao!.id);
      expect((await repositorios.documento_legal_versao.obter(versao!.id))?.situacao).toBe('em_validacao');
      const pedido = await pendenteDe(versao!.id);
      await expect(decidirValidacao(pedido.id, 'devolver', { motivo: '  ' })).rejects.toThrow('motivo');
      await decidirValidacao(pedido.id, 'devolver', { motivo: 'Falta a cláusula de cookies' });
      expect((await repositorios.documento_legal_versao.obter(versao!.id))?.situacao).toBe('rascunho');
      expect((await repositorios.validacao.obter(pedido.id))?.motivo_devolucao).toBe('Falta a cláusula de cookies');
      await expect(decidirValidacao(pedido.id, 'validar', {})).rejects.toThrow('já foi decidida');
    });

    it('validar agenda a revisão anual (RN-09.07)', async () => {
      const { documento } = await documentoPublicavel();
      expect((await repositorios.documento_legal.obter(documento.id))?.proxima_revisao).toBe('2027-11-06');
    });

    it('CA-09.02: Política de Privacidade sem encarregado não publica, com o caminho para configurar', async () => {
      const { versaoId, documento } = await documentoPublicavel('privacidade');
      const versao = (await repositorios.documento_legal_versao.obter(versaoId))!;
      const pendencias = await pendenciasParaPublicar(versao, documento, HOJE);
      expect(pendencias.map((item) => item.mensagem)).toEqual(['Configure o encarregado de dados (DPO).', 'Configure o canal do titular.']);
      expect(pendencias[0]?.href).toBe('/configuracoes#legal');
      await expect(publicarVersao(versaoId, HOJE)).rejects.toThrow('encarregado');
      await repositorios.configuracao.salvar({ encarregado_pessoa_id: ID_KIMBERLY, canal_titular_email: 'privacidade@exemplo.com' });
      await publicarVersao(versaoId, HOJE);
      expect((await repositorios.documento_legal_versao.obter(versaoId))?.situacao).toBe('publicado');
    });

    it('sem URL pública, não publica (RN-09.04)', async () => {
      const documento = await criarDocumentoLegal({ produto_id: ID_PRODUTO_KIPI, tipo: 'cookies', responsavel_id: ID_KIMBERLY }, { texto: 'T' });
      const [versao] = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documento.id } });
      await validar('documento_legal_versao', versao!.id);
      await expect(publicarVersao(versao!.id, HOJE)).rejects.toThrow('URL pública');
    });

    it('CA-09.03: publicar a V2 torna a V1 substituída na data da V2, e a V1 fica no histórico', async () => {
      const { documento, versaoId } = await documentoPublicavel();
      await publicarVersao(versaoId, '2026-11-01');
      const v2 = await novaVersaoDoDocumento(documento.id);
      expect(v2.numero).toBe(2);
      await expect(novaVersaoDoDocumento(documento.id)).rejects.toThrow('em andamento');
      await salvarRascunhoDoDocumento(v2.id, { texto: 'Texto V2', resumo_mudancas: 'Ajuste', arquivo_url: '', url_publica: 'https://kipi.exemplo/termos' });
      await validar('documento_legal_versao', v2.id);
      await publicarVersao(v2.id, HOJE);
      const v1 = await repositorios.documento_legal_versao.obter(versaoId);
      expect(v1?.situacao).toBe('substituido');
      expect(v1?.substituido_em).toBe(HOJE);
      expect(v1?.texto).toBe('Texto V1');
      expect((await repositorios.documento_legal.obter(documento.id))?.versao_vigente_id).toBe(v2.id);
    });

    it('texto validado não muda; rascunho sim', async () => {
      const { versaoId } = await documentoPublicavel();
      await expect(salvarRascunhoDoDocumento(versaoId, { texto: 'Outro', resumo_mudancas: '', arquivo_url: '', url_publica: '' })).rejects.toThrow('não muda');
    });

    it('revisão sem alterações: nova data, mesma versão (RN-09.07)', async () => {
      const { documento, versaoId } = await documentoPublicavel();
      await publicarVersao(versaoId, HOJE);
      await registrarRevisaoSemAlteracoes(documento.id, '2027-01-10');
      expect((await repositorios.documento_legal.obter(documento.id))?.proxima_revisao).toBe('2028-01-10');
      expect((await repositorios.documento_legal_versao.obter(versaoId))?.revisado_sem_alteracoes_em).toBe('2027-01-10');
    });

    it('CA-09.01: produto com usuários reais e sem os dois documentos publicados aparece com pendência (RN-09.02)', async () => {
      const dados = await carregarDocumentosLegais();
      const pendentes = produtosComPendenciaLegal(dados.produtos, dados.documentos);
      expect(pendentes.find((item) => item.produto.id === ID_PRODUTO_KIPI)?.faltando).toEqual(['termos_uso', 'privacidade']);
      expect(documentosFaltandoNoProduto({ id: ID_PRODUTO_ZUPI, tem_usuarios_reais: false }, [])).toEqual(['termos_uso', 'privacidade']);
      expect(pendentes.some((item) => item.produto.id === ID_PRODUTO_ZUPI)).toBe(false);
    });

    it('compara textos linha a linha', () => {
      expect(compararTextos('a\nb', 'a\nc')).toEqual([{ tipo: 'igual', texto: 'a' }, { tipo: 'saiu', texto: 'b' }, { tipo: 'entrou', texto: 'c' }]);
    });
  });

  describe('T09.03', () => {
    it('CA-09.04: novo dado marca a política vigente e cria o alerta; outro campo não', async () => {
      await repositorios.configuracao.salvar({ encarregado_pessoa_id: ID_KIMBERLY, canal_titular_email: 'p@exemplo.com' });
      const documento = await criarDocumentoLegal({ produto_id: ID_PRODUTO_ZUPI, tipo: 'privacidade', responsavel_id: ID_KIMBERLY }, { texto: 'T' });
      const [versao] = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documento.id } });
      await salvarRascunhoDoDocumento(versao!.id, { texto: 'T', resumo_mudancas: '', arquivo_url: '', url_publica: 'https://z.exemplo/p' });
      await validar('documento_legal_versao', versao!.id);
      await publicarVersao(versao!.id, HOJE);
      const tratamento = await salvarTratamento(TRATAMENTO);
      await registrarRevisaoSemAlteracoes(documento.id, HOJE);
      await salvarTratamento({ ...TRATAMENTO, retencao: 'Outra retenção' }, tratamento.id);
      expect((await repositorios.documento_legal.obter(documento.id))?.revisao_necessaria).toBe(false);
      await salvarTratamento({ ...TRATAMENTO, categorias_dados: ['identificacao', 'localizacao'] }, tratamento.id);
      const marcado = await repositorios.documento_legal.obter(documento.id);
      expect(marcado?.revisao_necessaria).toBe(true);
      expect(marcado?.revisao_motivo).toContain('Localização');
      const alertas = await repositorios.atividade.listar({ onde: { origem_tipo: 'documento_legal', origem_id: documento.id } });
      expect(alertas.filter((alerta) => alerta.situacao === 'a_fazer')).toHaveLength(1);
      expect(alertas[0]?.alerta_acao).toBe('revisar_documento_legal');
      await sincronizarAlertasLegais();
      expect((await repositorios.atividade.listar({ onde: { origem_tipo: 'documento_legal', origem_id: documento.id } })).filter((alerta) => alerta.situacao === 'a_fazer')).toHaveLength(1);
    });

    it('ferramenta que trata dados sem operação é pendência (RN-09.09)', () => {
      const base = { arquivado_em: null, situacao: 'ativa' };
      const pendentes = ferramentasSemOperacao([{ ...base, id: 'a', trata_dados_pessoais: true }, { ...base, id: 'b', trata_dados_pessoais: true }, { ...base, id: 'c', trata_dados_pessoais: false }] as never, [{ ferramenta_id: 'a' }]);
      expect(pendentes.map((item) => item.id)).toEqual(['b']);
    });

    it('sugestão do Anexo II só sugere, a partir do inventário (decisão 8)', async () => {
      await salvarTratamento(TRATAMENTO);
      const sugestao = await sugestaoDoAnexoII(ID_PRODUTO_ZUPI);
      expect(sugestao.categorias_dados).toEqual(['Identificação']);
      expect(sugestao.titulares).toEqual(['Usuários do app']);
    });
  });

  describe('T09.04', () => {
    it('não existe prazo universal: sem configuração, o prazo fica pendente (decisão 11)', async () => {
      expect((await repositorios.configuracao.ler()).prazo_resposta_titular_dias).toBeNull();
      expect(prazoSugerido(HOJE, null)).toEqual({ prazo: '', criterio: '' });
      expect(prazoSugerido(HOJE, 10).prazo).toBe('2026-11-16');
      const solicitacao = await salvarSolicitacao(SOLICITACAO);
      expect(solicitacao.prazo).toBeNull();
      expect(situacaoDoPrazo(solicitacao, HOJE).texto).toBe('Prazo a definir');
      await sincronizarAlertasLegais(HOJE);
      expect(await repositorios.atividade.listar({ onde: { origem_tipo: 'solicitacao_titular' } })).toHaveLength(0);
    });

    it('com prazo informado, o alerta aparece 3 dias antes, e responder o resolve', async () => {
      const solicitacao = await salvarSolicitacao({ ...SOLICITACAO, prazo: '2026-11-08', prazo_criterio: 'Regra aplicável conferida' });
      await sincronizarAlertasLegais(HOJE);
      const [alerta] = await repositorios.atividade.listar({ onde: { origem_tipo: 'solicitacao_titular', origem_id: solicitacao.id } });
      expect(alerta?.situacao).toBe('a_fazer');
      await expect(responderSolicitacao(solicitacao.id, { resposta: '', evidencia_url: DRIVE, respondida_em: HOJE }, HOJE)).rejects.toThrow('resposta');
      await expect(responderSolicitacao(solicitacao.id, { resposta: 'Ok', evidencia_url: '', respondida_em: HOJE }, HOJE)).rejects.toThrow('evidência');
      await expect(encerrarSolicitacao(solicitacao.id, HOJE)).rejects.toThrow('Responda');
      await responderSolicitacao(solicitacao.id, { resposta: 'Ok', evidencia_url: DRIVE, respondida_em: HOJE }, HOJE);
      expect((await repositorios.atividade.obter(alerta!.id))?.situacao).toBe('concluida');
      await encerrarSolicitacao(solicitacao.id, HOJE);
      expect((await repositorios.solicitacao_titular.obter(solicitacao.id))?.situacao).toBe('encerrada');
    });
  });

  describe('T09.06 e T09.07', () => {
    async function clausulaValidada() {
      const clausula = await criarClausula(CLAUSULA);
      const [versao] = await repositorios.clausula_versao.listar({ onde: { clausula_id: clausula.id } });
      await validar('clausula_versao', versao!.id);
      return { clausula, v1: versao! };
    }

    it('código repetido não entra; texto com estrutura errada também não', async () => {
      await criarClausula(CLAUSULA);
      await expect(criarClausula(CLAUSULA)).rejects.toThrow('Já existe');
      await expect(criarClausula({ ...CLAUSULA, codigo: 'CL-X-01', texto: '[SE a]sem fim' })).rejects.toThrow('sem [FIM SE]');
    });

    it('validada não se edita: nova versão em rascunho (RN-09.12)', async () => {
      const { clausula, v1 } = await clausulaValidada();
      await expect(salvarRascunhoDaClausula(v1.id, { titulo: 'x', categoria: 'reajuste', quando_usar: '', texto: 'y', alternativa_de_id: '' })).rejects.toThrow('Só o rascunho');
      const v2 = await novaVersaoDaClausula(clausula.id);
      expect(v2.numero).toBe(2);
      await expect(novaVersaoDaClausula(clausula.id)).rejects.toThrow('Já existe um rascunho');
    });

    it('CA-09.05: o modelo segue gerando a V1 depois que a V2 é validada, até ser atualizado', async () => {
      const { clausula, v1 } = await clausulaValidada();
      const modelo = await criarModelo({ nome: 'Contrato simples', tipo_documento: 'contrato', familia: '' });
      const [versaoModelo] = await repositorios.modelo_versao.listar({ onde: { modelo_id: modelo.id } });
      const bloco = novoBloco('clausula', { clausula_versao_id: v1.id });
      await salvarEstruturaDoModelo(versaoModelo!.id, { estrutura: [bloco], cabecalho: '', observacoes: '', opcionais: [] });
      const v2 = await novaVersaoDaClausula(clausula.id);
      await salvarRascunhoDaClausula(v2.id, { titulo: 'Reajuste', categoria: 'reajuste', quando_usar: '', texto: 'Versão dois.', alternativa_de_id: '' });
      await validar('clausula_versao', v2.id);
      const versoes = await repositorios.clausula_versao.listar();
      const salvo = (await repositorios.modelo_versao.obter(versaoModelo!.id))!;
      const texto = (dados: unknown, versao: typeof salvo) => JSON.stringify(renderizarVersao(versao, versoes, dados).nos);
      expect(texto({ contrato: { reajuste_indice: 'IPCA' } }, salvo)).toContain('versão um');
      const atualizado = { ...salvo, estrutura: atualizarClausulaNoBloco(salvo.estrutura, bloco.id, v2.id) };
      expect(texto({}, atualizado)).toContain('Versão dois');
      expect((await carregarClausulas()).find((item) => item.id === clausula.id)?.usadaEm).toBe(1);
    });

    it('modelo validado só com cláusulas validadas; versão validada não muda (RN-09.12 e RN-09.13)', async () => {
      const clausula = await criarClausula(CLAUSULA);
      const [versao] = await repositorios.clausula_versao.listar({ onde: { clausula_id: clausula.id } });
      const modelo = await criarModelo({ nome: 'M', tipo_documento: 'contrato', familia: '' });
      const [versaoModelo] = await repositorios.modelo_versao.listar({ onde: { modelo_id: modelo.id } });
      await expect(enviarParaValidacao('modelo_versao', versaoModelo!.id)).rejects.toThrow('vazio');
      await salvarEstruturaDoModelo(versaoModelo!.id, { estrutura: [novoBloco('clausula', { clausula_versao_id: versao!.id })], cabecalho: '', observacoes: '', opcionais: [] });
      await expect(enviarParaValidacao('modelo_versao', versaoModelo!.id)).rejects.toThrow('cláusula em rascunho');
      await validar('clausula_versao', versao!.id);
      await validar('modelo_versao', versaoModelo!.id);
      expect((await repositorios.modelo_versao.obter(versaoModelo!.id))?.situacao).toBe('validada');
      await expect(salvarEstruturaDoModelo(versaoModelo!.id, { estrutura: [], cabecalho: '', observacoes: '', opcionais: [] })).rejects.toThrow('Só o rascunho');
      const nova = await novaVersaoDoModelo(modelo.id);
      expect(nova.numero).toBe(2);
    });

    it('variável fora do dicionário impede validar', () => {
      const pendencias = pendenciasParaValidarModelo({ estrutura: [novoBloco('texto', { conteudo: '{{variavel.inventada}}' })] }, []);
      expect(pendencias[0]).toContain('variavel.inventada');
    });

    it('variável opcional vazia não bloqueia; obrigatória, sim (CA-09.06)', () => {
      const versao = { estrutura: [novoBloco('texto', { conteudo: '{{a.b}} {{a.c}}' })], variaveis: [{ nome: 'a.b', origem: '', formato: '', obrigatoria: true }, { nome: 'a.c', origem: '', formato: '', obrigatoria: false }] };
      expect(renderizarVersao(versao, [], {}).faltando).toEqual(['a.b']);
    });

    it('condicional e tabela de itens saem como blocos', () => {
      const versao = { estrutura: [novoBloco('condicional', { condicao: 'tem', blocos: [novoBloco('texto', { conteudo: 'Entrou' })] }), novoBloco('tabela_itens')], variaveis: [] };
      const texto = JSON.stringify(renderizarVersao(versao, [], { tem: true, itens: [{ descricao: 'Plano', quantidade: 1, valor_formatado: 'R$ 1,00', periodicidade_texto: 'Mensal' }], totais_texto: 'Mensal: R$ 1,00' }).nos);
      expect(texto).toContain('Entrou');
      expect(texto).toContain('Plano');
    });

    it('mover bloco respeita os limites', () => {
      const [a, b] = [novoBloco('texto', { titulo: 'A' }), novoBloco('texto', { titulo: 'B' })];
      expect(moverBloco([a, b], b.id, -1).map((bloco) => bloco.titulo)).toEqual(['B', 'A']);
      expect(moverBloco([a, b], a.id, -1).map((bloco) => bloco.titulo)).toEqual(['A', 'B']);
    });

    it('lista de modelos traz MOD-SAAS-LIC', async () => {
      const modelos = await carregarModelos();
      expect(modelos.find((modelo) => modelo.codigo === 'MOD-SAAS-LIC')?.atual?.situacao).toBe('rascunho');
    });
  });
});
