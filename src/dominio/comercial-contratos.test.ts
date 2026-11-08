import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Contraparte } from '@/dados/tipos/contraparte';
import { sincronizarAlertasComerciais } from './alertas-f1';
import { avancarEtapa, carregarComercial, carregarProposta, criarProposta, emitirProposta, encerrarOportunidade, expirarPropostas, ITEM_VAZIO, montarDocumentoDaProposta, novaVersaoDaProposta, reabrirValidade, registrarAceite, registrarEnvio, registrarProximaAcao, registrarRecusa, salvarItemDaProposta, salvarOportunidade, salvarVersaoDaProposta, semProximaAcao, totaisDosItens, linhasDosTotais, formularioOportunidadeVazio, totaisDaColuna } from './comercial';
import { aprovarParaEnvio, arquivoAssinadoValido, ativarProgramacao, calcularPrazo, carregarContrato, carregarContratos, converterPropostaEmContrato, correcaoAdministrativa, criarAditivo, criarContrato, dataLimiteDaRenovacao, decidirRenovacao, definirSignatarios, devolverParaRascunho, diferencasDoAssinado, emitirContrato, encerrarContrato, enviarParaRevisao, indicadoresDosContratos, montarDocumentoDoContrato, previaDaProgramacao, previaDoEncerramento, registrarAssinatura, registrarEnvioParaAssinatura, registrarEvento, salvarItemDoContrato, salvarRegraDePrazo, salvarVersao, situacaoDaVigencia, temCiclo } from './contratos';
import { criarContratoSaas, dadosSaasPadrao, errosDosLimites, gerarTermosDeAssinatura, montarDocumentoSaas, salvarDadosSaas, criarRelacaoAdesao } from './contrato-saas';
import { documentosDoRegistro, emissaoDoSnapshot } from './documentos-emitidos';
import { FORMULARIO_ENTIDADE_VAZIO, salvarEntidade } from './entidades';
import { CONFIGURACAO_DE_EXEMPLO, criarCatalogoDeExemplo, ID_CANAL_DIRETO, ID_OFERTA_ESTUDO, ID_OFERTA_PACOTE, ID_OFERTA_REVENDA, ID_OFERTA_SEM_LIMITE } from './integracoes/catalogo-de-exemplo';
import { catalogoAusente } from './integracoes/catalogo-comercial';
import { usarCatalogoDeTeste } from './integracoes/conexoes';
import { criarDocumentoLegal, decidirValidacao, enviarParaValidacao, publicarVersao, salvarRascunhoDoDocumento } from './legal';
import { textoDoDocumento as textoComEspacos } from './modelo-texto';

const semNbsp = (texto: string) => texto.replace(/\u00a0/g, ' ');
const textoDoDocumento = (...args: Parameters<typeof textoComEspacos>) => semNbsp(textoComEspacos(...args));
import { criarModelo, novoBloco, salvarEstruturaDoModelo } from './modelos';
import { registrarPagamento } from './titulos';

const HOJE = '2026-11-06';
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const categoria = (nome: string) => CATEGORIAS_INICIAIS.find((item) => item.nome === nome)!.id;

async function contraparteCompleta(): Promise<Contraparte> {
  return repositorios.contraparte.criar({ tipo_pessoa: 'pj', nome: 'Café Aurora Ltda', nome_fantasia: 'Café Aurora', documento: '11222333000181', documento_normalizado: '11222333000181', papeis: ['prospect'], site: null, email: 'contato@cafe.exemplo', telefone: null, endereco: { cep: '20000-000', logradouro: 'Rua A', numero: '1', complemento: null, bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'RJ' }, pais: 'BR', origem: 'indicacao', responsavel_id: ID_KIMBERLY, classe: 'int', observacoes: null, situacao: 'ativa' });
}

async function entidadeDasSocias({ cpfCamila = '52998224725', pctCamila = '50' } = {}) {
  return salvarEntidade({ ...FORMULARIO_ENTIDADE_VAZIO, tipo_pessoa: 'socias_pf', nome: 'Kimberly e Camila', situacao: cpfCamila && pctCamila ? 'ativa' : 'planejada', marca_comercial: 'Numa', licenciantes: [{ pessoa_id: ID_KIMBERLY, nome_civil: 'Kimberly Grebe', nacionalidade: 'brasileira', cpf: '111.444.777-35', endereco: 'Rua B, 2, Rio de Janeiro/RJ', email: 'k@exemplo.com', responsabilidade_pct: '50' }, { pessoa_id: ID_CAMILA, nome_civil: 'Camila Lima', nacionalidade: 'brasileira', cpf: cpfCamila, endereco: 'Rua C, 3, Rio de Janeiro/RJ', email: 'c@exemplo.com', responsabilidade_pct: pctCamila }] });
}

/** Um modelo simples e validado, com as variáveis do dicionário. */
async function modeloValidado(tipo: 'proposta' | 'contrato') {
  const modelo = await criarModelo({ nome: `Modelo de ${tipo}`, tipo_documento: tipo, familia: '' });
  const [versao] = await repositorios.modelo_versao.listar({ onde: { modelo_id: modelo.id } });
  const texto = tipo === 'proposta' ? 'Proposta {{proposta.codigo}} para {{contraparte.nome_ou_razao}}. Validade {{proposta.validade}}.' : 'Contrato {{contrato.codigo}} entre {{entidade.marca_comercial}} e {{contraparte.nome_ou_razao}}, com endereço em {{contraparte.endereco}}.';
  await salvarEstruturaDoModelo(versao!.id, { estrutura: [novoBloco('texto', { conteudo: texto }), novoBloco('tabela_itens')], cabecalho: '', observacoes: '', opcionais: [] });
  await enviarParaValidacao('modelo_versao', versao!.id);
  const pedido = (await repositorios.validacao.listar({ onde: { registro_id: versao!.id } }))[0]!;
  await decidirValidacao(pedido.id, 'validar', {});
  return versao!.id;
}

async function oportunidade(contraparteId: string) {
  return salvarOportunidade({ ...formularioOportunidadeVazio(ID_KIMBERLY, contraparteId), titulo: 'Kipi para o Café Aurora', produtos: [ID_PRODUTO_KIPI] }, undefined, HOJE);
}

const itemOferta = (oferta: string, periodicidade: string, extra = {}) => ({ ...ITEM_VAZIO, oferta_id: oferta, canal_id: ID_CANAL_DIRETO, periodicidade, ...extra });

async function propostaAceita() {
  const contraparte = await contraparteCompleta();
  const entidade = await entidadeDasSocias();
  const op = await oportunidade(contraparte.id);
  const proposta = await criarProposta(op.id, HOJE);
  const ficha = (await carregarProposta(proposta.id))!;
  await salvarVersaoDaProposta(ficha.atual.id, { ...ficha.atual, entidade_id: entidade.id, modelo_versao_id: await modeloValidado('proposta') });
  await salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_REVENDA, 'mensal'), undefined, HOJE);
  await salvarItemDaProposta(ficha.atual.id, { ...ITEM_VAZIO, tipo_item: 'sob_medida', descricao: 'Implantação assistida', valor_unitario: '2.000,00', justificativa_valor: 'Escopo da viabilidade', periodicidade: 'unica' }, undefined, HOJE);
  await emitirProposta(proposta.id, true, {}, HOJE);
  await registrarEnvio(ficha.atual.id, { data: HOJE, canal: 'E-mail', para: 'contato@cafe.exemplo', evidencia: '' }, HOJE);
  await registrarAceite(ficha.atual.id, { data: HOJE, forma: 'email', evidencia: DRIVE }, HOJE);
  return { proposta, contraparte, entidade, oportunidade: op, versaoId: ficha.atual.id };
}

describe('M10 e M11', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    usarCatalogoDeTeste(criarCatalogoDeExemplo());
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    usarCatalogoDeTeste(null);
  });

  describe('M10', () => {
    it('CA-10.02: único e mensal separados, sem total combinado', () => {
      const totais = totaisDosItens([{ valor_total: 2000, recorrente: false, periodicidade: 'unica' }, { valor_total: 150, recorrente: true, periodicidade: 'mensal' }]);
      expect(linhasDosTotais(totais).map(semNbsp)).toEqual(['Único: R$ 2.000,00', 'Mensal: R$ 150,00']);
      expect(totais.anualEquivalente).toBe(1800);
      expect(totaisDosItens([{ valor_total: null, recorrente: true, periodicidade: 'mensal' }]).semValor).toBe(1);
    });

    it('valor estimado vazio não é zero nos totais do funil', () => {
      const totais = totaisDaColuna([{ valor_estimado: null, valor_periodicidade: null }, { valor_estimado: 150, valor_periodicidade: 'mensal' }]);
      expect(totais).toEqual({ quantidade: 2, valores: [{ periodicidade: 'mensal', valor: 150 }], semValor: 1 });
    });

    it('a próxima ação é uma atividade do Meu dia vinculada; encerrada não pede próxima ação (RN-10.02)', async () => {
      const contraparte = await contraparteCompleta();
      const op = await oportunidade(contraparte.id);
      expect(semProximaAcao((await carregarComercial()).oportunidades[0]!)).toBe(true);
      const atividade = await registrarProximaAcao(op.id, { titulo: 'Retomar proposta', prazo: '2026-11-10', responsavelId: ID_KIMBERLY });
      expect(atividade.tipo).toBe('tarefa');
      const linha = (await carregarComercial()).oportunidades[0]!;
      expect(linha.proxima?.id).toBe(atividade.id);
      expect(semProximaAcao(linha)).toBe(false);
      expect((await repositorios.contraparte.obter(contraparte.id))?.papeis).toContain('prospect');
    });

    it('RN-10.03: perdida com motivo; ganha só com aceite ou adesão padrão; ganha soma o papel cliente', async () => {
      const contraparte = await contraparteCompleta();
      const op = await oportunidade(contraparte.id);
      await expect(encerrarOportunidade(op.id, { tipo: 'ganha', adesaoPadrao: false })).rejects.toThrow('versão aceita');
      await expect(encerrarOportunidade(op.id, { tipo: 'perdida', motivo: 'outro', texto: '' })).rejects.toThrow('motivo');
      await encerrarOportunidade(op.id, { tipo: 'ganha', adesaoPadrao: true }, HOJE);
      const papeis = (await repositorios.contraparte.obter(contraparte.id))?.papeis;
      expect(papeis).toEqual(['prospect', 'cliente']);
      await expect(avancarEtapa(op.id, 'proposta')).rejects.toThrow('encerrada');
    });

    it('RN-10.08: preço do catálogo copiado; sem preço aprovado, o valor fica vazio e bloqueia', async () => {
      const contraparte = await contraparteCompleta();
      const op = await oportunidade(contraparte.id);
      const proposta = await criarProposta(op.id, HOJE);
      const ficha = (await carregarProposta(proposta.id))!;
      expect(ficha.atual.validade).toBe('2026-11-21');
      const item = await salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_REVENDA, 'anual'), undefined, HOJE);
      expect(item.valor_unitario).toBe(599);
      const semPreco = await salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_ESTUDO, 'mensal'), undefined, HOJE);
      expect(semPreco.valor_unitario).toBeNull();
      const { pendencias } = await montarDocumentoDaProposta((await carregarProposta(proposta.id))!, undefined, HOJE);
      expect(pendencias.some((pendencia) => pendencia.mensagem.includes('não está Aprovada'))).toBe(true);
      expect(pendencias.some((pendencia) => pendencia.mensagem.includes('sem preço aprovado'))).toBe(true);
    });

    it('sem o catálogo do M07, o item de oferta não entra, e a mensagem explica', async () => {
      usarCatalogoDeTeste(catalogoAusente);
      const contraparte = await contraparteCompleta();
      const proposta = await criarProposta((await oportunidade(contraparte.id)).id, HOJE);
      const ficha = (await carregarProposta(proposta.id))!;
      await expect(salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_REVENDA, 'anual'), undefined, HOJE)).rejects.toThrow('M07');
    });

    it('CA-10.03: desconto sem justificativa bloqueia; com ela, registra quem concedeu e quando', async () => {
      const contraparte = await contraparteCompleta();
      const proposta = await criarProposta((await oportunidade(contraparte.id)).id, HOJE);
      const ficha = (await carregarProposta(proposta.id))!;
      const item = await salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_REVENDA, 'mensal', { desconto_tipo: 'percentual', desconto: '10' }), undefined, HOJE);
      expect(item.valor_total).toBe(53.91);
      const pendencias = (await montarDocumentoDaProposta((await carregarProposta(proposta.id))!, undefined, HOJE)).pendencias;
      expect(pendencias.find((pendencia) => pendencia.mensagem.includes('desconto sem justificativa'))?.tipo).toBe('bloqueia');
      const justificado = await salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_REVENDA, 'mensal', { desconto_tipo: 'percentual', desconto: '10', desconto_justificativa: 'Condição de lançamento' }), item.id, HOJE);
      expect(justificado.desconto_por).toBe(ID_KIMBERLY);
      expect(justificado.desconto_em).toBe(HOJE);
    });

    it('fluxo: emitir final → enviar → aceite com evidência; versões enviadas não mudam', async () => {
      const { proposta, versaoId } = await propostaAceita();
      const versao = await repositorios.proposta_versao.obter(versaoId);
      expect(versao?.situacao).toBe('aceita');
      expect(versao?.aceite_registrado_por).toBe(ID_KIMBERLY);
      expect((await repositorios.proposta.obter(proposta.id))?.versao_aceita_id).toBe(versaoId);
      await expect(salvarItemDaProposta(versaoId, itemOferta(ID_OFERTA_REVENDA, 'mensal'), undefined, HOJE)).rejects.toThrow('Só o rascunho');
      await expect(novaVersaoDaProposta(proposta.id, HOJE)).rejects.toThrow('aceita');
      const [documento] = await documentosDoRegistro(versaoId);
      expect(documento?.final).toBe(true);
      expect(documento?.enviado).toBe(true);
    });

    it('aceite exige evidência; validade vencida expira e só volta com motivo (RN-10.10 e RN-10.12)', async () => {
      const contraparte = await contraparteCompleta();
      const entidade = await entidadeDasSocias();
      const proposta = await criarProposta((await oportunidade(contraparte.id)).id, HOJE);
      const ficha = (await carregarProposta(proposta.id))!;
      await salvarVersaoDaProposta(ficha.atual.id, { ...ficha.atual, entidade_id: entidade.id, modelo_versao_id: await modeloValidado('proposta') });
      await salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_REVENDA, 'mensal'), undefined, HOJE);
      await emitirProposta(proposta.id, true, {}, HOJE);
      await registrarEnvio(ficha.atual.id, { data: HOJE, canal: 'E-mail', para: 'x', evidencia: '' }, HOJE);
      await expect(registrarAceite(ficha.atual.id, { data: HOJE, forma: 'email', evidencia: '' }, HOJE)).rejects.toThrow('evidência');
      expect(await expirarPropostas('2026-12-01')).toBe(1);
      await expect(registrarAceite(ficha.atual.id, { data: HOJE, forma: 'email', evidencia: DRIVE }, '2026-12-01')).rejects.toThrow('Reabrir validade');
      await reabrirValidade(ficha.atual.id, '2026-12-10', 'Cliente pediu mais prazo', '2026-12-01');
      await registrarRecusa(ficha.atual.id, 'Preço');
      const nova = await novaVersaoDaProposta(proposta.id, HOJE);
      expect(nova.numero).toBe(2);
      expect(await repositorios.proposta_item.listar({ onde: { versao_id: nova.id } })).toHaveLength(1);
    });

    it('alerta de validade 3 dias antes, para a versão enviada', async () => {
      const contraparte = await contraparteCompleta();
      const entidade = await entidadeDasSocias();
      const proposta = await criarProposta((await oportunidade(contraparte.id)).id, HOJE);
      const ficha = (await carregarProposta(proposta.id))!;
      await salvarVersaoDaProposta(ficha.atual.id, { ...ficha.atual, entidade_id: entidade.id, modelo_versao_id: await modeloValidado('proposta') });
      await salvarItemDaProposta(ficha.atual.id, itemOferta(ID_OFERTA_REVENDA, 'mensal'), undefined, HOJE);
      await emitirProposta(proposta.id, true, {}, HOJE);
      await registrarEnvio(ficha.atual.id, { data: HOJE, canal: 'E-mail', para: 'x', evidencia: '' }, HOJE);
      await sincronizarAlertasComerciais('2026-11-17');
      expect(await repositorios.atividade.listar({ onde: { origem_tipo: 'proposta', origem_id: proposta.id } })).toHaveLength(0);
      await sincronizarAlertasComerciais('2026-11-18');
      expect((await repositorios.atividade.listar({ onde: { origem_tipo: 'proposta', origem_id: proposta.id } }))[0]?.alerta_acao).toBe('abrir_proposta');
    });
  });

  describe('M11', () => {
    async function contratoAssinado({ inicio = null as string | null } = {}) {
      const { proposta } = await propostaAceita();
      const { contrato } = await converterPropostaEmContrato(proposta.id);
      const ficha = (await carregarContrato(contrato.id, HOJE))!;
      await salvarVersao(ficha.atual.id, { modelo_versao_id: await modeloValidado('contrato'), vigencia_duracao_meses: 12, vigencia_inicio_evento: inicio ? 'data_fixa' : 'assinatura', vigencia_inicio: inicio, condicoes: { ...ficha.atual.condicoes, forma_pagamento: 'pix', dia_vencimento: 10, renovacao_tipo: 'mediante_aditivo', aviso_previo_dias: 30 } }, HOJE);
      await definirSignatarios(ficha.atual.id, 'numa', [ID_KIMBERLY]);
      const representante = await repositorios.pessoa.criar({ nome_completo: 'Ana do Café', nome_exibicao: null, tipo: 'externa', eh_socia: false, contraparte_id: contrato.contraparte_id, papeis_contato: [], funcao: null, email: null, telefone: null, cpf: null, observacoes: null, situacao: 'ativa' });
      await definirSignatarios(ficha.atual.id, 'contraparte', [representante.id]);
      await enviarParaRevisao(contrato.id, HOJE);
      await emitirContrato(contrato.id, true, {}, HOJE);
      await aprovarParaEnvio(contrato.id, HOJE);
      await registrarEnvioParaAssinatura(contrato.id, { data: HOJE, canal: 'E-mail', destinatarios: 'ana' }, HOJE);
      const signatarios = (await carregarContrato(contrato.id, HOJE))!.signatarios;
      await registrarAssinatura(contrato.id, { datas: Object.fromEntries(signatarios.map((linha) => [linha.id, HOJE])), arquivoUrl: DRIVE, evidenciaUrl: DRIVE }, HOJE);
      return (await carregarContrato(contrato.id, HOJE))!;
    }

    it('RN-10.13: converter de novo a mesma versão abre o mesmo contrato', async () => {
      const { proposta } = await propostaAceita();
      const primeiro = await converterPropostaEmContrato(proposta.id);
      const segundo = await converterPropostaEmContrato(proposta.id);
      expect(primeiro.criado).toBe(true);
      expect(segundo.criado).toBe(false);
      expect(segundo.contrato.id).toBe(primeiro.contrato.id);
      expect((await carregarContrato(primeiro.contrato.id))?.itens).toHaveLength(2);
      expect((await repositorios.contrato.listar())).toHaveLength(1);
    });

    it('CA-11.03: entidade Planejada salva e revisa, mas o final fica bloqueado com a pendência', async () => {
      const contraparte = await contraparteCompleta();
      const planejada = (await repositorios.entidade.listar()).find((entidade) => entidade.situacao === 'planejada')!;
      const contrato = await criarContrato({ titulo: 'Fornecedor X', familia: 'cliente_negociado', tipo: 'prestacao_servico', entidade_id: planejada.id, contraparte_id: contraparte.id, responsavel_id: ID_KIMBERLY, participantes: [] });
      const ficha = (await carregarContrato(contrato.id))!;
      await salvarItemDoContrato(ficha.atual.id, { ...ITEM_VAZIO, tipo_item: 'sob_medida', descricao: 'Serviço', valor_unitario: '100', justificativa_valor: 'ok', periodicidade: 'unica' }, undefined, HOJE);
      await salvarVersao(ficha.atual.id, { vigencia_indeterminada: true, modelo_versao_id: await modeloValidado('contrato'), condicoes: { ...ficha.atual.condicoes, forma_pagamento: 'pix', renovacao_tipo: 'sem_renovacao' } }, HOJE);
      await enviarParaRevisao(contrato.id, HOJE);
      const { pendencias } = await montarDocumentoDoContrato((await carregarContrato(contrato.id))!, HOJE);
      expect(pendencias.some((pendencia) => pendencia.mensagem.includes('ainda não está Ativa'))).toBe(true);
      await expect(emitirContrato(contrato.id, true, {}, HOJE)).rejects.toThrow('Ativa');
      await expect(aprovarParaEnvio(contrato.id, HOJE)).rejects.toThrow('Emita o documento final');
      await devolverParaRascunho(contrato.id, 'Esperar a entidade');
      expect((await repositorios.contrato.obter(contrato.id))?.situacao_documental).toBe('rascunho');
    });

    it('CA-11.05: assinatura sem arquivo é bloqueada, e link de pasta não serve', () => {
      expect(arquivoAssinadoValido('https://drive.google.com/drive/folders/abc')).toBe(false);
      expect(arquivoAssinadoValido(DRIVE)).toBe(true);
    });

    it('fluxo completo: publica a versão, registra a assinatura e o snapshot das partes (RN-11.04)', async () => {
      const ficha = await contratoAssinado();
      expect(ficha.contrato.situacao_documental).toBe('assinado');
      expect(ficha.vigente?.situacao).toBe('publicada');
      expect(ficha.eventos.find((evento) => evento.tipo === 'assinatura')?.data).toBe(HOJE);
      expect(situacaoDaVigencia(ficha.contrato, ficha.vigente, ficha.eventos, HOJE)).toBe('vigente');
      expect((ficha.vigente?.snapshot as { contraparte: Contraparte }).contraparte.nome).toBe('Café Aurora Ltda');
      const lista = await carregarContratos(HOJE);
      expect(lista.linhas).toHaveLength(1);
      expect(indicadoresDosContratos(lista.linhas, HOJE).vigentes).toBe(1);
    });

    it('CA-11.02: mudar o endereço depois mostra a diferença, sem mudar o snapshot nem o documento', async () => {
      const ficha = await contratoAssinado();
      await repositorios.contraparte.atualizar(ficha.contrato.contraparte_id, { endereco: { cep: '20000-000', logradouro: 'Rua Nova', numero: '9', complemento: null, bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'RJ' } });
      const depois = (await carregarContrato(ficha.contrato.id, HOJE))!;
      expect(diferencasDoAssinado(depois.vigente, depois.contraparte, depois.entidade)).toContain('endereço da contraparte');
      expect(JSON.stringify(depois.vigente?.snapshot)).toContain('Rua A');
      const [emitido] = await documentosDoRegistro(depois.vigente!.id);
      expect(textoDoDocumento(emissaoDoSnapshot(emitido!).nos)).toContain('Rua A');
      await correcaoAdministrativa(ficha.contrato.id, { endereco_correspondencia: 'Rua Nova, 9', dados_bancarios: null, observacoes: null }, 'Mudou de endereço');
      expect(JSON.stringify((await carregarContrato(ficha.contrato.id, HOJE))!.vigente?.snapshot)).toContain('Rua A');
    });

    it('CA-11.04: emitir, mudar o modelo e emitir de novo dá dois documentos; o primeiro fica como era', async () => {
      const contraparte = await contraparteCompleta();
      const entidade = await entidadeDasSocias();
      const contrato = await criarContrato({ titulo: 'Teste', familia: 'cliente_negociado', tipo: 'confidencialidade', entidade_id: entidade.id, contraparte_id: contraparte.id, responsavel_id: ID_KIMBERLY, participantes: [] });
      const ficha = (await carregarContrato(contrato.id))!;
      const modelo = await criarModelo({ nome: 'NDA', tipo_documento: 'contrato', familia: '' });
      const [versao] = await repositorios.modelo_versao.listar({ onde: { modelo_id: modelo.id } });
      await salvarEstruturaDoModelo(versao!.id, { estrutura: [novoBloco('texto', { conteudo: 'Texto A {{contrato.codigo}}' })], cabecalho: '', observacoes: '', opcionais: [] });
      await salvarVersao(ficha.atual.id, { modelo_versao_id: versao!.id, vigencia_indeterminada: true }, HOJE);
      await emitirContrato(contrato.id, false, {}, HOJE);
      await salvarEstruturaDoModelo(versao!.id, { estrutura: [novoBloco('texto', { conteudo: 'Texto B {{contrato.codigo}}' })], cabecalho: '', observacoes: '', opcionais: [] });
      await emitirContrato(contrato.id, false, {}, HOJE);
      const documentos = await documentosDoRegistro(ficha.atual.id);
      expect(documentos.map((documento) => documento.numero_emissao)).toEqual([2, 1]);
      expect(textoDoDocumento(emissaoDoSnapshot(documentos[1]!).nos)).toContain('Texto A');
      expect(textoDoDocumento(emissaoDoSnapshot(documentos[0]!).nos)).toContain('Texto B');
      expect(emissaoDoSnapshot(documentos[0]!).rascunho).toBe(true);
    });

    it('CA-11.07: 30 dias úteis após a assinatura ficam pendentes até ela, e depois seguem os feriados', async () => {
      const regra = { evento_referencia: 'assinatura' as const, evento_nome: null, produto_id: null, data_fixa: null, duracao: 30, unidade: 'dias_uteis' as const };
      expect(calcularPrazo(regra, [], [])).toEqual({ data: null, pendente: true, texto: 'Pendente: aguardando Assinatura' });
      const evento = { tipo: 'assinatura' as const, nome: null, produto_id: null, data: '2026-11-02' };
      const semFeriado = calcularPrazo(regra, [evento], []);
      const comFeriado = calcularPrazo(regra, [evento], [{ data: '2026-11-20' }]);
      expect(semFeriado.data).toBe('2026-12-14');
      expect(comFeriado.data).toBe('2026-12-15');
    });

    it('CA-11.06: ativar a programação duas vezes não duplica', async () => {
      const ficha = await contratoAssinado();
      const previa = await previaDaProgramacao(ficha.contrato.id, HOJE);
      expect(previa.linhas.length).toBeGreaterThan(10);
      expect(previa.linhas.find((linha) => !linha.recorrente)?.valor).toBe(2000);
      expect(previa.linhas.filter((linha) => linha.recorrente).every((linha) => linha.vencimento.endsWith('-10'))).toBe(true);
      const categorias = { categoriaRecorrente: categoria('Assinaturas'), categoriaUnica: categoria('Implantação/setup') };
      const criados = await ativarProgramacao(ficha.contrato.id, categorias, HOJE);
      expect(criados).toBe(previa.linhas.length);
      expect(await ativarProgramacao(ficha.contrato.id, categorias, HOJE)).toBe(0);
      expect((await previaDaProgramacao(ficha.contrato.id, HOJE)).linhas.every((linha) => linha.jaGerado)).toBe(true);
      const titulos = await repositorios.titulo.listar({ onde: { origem: 'contrato', origem_id: ficha.contrato.id } });
      expect(titulos).toHaveLength(criados);
      expect(titulos.every((titulo) => titulo.natureza === 'receber')).toBe(true);
    });

    it('CA-11.08: mudar o preço de assinado só por aditivo; a V1 fica intacta', async () => {
      const ficha = await contratoAssinado();
      await expect(salvarItemDoContrato(ficha.vigente!.id, ITEM_VAZIO, ficha.itens[0]!.id, HOJE)).rejects.toThrow('Só o rascunho');
      const aditivo = await criarAditivo(ficha.contrato.id, { tipo: 'aditivo', dataEfeito: '2026-12-01', justificativa: '', resumo: 'Novo preço' }, HOJE);
      expect(aditivo.numero).toBe(2);
      const [item] = await repositorios.item_contrato.listar({ onde: { versao_id: aditivo.id } });
      expect(item?.item_origem_id).toBe(ficha.itens[0]!.id);
      await expect(criarAditivo(ficha.contrato.id, { tipo: 'aditivo', dataEfeito: '2026-12-01', justificativa: '', resumo: '' }, HOJE)).rejects.toThrow('em elaboração');
      expect((await repositorios.item_contrato.listar({ onde: { versao_id: ficha.vigente!.id } }))).toHaveLength(2);
      const lista = await carregarContratos(HOJE);
      expect(lista.linhas[0]?.paralela?.id).toBe(aditivo.id);
      await expect(previaDaProgramacao(ficha.contrato.id, HOJE)).resolves.toBeTruthy();
    });

    it('CA-11.11: encerrar em 15/03 cancela os não pagos depois e preserva os anteriores', async () => {
      const ficha = await contratoAssinado({ inicio: '2026-11-01' });
      await ativarProgramacao(ficha.contrato.id, { categoriaRecorrente: categoria('Assinaturas'), categoriaUnica: categoria('Implantação/setup') }, HOJE);
      const titulos = await repositorios.titulo.listar({ onde: { origem_id: ficha.contrato.id } });
      const pago = titulos.find((titulo) => titulo.vencimento === '2027-04-10')!;
      const conta = await repositorios.conta_financeira.criar({ nome: 'Banco', tipo: 'banco', titular_entidade_id: ficha.contrato.entidade_id, titular_pessoa_id: null, instituicao: null, final_numero: null, moeda: 'BRL', saldo_inicial: null, data_saldo_inicial: null, situacao: 'ativa' });
      await registrarPagamento(pago.id, { data: HOJE, contaId: conta.id, valorMoeda: pago.valor, cambio: null, iofBrl: null, valorBrl: pago.valor, comprovanteUrl: DRIVE, semComprovanteMotivo: null, tratamento: null, vencimentoReembolso: null, pagoAMais: false, motivo: null }, HOJE);
      const previa = await previaDoEncerramento(ficha.contrato.id, '2027-03-15');
      expect(previa.cancelar.every((titulo) => titulo.vencimento > '2027-03-15')).toBe(true);
      expect(previa.cancelar.some((titulo) => titulo.id === pago.id)).toBe(false);
      const cancelados = await encerrarContrato(ficha.contrato.id, { dataEfetiva: '2027-03-15', motivo: 'acordo', multaValor: null, multaDescricao: '' });
      expect(cancelados).toBe(previa.cancelar.length);
      const depois = await repositorios.titulo.listar({ onde: { origem_id: ficha.contrato.id } });
      expect(depois.filter((titulo) => titulo.vencimento <= '2027-03-15').every((titulo) => titulo.situacao !== 'cancelado')).toBe(true);
      expect(depois.find((titulo) => titulo.id === pago.id)?.situacao).toBe('quitado');
      expect((await repositorios.contrato.obter(ficha.contrato.id))?.encerrado_em).toBe('2027-03-15');
    });

    it('CA-11.10: o alerta de renovação vem antes da data-limite (fim − aviso − antecedência)', async () => {
      const ficha = await contratoAssinado({ inicio: '2026-01-01' });
      const limite = dataLimiteDaRenovacao(ficha.contrato, ficha.vigente, ficha.eventos);
      expect(limite).toBe('2026-12-01');
      await sincronizarAlertasComerciais('2026-11-01');
      const alerta = (await repositorios.atividade.listar({ onde: { origem_tipo: 'contrato', origem_id: ficha.contrato.id } })).find((item) => item.alerta_motivo === 'Renovação / aviso prévio');
      expect(alerta?.prazo).toBe('2026-12-01');
      const renovacao = await decidirRenovacao(ficha.contrato.id, 'renovar', 'Cliente satisfeito', HOJE);
      expect(renovacao?.tipo).toBe('renovacao');
      expect(renovacao?.data_efeito).toBe('2027-01-01');
    });

    it('prazo e obrigação: evento registrado uma vez, dependência sem ciclo', async () => {
      const contraparte = await contraparteCompleta();
      const entidade = await entidadeDasSocias();
      const contrato = await criarContrato({ titulo: 'T', familia: 'cliente_negociado', tipo: 'implantacao', entidade_id: entidade.id, contraparte_id: contraparte.id, responsavel_id: ID_KIMBERLY, participantes: [] });
      const ficha = (await carregarContrato(contrato.id))!;
      await salvarRegraDePrazo(ficha.atual.id, { nome: 'Entrega', uso: 'entrega', produto_id: null, evento_referencia: 'assinatura', evento_nome: null, data_fixa: null, duracao: 30, unidade: 'dias_corridos', excecao_justificativa: null });
      await registrarEvento(contrato.id, { tipo: 'aceite', nome: '', produto_id: '', data: HOJE, evidencia_url: '', observacao: '' }, HOJE);
      await expect(registrarEvento(contrato.id, { tipo: 'aceite', nome: '', produto_id: '', data: HOJE, evidencia_url: '', observacao: '' }, HOJE)).rejects.toThrow('Corrigir data');
      await expect(registrarEvento(contrato.id, { tipo: 'assinatura', nome: '', produto_id: '', data: HOJE, evidencia_url: '', observacao: '' }, HOJE)).rejects.toThrow('Registrar assinatura');
      expect(temCiclo([{ id: 'a', depende_de: ['b'] }, { id: 'b', depende_de: ['a'] }])).toBe(true);
      expect(temCiclo([{ id: 'a', depende_de: ['b'] }, { id: 'b', depende_de: [] }])).toBe(false);
    });
  });

  describe('T11.14 e adesão padrão', () => {
    async function publicarDocumentosDoKipi() {
      await repositorios.configuracao.salvar({ encarregado_pessoa_id: ID_KIMBERLY, canal_titular_email: 'p@exemplo.com' });
      for (const tipo of ['termos_uso', 'privacidade'] as const) {
        const documento = await criarDocumentoLegal({ produto_id: ID_PRODUTO_KIPI, tipo, responsavel_id: ID_KIMBERLY }, { texto: 'T' });
        const [versao] = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documento.id } });
        await salvarRascunhoDoDocumento(versao!.id, { texto: 'T', resumo_mudancas: '', arquivo_url: '', url_publica: `https://kipi.exemplo/${tipo}` });
        await enviarParaValidacao('documento_legal_versao', versao!.id);
        await decidirValidacao((await repositorios.validacao.listar({ onde: { registro_id: versao!.id } }))[0]!.id, 'validar', {});
        await publicarVersao(versao!.id, HOJE);
      }
    }

    async function contratoSaas(opcoes: Parameters<typeof entidadeDasSocias>[0] = {}) {
      const contraparte = await contraparteCompleta();
      const entidade = await entidadeDasSocias(opcoes);
      const contrato = await criarContratoSaas({ titulo: 'Kipi Revenda', familia: 'adesao_condicao_especial', entidadeId: entidade.id, contraparteId: contraparte.id, responsavelId: ID_KIMBERLY }, HOJE);
      await definirSignatarios(contrato.versao_elaboracao_id as string, 'numa', [ID_KIMBERLY, ID_CAMILA]);
      const representante = await repositorios.pessoa.criar({ nome_completo: 'Ana do Café', nome_exibicao: null, tipo: 'externa', eh_socia: false, contraparte_id: contraparte.id, papeis_contato: [], funcao: null, email: null, telefone: null, cpf: '39053344705', observacoes: null, situacao: 'ativa' });
      const dados = { ...dadosSaasPadrao(HOJE, { cidade: 'Rio de Janeiro/RJ' }), produto_id: ID_PRODUTO_KIPI, oferta_id: ID_OFERTA_REVENDA, periodicidade: 'anual' as const, canal_id: ID_CANAL_DIRETO, modalidades: ['Navegador', 'Android'], teste_dias: 14, plataforma_assinatura: 'Plataforma informada' };
      await salvarDadosSaas(contrato.id, dados, { representante: representante.id }, HOJE);
      return { contrato, dados, representante };
    }

    const documento = async (id: string) => montarDocumentoSaas((await carregarContrato(id, HOJE))!, HOJE);

    it('CA-11.12: o valor vem do preço aprovado (R$ 599), e o Anexo I lista os limites', async () => {
      await publicarDocumentosDoKipi();
      const { contrato } = await contratoSaas();
      const montado = await documento(contrato.id);
      const texto = textoDoDocumento(montado.nos);
      expect(texto).toContain('R$ 599,00 por ano');
      expect(texto).toContain('Revendedoras ativas | Incluído | 15');
      expect(texto).toContain('Pedidos | Incluído | Ilimitado');
      expect(texto).toContain('Pagamento único e antecipado do ano');
      expect(montado.pendencias.filter((pendencia) => pendencia.tipo === 'bloqueia')).toEqual([]);
      expect((await carregarContrato(contrato.id))?.itens[0]?.valor_unitario).toBe(599);
    });

    it('CA-11.13: condição especial exige motivo e duração e aparece no Quadro-resumo e na 6.2', async () => {
      await publicarDocumentosDoKipi();
      const { contrato, dados } = await contratoSaas();
      expect(errosDosLimites({ ...dados, condicao_especial: { valor: 39.9, duracao_meses: 6, motivo: '' } }, { contrapartePj: true, hoje: HOJE }).condicao_especial).toContain('motivo');
      await salvarDadosSaas(contrato.id, { ...dados, periodicidade: 'mensal', condicao_especial: { valor: 39.9, duracao_meses: 6, motivo: 'Fundadoras' } }, {}, HOJE);
      const texto = textoDoDocumento((await documento(contrato.id)).nos);
      expect(texto).toContain('R$ 39,90 por mês durante 6 meses; depois, R$ 59,90');
      expect(texto).toContain('6.2. Por condição especial (Fundadoras)');
    });

    it('CA-11.15: configuração em rascunho bloqueia o final, com o link para T07.10', async () => {
      await publicarDocumentosDoKipi();
      usarCatalogoDeTeste(criarCatalogoDeExemplo({ configuracoes: { [ID_PRODUTO_KIPI]: { ...CONFIGURACAO_DE_EXEMPLO, situacao: 'rascunho' } } }));
      const { contrato } = await contratoSaas();
      const pendencia = (await documento(contrato.id)).pendencias.find((item) => item.id === 'config');
      expect(pendencia?.mensagem).toContain('Rascunho');
      expect(pendencia?.href).toBe(`/produtos/${ID_PRODUTO_KIPI}?aba=contrato`);
    });

    it('CA-11.16: multa de 5% é recusada com a mensagem do CDC', async () => {
      const { contrato, dados } = await contratoSaas();
      await expect(salvarDadosSaas(contrato.id, { ...dados, multa_atraso_pct: 5 }, {}, HOJE)).rejects.toThrow('Máximo de 2% (CDC, art. 52, §1º)');
    });

    it('CA-11.17: nova configuração validada não muda o contrato emitido; o próximo usa o novo prazo', async () => {
      await publicarDocumentosDoKipi();
      const { contrato } = await contratoSaas();
      await enviarParaRevisao(contrato.id, HOJE);
      await emitirContrato(contrato.id, true, { confirmarModeloNaoValidado: true, motivo: 'Validação jurídica pendente' }, HOJE);
      usarCatalogoDeTeste(criarCatalogoDeExemplo({ configuracoes: { [ID_PRODUTO_KIPI]: { ...CONFIGURACAO_DE_EXEMPLO, versao: 2, prazo_exportacao_dias: 60 } } }));
      const [emitido] = await documentosDoRegistro((await carregarContrato(contrato.id))!.atual.id);
      expect(textoDoDocumento(emissaoDoSnapshot(emitido!).nos)).toContain('por 30 dias');
      expect(emissaoDoSnapshot(emitido!).aviso).toContain('não validado');
      expect(textoDoDocumento((await documento(contrato.id)).nos)).toContain('por 60 dias');
    });

    it('MOD-SAAS-LIC em rascunho: o final pede confirmação e motivo (decisão 6)', async () => {
      await publicarDocumentosDoKipi();
      const { contrato } = await contratoSaas();
      await enviarParaRevisao(contrato.id, HOJE);
      await expect(emitirContrato(contrato.id, true, {}, HOJE)).rejects.toThrow('Emitir com modelo não validado');
    });

    it('CA-11.18 e CA-11.21: sem CPF de uma sócia, ou sem proporções, o final fica bloqueado', async () => {
      const semCpf = await contratoSaas({ cpfCamila: '' });
      expect((await documento(semCpf.contrato.id)).pendencias.map((item) => item.mensagem)).toContain('Entidade: CPF de Camila Lima não informado');
      usarDriverDeTeste(criarArmazenamentoEmMemoria());
      esquecerMetaEmMemoria();
      const semProporcao = await contratoSaas({ pctCamila: '' });
      expect((await documento(semProporcao.contrato.id)).pendencias.map((item) => item.mensagem)).toContain('Entidade: proporção de responsabilidade das sócias');
    });

    it('limite não informado não sai como ilimitado (decisão 4)', async () => {
      const { contrato, dados } = await contratoSaas();
      await salvarDadosSaas(contrato.id, { ...dados, oferta_id: ID_OFERTA_SEM_LIMITE, periodicidade: 'mensal' }, {}, HOJE);
      const montado = await documento(contrato.id);
      expect(montado.pendencias.some((item) => item.mensagem.includes('Vazio não é ilimitado'))).toBe(true);
      expect(textoDoDocumento(montado.nos)).not.toContain('Pedidos | Incluído | Ilimitado');
    });

    it('adicional tem preço aprovado próprio, e o total soma por período', async () => {
      await publicarDocumentosDoKipi();
      const { contrato, dados } = await contratoSaas();
      await salvarDadosSaas(contrato.id, { ...dados, periodicidade: 'mensal', adicionais: [{ oferta_id: ID_OFERTA_PACOTE, quantidade: 2 }] }, {}, HOJE);
      const texto = textoDoDocumento((await documento(contrato.id)).nos);
      expect(texto).toContain('Total por período | R$ 99,70');
    });

    it('CA-11.19: Termos públicos sem contraparte, com aceite eletrônico, em rascunho em T09.02', async () => {
      const { documentoId } = await gerarTermosDeAssinatura(ID_PRODUTO_KIPI, ID_KIMBERLY, HOJE);
      const documentoLegal = await repositorios.documento_legal.obter(documentoId);
      expect(documentoLegal?.tipo).toBe('termos_assinatura');
      const [versao] = await repositorios.documento_legal_versao.listar({ onde: { documento_id: documentoId } });
      expect(versao?.situacao).toBe('rascunho');
      expect(versao?.texto).toContain('23.4. A contratação se forma pelo aceite eletrônico');
      expect(versao?.texto).toContain('a pessoa física ou jurídica identificada no cadastro da conta');
      expect(versao?.texto).toContain('| Revenda |');
      expect(versao?.texto).not.toContain('CONTRATANTE: Café');
    });

    it('adesão padrão exige Termos publicados e não repete oferta e canal', async () => {
      await expect(criarRelacaoAdesao({ produtoId: ID_PRODUTO_KIPI, ofertaId: ID_OFERTA_REVENDA, canalId: ID_CANAL_DIRETO, inicio: HOJE })).rejects.toThrow('Publicados');
      await publicarDocumentosDoKipi();
      await criarRelacaoAdesao({ produtoId: ID_PRODUTO_KIPI, ofertaId: ID_OFERTA_REVENDA, canalId: ID_CANAL_DIRETO, inicio: HOJE });
      await expect(criarRelacaoAdesao({ produtoId: ID_PRODUTO_KIPI, ofertaId: ID_OFERTA_REVENDA, canalId: ID_CANAL_DIRETO, inicio: HOJE })).rejects.toThrow('Já existe');
    });
  });
});
