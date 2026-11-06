import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { AREAS_INICIAIS, ID_BRUNA, ID_CAMILA, ID_CONTRAPARTE_CONTABILIDADE, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI, ID_ROTINA_BACKUP, ID_ROTINA_EXEMPLO } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import type { Atividade } from '@/dados/tipos/atividade';
import { REGISTROS_INICIAIS, ROTINAS_INICIAIS } from './apoio-testes';
import { cancelarAtividade, concluirAtividade, adiarAtividade, trocarResponsavel, carregarMeuDia } from './atividades';
import { criarAtividade, formularioAtividadeVazio } from './atividades-formulario';
import { alterarPrazo, duplicarAtividade } from './atividades-painel';
import { salvarFormularioGeral, formularioDosValores, lerConfiguracoes } from './configuracoes';
import { ID_CONSOLIDADA } from './contextos';
import { limparExemplos, resumoDosDados } from './dados';
import { historicoDaAtividade } from './historico';
import { vinculosDaPessoa } from './pessoas';
import {
  carregarRotinas,
  chaveDaOcorrencia,
  criarRotina,
  dadosDoFormularioRotina,
  editarOcorrencia,
  editarRotina,
  encerrarRotina,
  esquemaDoFormularioRotina,
  formularioDaRotina,
  formularioRotinaVazio,
  gerarOcorrencias,
  modeloVazio,
  pausarRotina,
  quantasOcorrenciasFuturas,
  repetirAtividade,
  retomarRotina,
  type DadosDaRotina,
} from './recorrencias';
import { executarRotinas } from './rotinas';
import type { RegraDeRepeticao } from './repeticao';

const HOJE = '2026-11-06'; // uma sexta
const TECNOLOGIA = AREAS_INICIAIS.find((area) => area.nome === 'Tecnologia')!.id;
const LINK = 'https://drive.google.com/file/d/abc';

function regra(alteracoes: Partial<RegraDeRepeticao> = {}): RegraDeRepeticao {
  return { frequencia: 'semanal', intervalo: 1, dias_semana: [1], dia_mes: null, ultimo_dia: false, mes: null, hora: null, inicio: HOJE, fim_data: null, fim_ocorrencias: null, ...alteracoes };
}

function dados(alteracoes: Partial<DadosDaRotina> = {}): DadosDaRotina {
  return { titulo: 'Revisar o caixa', responsavel_id: ID_KIMBERLY, modelo: modeloVazio(), regra: regra(), ...alteracoes };
}

describe('T03.05 e as rotinas do dia', () => {
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

  const obter = async (id: string) => (await repositorios.atividade.obter(id)) as Atividade;
  const daRotina = async (id: string, incluirArquivados = false) => (await repositorios.atividade.listar({ onde: { recorrencia_id: id }, incluirArquivados })).sort((a, b) => (a.ocorrencia_data ?? '').localeCompare(b.ocorrencia_data ?? ''));
  const datas = (linhas: readonly Atividade[]) => linhas.map((atividade) => atividade.ocorrencia_data);

  describe('carga inicial', () => {
    it('as rotinas da especificação não são exemplo; a de exemplo é', async () => {
      const rotinas = await repositorios.recorrencia.listar();
      expect(rotinas).toHaveLength(ROTINAS_INICIAIS);
      expect(rotinas.filter((rotina) => rotina.exemplo).map((rotina) => rotina.id)).toEqual([ID_ROTINA_EXEMPLO]);
      expect(rotinas.find((rotina) => rotina.id === ID_ROTINA_BACKUP)).toMatchObject({ titulo: 'Exportar backup da Central e salvar no Drive', responsavel_id: ID_CAMILA, frequencia: 'semanal', dias_semana: [1], fase_minima: null, situacao: 'ativa', inicio: HOJE });
    });

    it('as das outras fases dizem que esperam', async () => {
      const { rotinas } = await carregarRotinas(HOJE);
      expect(rotinas.filter((rotina) => rotina.aguardaFase).map((rotina) => [rotina.titulo, rotina.aguardaFase, rotina.proxima])).toEqual([
        ['Revisão de acessos às ferramentas', 'f2', null],
        ['Atualizar KPIs mensais dos produtos', 'f0b', null],
        ['Fechamento mensal', 'f1', null],
        ['Revisão jurídica anual dos documentos legais', 'f0b', null],
      ]);
    });

    it('a primeira ocorrência da rotina de exemplo já está no Histórico', async () => {
      const [primeira] = await daRotina(ID_ROTINA_EXEMPLO);
      expect(primeira).toMatchObject({ situacao: 'concluida', ocorrencia_numero: 1, ocorrencia_data: '2026-10-17', exemplo: true });
    });

    it('conta como registro', async () => {
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS);
    });
  });

  describe('gerar ocorrências (RN-03.15)', () => {
    it('até 30 dias à frente, só das rotinas da fase', async () => {
      expect(await gerarOcorrencias(HOJE)).toBe(10);
      expect(datas(await daRotina(ID_ROTINA_BACKUP))).toEqual(['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
      expect(datas(await daRotina(ID_ROTINA_EXEMPLO))).toEqual(['2026-10-17', '2026-11-17']);
      const todas = await repositorios.atividade.listar();
      expect(todas.filter((atividade) => atividade.titulo === 'Fechamento mensal')).toEqual([]);
    });

    it('rodar duas vezes no mesmo dia não duplica (CA-03.09)', async () => {
      await gerarOcorrencias(HOJE);
      const antes = (await repositorios.atividade.listar()).length;
      expect(await gerarOcorrencias(HOJE)).toBe(0);
      expect((await repositorios.atividade.listar()).length).toBe(antes);
    });

    it('cada ocorrência é uma atividade própria, com número e código', async () => {
      await gerarOcorrencias(HOJE);
      const [primeira, segunda] = await daRotina(ID_ROTINA_BACKUP);
      expect(primeira).toMatchObject({ titulo: 'Exportar backup da Central e salvar no Drive', tipo: 'tarefa', responsavel_id: ID_CAMILA, area_id: TECNOLOGIA, situacao: 'a_fazer', prazo: '2026-11-09', ocorrencia_numero: 1, recorrencia_id: ID_ROTINA_BACKUP, chave_idempotencia: chaveDaOcorrencia(ID_ROTINA_BACKUP, '2026-11-09'), exemplo: false });
      expect(segunda?.ocorrencia_numero).toBe(2);
      expect(primeira?.codigo).not.toBe(segunda?.codigo);
    });

    it('o que foi concluído, cancelado ou tirado não volta (RT-09)', async () => {
      await gerarOcorrencias(HOJE);
      const [primeira, segunda, terceira] = await daRotina(ID_ROTINA_BACKUP);
      await concluirAtividade(primeira!.id, ID_KIMBERLY);
      await cancelarAtividade(segunda!.id, 'Não precisou');
      await repositorios.atividade.arquivar(terceira!.id);
      expect(await gerarOcorrencias(HOJE)).toBe(0);
    });

    it('concluir uma não conclui as próximas (RN-03.18)', async () => {
      await gerarOcorrencias(HOJE);
      const [primeira, segunda] = await daRotina(ID_ROTINA_BACKUP);
      await concluirAtividade(primeira!.id, ID_KIMBERLY);
      expect((await obter(segunda!.id)).situacao).toBe('a_fazer');
    });

    it('a janela anda com os dias; o que já passou e ninguém gerou fica para trás', async () => {
      await gerarOcorrencias(HOJE);
      expect(await gerarOcorrencias('2026-11-13')).toBe(2);
      expect(datas(await daRotina(ID_ROTINA_BACKUP))).toEqual(['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']);
      expect(await gerarOcorrencias('2027-03-01')).toBeGreaterThan(0);
      const backups = await daRotina(ID_ROTINA_BACKUP);
      expect(backups.some((atividade) => atividade.ocorrencia_data === '2027-01-04')).toBe(false);
      expect(backups.find((atividade) => atividade.ocorrencia_data === '2027-03-01')?.ocorrencia_numero).toBe(17);
    });

    it('rotina pausada não gera; ao retomar, não recupera o tempo parado', async () => {
      await pausarRotina(ID_ROTINA_BACKUP);
      await gerarOcorrencias(HOJE);
      expect(await daRotina(ID_ROTINA_BACKUP)).toEqual([]);
      await retomarRotina(ID_ROTINA_BACKUP);
      await gerarOcorrencias('2026-12-01');
      expect(datas(await daRotina(ID_ROTINA_BACKUP))[0]).toBe('2026-12-07');
    });

    it('a rotina de outra fase começa quando a fase chega', async () => {
      await repositorios.configuracao.salvar({ fase_ativa: 'f0b' });
      await gerarOcorrencias(HOJE);
      expect((await repositorios.atividade.listar()).filter((atividade) => atividade.titulo === 'Atualizar KPIs mensais dos produtos').map((atividade) => atividade.prazo)).toEqual(['2026-12-05']);
      expect((await repositorios.atividade.listar()).filter((atividade) => atividade.titulo === 'Fechamento mensal')).toEqual([]);
    });

    it('rotina que chegou ao fim encerra sozinha', async () => {
      const { rotina } = await criarRotina(dados({ regra: regra({ fim_ocorrencias: 2 }) }), HOJE);
      await gerarOcorrencias(HOJE);
      expect(datas(await daRotina(rotina.id))).toEqual(['2026-11-09', '2026-11-16']);
      await gerarOcorrencias('2026-11-20');
      expect((await repositorios.recorrencia.obter(rotina.id))?.situacao).toBe('encerrada');
    });

    it('fica de pé mesmo com área, produto e pessoa arquivados', async () => {
      const { rotina } = await criarRotina(dados({ modelo: { ...modeloVazio(), area_id: TECNOLOGIA, produtos: [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI], participantes: [ID_BRUNA, ID_CAMILA] } }), HOJE);
      const [primeira] = await daRotina(rotina.id);
      expect((await repositorios.atividade_produto.listar({ onde: { atividade_id: primeira!.id } })).map((ligacao) => ligacao.produto_id).sort()).toEqual([ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI].sort());
      await repositorios.area.arquivar(TECNOLOGIA);
      await repositorios.produto.arquivar(ID_PRODUTO_ZUPI);
      await repositorios.pessoa.arquivar(ID_BRUNA);
      await gerarOcorrencias('2026-11-20');
      const ultima = (await daRotina(rotina.id)).at(-1)!;
      expect(ultima.area_id).toBeNull();
      expect((await repositorios.atividade_produto.listar({ onde: { atividade_id: ultima.id } })).map((ligacao) => ligacao.produto_id)).toEqual([ID_PRODUTO_KIPI]);
      expect((await repositorios.atividade_participante.listar({ onde: { atividade_id: ultima.id } })).map((ligacao) => ligacao.pessoa_id)).toEqual([ID_CAMILA]);
    });

    it('lembrete: aviso no dia e na hora, sem prazo; demanda: quem pediu', async () => {
      const lembrete = await criarRotina(dados({ modelo: modeloVazio('lembrete'), regra: regra({ hora: '09:30' }) }), HOJE);
      expect(lembrete.primeira).toMatchObject({ tipo: 'lembrete', prazo: null, aviso_em: '2026-11-09T12:30:00.000Z' });
      const demanda = await criarRotina(dados({ modelo: { ...modeloVazio('demanda'), solicitante_texto: 'Cliente Lumi', resultado_esperado: 'Relatório' }, regra: regra({ hora: '08:00' }) }), HOJE);
      expect(demanda.primeira).toMatchObject({ tipo: 'demanda', prazo: '2026-11-09', prazo_hora: '08:00', solicitante_texto: 'Cliente Lumi', resultado_esperado: 'Relatório' });
    });

    it('o apoio vem junto: contexto, participantes, checklist, vínculo e link', async () => {
      const { primeira } = await criarRotina(dados({ modelo: { ...modeloVazio(), produtos: [ID_PRODUTO_KIPI], participantes: [ID_CAMILA, ID_KIMBERLY], checklist: ['Um', 'Dois'], vinculos: [{ tipo: 'contraparte', id: ID_CONTRAPARTE_CONTABILIDADE }], arquivos: [LINK] } }), HOJE);
      const id = primeira!.id;
      expect((await repositorios.atividade_produto.listar({ onde: { atividade_id: id } })).map((ligacao) => ligacao.produto_id)).toEqual([ID_PRODUTO_KIPI]);
      expect((await repositorios.atividade_participante.listar({ onde: { atividade_id: id } })).map((ligacao) => ligacao.pessoa_id)).toEqual([ID_CAMILA]);
      expect((await repositorios.checklist_item.listar({ onde: { registro_id: id } })).map((item) => item.texto)).toEqual(['Um', 'Dois']);
      expect((await repositorios.vinculo.listar()).some((vinculo) => vinculo.origem_id === id || vinculo.destino_id === id)).toBe(true);
      expect((await repositorios.anexo_link.listar({ onde: { registro_id: id } })).map((anexo) => anexo.url)).toEqual([LINK]);
    });

    it('nas rotinas do dia, quem cria é o Sistema, e o aviso diz o que nasceu', async () => {
      const resultado = await executarRotinas();
      expect(resultado).toMatchObject({ executou: true, novos: 10, falhas: [], novidades: ['10 ocorrências novas'] });
      const [primeira] = await daRotina(ID_ROTINA_BACKUP);
      expect(primeira?.criado_por).toBeNull();
      expect((await historicoDaAtividade(primeira!.id)).at(-1)?.texto).toContain('Sistema criou a atividade');
      expect(await executarRotinas()).toMatchObject({ executou: false });
    });

    it('aparece no Meu dia na hora, como as outras', async () => {
      await gerarOcorrencias(HOJE);
      const { atividades } = await carregarMeuDia();
      expect(atividades.filter((atividade) => atividade.recorrencia_id === ID_ROTINA_BACKUP)).toHaveLength(4);
    });
  });

  describe('criar', () => {
    it('a primeira nasce já, mesmo fora da janela de 30 dias', async () => {
      const { rotina, primeira } = await criarRotina(dados({ regra: regra({ frequencia: 'anual', dia_mes: 15, mes: 3, dias_semana: [] }) }), HOJE);
      expect(primeira).toMatchObject({ prazo: '2027-03-15', ocorrencia_numero: 1 });
      expect(datas(await daRotina(rotina.id))).toEqual(['2027-03-15']);
      await gerarOcorrencias(HOJE);
      expect(datas(await daRotina(rotina.id))).toEqual(['2027-03-15']);
    });

    it('começando no futuro, a primeira é no início', async () => {
      const { primeira } = await criarRotina(dados({ regra: regra({ inicio: '2027-05-01' }) }), HOJE);
      expect(primeira?.prazo).toBe('2027-05-03');
    });

    it('sem nenhuma ocorrência possível, não cria', async () => {
      await expect(criarRotina(dados({ regra: regra({ fim_data: '2026-11-07' }) }), HOJE)).rejects.toThrow('Com esse fim, a rotina não teria nenhuma ocorrência.');
      expect(await repositorios.recorrencia.listar()).toHaveLength(ROTINAS_INICIAIS);
    });

    it('pelo Adicionar: a atividade criada é a primeira ocorrência (T03.03)', async () => {
      const formulario = { ...formularioAtividadeVazio('tarefa', ID_KIMBERLY, ID_CONSOLIDADA), titulo: 'Repetida', repetir: true, repeticao: { ...formularioAtividadeVazio('tarefa', ID_KIMBERLY, ID_CONSOLIDADA).repeticao, dias_semana: [1] }, contextos: [ID_PRODUTO_KIPI], checklist: 'Um', arquivo: LINK };
      const criada = await criarAtividade(formulario);
      expect(criada).toMatchObject({ titulo: 'Repetida', prazo: '2026-11-09', ocorrencia_numero: 1 });
      const rotina = await repositorios.recorrencia.obter(criada.recorrencia_id as string);
      expect(rotina).toMatchObject({ titulo: 'Repetida', responsavel_id: ID_KIMBERLY, frequencia: 'semanal', dias_semana: [1] });
      expect(rotina?.modelo).toMatchObject({ produtos: [ID_PRODUTO_KIPI], checklist: ['Um'], arquivos: [LINK] });
      expect(datas(await daRotina(rotina!.id))).toEqual(['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    });

    it('duplicar uma ocorrência dá uma atividade solta', async () => {
      await gerarOcorrencias(HOJE);
      const [primeira] = await daRotina(ID_ROTINA_BACKUP);
      const copia = await duplicarAtividade(primeira!.id);
      expect(copia).toMatchObject({ recorrencia_id: null, ocorrencia_numero: null, ocorrencia_data: null, chave_idempotencia: null });
    });
  });

  describe('editar a rotina (RN-03.17)', () => {
    let id: string;
    beforeEach(async () => {
      id = (await criarRotina(dados(), HOJE)).rotina.id;
    });

    it('sem mudar a agenda, vale para as próximas que ninguém editou', async () => {
      const [primeira, segunda] = await daRotina(id);
      await trocarResponsavel(segunda!.id, ID_BRUNA);
      await editarRotina(id, dados({ titulo: 'Novo título', responsavel_id: ID_CAMILA, modelo: { ...modeloVazio(), produtos: [ID_PRODUTO_KIPI], prioridade: 'alta' } }), HOJE);
      expect((await repositorios.recorrencia.obter(id))).toMatchObject({ titulo: 'Novo título', situacao: 'ativa', substitui_id: null });
      const depois = await obter(primeira!.id);
      expect(depois).toMatchObject({ titulo: 'Novo título', responsavel_id: ID_CAMILA, prioridade: 'alta' });
      expect((await repositorios.atividade_produto.listar({ onde: { atividade_id: primeira!.id } })).map((ligacao) => ligacao.produto_id)).toEqual([ID_PRODUTO_KIPI]);
      expect(await obter(segunda!.id)).toMatchObject({ titulo: 'Revisar o caixa', responsavel_id: ID_BRUNA, editada_individualmente: true });
    });

    it('mudando a agenda, encerra a regra e nasce outra; quem foi mexida fica', async () => {
      const [primeira, segunda, terceira] = await daRotina(id);
      await concluirAtividade(primeira!.id, ID_KIMBERLY);
      await trocarResponsavel(segunda!.id, ID_BRUNA);
      const nova = await editarRotina(id, dados({ regra: regra({ dias_semana: [1, 3], inicio: '2026-11-01' }) }), HOJE);
      expect(await repositorios.recorrencia.obter(id)).toMatchObject({ situacao: 'encerrada', fim_data: '2026-11-05' });
      expect(nova).toMatchObject({ substitui_id: id, situacao: 'ativa', inicio: HOJE, dias_semana: [1, 3] });
      // A concluída fica na regra antiga; a intocada sai; a editada acompanha a data dela na regra nova.
      expect((await obter(primeira!.id)).recorrencia_id).toBe(id);
      expect((await obter(terceira!.id)).arquivado_em).not.toBeNull();
      expect((await obter(segunda!.id)).recorrencia_id).toBe(nova.id);
      const datasNovas = datas(await daRotina(nova.id));
      expect(new Set(datasNovas).size).toBe(datasNovas.length);
      expect(datasNovas.slice(0, 4)).toEqual(['2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18']);
      expect(await gerarOcorrencias(HOJE)).toBe(10);
      expect(await gerarOcorrencias(HOJE)).toBe(0);
    });

    it('sem nenhuma ocorrência possível, não muda nada', async () => {
      await expect(editarRotina(id, dados({ regra: regra({ inicio: HOJE, fim_data: '2026-11-07' }) }), HOJE)).rejects.toThrow('Com esse fim, a rotina não teria nenhuma ocorrência.');
      expect((await repositorios.recorrencia.obter(id))?.situacao).toBe('ativa');
    });

    it('rotina encerrada não edita', async () => {
      await encerrarRotina(id, { cancelarFuturas: false, motivo: '' }, HOJE);
      await expect(editarRotina(id, dados(), HOJE)).rejects.toThrow('Esta rotina está encerrada.');
    });
  });

  describe('editar uma ocorrência (RN-03.17)', () => {
    let id: string;
    let ocorrencias: Atividade[];
    beforeEach(async () => {
      id = (await criarRotina(dados({ regra: regra({ fim_ocorrencias: 10 }) }), HOJE)).rotina.id;
      ocorrencias = await daRotina(id);
    });

    it('"Somente esta" fica marcada, e as outras não mudam', async () => {
      await editarOcorrencia(ocorrencias[1]!.id, { titulo: 'Só esta', produtos: [ID_PRODUTO_KIPI], participantes: [ID_CAMILA] }, 'esta');
      expect(await obter(ocorrencias[1]!.id)).toMatchObject({ titulo: 'Só esta', editada_individualmente: true, recorrencia_id: id });
      expect((await repositorios.atividade_produto.listar({ onde: { atividade_id: ocorrencias[1]!.id } })).map((ligacao) => ligacao.produto_id)).toEqual([ID_PRODUTO_KIPI]);
      expect((await repositorios.atividade_participante.listar({ onde: { atividade_id: ocorrencias[1]!.id } })).map((ligacao) => ligacao.pessoa_id)).toEqual([ID_CAMILA]);
      expect((await obter(ocorrencias[2]!.id)).titulo).toBe('Revisar o caixa');
      expect((await repositorios.recorrencia.obter(id))?.titulo).toBe('Revisar o caixa');
    });

    it('"Esta e as próximas" encerra a regra na data e cria outra; as anteriores não mudam', async () => {
      await editarOcorrencia(ocorrencias[2]!.id, { titulo: 'Só o título' }, 'esta');
      await editarOcorrencia(ocorrencias[1]!.id, { titulo: 'Daqui em diante', prioridade: 'alta', produtos: [ID_PRODUTO_ZUPI] }, 'proximas');
      const antiga = await repositorios.recorrencia.obter(id);
      expect(antiga).toMatchObject({ situacao: 'encerrada', fim_data: '2026-11-15', titulo: 'Revisar o caixa' });
      const nova = (await repositorios.recorrencia.listar({ onde: { substitui_id: id } }))[0]!;
      expect(nova).toMatchObject({ titulo: 'Daqui em diante', inicio: '2026-11-16', fim_ocorrencias: 9, situacao: 'ativa' });
      expect(nova.modelo).toMatchObject({ prioridade: 'alta', produtos: [ID_PRODUTO_ZUPI] });
      expect(await obter(ocorrencias[0]!.id)).toMatchObject({ titulo: 'Revisar o caixa', recorrencia_id: id, ocorrencia_numero: 1 });
      expect(await obter(ocorrencias[1]!.id)).toMatchObject({ titulo: 'Daqui em diante', prioridade: 'alta', recorrencia_id: nova.id, ocorrencia_numero: 1 });
      // A que foi editada à parte muda de regra, mas continua com o que recebeu.
      expect(await obter(ocorrencias[2]!.id)).toMatchObject({ titulo: 'Só o título', recorrencia_id: nova.id, ocorrencia_numero: 2 });
      expect(await obter(ocorrencias[3]!.id)).toMatchObject({ titulo: 'Daqui em diante', recorrencia_id: nova.id, ocorrencia_numero: 3 });
      expect((await repositorios.atividade_produto.listar({ onde: { atividade_id: ocorrencias[3]!.id } })).map((ligacao) => ligacao.produto_id)).toEqual([ID_PRODUTO_ZUPI]);
    });

    it('depois de "Esta e as próximas", as rotinas do dia não duplicam', async () => {
      await editarOcorrencia(ocorrencias[1]!.id, { titulo: 'Daqui em diante' }, 'proximas');
      await gerarOcorrencias(HOJE);
      const nova = (await repositorios.recorrencia.listar({ onde: { substitui_id: id } }))[0]!;
      const datasNovas = datas(await daRotina(nova.id));
      expect(datasNovas).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
    });

    it('as próximas nascem da regra nova', async () => {
      await editarOcorrencia(ocorrencias[1]!.id, { titulo: 'Daqui em diante', responsavel_id: ID_CAMILA }, 'proximas');
      await gerarOcorrencias('2026-11-20');
      const nova = (await repositorios.recorrencia.listar({ onde: { substitui_id: id } }))[0]!;
      expect((await daRotina(nova.id)).at(-1)).toMatchObject({ titulo: 'Daqui em diante', responsavel_id: ID_CAMILA, ocorrencia_data: '2026-12-14', ocorrencia_numero: 5 });
    });

    it('encerrada não edita', async () => {
      await concluirAtividade(ocorrencias[0]!.id, ID_KIMBERLY);
      await expect(editarOcorrencia(ocorrencias[0]!.id, { titulo: 'x' }, 'esta')).rejects.toThrow('Esta atividade está encerrada: reabra para mudar.');
    });

    it('mudar a data de uma é sempre só dela', async () => {
      await alterarPrazo(ocorrencias[0]!.id, '2026-11-10', '');
      expect((await obter(ocorrencias[0]!.id)).editada_individualmente).toBe(true);
      await adiarAtividade(ocorrencias[1]!.id, '2026-11-17', HOJE);
      expect((await obter(ocorrencias[1]!.id)).editada_individualmente).toBe(true);
      expect((await obter(ocorrencias[2]!.id)).editada_individualmente).toBe(false);
    });
  });

  describe('pausar e encerrar (RN-03.18)', () => {
    let id: string;
    beforeEach(async () => {
      id = (await criarRotina(dados(), HOJE)).rotina.id;
    });

    it('encerrar sem cancelar: as ocorrências ficam, e nada mais nasce', async () => {
      expect(await quantasOcorrenciasFuturas(id, HOJE)).toBe(4);
      expect(await encerrarRotina(id, { cancelarFuturas: false, motivo: '' }, HOJE)).toBe(0);
      expect((await repositorios.recorrencia.obter(id))?.situacao).toBe('encerrada');
      expect((await daRotina(id)).every((atividade) => atividade.situacao === 'a_fazer')).toBe(true);
      await gerarOcorrencias('2026-12-20');
      expect(await daRotina(id)).toHaveLength(4);
    });

    it('encerrar cancelando pede motivo e cancela as futuras abertas', async () => {
      await expect(encerrarRotina(id, { cancelarFuturas: true, motivo: ' ' }, HOJE)).rejects.toThrow('Informe o motivo para cancelar as ocorrências.');
      const [primeira] = await daRotina(id);
      await concluirAtividade(primeira!.id, ID_KIMBERLY);
      expect(await encerrarRotina(id, { cancelarFuturas: true, motivo: 'Não precisa mais' }, HOJE)).toBe(3);
      const linhas = await daRotina(id);
      expect(linhas[0]?.situacao).toBe('concluida');
      expect(linhas.slice(1).every((atividade) => atividade.situacao === 'cancelada' && atividade.cancelada_motivo === 'Não precisa mais')).toBe(true);
    });

    it('as atrasadas ficam: só o que vem pela frente é cancelado', async () => {
      await encerrarRotina(id, { cancelarFuturas: true, motivo: 'Fim' }, '2026-11-20');
      const linhas = await daRotina(id);
      expect(linhas[0]?.situacao).toBe('a_fazer');
      expect(linhas[1]?.situacao).toBe('a_fazer');
      expect(linhas[2]?.situacao).toBe('cancelada');
    });
  });

  describe('uma atividade passa a repetir', () => {
    it('vira a primeira ocorrência, na primeira data da regra', async () => {
      const atividade = await criarAtividade({ ...formularioAtividadeVazio('tarefa', ID_KIMBERLY, ID_CONSOLIDADA), titulo: 'Solta', prazo: '2026-11-07', contextos: [ID_PRODUTO_KIPI], checklist: 'Um', arquivo: LINK });
      const rotina = await repetirAtividade(atividade.id, regra(), HOJE);
      expect(rotina).toMatchObject({ titulo: 'Solta', responsavel_id: ID_KIMBERLY });
      expect(rotina.modelo).toMatchObject({ produtos: [ID_PRODUTO_KIPI], checklist: ['Um'], arquivos: [LINK] });
      expect(await obter(atividade.id)).toMatchObject({ recorrencia_id: rotina.id, ocorrencia_numero: 1, ocorrencia_data: '2026-11-09', prazo: '2026-11-09' });
      expect(datas(await daRotina(rotina.id))).toEqual(['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
      await expect(repetirAtividade(atividade.id, regra(), HOJE)).rejects.toThrow('Esta atividade já faz parte de uma rotina.');
    });

    it('alerta e encerrada não repetem', async () => {
      const alerta = (await repositorios.atividade.listar()).find((atividade) => atividade.tipo === 'alerta')!;
      await expect(repetirAtividade(alerta.id, regra(), HOJE)).rejects.toThrow('Alerta não repete');
      const fechada = (await repositorios.atividade.listar()).find((atividade) => atividade.situacao === 'concluida')!;
      await expect(repetirAtividade(fechada.id, regra(), HOJE)).rejects.toThrow('encerrada');
    });
  });

  describe('formulário de T03.05', () => {
    const mensagens = (alteracoes: Partial<ReturnType<typeof formularioRotinaVazio>>, minimo?: string) => {
      const resultado = esquemaDoFormularioRotina(minimo).safeParse({ ...formularioRotinaVazio(ID_KIMBERLY, ID_CONSOLIDADA, HOJE), titulo: 'Uma rotina', ...alteracoes });
      return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
    };

    it('confere o título, a regra, a demanda e o link', () => {
      expect(mensagens({})).toEqual([]);
      expect(mensagens({ titulo: ' ' })).toEqual(['Informe o título.']);
      expect(mensagens({ responsavel_id: '' })).toEqual(['Escolha a responsável.']);
      expect(mensagens({ tipo: 'lembrete' })).toEqual(['Lembrete exige a hora do aviso.']);
      expect(mensagens({ tipo: 'demanda', solicitante: '' })).toEqual(['Diga quem pediu.']);
      expect(mensagens({ tipo: 'demanda', solicitante: 'outra' })).toEqual(['Escreva quem pediu.']);
      expect(mensagens({ arquivo: 'https://exemplo.com' })[0]).toContain('drive.google.com');
    });

    it('só ao criar o início precisa ser de hoje em diante', () => {
      const repeticao = { ...formularioRotinaVazio(ID_KIMBERLY, ID_CONSOLIDADA, HOJE).repeticao, inicio: '2026-11-01' };
      expect(mensagens({ repeticao }, HOJE)).toEqual(['A rotina começa hoje ou depois.']);
      expect(mensagens({ repeticao })).toEqual([]);
    });

    it('vai e volta sem perder nada', async () => {
      const original = dados({ modelo: { ...modeloVazio('demanda'), solicitante_texto: 'Cliente', produtos: [ID_PRODUTO_KIPI], checklist: ['Um', 'Dois'], arquivos: [LINK, 'https://drive.google.com/file/d/b'], vinculos: [{ tipo: 'produto', id: ID_PRODUTO_KIPI }] } });
      const { rotina } = await criarRotina(original, HOJE);
      const formulario = formularioDaRotina(rotina);
      expect(formulario).toMatchObject({ tipo: 'demanda', solicitante: 'outra', solicitante_texto: 'Cliente', checklist: 'Um\nDois', arquivo: LINK });
      const volta = dadosDoFormularioRotina(formulario, rotina);
      expect(volta.modelo).toEqual(original.modelo);
      expect(volta.regra).toMatchObject(original.regra);
    });
  });

  describe('com as outras telas', () => {
    it('quem responde por uma rotina em uso não arquiva (RN-02.04)', async () => {
      const { rotina } = await criarRotina(dados({ responsavel_id: ID_BRUNA }), HOJE);
      expect(await vinculosDaPessoa(ID_BRUNA)).toContain('Responsável por 1 rotina');
      await encerrarRotina(rotina.id, { cancelarFuturas: true, motivo: 'Fim' }, HOJE);
      expect(await vinculosDaPessoa(ID_BRUNA)).not.toContain('Responsável por 1 rotina');
    });

    it('T02.01 e a rotina do backup dizem a mesma coisa, nos dois sentidos', async () => {
      await gerarOcorrencias(HOJE);
      const pessoas = await repositorios.pessoa.listar();
      await salvarFormularioGeral({ ...formularioDosValores(await lerConfiguracoes(), pessoas), responsavel_backup_id: ID_KIMBERLY });
      expect((await repositorios.recorrencia.obter(ID_ROTINA_BACKUP))?.responsavel_id).toBe(ID_KIMBERLY);
      expect((await daRotina(ID_ROTINA_BACKUP)).every((atividade) => atividade.responsavel_id === ID_KIMBERLY)).toBe(true);
      const rotina = (await repositorios.recorrencia.obter(ID_ROTINA_BACKUP))!;
      await editarRotina(ID_ROTINA_BACKUP, { titulo: rotina.titulo, responsavel_id: ID_CAMILA, modelo: rotina.modelo, regra: rotina }, HOJE);
      expect((await repositorios.configuracao.ler()).responsavel_backup_id).toBe(ID_CAMILA);
    });

    it('limpar exemplos leva a rotina de exemplo e o que nasceu dela; as reais ficam', async () => {
      await gerarOcorrencias(HOJE);
      await limparExemplos();
      const rotinas = await repositorios.recorrencia.listar();
      expect(rotinas).toHaveLength(6);
      expect(rotinas.some((rotina) => rotina.exemplo)).toBe(false);
      expect((await repositorios.atividade.listar()).some((atividade) => atividade.exemplo)).toBe(false);
      expect(await daRotina(ID_ROTINA_BACKUP)).toHaveLength(4);
    });

    it('limpar exemplos passa para quem fica o que uma pessoa fictícia respondia', async () => {
      const { rotina, primeira } = await criarRotina(dados({ responsavel_id: ID_BRUNA, modelo: { ...modeloVazio('demanda'), participantes: [ID_BRUNA, ID_CAMILA], solicitante_pessoa_id: ID_BRUNA, vinculos: [{ tipo: 'contraparte', id: ID_CONTRAPARTE_CONTABILIDADE }] } }), HOJE);
      await limparExemplos();
      const depois = await repositorios.recorrencia.obter(rotina.id);
      expect(depois?.responsavel_id).toBe(ID_KIMBERLY);
      expect(depois?.modelo).toMatchObject({ participantes: [ID_CAMILA], solicitante_pessoa_id: null, solicitante_texto: 'Bruna Alves', vinculos: [] });
      expect((await obter(primeira!.id)).responsavel_id).toBe(ID_KIMBERLY);
    });

    it('uma atividade de verdade não fica com responsável fictícia', async () => {
      const criada = await criarAtividade({ ...formularioAtividadeVazio('tarefa', ID_BRUNA, ID_CONSOLIDADA), titulo: 'De verdade' });
      await limparExemplos();
      expect((await obter(criada.id)).responsavel_id).toBe(ID_KIMBERLY);
    });
  });

  describe('dados da versão anterior', () => {
    const paraVersao8 = async () => {
      await repositorios.pessoa.listar();
      armazenamento.removeItem(chaveDaTabela('recorrencia'));
      gravarMeta({ versao_dados: 8 });
      esquecerMetaEmMemoria();
    };

    it('recebe as rotinas sem tocar no resto', async () => {
      await paraVersao8();
      const rotinas = await repositorios.recorrencia.listar();
      expect(rotinas).toHaveLength(ROTINAS_INICIAIS);
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });

    it('quem já limpou os exemplos só recebe as reais', async () => {
      await limparExemplos();
      await paraVersao8();
      const rotinas = await repositorios.recorrencia.listar();
      expect(rotinas).toHaveLength(6);
      expect(rotinas.some((rotina) => rotina.exemplo)).toBe(false);
    });
  });
});
