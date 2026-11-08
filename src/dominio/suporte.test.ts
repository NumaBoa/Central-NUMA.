import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_CAMILA, ID_CONTRAPARTE_CONTABILIDADE, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { instanteNoFuso } from '@/lib/datas';
import { contratoComImplantacao } from './apoio-testes-m12';
import { ID_OFERTA_REVENDA, criarCatalogoDeExemplo } from './integracoes/catalogo-de-exemplo';
import { usarCatalogoDeTeste } from './integracoes/conexoes';
import { formularioDeRegras, salvarRegras } from './sla';
import { abrirSolicitacao, cancelarSolicitacao, clienteRespondeu, contratoSugerido, criarOportunidadeDeNovoEscopo, cumprimentoDoSla, fecharSolicitacao, formularioSolicitacaoVazio, MOTIVO_SLA_EM_RISCO, carregarSuporte, reabrirSolicitacao, reclassificarSolicitacao, registrarResposta, resolverSolicitacao, slaDaSolicitacao, sincronizarAlertasDoSuporte, type FormularioSolicitacao } from './suporte';

const em = (dia: string, hora: string) => instanteNoFuso(dia, hora, 'America/Sao_Paulo');
const SEGUNDA = em('2026-11-16', '09:00');

async function regraNormal() {
  const base = formularioDeRegras([]);
  await salvarRegras({ tipo: 'oferta', id: ID_OFERTA_REVENDA }, { ...base, linhas: base.linhas.map((linha) => (linha.prioridade === 'normal' ? { ...linha, resposta_horas: '4', resolucao_horas: '16' } : linha)) });
}

describe('T12.03 Solicitações de suporte', () => {
  let contratoId = '';
  let contraparteId = '';
  const nova = (extra: Partial<FormularioSolicitacao> = {}): FormularioSolicitacao => ({ ...formularioSolicitacaoVazio(ID_CAMILA), contraparte_id: contraparteId, produto_id: ID_PRODUTO_KIPI, contrato_id: contratoId, titulo: 'A agenda não abre', ...extra });

  beforeEach(async () => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    usarCatalogoDeTeste(criarCatalogoDeExemplo());
    garantirCarga();
    const ficha = await contratoComImplantacao('2026-11-06');
    contratoId = ficha.contrato.id;
    contraparteId = ficha.contrato.contraparte_id;
    await regraNormal();
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    usarCatalogoDeTeste(null);
  });

  it('o contrato é sugerido pela contraparte e pelo produto', async () => {
    expect(await contratoSugerido(contraparteId, ID_PRODUTO_KIPI)).toBe(contratoId);
    expect(await contratoSugerido(contraparteId, ID_PRODUTO_ZUPI)).toBe('');
  });

  it('na abertura, o SLA da oferta do contrato fica congelado, com os dois prazos (RN-12.08)', async () => {
    const aberta = await abrirSolicitacao(nova(), SEGUNDA);
    expect(aberta).toMatchObject({ codigo: 'SUP-2026-0001', situacao: 'aberta', sla: { origem: 'oferta', resposta_horas: 4, resolucao_horas: 16, contagem: 'horas_uteis', horario_inicio: '09:00' }, prazo_resposta_em: em('2026-11-16', '13:00'), prazo_resolucao_em: em('2026-11-17', '16:00') });
    // Mudar a regra depois não muda o prazo de quem já abriu.
    const base = formularioDeRegras([]);
    await salvarRegras({ tipo: 'oferta', id: ID_OFERTA_REVENDA }, { ...base, linhas: base.linhas.map((linha) => (linha.prioridade === 'normal' ? { ...linha, resposta_horas: '1', resolucao_horas: '2' } : linha)) });
    expect((await repositorios.solicitacao_suporte.obter(aberta.id))?.prazo_resposta_em).toBe(em('2026-11-16', '13:00'));
  });

  it('sem regra para a prioridade, "Sem SLA"; usuário sem cadastro entra com nome e contato (RN-12.09)', async () => {
    const semRegra = await abrirSolicitacao(nova({ prioridade: 'baixa' }), SEGUNDA);
    expect(semRegra).toMatchObject({ sla: null, prazo_resposta_em: null });
    expect(slaDaSolicitacao(semRegra, SEGUNDA, []).resposta.texto).toBe('Sem SLA');
    const usuario = await abrirSolicitacao(nova({ contraparte_id: '', contrato_id: '', solicitante_texto: 'Maria, maria@exemplo.com' }), SEGUNDA);
    expect(usuario).toMatchObject({ contraparte_id: null, solicitante_texto: 'Maria, maria@exemplo.com', sla: { origem: 'oferta' } });
    await expect(abrirSolicitacao(nova({ contraparte_id: '', contrato_id: '', solicitante_texto: '' }), SEGUNDA)).rejects.toThrow();
  });

  it('o contrato precisa ser da contraparte e ter o produto', async () => {
    await expect(abrirSolicitacao(nova({ contraparte_id: ID_CONTRAPARTE_CONTABILIDADE }), SEGUNDA)).rejects.toThrow('é de outra contraparte');
    await expect(abrirSolicitacao(nova({ produto_id: ID_PRODUTO_ZUPI }), SEGUNDA)).rejects.toThrow('não tem este produto');
  });

  it('responder marca a primeira resposta; aguardar o cliente pausa e empurra a resolução', async () => {
    const aberta = await abrirSolicitacao(nova(), SEGUNDA);
    await registrarResposta(aberta.id, { texto: 'Pode mandar um print?', aguardarCliente: true }, em('2026-11-16', '10:00'));
    let atual = (await repositorios.solicitacao_suporte.obter(aberta.id))!;
    expect(atual).toMatchObject({ situacao: 'aguardando_cliente', primeira_resposta_em: em('2026-11-16', '10:00') });
    expect(slaDaSolicitacao(atual, em('2026-11-16', '15:00'), []).resolucao).toMatchObject({ estado: 'pausado', texto: 'Pausado: faltam 15 h' });
    atual = await clienteRespondeu(aberta.id, 'Mandei o print.', em('2026-11-16', '12:00'));
    expect(atual.situacao).toBe('em_atendimento');
    expect(slaDaSolicitacao(atual, em('2026-11-16', '12:00'), []).resolucao.prazo).toBe(em('2026-11-17', '18:00'));
    expect(slaDaSolicitacao(atual, em('2026-11-16', '12:00'), []).resposta.estado).toBe('cumprido');
    const interacoes = await repositorios.suporte_interacao.listar({ onde: { solicitacao_id: aberta.id } });
    expect(interacoes.map((linha) => linha.tipo)).toEqual(['mudanca', 'resposta', 'mudanca', 'nota_interna', 'mudanca']);
  });

  it('resolver, fechar, reabrir e cancelar, com motivo onde a regra pede', async () => {
    const aberta = await abrirSolicitacao(nova(), SEGUNDA);
    await expect(resolverSolicitacao(aberta.id, ' ', SEGUNDA)).rejects.toThrow('Descreva a solução.');
    const resolvida = await resolverSolicitacao(aberta.id, 'Cache limpo.', em('2026-11-16', '11:00'));
    expect(resolvida).toMatchObject({ situacao: 'resolvida', resolvida_em: em('2026-11-16', '11:00'), primeira_resposta_em: em('2026-11-16', '11:00') });
    await expect(reabrirSolicitacao(aberta.id, '', SEGUNDA)).rejects.toThrow('Reabrir exige motivo.');
    expect((await reabrirSolicitacao(aberta.id, 'Voltou a falhar', em('2026-11-16', '12:00'))).situacao).toBe('em_atendimento');
    await resolverSolicitacao(aberta.id, 'Corrigido de vez.', em('2026-11-16', '13:00'));
    expect((await fecharSolicitacao(aberta.id)).situacao).toBe('fechada');
    await expect(registrarResposta(aberta.id, { texto: 'Oi', aguardarCliente: false })).rejects.toThrow('reabra para mudar');
    const outra = await abrirSolicitacao(nova(), SEGUNDA);
    await expect(cancelarSolicitacao(outra.id, '')).rejects.toThrow('Cancelar exige motivo.');
    expect((await cancelarSolicitacao(outra.id, 'Duplicada')).situacao).toBe('cancelada');
  });

  it('CA-12.03: Novo escopo fica "Aguardando proposta" e oferece a oportunidade vinculada; o contrato não muda', async () => {
    const versaoAntes = await repositorios.contrato_versao.listar({ onde: { contrato_id: contratoId } });
    const aberta = await abrirSolicitacao(nova({ tipo: 'novo_escopo', titulo: 'Integrar com o caixa' }), SEGUNDA);
    expect(aberta.situacao).toBe('aguardando_proposta');
    await expect(resolverSolicitacao(aberta.id, 'x', SEGUNDA)).rejects.toThrow('Novo escopo não se resolve como suporte');
    const oportunidadeId = await criarOportunidadeDeNovoEscopo(aberta.id, '2026-11-16');
    const oportunidade = await repositorios.oportunidade.obter(oportunidadeId);
    expect(oportunidade).toMatchObject({ contraparte_id: contraparteId, titulo: 'Aditivo: Integrar com o caixa', tipo: 'sob_medida', etapa: 'qualificacao' });
    expect(await criarOportunidadeDeNovoEscopo(aberta.id)).toBe(oportunidadeId);
    expect((await repositorios.solicitacao_suporte.obter(aberta.id))).toMatchObject({ oportunidade_id: oportunidadeId, situacao: 'aguardando_proposta' });
    expect(await repositorios.contrato_versao.listar({ onde: { contrato_id: contratoId } })).toEqual(versaoAntes);
    const semCadastro = await abrirSolicitacao(nova({ tipo: 'novo_escopo', contraparte_id: '', contrato_id: '', solicitante_texto: 'Maria' }), SEGUNDA);
    await expect(criarOportunidadeDeNovoEscopo(semCadastro.id)).rejects.toThrow('Cadastre e escolha a contraparte');
  });

  it('reclassificar pede motivo e recalcula o prazo pela nova prioridade; virar Novo escopo espera a proposta', async () => {
    const aberta = await abrirSolicitacao(nova({ prioridade: 'baixa' }), SEGUNDA);
    await expect(reclassificarSolicitacao(aberta.id, { tipo: 'duvida', prioridade: 'normal', motivo: '' }, SEGUNDA)).rejects.toThrow('exige motivo');
    const normal = await reclassificarSolicitacao(aberta.id, { tipo: 'duvida', prioridade: 'normal', motivo: 'Afeta a equipe toda' }, SEGUNDA);
    expect(normal).toMatchObject({ prioridade: 'normal', prazo_resposta_em: em('2026-11-16', '13:00') });
    expect((await reclassificarSolicitacao(aberta.id, { tipo: 'novo_escopo', prioridade: 'normal', motivo: 'É função nova' }, SEGUNDA)).situacao).toBe('aguardando_proposta');
  });

  it('alerta "SLA em risco" a 80% do prazo, que se resolve com a solicitação resolvida', async () => {
    const aberta = await abrirSolicitacao(nova(), SEGUNDA);
    expect(await sincronizarAlertasDoSuporte(em('2026-11-16', '12:00'))).toBe(0);
    expect(await sincronizarAlertasDoSuporte(em('2026-11-16', '12:15'))).toBe(1);
    const [alerta] = await repositorios.atividade.listar({ onde: { origem_tipo: 'solicitacao_suporte', origem_id: aberta.id } });
    expect(alerta).toMatchObject({ alerta_motivo: MOTIVO_SLA_EM_RISCO, responsavel_id: ID_CAMILA, alerta_acao: 'abrir_solicitacao', titulo: 'SUP-2026-0001: SLA de primeira resposta em risco' });
    await resolverSolicitacao(aberta.id, 'Feito.', em('2026-11-16', '12:30'));
    expect((await repositorios.atividade.obter(alerta!.id))?.situacao).toBe('concluida');
  });

  it('cumprimento de SLA por grupo: só o que já se decidiu entra no percentual', async () => {
    const noPrazo = await abrirSolicitacao(nova(), SEGUNDA);
    await resolverSolicitacao(noPrazo.id, 'Feito.', em('2026-11-16', '11:00'));
    const fora = await abrirSolicitacao(nova(), SEGUNDA);
    await registrarResposta(fora.id, { texto: 'Olhando.', aguardarCliente: false }, em('2026-11-16', '14:00'));
    await abrirSolicitacao(nova(), SEGUNDA);
    await abrirSolicitacao(nova({ prioridade: 'baixa' }), SEGUNDA);
    const { linhas } = await carregarSuporte(em('2026-11-16', '15:00'));
    const [grupo] = cumprimentoDoSla(linhas, () => ({ chave: 'kipi', rotulo: 'Kipi' }));
    expect(grupo).toMatchObject({ comSla: 3, respostaMedida: 3, respostaNoPrazo: 1, resolucaoMedida: 1, resolucaoNoPrazo: 1 });
  });
});
