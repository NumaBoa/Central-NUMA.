import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_CAMILA, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { categoria, contratoComImplantacao, DRIVE } from './apoio-testes-m12';
import { ativarProgramacao } from './contratos';
import { concluirImplantacao, criarImplantacao, desvioDaEntrega, gerarTarefas, interromperImplantacao, MOTIVO_ALERTA_ENTREGA, previaDaImplantacao, produtosParaImplantar, registrarAceiteDaEntrega, retomarImplantacao, salvarMarco, situacaoPelosMarcos, carregarImplantacao, carregarImplantacoes } from './implantacoes';
import { criarCatalogoDeExemplo } from './integracoes/catalogo-de-exemplo';
import { usarCatalogoDeTeste } from './integracoes/conexoes';
import { somarDias } from './repeticao';

const HOJE = '2026-11-06';
const PRAZO = somarDias(HOJE, 30);
const vazio = { planejado_em: '', realizado_em: '', nao_se_aplica: false, observacao: '' };

describe('T12.01 e T12.02 Implantações', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    usarCatalogoDeTeste(criarCatalogoDeExemplo());
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    usarCatalogoDeTeste(null);
  });

  it('situação pelos marcos, sem escolha à mão', () => {
    const marcos = (realizados: string[], naoSeAplica: string[] = []) => (['inicio', 'configuracao', 'validacao', 'entrega', 'acompanhamento'] as const).map((marco) => ({ marco, realizado_em: realizados.includes(marco) ? HOJE : null, nao_se_aplica: naoSeAplica.includes(marco) }));
    const base = { interrupcao: null, concluida_em: null, aceite_em: null };
    expect(situacaoPelosMarcos(base, marcos([]))).toBe('nao_iniciada');
    expect(situacaoPelosMarcos(base, marcos(['inicio']))).toBe('em_andamento');
    expect(situacaoPelosMarcos(base, marcos(['inicio', 'configuracao']))).toBe('em_validacao');
    expect(situacaoPelosMarcos(base, marcos(['inicio'], ['configuracao']))).toBe('em_validacao');
    expect(situacaoPelosMarcos(base, marcos(['inicio', 'configuracao', 'validacao', 'entrega']))).toBe('entregue');
    expect(situacaoPelosMarcos({ ...base, aceite_em: HOJE }, marcos(['inicio', 'configuracao', 'validacao', 'entrega']))).toBe('acompanhamento');
    expect(situacaoPelosMarcos({ ...base, aceite_em: HOJE }, marcos(['inicio', 'configuracao', 'validacao', 'entrega'], ['acompanhamento']))).toBe('entregue');
    expect(situacaoPelosMarcos({ ...base, interrupcao: { tipo: 'suspensa', motivo: 'x', em: HOJE } }, marcos(['inicio']))).toBe('suspensa');
  });

  it('desvio em dias, com texto (RN-12.05)', () => {
    const contratual = { data: '2026-12-01', pendente: false as const };
    expect(desvioDaEntrega(contratual, '2026-12-04', 'planejada')).toMatchObject({ dias: 3, texto: '3 dias depois do prazo contratual', tom: 'atencao' });
    expect(desvioDaEntrega(contratual, '2026-11-30', 'realizada')).toMatchObject({ dias: -1, texto: '1 dia antes do prazo contratual' });
    expect(desvioDaEntrega(contratual, '2026-12-01', 'planejada').texto).toBe('No prazo contratual');
    expect(desvioDaEntrega({ data: null, pendente: true, texto: 'Pendente: aguardando Assinatura' }, '2026-12-01', 'planejada').texto).toBe('Pendente: aguardando Assinatura');
    expect(desvioDaEntrega(null, null, 'planejada').texto).toBe('Sem prazo contratual de entrega');
    expect(desvioDaEntrega(contratual, null, 'planejada').texto).toBe('Entrega ainda não planejada');
  });

  it('RN-12.01 e RN-12.02: do contrato assinado, por produto, herdando estimativas, escopo e prazo', async () => {
    const ficha = await contratoComImplantacao(HOJE);
    const { produtos } = await produtosParaImplantar(ficha.contrato.id);
    expect(produtos.map((linha) => linha.produtoId)).toEqual([ID_PRODUTO_KIPI]);
    expect(produtos[0]!.itens.map((item) => item.descricao)).toEqual(['Implantação assistida']);
    const previa = await previaDaImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI);
    expect(previa).toMatchObject({ horasEstimadas: 20, prazoEstimadoDias: 30, aceiteCriterios: 'Agenda funcionando no celular da equipe.' });
    expect(previa.entrega.prazo).toEqual({ data: PRAZO, pendente: false });
    expect(previa.tarefas.map((tarefa) => tarefa.titulo)).toEqual(['Configurar a agenda do café', 'Treinar a equipe', 'Implantação assistida']);
  });

  it('sem horas na proposta, usa a viabilidade; sem nenhuma das duas, fica sem estimativa', async () => {
    const ficha = await contratoComImplantacao(HOJE, { horasNoItem: '' });
    expect((await previaDaImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI)).horasEstimadas).toBe(16);
  });

  it('criar de novo não duplica; os marcos nascem sem data; as tarefas escolhidas viram atividades', async () => {
    const ficha = await contratoComImplantacao(HOJE);
    const primeira = await criarImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI, { responsavelId: ID_CAMILA, tarefas: ['Treinar a equipe', 'Implantação assistida', 'Inventada'] }, HOJE);
    expect(primeira).toMatchObject({ criada: true, tarefas: 2 });
    expect(primeira.implantacao).toMatchObject({ codigo: 'IMP-2026-0001', situacao: 'nao_iniciada', contraparte_id: ficha.contrato.contraparte_id, horas_estimadas: 20, entrega_planejada: null });
    const segunda = await criarImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI, { responsavelId: ID_CAMILA, tarefas: [] }, HOJE);
    expect(segunda).toMatchObject({ criada: false });
    expect(segunda.implantacao.id).toBe(primeira.implantacao.id);
    expect(await repositorios.implantacao.listar()).toHaveLength(1);
    const marcos = await repositorios.implantacao_marco.listar({ onde: { implantacao_id: primeira.implantacao.id } });
    expect(marcos).toHaveLength(5);
    expect(marcos.every((marco) => !marco.planejado_em && !marco.realizado_em)).toBe(true);
    expect(await gerarTarefas(primeira.implantacao.id, ['Treinar a equipe', 'Configurar a agenda do café'])).toBe(1);
    const vinculos = (await repositorios.vinculo.listar()).filter((vinculo) => vinculo.destino_tipo === 'implantacao' || vinculo.origem_tipo === 'implantacao');
    expect(vinculos).toHaveLength(3);
    const tarefas = await repositorios.atividade.listar({ onde: { titulo: 'Treinar a equipe' } });
    expect(tarefas[0]).toMatchObject({ responsavel_id: ID_CAMILA, prazo: null, tipo: 'tarefa' });
  });

  it('CA-12.01: planejar depois do prazo contratual mostra o desvio e cria alerta, sem mudar o contrato', async () => {
    const ficha = await contratoComImplantacao(HOJE);
    const { implantacao } = await criarImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI, { responsavelId: ID_CAMILA, tarefas: [] }, HOJE);
    const regrasAntes = await repositorios.regra_prazo.listar({ onde: { versao_id: ficha.vigente!.id } });
    const salva = await salvarMarco(implantacao.id, 'entrega', { ...vazio, planejado_em: somarDias(PRAZO, 5) }, HOJE);
    expect(salva.entrega_planejada).toBe(somarDias(PRAZO, 5));
    const linha = (await carregarImplantacoes()).linhas[0]!;
    expect(linha.desvioPlanejado.texto).toBe('5 dias depois do prazo contratual');
    const alertas = await repositorios.atividade.listar({ onde: { origem_tipo: 'implantacao', origem_id: implantacao.id } });
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ tipo: 'alerta', responsavel_id: ID_CAMILA, alerta_motivo: MOTIVO_ALERTA_ENTREGA, alerta_acao: 'abrir_implantacao', prazo: PRAZO });
    expect(await repositorios.regra_prazo.listar({ onde: { versao_id: ficha.vigente!.id } })).toEqual(regrasAntes);
    // Voltar para dentro do prazo resolve o alerta.
    await salvarMarco(implantacao.id, 'entrega', { ...vazio, planejado_em: PRAZO }, HOJE);
    const depois = await repositorios.atividade.listar({ onde: { origem_tipo: 'implantacao', origem_id: implantacao.id } });
    expect(depois[0]?.situacao).toBe('concluida');
  });

  it('marcos: realizado não fica no futuro; Início e Entrega sempre se aplicam', async () => {
    const ficha = await contratoComImplantacao(HOJE);
    const { implantacao } = await criarImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI, { responsavelId: ID_CAMILA, tarefas: [] }, HOJE);
    await expect(salvarMarco(implantacao.id, 'inicio', { ...vazio, realizado_em: somarDias(HOJE, 1) }, HOJE)).rejects.toThrow('vai até hoje');
    await expect(salvarMarco(implantacao.id, 'entrega', { ...vazio, nao_se_aplica: true }, HOJE)).rejects.toThrow('sempre se aplica');
    expect((await salvarMarco(implantacao.id, 'inicio', { ...vazio, realizado_em: HOJE }, HOJE)).situacao).toBe('em_andamento');
    expect((await salvarMarco(implantacao.id, 'configuracao', { ...vazio, nao_se_aplica: true }, HOJE)).situacao).toBe('em_validacao');
  });

  it('CA-12.02: o aceite vira evento do contrato e gera a parcela de 50% no aceite', async () => {
    const ficha = await contratoComImplantacao(HOJE);
    await ativarProgramacao(ficha.contrato.id, { categoriaRecorrente: categoria('Assinaturas'), categoriaUnica: categoria('Implantação/setup') }, HOJE);
    const unicas = async () => (await repositorios.titulo.listar({ onde: { origem: 'contrato', origem_id: ficha.contrato.id } })).filter((titulo) => titulo.periodo_inicio === titulo.periodo_fim);
    expect((await unicas()).map((titulo) => titulo.valor)).toEqual([1000]);
    const { implantacao } = await criarImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI, { responsavelId: ID_CAMILA, tarefas: [] }, HOJE);
    await expect(registrarAceiteDaEntrega(implantacao.id, { data: HOJE, porTexto: 'Ana do Café', evidenciaUrl: DRIVE }, HOJE)).rejects.toThrow('entrega (Go Live) realizada');
    const entrega = somarDias(HOJE, 10);
    const aceite = somarDias(HOJE, 12);
    await salvarMarco(implantacao.id, 'entrega', { ...vazio, realizado_em: entrega }, entrega);
    await expect(registrarAceiteDaEntrega(implantacao.id, { data: aceite, porTexto: '', evidenciaUrl: DRIVE }, aceite)).rejects.toThrow('quem aceitou');
    await expect(registrarAceiteDaEntrega(implantacao.id, { data: somarDias(entrega, -1), porTexto: 'Ana', evidenciaUrl: DRIVE }, aceite)).rejects.toThrow('antes da entrega');
    const resultado = await registrarAceiteDaEntrega(implantacao.id, { data: aceite, porTexto: 'Ana do Café', evidenciaUrl: DRIVE }, aceite);
    expect(resultado).toMatchObject({ eventoNovo: true, titulosGerados: 1, programacaoAtiva: true });
    const parcelas = await unicas();
    expect(parcelas.map((titulo) => titulo.valor)).toEqual([1000, 1000]);
    expect(parcelas.some((titulo) => titulo.vencimento === aceite)).toBe(true);
    const evento = (await repositorios.evento_contrato.listar({ onde: { contrato_id: ficha.contrato.id, tipo: 'aceite' } }))[0];
    expect(evento).toMatchObject({ data: aceite, evidencia_url: DRIVE });
    const fichaImpl = (await carregarImplantacao(implantacao.id))!;
    expect(fichaImpl).toMatchObject({ aceite_em: aceite, aceite_por_texto: 'Ana do Café', situacao: 'acompanhamento' });
    await expect(registrarAceiteDaEntrega(implantacao.id, { data: aceite, porTexto: 'Ana', evidenciaUrl: DRIVE }, aceite)).rejects.toThrow('já foi registrado');
  });

  it('concluir exige os marcos; suspender pede motivo e retomar volta à situação dos marcos', async () => {
    const ficha = await contratoComImplantacao(HOJE);
    const { implantacao } = await criarImplantacao(ficha.contrato.id, ID_PRODUTO_KIPI, { responsavelId: ID_CAMILA, tarefas: [] }, HOJE);
    await expect(concluirImplantacao(implantacao.id, HOJE)).rejects.toThrow('Falta registrar: Início (kickoff)');
    await expect(interromperImplantacao(implantacao.id, 'suspensa', ' ', HOJE)).rejects.toThrow('Suspender exige motivo.');
    expect((await interromperImplantacao(implantacao.id, 'suspensa', 'Cliente pediu pausa', HOJE)).situacao).toBe('suspensa');
    expect((await retomarImplantacao(implantacao.id, HOJE)).situacao).toBe('nao_iniciada');
    for (const marco of ['inicio', 'configuracao', 'validacao', 'entrega'] as const) await salvarMarco(implantacao.id, marco, { ...vazio, realizado_em: HOJE }, HOJE);
    await salvarMarco(implantacao.id, 'acompanhamento', { ...vazio, nao_se_aplica: true }, HOJE);
    expect((await concluirImplantacao(implantacao.id, HOJE)).situacao).toBe('concluida');
    await expect(salvarMarco(implantacao.id, 'inicio', vazio, HOJE)).rejects.toThrow('só para consulta');
  });
});
