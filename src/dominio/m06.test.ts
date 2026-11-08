import { beforeEach, describe, expect, it } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { ID_MEMORANDO, ID_MEMORANDO_V1, idDoItemPadrao } from '@/dados/carga-m06';
import { ID_CAMILA, ID_ENTIDADE_PLANEJADA, ID_KIMBERLY, ID_MARCA_KIPI, ID_MARCA_NUMA, ID_MARCA_ZARPA } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { garantirCarga } from '@/dados/carga';
import { MENSAGEM_DECISAO_IMUTAVEL } from '@/dados/decisao-imutavel';
import { cancelarVersao, confirmarAssinatura, criarAcordo, diferencasEntreVersoes, enviarParaRevisao, errosDoAcordo, faltaTitularidade, formularioAcordoVazio, novaVersao, pedirAssinaturas, pendenciasDaVigencia, registrarArquivoAssinado, salvarVersaoDoAcordo, formularioDaVersao, tornarVigente, voltarParaRevisao } from './acordos';
import { gerarAlertasM06, sincronizarAlertasDasMarcas, sincronizarAlertasDeTransferencia, sincronizarAlertasDosAcordos } from './alertas-m06';
import { concluirAtividade, estaAberta } from './atividades';
import { atividadesDoRegistro } from './atividades-painel';
import { itensATransferir } from './ativos-a-transferir';
import { marcarTransferenciaImpedida, registrarTransferencia, formularioTransferenciaVazio } from './ativos';
import { acordosParaEvidencia, carregarConstituicao, concluirItem, dependenciaCriaCiclo, errosDaConclusao, estadoDoItem, formularioItemVazio, iniciarChecklist, marcarNaoSeAplica, motivoDoBloqueio, progressoDoChecklist, reabrirItem, removerItem, responsabilidadeDaAtividade, salvarItem } from './constituicao';
import { carregarDadosDaJornada, marcosDaJornada } from './jornada';
import { adicionarPrazo, AVISO_NOME_PROVISORIO, avisoDaMarcaDoProduto, cumprirPrazo, errosDaPesquisa, errosDoProcesso, formularioPesquisaVazio, formularioProcessoVazio, marcaPrecisaDeAviso, registrarPesquisa, salvarProcesso, vincularTituloAoProcesso } from './marcas-inpi';
import { adicionarOcorrencia, chaveDoTitulo, errosDaObrigacao, formularioObrigacaoVazio, gerarOcorrenciasDasObrigacoes, MENSAGEM_ENTIDADE_PLANEJADA, MENSAGEM_FASE_DAS_OBRIGACOES, proximoVencimento, registrarCumprimento, salvarObrigacao, vencimentosAte } from './obrigacoes';
import { acoesDaReuniao, adicionarAcao, carregarReunioes, errosDoFormularioDecisao, formularioDecisaoVazio, formularioReuniaoVazio, registrarDecisao, salvarReuniao } from './reunioes';
import { somarDias } from './repeticao';
import { executarRotinas } from './rotinas';
import { alterarParticipacao, divergenciaDoAcordo, errosDaParticipacao, errosDaSaida, formularioDaParticipacao, formularioDaSaida, lerParticipacao, linhaDoTempoDaParticipacao, carregarSociedade, MENSAGEM_SOMA_100, registrarSaida, sociasAtivas, somaDasParticipacoes } from './sociedade';
import { decisoesParaVincular, novaDecisaoVazia } from './decisoes';
import { salvarEntidade, FORMULARIO_ENTIDADE_VAZIO, carregarEntidades, formularioDaEntidade, representantesDaEntidade } from './entidades';
import { atualizarSituacoesDosTitulos } from './titulos';

const HOJE = '2026-11-07';
const LINK = 'https://drive.google.com/file/d/abc/view';
const SEMANA = '2026-11-14';

let driver: Driver;

function comoPessoa(id: string) {
  gravarMeta({ pessoa_atual_id: id });
}

/** Leva o memorando até faltar só o que o teste quer ver. */
async function memorandoAguardando() {
  await enviarParaRevisao(ID_MEMORANDO_V1);
  await pedirAssinaturas(ID_MEMORANDO_V1);
}

async function memorandoVigente(titularidade = false) {
  if (titularidade) {
    const acordo = await repositorios.acordo_societario.obter(ID_MEMORANDO);
    const versao = await repositorios.acordo_versao.obter(ID_MEMORANDO_V1);
    await salvarVersaoDoAcordo(ID_MEMORANDO_V1, { ...formularioDaVersao(acordo!, versao!), titularidade_numa: true });
  }
  await memorandoAguardando();
  await registrarArquivoAssinado(ID_MEMORANDO_V1, { arquivo_url: LINK, data_assinatura: HOJE }, HOJE);
  comoPessoa(ID_KIMBERLY);
  await confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE);
  comoPessoa(ID_CAMILA);
  await confirmarAssinatura(ID_MEMORANDO_V1, ID_CAMILA, HOJE);
  comoPessoa(ID_KIMBERLY);
  await tornarVigente(ID_MEMORANDO_V1, HOJE);
}

const decisaoNova = (titulo = 'Mudança de participação') => ({ ...novaDecisaoVazia(HOJE, [ID_KIMBERLY]), titulo, descricao: 'O que foi decidido' });

async function ativarEntidade() {
  const dados = await carregarEntidades();
  const entidade = dados.entidades.find((item) => item.id === ID_ENTIDADE_PLANEJADA)!;
  await salvarEntidade(
    {
      ...formularioDaEntidade(entidade, representantesDaEntidade(entidade.id, dados.representantes)),
      documento: '11.222.333/0001-81',
      situacao: 'ativa',
      endereco: { ...FORMULARIO_ENTIDADE_VAZIO.endereco, cep: '20000-000', logradouro: 'Rua', numero: '1', bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'RJ' },
      representantes: [ID_KIMBERLY],
      data_abertura: '2026-11-01',
    },
    entidade.id,
  );
}

beforeEach(() => {
  esquecerMetaEmMemoria();
  driver = criarArmazenamentoEmMemoria();
  usarDriverDeTeste(driver);
  garantirCarga();
  gravarMeta({ pessoa_atual_id: ID_KIMBERLY });
});

describe('Carga inicial do M06', () => {
  it('traz as sócias com 50% cada, sem data de entrada inventada, e nada de exemplo', async () => {
    const socias = await repositorios.socia.listar();
    expect(socias.map((socia) => [socia.pessoa_id, socia.participacao, socia.entrada_em, socia.exemplo])).toEqual([
      [ID_KIMBERLY, 50, null, false],
      [ID_CAMILA, 50, null, false],
    ]);
  });

  it('o memorando nasce em rascunho, sem confirmação, arquivo ou data', async () => {
    const versao = await repositorios.acordo_versao.obter(ID_MEMORANDO_V1);
    expect(versao).toMatchObject({ situacao: 'rascunho', arquivo_url: null, data_assinatura: null, titularidade_numa: false });
    expect(await repositorios.acordo_assinatura.listar()).toEqual([]);
  });

  it('nada das imagens virou fato: sem pesquisa, processo, reunião, decisão ou obrigação', async () => {
    expect(await repositorios.marca_pesquisa.listar()).toEqual([]);
    expect(await repositorios.marca_processo.listar()).toEqual([]);
    expect(await repositorios.reuniao.listar()).toEqual([]);
    expect(await repositorios.decisao.listar()).toEqual([]);
    expect(await repositorios.obrigacao_corporativa.listar()).toEqual([]);
  });

  it('o checklist tem os 17 itens, com as dependências da especificação', async () => {
    const itens = await repositorios.constituicao_item.listar();
    expect(itens).toHaveLength(17);
    expect(itens.find((item) => item.ordem === 6)?.depende_de).toEqual([idDoItemPadrao(1), idDoItemPadrao(3)]);
    expect(itens.find((item) => item.ordem === 15)?.depende_de).toEqual([idDoItemPadrao(9), idDoItemPadrao(10)]);
    expect(itens.find((item) => item.ordem === 16)?.depende_de).toEqual([idDoItemPadrao(3), idDoItemPadrao(8)]);
    expect(itens.filter((item) => item.exige_evidencia)).toHaveLength(13);
  });

  it('quem já usa a Central recebe as tabelas sem perder nada', async () => {
    const socia = (await repositorios.socia.listar())[0]!;
    await repositorios.socia.atualizar(socia.id, { entrada_em: '2025-01-01' });
    driver.removeItem(chaveDaTabela('marca_pesquisa'));
    driver.removeItem(chaveDaTabela('constituicao_item'));
    gravarMeta({ versao_dados: 17 });
    garantirCarga();
    expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    expect(await repositorios.marca_pesquisa.listar()).toEqual([]);
    expect(await repositorios.constituicao_item.listar()).toHaveLength(17);
    expect((await repositorios.socia.obter(socia.id))?.entrada_em).toBe('2025-01-01');
  });
});

describe('T06.02: participação', () => {
  const entrada = async () => {
    const dados = await carregarSociedade();
    return formularioDaParticipacao(dados, ID_KIMBERLY, HOJE);
  };

  it('lê percentuais em português e fecha a soma', () => {
    expect(lerParticipacao('33,3333')).toBe(33.3333);
    expect(lerParticipacao('101')).toBeNull();
    expect(lerParticipacao('')).toBeNull();
    expect(somaDasParticipacoes([50, 40])).toBe(90);
  });

  it('CA-06.02: somar 90% é bloqueado', async () => {
    const formulario = await entrada();
    formulario.linhas[1]!.percentual = '40';
    formulario.fundamento_tipo = 'decisao';
    formulario.decisao = decisaoNova();
    expect(errosDaParticipacao(formulario, { hoje: HOJE, ultimaVigencia: null }).total).toBe(MENSAGEM_SOMA_100);
    await expect(alterarParticipacao(formulario, HOJE)).rejects.toThrow(MENSAGEM_SOMA_100);
    expect((await repositorios.socia.listar()).map((socia) => socia.participacao)).toEqual([50, 50]);
    expect(await repositorios.decisao.listar()).toEqual([]);
  });

  it('RN-06.02: sem fundamento não salva, e versão que não está vigente não serve', async () => {
    const formulario = await entrada();
    formulario.linhas[0]!.percentual = '60';
    formulario.linhas[1]!.percentual = '40';
    expect(errosDaParticipacao(formulario, { hoje: HOJE, ultimaVigencia: null }).acordo_versao_id).toBeTruthy();
    await expect(alterarParticipacao({ ...formulario, acordo_versao_id: ID_MEMORANDO_V1 }, HOJE)).rejects.toThrow('não está vigente');
    expect((await repositorios.socia.listar()).map((socia) => socia.participacao)).toEqual([50, 50]);
  });

  it('com decisão de fundamento, grava a participação e o histórico, tudo junto', async () => {
    const formulario = await entrada();
    formulario.linhas[0]!.percentual = '60';
    formulario.linhas[1]!.percentual = '40';
    formulario.fundamento_tipo = 'decisao';
    formulario.decisao = decisaoNova();
    await alterarParticipacao(formulario, HOJE);
    const socias = await repositorios.socia.listar();
    expect(socias.map((socia) => socia.participacao)).toEqual([60, 40]);
    const [decisao] = await repositorios.decisao.listar();
    expect(socias[0]?.decisao_id).toBe(decisao?.id);
    expect(socias[0]?.acordo_versao_id).toBeNull();
    const dados = await carregarSociedade();
    const linha = linhaDoTempoDaParticipacao(dados);
    expect(linha).toHaveLength(1);
    expect(linha[0]?.linhas.map((item) => item.participacao).sort()).toEqual([40, 60]);
    expect(linha[0]?.fundamento.texto).toContain(decisao?.codigo);
  });

  it('as mesmas participações não geram histórico', async () => {
    const formulario = await entrada();
    formulario.fundamento_tipo = 'decisao';
    formulario.decisao = decisaoNova();
    await expect(alterarParticipacao(formulario, HOJE)).rejects.toThrow('não há o que registrar');
    expect(await repositorios.socia_participacao_historico.listar()).toEqual([]);
  });

  it('avisa quando o acordo vigente traz outra participação; não aplica sozinho', async () => {
    const acordo = await repositorios.acordo_societario.obter(ID_MEMORANDO);
    const versao = await repositorios.acordo_versao.obter(ID_MEMORANDO_V1);
    await salvarVersaoDoAcordo(ID_MEMORANDO_V1, { ...formularioDaVersao(acordo!, versao!), participacao: { [ID_KIMBERLY]: '70', [ID_CAMILA]: '30' } });
    await memorandoVigente();
    const dados = await carregarSociedade();
    expect(divergenciaDoAcordo(dados, HOJE)?.versao.id).toBe(ID_MEMORANDO_V1);
    expect(dados.socias.map((socia) => socia.participacao)).toEqual([50, 50]);
  });

  it('saída: exige motivo e fundamento, quem fica soma 100%, e a pessoa não some', async () => {
    const dados = await carregarSociedade();
    const formulario = formularioDaSaida(dados, ID_CAMILA, ID_KIMBERLY, HOJE);
    expect(formulario.linhas.map((linha) => linha.pessoa_id)).toEqual([ID_KIMBERLY]);
    const erros = errosDaSaida(formulario, { hoje: HOJE, ultimaVigencia: null });
    expect(erros.motivo).toBeTruthy();
    expect(erros.total).toBeTruthy();
    formulario.motivo = 'Decisão pessoal';
    formulario.linhas[0]!.percentual = '100';
    formulario.fundamento_tipo = 'decisao';
    formulario.decisao = decisaoNova('Saída da sócia');
    await registrarSaida(formulario, HOJE);
    const socias = await repositorios.socia.listar();
    expect(sociasAtivas(socias, HOJE).map((socia) => socia.pessoa_id)).toEqual([ID_KIMBERLY]);
    expect(socias.find((socia) => socia.pessoa_id === ID_CAMILA)).toMatchObject({ saida_em: HOJE, participacao: 0 });
    expect(await repositorios.pessoa.obter(ID_CAMILA)).toBeTruthy();
    expect((await repositorios.socia_participacao_historico.listar()).filter((linha) => linha.pessoa_id === ID_CAMILA).map((linha) => linha.participacao)).toEqual([0]);
  });

  it('a última sócia não sai, e quem saiu não decide nem precisa confirmar', async () => {
    const dados = await carregarSociedade();
    const saida = { ...formularioDaSaida(dados, ID_CAMILA, ID_KIMBERLY, HOJE), motivo: 'Motivo', fundamento_tipo: 'decisao' as const, decisao: decisaoNova('Saída') };
    saida.linhas[0]!.percentual = '100';
    await registrarSaida(saida, HOJE);
    const depois = await carregarSociedade();
    const ultima = { ...formularioDaSaida(depois, ID_KIMBERLY, ID_KIMBERLY, HOJE), motivo: 'Motivo', fundamento_tipo: 'decisao' as const, decisao: decisaoNova('Outra') };
    expect(errosDaSaida(ultima, { hoje: HOJE, ultimaVigencia: null }).total).toContain('pelo menos uma');
    const opcoes = await decisoesParaVincular({ produto_id: null, assunto: 'geral' });
    expect(opcoes.length).toBeGreaterThan(0);
    await expect(registrarDecisao({ ...formularioDecisaoVazio(ID_KIMBERLY, [], HOJE), titulo: 'X', descricao: 'Y', decisores: [ID_CAMILA] }, HOJE)).rejects.toThrow('sócia ativa');
    const versao = (await repositorios.acordo_versao.obter(ID_MEMORANDO_V1))!;
    const acordo = (await repositorios.acordo_societario.obter(ID_MEMORANDO))!;
    expect(pendenciasDaVigencia({ acordo, versao, assinaturas: [], socias: depois.socias, pessoas: depois.pessoas, hoje: HOJE }).some((linha) => linha.includes('Camila'))).toBe(false);
  });
});

describe('T06.03: acordos, versões e vigência', () => {
  it('CA-06.03: sem a confirmação de Camila, não fica vigente, mesmo com arquivo e data', async () => {
    await memorandoAguardando();
    await registrarArquivoAssinado(ID_MEMORANDO_V1, { arquivo_url: LINK, data_assinatura: HOJE }, HOJE);
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE);
    await expect(tornarVigente(ID_MEMORANDO_V1, HOJE)).rejects.toThrow('Falta a confirmação de Camila Lima');
    expect((await repositorios.acordo_versao.obter(ID_MEMORANDO_V1))?.situacao).toBe('aguardando_assinaturas');
  });

  it('sem arquivo ou sem data, também não', async () => {
    await memorandoAguardando();
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE);
    comoPessoa(ID_CAMILA);
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_CAMILA, HOJE);
    await expect(tornarVigente(ID_MEMORANDO_V1, HOJE)).rejects.toThrow('arquivo assinado');
    await expect(registrarArquivoAssinado(ID_MEMORANDO_V1, { arquivo_url: 'https://exemplo.com/x', data_assinatura: HOJE }, HOJE)).rejects.toThrow('drive.google.com');
    await expect(registrarArquivoAssinado(ID_MEMORANDO_V1, { arquivo_url: LINK, data_assinatura: '2027-01-01' }, HOJE)).rejects.toThrow('passada');
  });

  it('RN-06.04: cada sócia confirma a própria; repetir não duplica', async () => {
    await memorandoAguardando();
    await expect(confirmarAssinatura(ID_MEMORANDO_V1, ID_CAMILA, HOJE)).rejects.toThrow('não pode confirmar em nome de Camila Lima');
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE);
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE);
    expect(await repositorios.acordo_assinatura.listar()).toHaveLength(1);
  });

  it('não confirma antes de pedir as assinaturas, e o fluxo não pula etapas', async () => {
    await expect(confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE)).rejects.toThrow('não está aguardando');
    await expect(pedirAssinaturas(ID_MEMORANDO_V1)).rejects.toThrow('em revisão');
    await expect(tornarVigente(ID_MEMORANDO_V1, HOJE)).rejects.toThrow('aguardando assinaturas');
  });

  it('participação que não soma 100% não vai para assinatura', async () => {
    const acordo = (await repositorios.acordo_societario.obter(ID_MEMORANDO))!;
    const versao = (await repositorios.acordo_versao.obter(ID_MEMORANDO_V1))!;
    await salvarVersaoDoAcordo(ID_MEMORANDO_V1, { ...formularioDaVersao(acordo, versao), participacao: { [ID_KIMBERLY]: '50', [ID_CAMILA]: '40' } });
    await enviarParaRevisao(ID_MEMORANDO_V1);
    await expect(pedirAssinaturas(ID_MEMORANDO_V1)).rejects.toThrow('somar 100%');
  });

  it('RN-06.03: só uma vigente por acordo; a anterior fica Substituída, com o conteúdo preservado', async () => {
    await memorandoVigente(true);
    const nova = await novaVersao(ID_MEMORANDO);
    expect(nova).toMatchObject({ numero: 2, situacao: 'rascunho', titularidade_numa: true, arquivo_url: null, data_assinatura: null });
    const acordo = (await repositorios.acordo_societario.obter(ID_MEMORANDO))!;
    await salvarVersaoDoAcordo(nova.id, { ...formularioDaVersao(acordo, nova), decisao: 'Decisões por unanimidade.' });
    await enviarParaRevisao(nova.id);
    await pedirAssinaturas(nova.id);
    await registrarArquivoAssinado(nova.id, { arquivo_url: LINK, data_assinatura: HOJE }, HOJE);
    await confirmarAssinatura(nova.id, ID_KIMBERLY, HOJE);
    comoPessoa(ID_CAMILA);
    await confirmarAssinatura(nova.id, ID_CAMILA, HOJE);
    await tornarVigente(nova.id, HOJE);
    const versoes = await repositorios.acordo_versao.listar({ onde: { acordo_id: ID_MEMORANDO } });
    expect(versoes.filter((versao) => versao.situacao === 'vigente').map((versao) => versao.numero)).toEqual([2]);
    const antiga = versoes.find((versao) => versao.numero === 1);
    expect(antiga).toMatchObject({ situacao: 'substituida', arquivo_url: LINK });
    expect((await repositorios.acordo_societario.obter(ID_MEMORANDO))?.versao_vigente_id).toBe(nova.id);
    const pessoas = await repositorios.pessoa.listar();
    const atual = versoes.find((versao) => versao.numero === 2)!;
    expect(diferencasEntreVersoes(antiga!, atual, { pessoas, entidades: [] }).map((linha) => linha.campo)).toEqual(['Regras de decisão']);
  });

  it('só uma versão em andamento por vez; vigente não se cancela', async () => {
    await expect(novaVersao(ID_MEMORANDO)).rejects.toThrow('em andamento');
    await memorandoVigente();
    await expect(cancelarVersao(ID_MEMORANDO_V1, 'Motivo')).rejects.toThrow('em andamento');
    const nova = await novaVersao(ID_MEMORANDO);
    await cancelarVersao(nova.id, 'Desistimos');
    expect(await repositorios.acordo_versao.obter(nova.id)).toMatchObject({ situacao: 'cancelada', cancelada_motivo: 'Desistimos' });
    expect((await repositorios.acordo_versao.obter(ID_MEMORANDO_V1))?.situacao).toBe('vigente');
  });

  it('assinatura trava o conteúdo; voltar para revisão invalida o que foi assinado', async () => {
    await memorandoAguardando();
    await registrarArquivoAssinado(ID_MEMORANDO_V1, { arquivo_url: LINK, data_assinatura: HOJE }, HOJE);
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE);
    const acordo = (await repositorios.acordo_societario.obter(ID_MEMORANDO))!;
    const versao = (await repositorios.acordo_versao.obter(ID_MEMORANDO_V1))!;
    await expect(salvarVersaoDoAcordo(ID_MEMORANDO_V1, formularioDaVersao(acordo, versao))).rejects.toThrow('não pode mais ser editada');
    await expect(voltarParaRevisao(ID_MEMORANDO_V1, '')).rejects.toThrow('motivo');
    await voltarParaRevisao(ID_MEMORANDO_V1, 'Faltou uma cláusula');
    expect(await repositorios.acordo_versao.obter(ID_MEMORANDO_V1)).toMatchObject({ situacao: 'em_revisao', arquivo_url: null, data_assinatura: null });
    expect(await repositorios.acordo_assinatura.listar()).toEqual([]);
  });

  it('RN-06.06: o alerta sai só com acordo vigente que marca a titularidade', async () => {
    expect(faltaTitularidade(await repositorios.acordo_versao.listar())).toBe(true);
    await memorandoVigente();
    expect(faltaTitularidade(await repositorios.acordo_versao.listar())).toBe(true);
    const nova = await novaVersao(ID_MEMORANDO);
    await repositorios.acordo_versao.atualizar(nova.id, { titularidade_numa: true });
    expect(faltaTitularidade(await repositorios.acordo_versao.listar())).toBe(true);
    await enviarParaRevisao(nova.id);
    await pedirAssinaturas(nova.id);
    await registrarArquivoAssinado(nova.id, { arquivo_url: LINK, data_assinatura: HOJE }, HOJE);
    await confirmarAssinatura(nova.id, ID_KIMBERLY, HOJE);
    comoPessoa(ID_CAMILA);
    await confirmarAssinatura(nova.id, ID_CAMILA, HOJE);
    await tornarVigente(nova.id, HOJE);
    expect(faltaTitularidade(await repositorios.acordo_versao.listar())).toBe(false);
  });

  it('novo acordo: exige título, e valida o que foi preenchido', async () => {
    const socias = await repositorios.socia.listar();
    const vazio = formularioAcordoVazio(socias);
    expect(errosDoAcordo(vazio).titulo).toBeTruthy();
    expect(errosDoAcordo({ ...vazio, titulo: 'X', participacao: { [ID_KIMBERLY]: 'abc' } })[`participacao_${ID_KIMBERLY}`]).toBeTruthy();
    const criado = await criarAcordo({ ...vazio, titulo: 'Termo de cessão de PI', tipo: 'cessao_pi' });
    expect(criado.codigo).toMatch(/^ACO-\d{4}-0002$/);
    expect(await repositorios.acordo_versao.listar({ onde: { acordo_id: criado.id } })).toHaveLength(1);
  });

  it('revisão prevista: alerta 30 dias antes, sem duplicar, e sai com a revisão', async () => {
    const acordo = (await repositorios.acordo_societario.obter(ID_MEMORANDO))!;
    const versao = (await repositorios.acordo_versao.obter(ID_MEMORANDO_V1))!;
    await salvarVersaoDoAcordo(ID_MEMORANDO_V1, { ...formularioDaVersao(acordo, versao), revisao_prevista: '2026-12-01' });
    await memorandoVigente();
    expect(await sincronizarAlertasDosAcordos('2026-10-31')).toBe(0);
    const alertas = () => repositorios.atividade.listar({ onde: { origem_tipo: 'acordo_societario' } });
    expect(await alertas()).toHaveLength(1);
    await sincronizarAlertasDosAcordos(HOJE);
    expect(await alertas()).toHaveLength(1);
    expect((await atividadesDoRegistro('acordo_societario', ID_MEMORANDO)).length).toBe(1);
  });
});

describe('T06.04: ativos a transferir', () => {
  const fontes = async () => {
    const [ativos, ferramentas, contextos, pessoas] = await Promise.all([repositorios.ativo_digital.listar(), repositorios.ferramenta.listar(), repositorios.ferramenta_contexto.listar(), repositorios.pessoa.listar()]);
    return itensATransferir({ ativos, ferramentas, contextos, pessoas });
  };

  it('a lista sai de ativos e ferramentas com titular diferente do desejado', async () => {
    const itens = await fontes();
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.some((item) => item.origem === 'ativo')).toBe(true);
    for (const item of itens) expect(item.titularAtual).not.toBe(item.titularDesejado);
  });

  it('o requisito é o de cada ativo: não há bloqueio geral', async () => {
    const [ativo] = (await fontes()).filter((item) => item.origem === 'ativo');
    await repositorios.ativo_digital.atualizar(ativo!.id, { requisito_transferencia: 'Exige conta de organização' });
    const itens = await fontes();
    expect(itens.find((item) => item.id === ativo!.id)?.requisito).toBe('Exige conta de organização');
    expect(itens.filter((item) => item.id !== ativo!.id && item.requisito === 'Exige conta de organização')).toEqual([]);
  });

  it('gerar é idempotente, e nada nasce sozinho com a entidade planejada', async () => {
    expect(await sincronizarAlertasDeTransferencia()).toBe(0);
    const itens = await fontes();
    expect(await sincronizarAlertasDeTransferencia({ gerar: true })).toBe(itens.length);
    expect(await sincronizarAlertasDeTransferencia({ gerar: true })).toBe(0);
    await sincronizarAlertasDeTransferencia();
    const alertas = await repositorios.atividade.listar({ onde: { origem_tipo: 'transferencia' } });
    expect(alertas).toHaveLength(itens.length);
    expect(alertas.every((alerta) => alerta.prazo === null && estaAberta(alerta))).toBe(true);
  });

  it('RN-06.07: entidade PJ Ativa gera as atividades, uma vez só', async () => {
    const itens = await fontes();
    await ativarEntidade();
    const alertas = () => repositorios.atividade.listar({ onde: { origem_tipo: 'transferencia' } });
    expect(await alertas()).toHaveLength(itens.length);
    await sincronizarAlertasDeTransferencia();
    await gerarAlertasM06(HOJE);
    expect(await alertas()).toHaveLength(itens.length);
  });

  it('atividade aberta já ligada ao item é reaproveitada', async () => {
    const [item] = (await fontes()).filter((linha) => linha.origem === 'ativo');
    const tarefa = await repositorios.atividade.listar();
    const aberta = tarefa.find(estaAberta)!;
    await repositorios.vinculo.criar({ origem_tipo: 'ativo_digital', origem_id: item!.id, destino_tipo: 'atividade', destino_id: aberta.id });
    await sincronizarAlertasDeTransferencia({ gerar: true });
    expect((await repositorios.atividade.listar({ onde: { origem_tipo: 'transferencia', origem_id: item!.id } })).length).toBe(0);
  });

  it('o fluxo do M04 resolve o alerta e tira da lista; concluir o alerta à mão não transfere', async () => {
    const [item] = (await fontes()).filter((linha) => linha.origem === 'ativo');
    await sincronizarAlertasDeTransferencia({ gerar: true });
    const [alerta] = await repositorios.atividade.listar({ onde: { origem_tipo: 'transferencia', origem_id: item!.id } });
    expect((await atividadesDoRegistro('ativo_digital', item!.id)).map((atividade) => atividade.id)).toContain(alerta!.id);
    await concluirAtividade(alerta!.id, ID_KIMBERLY);
    expect((await fontes()).some((linha) => linha.id === item!.id)).toBe(true);
    await registrarTransferencia(item!.id, { ...formularioTransferenciaVazio(HOJE), evidencia: LINK });
    expect((await fontes()).some((linha) => linha.id === item!.id)).toBe(false);
  });

  it('o alerta aberto se resolve na hora da transferência, com a nota do sistema', async () => {
    const [item] = (await fontes()).filter((linha) => linha.origem === 'ativo');
    await sincronizarAlertasDeTransferencia({ gerar: true });
    await registrarTransferencia(item!.id, { ...formularioTransferenciaVazio(HOJE), evidencia: LINK });
    const [alerta] = await repositorios.atividade.listar({ onde: { origem_tipo: 'transferencia', origem_id: item!.id } });
    expect(alerta).toMatchObject({ situacao: 'concluida', concluida_por: null, conclusao_nota: 'Concluído: a transferência foi registrada.' });
  });

  it('impedida exige motivo, e o motivo aparece na lista', async () => {
    const [item] = (await fontes()).filter((linha) => linha.origem === 'ativo');
    await expect(marcarTransferenciaImpedida(item!.id, ' ')).rejects.toThrow('impede');
    await marcarTransferenciaImpedida(item!.id, 'Exige entidade ativa');
    expect((await fontes()).find((linha) => linha.id === item!.id)).toMatchObject({ situacao: 'impedida', impedimento: 'Exige entidade ativa' });
  });
});

describe('T06.05: marcas', () => {
  it('CA-06.04: provisória sem pesquisa mostra o aviso; registrar a pesquisa tira', async () => {
    expect(await avisoDaMarcaDoProduto(ID_MARCA_ZARPA)).toBe(AVISO_NOME_PROVISORIO);
    expect(await avisoDaMarcaDoProduto(ID_MARCA_KIPI)).toBeNull();
    await registrarPesquisa({ ...formularioPesquisaVazio(ID_MARCA_ZARPA, ID_KIMBERLY, HOJE), resultado: 'disponivel' }, HOJE);
    expect(await avisoDaMarcaDoProduto(ID_MARCA_ZARPA)).toBeNull();
    expect(marcaPrecisaDeAviso({ id: 'x', provisorio: true, arquivado_em: null }, [])).toBe(true);
  });

  it('pesquisa: data, quem fez e resultado; link só do Drive', () => {
    const vazio = { ...formularioPesquisaVazio(ID_MARCA_ZARPA, '', HOJE), data: '' };
    expect(Object.keys(errosDaPesquisa(vazio, HOJE)).sort()).toEqual(['data', 'feita_por', 'resultado']);
    expect(errosDaPesquisa({ ...formularioPesquisaVazio(ID_MARCA_ZARPA, ID_KIMBERLY, HOJE), resultado: 'disponivel', evidencia_url: 'https://inpi.gov.br' }, HOJE).evidencia_url).toBeTruthy();
  });

  it('processo: Planejada vale como intenção; protocolo exige titular real, número e data', async () => {
    const entidades = await repositorios.entidade.listar();
    const base = { ...formularioProcessoVazio(ID_MARCA_NUMA), classes: '42', apresentacao: 'nominativa', titular_entidade_id: ID_ENTIDADE_PLANEJADA };
    expect(errosDoProcesso(base, entidades, HOJE)).toEqual({});
    const protocolado = { ...base, situacao: 'protocolado' as const };
    expect(Object.keys(errosDoProcesso(protocolado, entidades, HOJE)).sort()).toEqual(['data_deposito', 'numero_processo', 'titular_entidade_id']);
    await expect(salvarProcesso(protocolado, undefined, HOJE)).rejects.toThrow('A partir de Protocolado');
    await ativarEntidade();
    const salvo = await salvarProcesso({ ...protocolado, numero_processo: '912345678', data_deposito: HOJE }, undefined, HOJE);
    expect(salvo).toMatchObject({ situacao: 'protocolado', numero_processo: '912345678' });
  });

  it('RN-06.09: prazo gera alerta na janela, sem duplicar; cumprir resolve', async () => {
    const processo = await salvarProcesso({ ...formularioProcessoVazio(ID_MARCA_NUMA), classes: '42', apresentacao: 'nominativa', titular_entidade_id: ID_ENTIDADE_PLANEJADA }, undefined, HOJE);
    const { alerta_dominio_dias: dias } = await repositorios.configuracao.ler();
    const limite = somarDias(HOJE, dias);
    const prazo = await adicionarPrazo(processo.id, { descricao: 'Responder exigência', data_limite: limite, responsavel_id: ID_KIMBERLY });
    const alertas = () => repositorios.atividade.listar({ onde: { origem_tipo: 'marca_prazo' } });
    await sincronizarAlertasDasMarcas(somarDias(HOJE, -1));
    expect((await alertas()).filter(estaAberta)).toHaveLength(0);
    await sincronizarAlertasDasMarcas(HOJE);
    await sincronizarAlertasDasMarcas(HOJE);
    expect((await alertas()).filter(estaAberta)).toHaveLength(1);
    expect((await alertas()).find(estaAberta)).toMatchObject({ situacao: 'a_fazer', responsavel_id: ID_KIMBERLY, prazo: limite });
    await cumprirPrazo(prazo.id, HOJE, HOJE);
    expect((await alertas()).filter(estaAberta)).toHaveLength(0);
  });

  it('custo é o título do M05, vinculado uma vez só', async () => {
    const processo = await salvarProcesso({ ...formularioProcessoVazio(ID_MARCA_NUMA), classes: '42', apresentacao: 'nominativa', titular_entidade_id: ID_ENTIDADE_PLANEJADA }, undefined, HOJE);
    const [titulo] = await repositorios.titulo.listar();
    await vincularTituloAoProcesso(processo.id, titulo!.id);
    await vincularTituloAoProcesso(processo.id, titulo!.id);
    expect((await repositorios.vinculo.listar()).filter((vinculo) => [vinculo.origem_id, vinculo.destino_id].includes(processo.id))).toHaveLength(1);
  });
});

describe('T06.06: constituição', () => {
  it('CA-06.05: o item 6 fica bloqueado até 1 e 3, com o motivo', async () => {
    const dados = await carregarConstituicao();
    const seis = dados.itens.find((item) => item.ordem === 6)!;
    expect(estadoDoItem(seis, dados.itens)).toBe('bloqueado');
    expect(motivoDoBloqueio(seis, dados.itens)).toBe('Depende de: Memorando entre sócias vigente, Definir tipo societário e regime tributário com o contador');
    await expect(concluirItem(seis.id, { evidencia_url: LINK, evidencia_registro_id: '' }, HOJE)).rejects.toThrow('Depende de');
    expect((await repositorios.constituicao_item.obter(seis.id))?.situacao).toBe('a_fazer');
    expect(progressoDoChecklist(dados.itens)).toMatchObject({ concluidos: 0, total: 17 });
  });

  it('RN-06.10: concluir exige a evidência do tipo certo', async () => {
    const dois = idDoItemPadrao(2);
    await concluirItem(dois, { evidencia_url: '', evidencia_registro_id: '' }, HOJE);
    const tres = idDoItemPadrao(3);
    await expect(concluirItem(tres, { evidencia_url: LINK, evidencia_registro_id: '' }, HOJE)).rejects.toThrow('decisão registrada');
    const decisao = await registrarDecisao({ ...formularioDecisaoVazio(ID_KIMBERLY, [{ id: ID_KIMBERLY }], HOJE), titulo: 'Tipo e regime', descricao: 'Definidos com o contador' }, HOJE);
    await concluirItem(tres, { evidencia_url: '', evidencia_registro_id: decisao.id }, HOJE);
    expect(await repositorios.constituicao_item.obter(tres)).toMatchObject({ situacao: 'concluido', evidencia_registro_id: decisao.id, concluido_em: HOJE });
    const quatro = idDoItemPadrao(4);
    await expect(concluirItem(quatro, { evidencia_url: '', evidencia_registro_id: '' }, HOJE)).rejects.toThrow('exige evidência');
    await expect(concluirItem(quatro, { evidencia_url: 'https://exemplo.com', evidencia_registro_id: '' }, HOJE)).rejects.toThrow('drive.google.com');
    await concluirItem(quatro, { evidencia_url: LINK, evidencia_registro_id: '' }, HOJE);
  });

  it('o item 1 só aceita memorando ou acordo de sócias vigente', async () => {
    const um = idDoItemPadrao(1);
    expect(acordosParaEvidencia({ chave: 'memorando' }, await carregarConstituicao())).toEqual([]);
    await expect(concluirItem(um, { evidencia_url: '', evidencia_registro_id: ID_MEMORANDO }, HOJE)).rejects.toThrow('acordo vigente');
    await memorandoVigente();
    await concluirItem(um, { evidencia_url: '', evidencia_registro_id: ID_MEMORANDO }, HOJE);
    expect((await repositorios.constituicao_item.obter(um))?.situacao).toBe('concluido');
    expect(acordosParaEvidencia({ chave: 'cessao_pi' }, await carregarConstituicao())).toEqual([]);
  });

  it('RN-06.11: o item do CNPJ só conclui com a entidade Ativa', async () => {
    const dados = await carregarConstituicao();
    const cnpj = dados.itens.find((item) => item.chave === 'cnpj')!;
    const semDependencias = dados.itens.map((item) => ({ ...item, situacao: 'concluido' as const, concluido_em: HOJE }));
    expect(errosDaConclusao(cnpj, { evidencia_url: LINK, evidencia_registro_id: '' }, { ...dados, itens: semDependencias }).entidade).toBeTruthy();
    await ativarEntidade();
    const depois = await carregarConstituicao();
    expect(errosDaConclusao(cnpj, { evidencia_url: LINK, evidencia_registro_id: '' }, { ...depois, itens: semDependencias })).toEqual({});
    await expect(marcarNaoSeAplica(cnpj.id, 'Sem CNPJ')).rejects.toThrow('não pode ficar de fora');
    await expect(removerItem(cnpj.id)).rejects.toThrow('não pode sair');
  });

  it('o item da conta PJ pede a conta da entidade Ativa', async () => {
    await ativarEntidade();
    const dados = await carregarConstituicao();
    const conta = dados.itens.find((item) => item.chave === 'conta_pj')!;
    const liberados = dados.itens.map((item) => ({ ...item, situacao: 'concluido' as const, concluido_em: HOJE }));
    expect(errosDaConclusao(conta, { evidencia_url: LINK, evidencia_registro_id: '' }, { ...dados, itens: liberados }).conta).toBeTruthy();
    await repositorios.conta_financeira.criar({ nome: 'Conta PJ', tipo: 'banco', titular_entidade_id: ID_ENTIDADE_PLANEJADA, titular_pessoa_id: null, instituicao: null, final_numero: null, moeda: 'BRL', saldo_inicial: null, data_saldo_inicial: null, situacao: 'ativa' });
    const depois = await carregarConstituicao();
    expect(errosDaConclusao(conta, { evidencia_url: LINK, evidencia_registro_id: '' }, { ...depois, itens: liberados }).conta).toBeUndefined();
  });

  it('o item de transferir ativos só conclui sem pendência em T06.04', async () => {
    const dados = await carregarConstituicao();
    const item = dados.itens.find((linha) => linha.chave === 'transferir_ativos')!;
    const liberados = dados.itens.map((linha) => ({ ...linha, situacao: 'concluido' as const, concluido_em: HOJE }));
    expect(errosDaConclusao(item, { evidencia_url: '', evidencia_registro_id: '' }, { ...dados, itens: liberados }).ativos).toContain('Ativos a transferir');
    expect(errosDaConclusao(item, { evidencia_url: '', evidencia_registro_id: '' }, { ...dados, itens: liberados, pendentesDeTransferencia: [] }).ativos).toBeUndefined();
  });

  it('"Não se aplica" exige motivo, libera quem depende e sai do total', async () => {
    await expect(marcarNaoSeAplica(idDoItemPadrao(2), '')).rejects.toThrow('motivo');
    await marcarNaoSeAplica(idDoItemPadrao(2), 'Já temos');
    const dados = await carregarConstituicao();
    const tres = dados.itens.find((item) => item.ordem === 3)!;
    expect(estadoDoItem(tres, dados.itens)).toBe('a_fazer');
    expect(progressoDoChecklist(dados.itens).total).toBe(16);
  });

  it('iniciar é idempotente: uma atividade por item, a mesma do Meu dia, bloqueada se depender de outro', async () => {
    const criadas = await iniciarChecklist(HOJE);
    expect(criadas).toBe(17);
    expect(await iniciarChecklist(HOJE)).toBe(0);
    const atividades = await repositorios.atividade.listar({ onde: { origem_tipo: 'constituicao_item' } });
    expect(atividades).toHaveLength(17);
    const seis = (await repositorios.constituicao_item.obter(idDoItemPadrao(6)))!;
    const daSeis = atividades.find((atividade) => atividade.id === seis.atividade_id)!;
    expect(daSeis.bloqueada).toBe(true);
    expect(daSeis.bloqueio_motivo).toContain('Depende de');
    expect((await atividadesDoRegistro('constituicao_item', seis.id)).map((atividade) => atividade.id)).toEqual([daSeis.id]);
  });

  it('concluir o item conclui a atividade e libera o bloqueio do próximo; o contrário não conclui o item', async () => {
    await iniciarChecklist(HOJE);
    const dois = (await repositorios.constituicao_item.obter(idDoItemPadrao(2)))!;
    const tres = (await repositorios.constituicao_item.obter(idDoItemPadrao(3)))!;
    expect((await repositorios.atividade.obter(tres.atividade_id!))?.bloqueada).toBe(true);
    await concluirItem(dois.id, { evidencia_url: '', evidencia_registro_id: '' }, HOJE);
    expect((await repositorios.atividade.obter(dois.atividade_id!))?.situacao).toBe('concluida');
    expect((await repositorios.atividade.obter(tres.atividade_id!))?.bloqueada).toBe(false);
    const quatro = (await repositorios.constituicao_item.obter(idDoItemPadrao(10)))!;
    await concluirAtividade(quatro.atividade_id!, ID_KIMBERLY);
    expect((await repositorios.constituicao_item.obter(quatro.id))?.situacao).toBe('a_fazer');
  });

  it('reabrir exige motivo e não passa por cima de quem já concluiu', async () => {
    await iniciarChecklist(HOJE);
    await concluirItem(idDoItemPadrao(2), { evidencia_url: '', evidencia_registro_id: '' }, HOJE);
    const decisao = await registrarDecisao({ ...formularioDecisaoVazio(ID_KIMBERLY, [{ id: ID_KIMBERLY }], HOJE), titulo: 'Regime', descricao: 'Decidido' }, HOJE);
    await concluirItem(idDoItemPadrao(3), { evidencia_url: '', evidencia_registro_id: decisao.id }, HOJE);
    await expect(reabrirItem(idDoItemPadrao(2), 'Motivo')).rejects.toThrow('Reabra antes');
    await expect(reabrirItem(idDoItemPadrao(3), '')).rejects.toThrow('motivo');
    await reabrirItem(idDoItemPadrao(3), 'Faltou conferir');
    const item = (await repositorios.constituicao_item.obter(idDoItemPadrao(3)))!;
    expect(item).toMatchObject({ situacao: 'a_fazer', concluido_em: null });
    expect((await repositorios.atividade.obter(item.atividade_id!))?.situacao).toBe('a_fazer');
  });

  it('o checklist é editável: item novo, sem ciclo, e quem tem dependente não sai', async () => {
    await iniciarChecklist(HOJE);
    const novo = await salvarItem({ ...formularioItemVazio(ID_CAMILA), titulo: 'Alvará', depende_de: [idDoItemPadrao(8)] }, undefined, HOJE);
    expect(novo).toMatchObject({ ordem: 18, chave: null, responsavel_id: ID_CAMILA });
    const comAtividade = (await repositorios.constituicao_item.obter(novo.id))!;
    expect(comAtividade.atividade_id).toBeTruthy();
    expect((await repositorios.atividade.obter(comAtividade.atividade_id!))?.bloqueada).toBe(true);
    const itens = await repositorios.constituicao_item.listar();
    expect(dependenciaCriaCiclo(idDoItemPadrao(8), [novo.id], itens)).toBe(true);
    expect(dependenciaCriaCiclo(idDoItemPadrao(9), [idDoItemPadrao(2)], itens)).toBe(false);
    await expect(removerItem(idDoItemPadrao(8))).rejects.toThrow();
    await expect(removerItem(idDoItemPadrao(2))).rejects.toThrow('Tire a dependência');
    await removerItem(novo.id);
    expect((await repositorios.atividade.obter(comAtividade.atividade_id!))?.situacao).toBe('cancelada');
  });

  it('"Ambas" e "Contador" viram uma responsável só, sem inventar pessoa', () => {
    expect(responsabilidadeDaAtividade({ responsavel_tipo: 'ambas', responsavel_id: null }, ID_KIMBERLY, [ID_KIMBERLY, ID_CAMILA])).toEqual({ responsavel_id: ID_KIMBERLY, participantes: [ID_CAMILA], descricao: null });
    expect(responsabilidadeDaAtividade({ responsavel_tipo: 'contador', responsavel_id: null }, ID_CAMILA, [ID_KIMBERLY, ID_CAMILA])).toEqual({ responsavel_id: ID_CAMILA, participantes: [], descricao: 'Acompanhar com o contador.' });
    expect(responsabilidadeDaAtividade({ responsavel_tipo: 'pessoa', responsavel_id: ID_CAMILA }, ID_KIMBERLY, [])).toEqual({ responsavel_id: ID_CAMILA, participantes: [], descricao: null });
  });
});

describe('T06.08: obrigações corporativas', () => {
  const base = () => ({ ...formularioObrigacaoVazio(ID_ENTIDADE_PLANEJADA, ID_KIMBERLY), nome: 'Declaração mensal', vencimento_base: '2026-11-20', antecedencia_dias: '15' });
  const categoria = async () => (await repositorios.categoria_financeira.listar())[0]!.id;

  it('não presume nenhuma obrigação: começa vazio', async () => {
    expect(await repositorios.obrigacao_corporativa.listar()).toEqual([]);
  });

  it('ativar exige a F1 e a entidade Ativa; rascunho não gera nada', async () => {
    const entidades = await repositorios.entidade.listar();
    expect(errosDaObrigacao({ ...base(), situacao: 'ativa' }, { entidades, fase: 'f0b', hoje: HOJE }).situacao).toBe(MENSAGEM_FASE_DAS_OBRIGACOES);
    expect(errosDaObrigacao({ ...base(), situacao: 'ativa' }, { entidades, fase: 'f1', hoje: HOJE }).situacao).toBe(MENSAGEM_ENTIDADE_PLANEJADA);
    await salvarObrigacao(base(), undefined, HOJE);
    await repositorios.configuracao.salvar({ fase_ativa: 'f1' });
    expect(await gerarOcorrenciasDasObrigacoes(HOJE)).toBe(0);
    expect(await repositorios.obrigacao_corporativa_ocorrencia.listar()).toEqual([]);
  });

  it('o vencimento segue a periodicidade, e "Outra" não se repete sozinha', () => {
    expect(vencimentosAte({ periodicidade: 'mensal', vencimento_base: '2026-01-31' }, '2026-03-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(vencimentosAte({ periodicidade: 'trimestral', vencimento_base: '2026-01-15' }, '2026-08-01')).toEqual(['2026-01-15', '2026-04-15', '2026-07-15']);
    expect(vencimentosAte({ periodicidade: 'anual', vencimento_base: '2026-05-31' }, '2028-06-01')).toEqual(['2026-05-31', '2027-05-31', '2028-05-31']);
    expect(vencimentosAte({ periodicidade: 'outra', vencimento_base: '2026-01-15' }, '2030-01-01')).toEqual(['2026-01-15']);
    expect(proximoVencimento({ periodicidade: 'outra', vencimento_base: '2026-01-15', situacao: 'ativa' }, [{ referencia: '2026-01-15', vencimento: '2026-01-15', cumprida_em: '2026-01-10' }])).toBeNull();
  });

  it('rotinas repetidas não duplicam ocorrência, alerta nem título', async () => {
    await ativarEntidade();
    await repositorios.configuracao.salvar({ fase_ativa: 'f1' });
    const obrigacao = await salvarObrigacao({ ...base(), situacao: 'ativa', gera_titulo: true, categoria_id: await categoria(), valor_estimado: '150,00' }, undefined, HOJE);
    await gerarOcorrenciasDasObrigacoes(HOJE);
    await gerarOcorrenciasDasObrigacoes(HOJE);
    await executarRotinas({ manual: true });
    const ocorrencias = await repositorios.obrigacao_corporativa_ocorrencia.listar({ onde: { obrigacao_id: obrigacao.id } });
    expect(ocorrencias.map((ocorrencia) => ocorrencia.referencia)).toEqual(['2026-11-20']);
    expect(await repositorios.atividade.listar({ onde: { origem_tipo: 'obrigacao_ocorrencia' } })).toHaveLength(1);
    const titulos = await repositorios.titulo.listar({ onde: { chave_idempotencia: chaveDoTitulo(obrigacao.id, '2026-11-20') } });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toMatchObject({ situacao: 'previsto', valor: 150, origem: 'obrigacao_corporativa', origem_id: ocorrencias[0]?.id });
    expect(ocorrencias[0]?.titulo_id).toBe(titulos[0]?.id);
    expect(await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulos[0]!.id } })).toHaveLength(1);
  });

  it('antes da janela não gera; sem valor estimado não inventa título', async () => {
    await ativarEntidade();
    await repositorios.configuracao.salvar({ fase_ativa: 'f1' });
    const obrigacao = await salvarObrigacao({ ...base(), vencimento_base: '2026-12-20', situacao: 'ativa', gera_titulo: true, categoria_id: await categoria() }, undefined, HOJE);
    expect(await repositorios.obrigacao_corporativa_ocorrencia.listar()).toEqual([]);
    await gerarOcorrenciasDasObrigacoes('2026-12-10');
    const [ocorrencia] = await repositorios.obrigacao_corporativa_ocorrencia.listar({ onde: { obrigacao_id: obrigacao.id } });
    expect(ocorrencia?.titulo_id).toBeNull();
    expect(await repositorios.titulo.listar({ onde: { chave_idempotencia: chaveDoTitulo(obrigacao.id, '2026-12-20') } })).toEqual([]);
  });

  it('concluir o alerta não cumpre a ocorrência nem paga o título', async () => {
    await ativarEntidade();
    await repositorios.configuracao.salvar({ fase_ativa: 'f1' });
    await salvarObrigacao({ ...base(), situacao: 'ativa', gera_titulo: true, categoria_id: await categoria(), valor_estimado: '150,00' }, undefined, HOJE);
    const [alerta] = await repositorios.atividade.listar({ onde: { origem_tipo: 'obrigacao_ocorrencia' } });
    await concluirAtividade(alerta!.id, ID_KIMBERLY);
    const [ocorrencia] = await repositorios.obrigacao_corporativa_ocorrencia.listar();
    expect(ocorrencia?.cumprida_em).toBeNull();
    expect((await repositorios.titulo.obter(ocorrencia!.titulo_id!))?.situacao).toBe('previsto');
    await atualizarSituacoesDosTitulos();
    expect(await repositorios.baixa.listar({ onde: { titulo_id: ocorrencia!.titulo_id! } })).toEqual([]);
  });

  it('cumprir exige comprovante; resolve o alerta, sem mexer no título', async () => {
    await ativarEntidade();
    await repositorios.configuracao.salvar({ fase_ativa: 'f1' });
    await salvarObrigacao({ ...base(), situacao: 'ativa', gera_titulo: true, categoria_id: await categoria(), valor_estimado: '150,00' }, undefined, HOJE);
    const [ocorrencia] = await repositorios.obrigacao_corporativa_ocorrencia.listar();
    await expect(registrarCumprimento(ocorrencia!.id, { cumprida_em: HOJE, comprovante_url: '', titulo_id: '', observacao: '' }, HOJE)).rejects.toThrow('comprovante');
    await registrarCumprimento(ocorrencia!.id, { cumprida_em: HOJE, comprovante_url: LINK, titulo_id: ocorrencia!.titulo_id!, observacao: '' }, HOJE);
    const [alerta] = await repositorios.atividade.listar({ onde: { origem_tipo: 'obrigacao_ocorrencia' } });
    expect(alerta?.situacao).toBe('concluida');
    expect((await repositorios.titulo.obter(ocorrencia!.titulo_id!))?.situacao).toBe('previsto');
    await expect(registrarCumprimento(ocorrencia!.id, { cumprida_em: HOJE, comprovante_url: LINK, titulo_id: '', observacao: '' }, HOJE)).rejects.toThrow('já foi cumprida');
  });

  it('"Outra": a próxima é informada à mão, e a mesma data não entra duas vezes', async () => {
    await ativarEntidade();
    await repositorios.configuracao.salvar({ fase_ativa: 'f1' });
    const obrigacao = await salvarObrigacao({ ...base(), periodicidade: 'outra', situacao: 'ativa' }, undefined, HOJE);
    await adicionarOcorrencia(obrigacao.id, '2027-03-01');
    await expect(adicionarOcorrencia(obrigacao.id, '2027-03-01')).rejects.toThrow('Já existe');
    expect((await repositorios.obrigacao_corporativa_ocorrencia.listar({ onde: { obrigacao_id: obrigacao.id } })).map((linha) => linha.referencia).sort()).toEqual(['2026-11-20', '2027-03-01']);
  });
});

describe('T06.09: reuniões e decisões', () => {
  const socias = [{ id: ID_KIMBERLY }, { id: ID_CAMILA }];
  const nova = (dados = {}) => ({ ...formularioDecisaoVazio(ID_KIMBERLY, socias, HOJE), titulo: 'Centralizar custos', descricao: 'Registrar custos na Central', ...dados });

  it('decisão exige o quê e quem decidiu, sócia, e já tomada', async () => {
    const erros = errosDoFormularioDecisao({ ...nova(), titulo: '', descricao: '', decisores: [], data: '2027-01-01' }, HOJE);
    expect(Object.keys(erros).sort()).toEqual(['data', 'decisores', 'descricao', 'titulo']);
    await expect(registrarDecisao(nova({ decisores: ['pessoa-qualquer'] }), HOJE)).rejects.toThrow('sócia ativa');
  });

  it('CA-06.06: decisão registrada não muda, por nenhum caminho', async () => {
    const decisao = await registrarDecisao(nova(), HOJE);
    expect(decisao.codigo).toMatch(/^DEC-\d{4}-\d{4}$/);
    await expect(repositorios.decisao.atualizar(decisao.id, { titulo: 'Outro título' })).rejects.toThrow(MENSAGEM_DECISAO_IMUTAVEL);
    await expect(repositorios.decisao.atualizar(decisao.id, { descricao: 'Outra coisa', situacao: 'substituida' })).rejects.toThrow(MENSAGEM_DECISAO_IMUTAVEL);
    await expect(repositorios.decisao.arquivar(decisao.id)).rejects.toThrow(MENSAGEM_DECISAO_IMUTAVEL);
    expect((await repositorios.decisao.obter(decisao.id))?.titulo).toBe('Centralizar custos');
  });

  it('RN-06.13: substituir pede o motivo, liga as duas e mantém a antiga como foi', async () => {
    const antiga = await registrarDecisao(nova(), HOJE);
    await expect(registrarDecisao(nova({ titulo: 'Nova', substitui_id: antiga.id }), HOJE)).rejects.toThrow('motivo da substituição');
    const substituta = await registrarDecisao(nova({ titulo: 'Nova', substitui_id: antiga.id, motivo: 'Mudou o cenário' }), HOJE);
    const depois = await repositorios.decisao.obter(antiga.id);
    expect(depois).toMatchObject({ situacao: 'substituida', substituida_por_id: substituta.id, titulo: 'Centralizar custos', descricao: 'Registrar custos na Central' });
    expect(substituta).toMatchObject({ situacao: 'registrada', motivo: 'Mudou o cenário' });
    await expect(registrarDecisao(nova({ titulo: 'Terceira', substitui_id: antiga.id, motivo: 'Outro' }), HOJE)).rejects.toThrow('já foi substituída');
    await expect(repositorios.decisao.atualizar(antiga.id, { situacao: 'registrada' })).rejects.toThrow('não volta a valer');
  });

  it('registros afetados entram como vínculos, uma vez só', async () => {
    const [ferramenta] = await repositorios.ferramenta.listar();
    const decisao = await registrarDecisao(nova({ registros: [{ tipo: 'ferramenta', id: ferramenta!.id }, { tipo: 'ferramenta', id: ferramenta!.id }] }), HOJE);
    expect((await repositorios.vinculo.listar()).filter((vinculo) => [vinculo.origem_id, vinculo.destino_id].includes(decisao.id))).toHaveLength(1);
  });

  it('reunião: título, data, hora e participantes; a pauta vira itens', async () => {
    const reuniao = await salvarReuniao({ ...formularioReuniaoVazio(ID_KIMBERLY, HOJE), titulo: 'Alinhamento', hora: '10:00', participantes: [ID_KIMBERLY, ID_CAMILA], pauta: '• Precificação\n\n- Formalização\n' });
    expect(reuniao.codigo).toMatch(/^REU-\d{4}-0001$/);
    expect(reuniao.pauta).toEqual(['Precificação', 'Formalização']);
    expect(await repositorios.reuniao_participante.listar({ onde: { reuniao_id: reuniao.id } })).toHaveLength(2);
    await expect(salvarReuniao({ ...formularioReuniaoVazio(ID_KIMBERLY, HOJE), titulo: '', hora: '' })).rejects.toThrow();
  });

  it('CA-06.07 e RN-06.14: a ação é a atividade do Meu dia, com o vínculo da reunião; concluir vale nos dois', async () => {
    const reuniao = await salvarReuniao({ ...formularioReuniaoVazio(ID_KIMBERLY, HOJE), titulo: 'Alinhamento', hora: '10:00' });
    const acao = await adicionarAcao(reuniao.id, { titulo: 'Levantar custos por app', responsavel_id: ID_CAMILA, prazo: SEMANA });
    expect(acao).toMatchObject({ tipo: 'tarefa', origem_tipo: 'reuniao', origem_id: reuniao.id, responsavel_id: ID_CAMILA, prazo: SEMANA });
    expect((await acoesDaReuniao(reuniao.id)).map((linha) => linha.id)).toEqual([acao.id]);
    const { vinculosDaAtividade } = await import('./atividades-painel');
    expect((await vinculosDaAtividade(acao.id))[0]).toMatchObject({ tipo: 'reuniao', rotulo: 'Reunião', nome: 'Alinhamento' });
    await concluirAtividade(acao.id, ID_CAMILA);
    expect((await acoesDaReuniao(reuniao.id))[0]?.situacao).toBe('concluida');
    expect((await carregarReunioes()).acoes.filter(estaAberta)).toEqual([]);
  });

  it('a mesma ação aberta não entra duas vezes; depois de concluída, pode', async () => {
    const reuniao = await salvarReuniao({ ...formularioReuniaoVazio(ID_KIMBERLY, HOJE), titulo: 'Alinhamento', hora: '10:00' });
    const acao = await adicionarAcao(reuniao.id, { titulo: 'Levantar custos', responsavel_id: ID_KIMBERLY, prazo: '' });
    await expect(adicionarAcao(reuniao.id, { titulo: ' levantar  CUSTOS', responsavel_id: ID_KIMBERLY, prazo: '' })).rejects.toThrow('já está aberta');
    await concluirAtividade(acao.id, ID_KIMBERLY);
    await adicionarAcao(reuniao.id, { titulo: 'Levantar custos', responsavel_id: ID_KIMBERLY, prazo: '' });
    expect(await acoesDaReuniao(reuniao.id)).toHaveLength(2);
  });

  it('a decisão na reunião fica ligada a ela', async () => {
    const reuniao = await salvarReuniao({ ...formularioReuniaoVazio(ID_KIMBERLY, HOJE), titulo: 'Alinhamento', hora: '10:00' });
    const decisao = await registrarDecisao(nova({ reuniao_id: reuniao.id }), HOJE);
    expect(decisao.reuniao_id).toBe(reuniao.id);
  });
});

describe('T06.01: jornada', () => {
  const marco = async (codigo: string) => marcosDaJornada(await carregarDadosDaJornada(), HOJE).find((linha) => linha.codigo === codigo)!;

  it('são os 12 marcos, e nenhum atingido por falta de dado', async () => {
    const marcos = marcosDaJornada(await carregarDadosDaJornada(), HOJE);
    expect(marcos.map((linha) => linha.codigo)).toEqual(['ME-01', 'ME-02', 'ME-03', 'ME-04', 'ME-05', 'ME-06', 'ME-07', 'ME-08', 'ME-09', 'ME-10', 'ME-11', 'ME-12']);
    for (const codigo of ['ME-02', 'ME-04', 'ME-06', 'ME-07', 'ME-08', 'ME-09', 'ME-10', 'ME-11', 'ME-12']) expect(marcos.find((linha) => linha.codigo === codigo)?.situacao, codigo).toBe('nao_iniciado');
  });

  it('CA-06.01: ME-04 só com memorando ou acordo de sócias Vigente', async () => {
    expect((await marco('ME-04')).situacao).toBe('nao_iniciado');
    await enviarParaRevisao(ID_MEMORANDO_V1);
    expect((await marco('ME-04')).situacao).toBe('em_andamento');
    await pedirAssinaturas(ID_MEMORANDO_V1);
    await registrarArquivoAssinado(ID_MEMORANDO_V1, { arquivo_url: LINK, data_assinatura: HOJE }, HOJE);
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_KIMBERLY, HOJE);
    expect((await marco('ME-04')).situacao).toBe('em_andamento');
    comoPessoa(ID_CAMILA);
    await confirmarAssinatura(ID_MEMORANDO_V1, ID_CAMILA, HOJE);
    await tornarVigente(ID_MEMORANDO_V1, HOJE);
    expect(await marco('ME-04')).toMatchObject({ situacao: 'atingido', atingidoEm: HOJE });
  });

  it('um termo de cessão vigente não faz o ME-04', async () => {
    const socias = await repositorios.socia.listar();
    const termo = await criarAcordo({ ...formularioAcordoVazio(socias), titulo: 'Cessão', tipo: 'cessao_pi' });
    const [versao] = await repositorios.acordo_versao.listar({ onde: { acordo_id: termo.id } });
    await enviarParaRevisao(versao!.id);
    await pedirAssinaturas(versao!.id);
    await registrarArquivoAssinado(versao!.id, { arquivo_url: LINK, data_assinatura: HOJE }, HOJE);
    await confirmarAssinatura(versao!.id, ID_KIMBERLY, HOJE);
    comoPessoa(ID_CAMILA);
    await confirmarAssinatura(versao!.id, ID_CAMILA, HOJE);
    await tornarVigente(versao!.id, HOJE);
    expect((await marco('ME-04')).situacao).toBe('nao_iniciado');
  });

  it('ME-06: pesquisas e pedidos de todas as marcas', async () => {
    await registrarPesquisa({ ...formularioPesquisaVazio(ID_MARCA_ZARPA, ID_KIMBERLY, HOJE), resultado: 'disponivel' }, HOJE);
    const linha = await marco('ME-06');
    expect(linha.situacao).toBe('em_andamento');
    expect(linha.detalhe).toContain('1 de 6 pesquisas');
  });

  it('ME-08 e ME-09: dependem da entidade Ativa', async () => {
    expect((await marco('ME-09')).detalhe).toContain('Depende da entidade Ativa');
    await ativarEntidade();
    const oito = await marco('ME-08');
    expect(oito.situacao).toBe('em_andamento');
    expect(oito.detalhe).toContain('regime tributário');
    expect((await marco('ME-09')).situacao).toBe('em_andamento');
  });
});
