import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { ID_BRUNA, ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { esquemaAtividade, type Atividade } from '@/dados/tipos/atividade';
import { ATIVIDADES_INICIAIS } from './apoio-testes';
import {
  adiarAtividade,
  agruparAtividades,
  atividadesDaBase,
  atividadesVisiveis,
  bloquearAtividade,
  cancelarAtividade,
  carregarMeuDia,
  colunasDoQuadro,
  concluidaHoje,
  concluirAtividade,
  contextosDaAtividade,
  dataPorExtenso,
  desbloquearAtividade,
  desfazerAdiamento,
  desfazerConclusao,
  dispensarAlerta,
  ehParaHoje,
  estaAberta,
  estaAtrasada,
  estaNoDia,
  FILTROS_MEU_DIA_INICIAIS,
  fraseDoResumo,
  MINHAS,
  moverAtividade,
  moverParaAguardando,
  novaDataDoAdiamento,
  ordenarAtividades,
  prazoEfetivo,
  primeiroNome,
  quantasAtividadesAbertasNaArea,
  quantasAtividadesAbertasNoProduto,
  reabrirAtividade,
  recorteDosFiltros,
  resumoDoDia,
  saudacao,
  textoDoPrazo,
  textoDosAdiamentos,
  trocarResponsavel,
  vinculosDeAtividadeDaPessoa,
  type AtividadeDoDia,
  type DadosMeuDia,
  type FiltrosMeuDia,
} from './atividades';
import { arquivarArea } from './areas';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { limparExemplos, resumoDosDados } from './dados';
import { historicoDoRegistro } from './historico';
import { vinculosDaPessoa } from './pessoas';
import { arquivarProduto } from './produtos';

const HOJE = '2026-11-06';

function atividade(alteracoes: Partial<AtividadeDoDia> = {}): AtividadeDoDia {
  return {
    id: crypto.randomUUID(),
    criado_em: '2026-11-01T12:00:00.000Z',
    criado_por: null,
    atualizado_em: '2026-11-01T12:00:00.000Z',
    atualizado_por: null,
    arquivado_em: null,
    arquivado_por: null,
    versao_registro: 1,
    exemplo: false,
    codigo: 'ATV-2026-9001',
    tipo: 'tarefa',
    titulo: 'Atividade de teste',
    descricao: null,
    area_id: null,
    responsavel_id: ID_KIMBERLY,
    prioridade: 'normal',
    situacao: 'a_fazer',
    bloqueada: false,
    bloqueio_motivo: null,
    bloqueada_em: null,
    inicio: null,
    prazo: null,
    prazo_hora: null,
    aviso_em: null,
    solicitante_pessoa_id: null,
    solicitante_texto: null,
    resultado_esperado: null,
    aguardando_de_pessoa_id: null,
    aguardando_de_texto: null,
    aguardando_desde: null,
    acompanhamento_em: null,
    recorrencia_id: null,
    ocorrencia_numero: null,
    ocorrencia_data: null,
    editada_individualmente: false,
    origem_tipo: null,
    origem_id: null,
    alerta_motivo: null,
    alerta_data_referencia: null,
    alerta_acao: null,
    chave_idempotencia: null,
    adiamentos: 0,
    concluida_em: null,
    concluida_por: null,
    conclusao_nota: null,
    cancelada_motivo: null,
    dispensada_motivo: null,
    produtos: [],
    participantes: [],
    itensFeitos: 0,
    itensTotal: 0,
    comentarios: 0,
    ...alteracoes,
  };
}

const OPCOES = { hoje: HOJE, pessoaAtualId: ID_KIMBERLY, contextoGlobalId: ID_CONSOLIDADA, nomeDaPessoa: (id: string) => (id === ID_KIMBERLY ? 'Kimberly Grebe' : 'Camila Lima') };

const base = (atividades: readonly AtividadeDoDia[], filtros: Partial<FiltrosMeuDia> = {}, opcoes = {}) => atividadesDaBase(atividades, { ...FILTROS_MEU_DIA_INICIAIS, ...filtros }, { ...OPCOES, ...opcoes });

describe('T03.01', () => {
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

  describe('esquema', () => {
    const erros = (alteracoes: Partial<Atividade>) => {
      const resultado = esquemaAtividade.safeParse(atividade(alteracoes));
      return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
    };

    it('título de até 140 caracteres', () => {
      expect(erros({ titulo: 'x'.repeat(140) })).toEqual([]);
      expect(erros({ titulo: 'x'.repeat(141) })).toHaveLength(1);
      expect(erros({ titulo: '  ' })).toHaveLength(1);
    });

    it('as regras que olham só para a própria linha', () => {
      expect(erros({ bloqueada: true })).toEqual(['Bloqueada exige motivo.']);
      expect(erros({ tipo: 'lembrete' })).toEqual(['Lembrete exige data e hora do aviso.']);
      expect(erros({ situacao: 'aguardando' })).toEqual(['Diga de quem está aguardando.']);
      expect(erros({ situacao: 'concluida' })).toEqual(['Concluída registra a data e a hora.']);
      expect(erros({ situacao: 'cancelada' })).toEqual(['Cancelar exige motivo.']);
    });
  });

  describe('o que é derivado (RN-03.04 a RN-03.06)', () => {
    it('atraso vem do prazo, no fuso configurado', () => {
      expect(estaAtrasada(atividade({ prazo: '2026-11-05' }), HOJE)).toBe(true);
      expect(estaAtrasada(atividade({ prazo: HOJE }), HOJE)).toBe(false);
      expect(estaAtrasada(atividade(), HOJE)).toBe(false);
      expect(estaAtrasada(atividade({ prazo: '2026-11-05', situacao: 'concluida', concluida_em: '2026-11-05T12:00:00.000Z' }), HOJE)).toBe(false);
      expect(estaAtrasada(atividade({ prazo: '2026-11-05', situacao: 'cancelada', cancelada_motivo: 'x' }), HOJE)).toBe(false);
    });

    it('lembrete conta o dia do aviso, que vira o dia no fuso certo', () => {
      const lembrete = atividade({ tipo: 'lembrete', aviso_em: '2026-11-07T02:00:00.000Z' });
      expect(prazoEfetivo(lembrete)).toBe('2026-11-06');
      expect(ehParaHoje(lembrete, HOJE)).toBe(true);
      expect(estaAtrasada(atividade({ tipo: 'lembrete', aviso_em: '2026-11-05T15:00:00.000Z' }), HOJE)).toBe(true);
    });

    it('para hoje: prazo, lembrete e acompanhamento', () => {
      expect(ehParaHoje(atividade({ prazo: HOJE }), HOJE)).toBe(true);
      expect(ehParaHoje(atividade({ prazo: '2026-12-01', situacao: 'aguardando', aguardando_de_texto: 'x', acompanhamento_em: HOJE }), HOJE)).toBe(true);
      expect(ehParaHoje(atividade({ prazo: '2026-12-01' }), HOJE)).toBe(false);
    });

    it('concluída sai do dia só no dia seguinte (RN-03.06)', () => {
      const hoje = atividade({ situacao: 'concluida', concluida_em: '2026-11-06T13:00:00.000Z' });
      const ontem = atividade({ situacao: 'concluida', concluida_em: '2026-11-05T13:00:00.000Z' });
      expect(concluidaHoje(hoje, HOJE)).toBe(true);
      expect(estaNoDia(hoje, HOJE)).toBe(true);
      expect(concluidaHoje(ontem, HOJE)).toBe(false);
      expect(estaNoDia(ontem, HOJE)).toBe(false);
    });

    it('nada some ao virar o dia (RN-03.05 e CA-03.02)', () => {
      expect(estaNoDia(atividade({ criado_em: '2026-09-07T12:00:00.000Z' }), HOJE)).toBe(true);
      expect(estaNoDia(atividade({ prazo: '2020-01-01' }), HOJE)).toBe(true);
    });

    it('cancelada e arquivada não estão abertas', () => {
      expect(estaAberta(atividade({ situacao: 'cancelada', cancelada_motivo: 'x' }))).toBe(false);
      expect(estaAberta(atividade({ arquivado_em: '2026-11-01T12:00:00.000Z' }))).toBe(false);
    });
  });

  describe('ordem (RN-03.11)', () => {
    it('bloqueadas e urgentes, atrasadas, hoje, próximas, sem prazo', () => {
      const lista = [
        atividade({ titulo: 'sem prazo' }),
        atividade({ titulo: 'próxima', prazo: '2026-11-20' }),
        atividade({ titulo: 'hoje', prazo: HOJE }),
        atividade({ titulo: 'atrasada', prazo: '2026-11-01' }),
        atividade({ titulo: 'urgente', prazo: '2026-12-01', prioridade: 'urgente' }),
        atividade({ titulo: 'bloqueada', prazo: '2026-11-30', bloqueada: true, bloqueio_motivo: 'x' }),
      ];
      expect(ordenarAtividades(lista, HOJE).map((item) => item.titulo)).toEqual(['bloqueada', 'urgente', 'atrasada', 'hoje', 'próxima', 'sem prazo']);
    });

    it('atrasadas: a mais antiga primeiro', () => {
      const lista = [atividade({ titulo: 'b', prazo: '2026-11-03' }), atividade({ titulo: 'a', prazo: '2026-10-20' })];
      expect(ordenarAtividades(lista, HOJE).map((item) => item.titulo)).toEqual(['a', 'b']);
    });

    it('sem prazo: por prioridade e data de criação', () => {
      const lista = [
        atividade({ titulo: 'normal nova', criado_em: '2026-11-05T12:00:00.000Z' }),
        atividade({ titulo: 'normal antiga', criado_em: '2026-10-05T12:00:00.000Z' }),
        atividade({ titulo: 'alta', prioridade: 'alta', criado_em: '2026-11-06T12:00:00.000Z' }),
      ];
      expect(ordenarAtividades(lista, HOJE).map((item) => item.titulo)).toEqual(['alta', 'normal antiga', 'normal nova']);
    });

    it('concluída urgente não sobe', () => {
      const lista = [atividade({ titulo: 'fechada', prioridade: 'urgente', situacao: 'concluida', concluida_em: '2026-11-06T12:00:00.000Z' }), atividade({ titulo: 'aberta', prazo: HOJE })];
      expect(ordenarAtividades(lista, HOJE).map((item) => item.titulo)).toEqual(['aberta', 'fechada']);
    });
  });

  describe('textos', () => {
    it('o prazo por extenso', () => {
      expect(textoDoPrazo(atividade(), HOJE)).toEqual({ texto: 'Sem prazo', atrasada: false });
      expect(textoDoPrazo(atividade({ prazo: HOJE }), HOJE).texto).toBe('Hoje');
      expect(textoDoPrazo(atividade({ prazo: '2026-11-07' }), HOJE).texto).toBe('Amanhã');
      expect(textoDoPrazo(atividade({ prazo: '2026-11-14' }), HOJE).texto).toBe('14/11 (em 8 dias)');
      expect(textoDoPrazo(atividade({ prazo: '2026-11-03' }), HOJE)).toEqual({ texto: 'Atrasada há 3 dias', atrasada: true });
      expect(textoDoPrazo(atividade({ prazo: '2026-11-05' }), HOJE).texto).toBe('Atrasada há 1 dia');
      expect(textoDoPrazo(atividade({ prazo: HOJE, prazo_hora: '09:30' }), HOJE).texto).toBe('Hoje às 09:30');
    });

    it('lembrete mostra a hora do aviso', () => {
      expect(textoDoPrazo(atividade({ tipo: 'lembrete', aviso_em: '2026-11-06T18:00:00.000Z' }), HOJE).texto).toBe('Hoje às 15:00');
    });

    it('adiada aparece a partir da 2ª vez (RN-03.08)', () => {
      expect(textoDosAdiamentos({ adiamentos: 1 })).toBeNull();
      expect(textoDosAdiamentos({ adiamentos: 2 })).toBe('Adiada 2 vezes');
    });

    it('saudação e data no fuso configurado', () => {
      expect(saudacao(new Date('2026-11-06T11:00:00.000Z'))).toBe('Bom dia');
      expect(saudacao(new Date('2026-11-06T16:00:00.000Z'))).toBe('Boa tarde');
      expect(saudacao(new Date('2026-11-06T23:30:00.000Z'))).toBe('Boa noite');
      expect(saudacao(new Date('2026-11-06T04:00:00.000Z'))).toBe('Boa noite');
      expect(dataPorExtenso(new Date('2026-11-06T15:00:00.000Z'))).toBe('sexta-feira, 6 de novembro');
      expect(primeiroNome('Kimberly Grebe')).toBe('Kimberly');
    });

    it('a frase do resumo', () => {
      const vazio = { atrasadas: 0, hoje: 0, em_andamento: 0, aguardando: 0, bloqueadas: 0, concluidas: 0 };
      expect(fraseDoResumo(vazio)).toBeNull();
      expect(fraseDoResumo({ ...vazio, hoje: 4, atrasadas: 2, aguardando: 1 })).toEqual({ abertura: 'Hoje você tem ', itens: '4 itens', resto: ', 2 atrasados e 1 aguardando retorno.' });
      expect(fraseDoResumo({ ...vazio, hoje: 1 })).toEqual({ abertura: 'Hoje você tem ', itens: '1 item', resto: '.' });
      expect(fraseDoResumo({ ...vazio, atrasadas: 1 })?.resto).toBe(', 1 atrasado.');
    });
  });

  describe('filtros (RN-03.01 e RN-03.19)', () => {
    const lista = [
      atividade({ titulo: 'Minha', responsavel_id: ID_KIMBERLY, prazo: HOJE, produtos: [ID_PRODUTO_KIPI] }),
      atividade({ titulo: 'Da Camila', responsavel_id: ID_CAMILA, prazo: '2026-11-01', participantes: [ID_KIMBERLY], produtos: [ID_PRODUTO_ZUPI], prioridade: 'alta' }),
      atividade({ titulo: 'Só da Camila', responsavel_id: ID_CAMILA, area_id: 'area-1', tipo: 'demanda' }),
      atividade({ titulo: 'Fechada ontem', situacao: 'concluida', concluida_em: '2026-11-05T12:00:00.000Z' }),
      atividade({ titulo: 'Cancelada', situacao: 'cancelada', cancelada_motivo: 'x' }),
    ];
    const titulos = (atividades: readonly Atividade[]) => atividades.map((item) => item.titulo);

    it('a visão padrão é Todas: entrar com uma conta não esconde o trabalho da outra', () => {
      expect(titulos(base(lista))).toEqual(['Minha', 'Da Camila', 'Só da Camila']);
    });

    it('Minhas conta responsável ou participante, com a alternância "só responsável"', () => {
      expect(titulos(base(lista, { pessoa: MINHAS }))).toEqual(['Minha', 'Da Camila']);
      expect(titulos(base(lista, { pessoa: MINHAS, soResponsavel: true }))).toEqual(['Minha']);
      expect(titulos(base(lista, { pessoa: ID_CAMILA }))).toEqual(['Da Camila', 'Só da Camila']);
    });

    it('contexto: multiseleção, Numa é quem não tem produto, e herda o seletor global', () => {
      expect(titulos(base(lista, { contextos: [ID_PRODUTO_KIPI] }))).toEqual(['Minha']);
      expect(titulos(base(lista, { contextos: [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI] }))).toEqual(['Minha', 'Da Camila']);
      expect(titulos(base(lista, { contextos: [ID_INSTITUCIONAL] }))).toEqual(['Só da Camila']);
      expect(titulos(base(lista, {}, { contextoGlobalId: ID_PRODUTO_ZUPI }))).toEqual(['Da Camila']);
      expect(titulos(base(lista, { contextos: [ID_PRODUTO_KIPI] }, { contextoGlobalId: ID_PRODUTO_ZUPI }))).toEqual(['Minha']);
    });

    it('busca por título, código, descrição e responsável, sem ligar para acento', () => {
      expect(titulos(base(lista, { busca: 'SÓ DA' }))).toEqual(['Só da Camila']);
      expect(titulos(base(lista, { busca: 'camila lima' }))).toEqual(['Da Camila', 'Só da Camila']);
      expect(base(lista, { busca: 'atv-2026-9001' })).toHaveLength(3);
    });

    it('área, tipo e prioridade', () => {
      expect(titulos(base(lista, { area: 'area-1' }))).toEqual(['Só da Camila']);
      expect(titulos(base(lista, { tipo: 'demanda' }))).toEqual(['Só da Camila']);
      expect(titulos(base(lista, { prioridades: ['alta', 'urgente'] }))).toEqual(['Da Camila']);
    });

    it('período do prazo', () => {
      const prazos = [atividade({ titulo: 'hoje', prazo: HOJE }), atividade({ titulo: 'domingo', prazo: '2026-11-08' }), atividade({ titulo: 'segunda', prazo: '2026-11-09' }), atividade({ titulo: 'em 30', prazo: '2026-12-06' }), atividade({ titulo: 'em 31', prazo: '2026-12-07' }), atividade({ titulo: 'atrasada', prazo: '2026-11-01' }), atividade({ titulo: 'sem' })];
      expect(titulos(base(prazos, { periodo: 'atrasadas' }))).toEqual(['atrasada']);
      expect(titulos(base(prazos, { periodo: 'hoje' }))).toEqual(['hoje']);
      expect(titulos(base(prazos, { periodo: 'semana' }))).toEqual(['hoje', 'domingo']);
      expect(titulos(base(prazos, { periodo: '30dias' }))).toEqual(['hoje', 'domingo', 'segunda', 'em 30']);
      expect(titulos(base(prazos, { periodo: 'sem_prazo' }))).toEqual(['sem']);
      expect(titulos(base(prazos, { periodo: 'intervalo', prazoDe: '2026-11-08', prazoAte: '2026-11-09' }))).toEqual(['domingo', 'segunda']);
    });

    it('origem do alerta', () => {
      const alertas = [atividade({ titulo: 'backup', tipo: 'alerta', origem_tipo: 'backup' }), atividade({ titulo: 'comum' })];
      expect(titulos(base(alertas, { origem: 'backup' }))).toEqual(['backup']);
    });

    it('os contadores seguem os filtros e o recorte diz quais (CA-03.04)', () => {
      const semFiltro = resumoDoDia(base(lista), HOJE);
      expect(semFiltro).toMatchObject({ atrasadas: 1, hoje: 1 });
      expect(resumoDoDia(base(lista, { contextos: [ID_PRODUTO_KIPI] }), HOJE)).toMatchObject({ atrasadas: 0, hoje: 1 });
      const nomes = { nomeDaPessoa: () => 'Camila Lima', nomeDaArea: () => 'Tecnologia', nomeDoContexto: () => 'Kipi', contextoGlobalId: ID_CONSOLIDADA };
      expect(recorteDosFiltros(FILTROS_MEU_DIA_INICIAIS, nomes)).toEqual([]);
      expect(recorteDosFiltros({ ...FILTROS_MEU_DIA_INICIAIS, contextos: [ID_PRODUTO_KIPI], prioridades: ['alta'], pessoa: MINHAS, periodo: 'hoje', tipo: 'demanda', area: 'x', busca: ' lumi ', origem: 'backup' }, nomes)).toEqual(['“lumi”', 'Minhas', 'Kipi', 'Tecnologia', 'Demanda', 'Alta', 'Hoje', 'Backup']);
      expect(recorteDosFiltros(FILTROS_MEU_DIA_INICIAIS, { ...nomes, contextoGlobalId: ID_PRODUTO_KIPI })).toEqual(['Kipi']);
    });
  });

  describe('o que aparece', () => {
    const lista = [
      atividade({ titulo: 'a fazer', prazo: HOJE }),
      atividade({ titulo: 'andamento', situacao: 'em_andamento' }),
      atividade({ titulo: 'aguardando', situacao: 'aguardando', aguardando_de_texto: 'x' }),
      atividade({ titulo: 'concluída', situacao: 'concluida', concluida_em: '2026-11-06T12:00:00.000Z' }),
      atividade({ titulo: 'bloqueada', bloqueada: true, bloqueio_motivo: 'x' }),
    ];
    const visiveis = (filtros: Partial<FiltrosMeuDia>, visao: 'quadro' | 'lista' = 'quadro') => atividadesVisiveis(base(lista), { ...FILTROS_MEU_DIA_INICIAIS, ...filtros }, visao, HOJE).map((item) => item.titulo);

    it('o quadro mostra a coluna Concluída; a lista, só as abertas', () => {
      expect(visiveis({})).toContain('concluída');
      expect(visiveis({}, 'lista')).not.toContain('concluída');
      expect(visiveis({ destaque: 'concluidas' }, 'lista')).toEqual(['concluída']);
    });

    it('as colunas do quadro', () => {
      const colunas = colunasDoQuadro(atividadesVisiveis(base(lista), FILTROS_MEU_DIA_INICIAIS, 'quadro', HOJE));
      expect(colunas.a_fazer.map((item) => item.titulo)).toEqual(['bloqueada', 'a fazer']);
      expect(colunas.em_andamento).toHaveLength(1);
      expect(colunas.aguardando).toHaveLength(1);
      expect(colunas.concluida).toHaveLength(1);
    });

    it('cada cartão da faixa de resumo vira filtro', () => {
      expect(visiveis({ destaque: 'hoje' })).toEqual(['a fazer']);
      expect(visiveis({ destaque: 'em_andamento' })).toEqual(['andamento']);
      expect(visiveis({ destaque: 'aguardando' })).toEqual(['aguardando']);
      expect(visiveis({ destaque: 'bloqueadas' })).toEqual(['bloqueada']);
      expect(visiveis({ destaque: 'atrasadas' })).toEqual([]);
    });

    it('filtro de situação', () => {
      expect(visiveis({ situacao: 'em_andamento' }, 'lista')).toEqual(['andamento']);
      expect(visiveis({ situacao: 'concluida' }, 'lista')).toEqual(['concluída']);
    });
  });

  describe('agrupar a lista', () => {
    it('por prazo, na ordem do tempo', async () => {
      const dados = await carregarMeuDia();
      const linhas = [atividade({ titulo: 'sem' }), atividade({ titulo: 'hoje', prazo: HOJE }), atividade({ titulo: 'depois', prazo: '2026-12-01' }), atividade({ titulo: 'domingo', prazo: '2026-11-08' }), atividade({ titulo: 'atrasada', prazo: '2026-11-01' })];
      expect(agruparAtividades(linhas, 'prazo', HOJE, dados).map((grupo) => grupo.titulo)).toEqual(['Atrasadas', 'Hoje', 'Esta semana', 'Depois', 'Sem prazo']);
    });

    it('por responsável, contexto e área; nenhum é um grupo só', async () => {
      const dados = await carregarMeuDia();
      const linhas = dados.atividades.filter(estaAberta);
      expect(agruparAtividades(linhas, 'nenhum', HOJE, dados)).toHaveLength(1);
      expect(agruparAtividades(linhas, 'responsavel', HOJE, dados).map((grupo) => grupo.titulo)).toEqual(['Bruna Alves', 'Camila Lima', 'Kimberly Grebe']);
      const porContexto = agruparAtividades(linhas, 'contexto', HOJE, dados);
      expect(porContexto.map((grupo) => grupo.titulo)).toContain('Numa');
      expect(porContexto.find((grupo) => grupo.titulo === 'Kipi')?.linhas.length).toBe(3);
      expect(agruparAtividades([atividade({ area_id: null })], 'area', HOJE, dados)[0]?.titulo).toBe('Sem área');
    });
  });

  describe('carga de exemplos', () => {
    let dados: DadosMeuDia;
    beforeEach(async () => {
      dados = await carregarMeuDia();
    });

    it('todas de exemplo, com código e nas situações pedidas', () => {
      expect(dados.atividades).toHaveLength(ATIVIDADES_INICIAIS);
      expect(dados.atividades.every((item) => item.exemplo && item.codigo.startsWith('ATV-2026-'))).toBe(true);
      expect(new Set(dados.atividades.map((item) => item.situacao))).toEqual(new Set(['a_fazer', 'em_andamento', 'aguardando', 'concluida', 'cancelada']));
      expect(new Set(dados.atividades.map((item) => item.tipo))).toEqual(new Set(['tarefa', 'demanda', 'lembrete', 'alerta']));
    });

    it('com atraso, bloqueio e sem prazo, contados a partir de hoje (CA-03.02)', () => {
      expect(dados.atividades.some((item) => estaAtrasada(item, HOJE))).toBe(true);
      expect(dados.atividades.some((item) => item.bloqueada)).toBe(true);
      const antiga = dados.atividades.find((item) => item.titulo === 'Mapear o fluxo de cadastro do Zarpa');
      expect(antiga?.prazo).toBeNull();
      expect(Date.now() - Date.parse(antiga?.criado_em as string)).toBe(60 * 86_400_000);
      expect(estaNoDia(antiga as Atividade, HOJE)).toBe(true);
    });

    it('concluída ontem não aparece no quadro de hoje (CA-03.08)', () => {
      const visiveis = atividadesVisiveis(base(dados.atividades), FILTROS_MEU_DIA_INICIAIS, 'quadro', HOJE).map((item) => item.titulo);
      expect(visiveis).not.toContain('Atualizar a lista de fornecedores');
      expect(visiveis).not.toContain('Testar outra plataforma de e-mail');
      expect(visiveis).toContain('Enviar o logotipo final do Zupi');
    });

    it('contexto e nomes', () => {
      const multi = dados.atividades.find((item) => item.titulo === 'Definir o preço da oferta anual') as AtividadeDoDia;
      expect(contextosDaAtividade(multi, dados).map((contexto) => contexto.nome)).toEqual(['Kipi', 'Zupi']);
      expect(multi.participantes).toEqual([ID_CAMILA]);
      const daNuma = dados.atividades.find((item) => item.titulo === 'Organizar a pasta de contratos no Drive') as AtividadeDoDia;
      expect(contextosDaAtividade(daNuma, dados).map((contexto) => contexto.nome)).toEqual(['Numa']);
    });

    it('o próximo código continua depois dos que vieram na carga (RT-01)', async () => {
      const nova = await repositorios.atividade.criar({ ...atividade({ titulo: 'Nova' }), id: undefined });
      expect(nova.codigo).toBe(`ATV-2026-${String(ATIVIDADES_INICIAIS + 1).padStart(4, '0')}`);
    });
  });

  describe('ações', () => {
    const achar = async (titulo: string) => (await repositorios.atividade.listar()).find((item) => item.titulo === titulo) as Atividade;
    const historico = async (id: string) => (await historicoDoRegistro('atividade', id)).map((linha) => linha.texto);

    it('concluir registra a pessoa e a hora; desfazer volta sem motivo (RN-03.07)', async () => {
      const alvo = await achar('Corrigir o erro no login do Kipi');
      const anterior = await concluirAtividade(alvo.id, ID_CAMILA);
      expect(anterior).toBe('em_andamento');
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ situacao: 'concluida', concluida_por: ID_CAMILA, concluida_em: '2026-11-06T15:00:00.000Z' });
      await desfazerConclusao(alvo.id, anterior);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ situacao: 'em_andamento', concluida_por: null, concluida_em: null });
    });

    it('reabrir e cancelar exigem motivo, que vai para o histórico', async () => {
      const concluida = await achar('Conferir as faturas de hospedagem');
      await expect(reabrirAtividade(concluida.id, ' ')).rejects.toThrow('Informe o motivo para reabrir.');
      await reabrirAtividade(concluida.id, 'Faltou uma fatura');
      expect(await repositorios.atividade.obter(concluida.id)).toMatchObject({ situacao: 'a_fazer', concluida_em: null });
      expect((await historico(concluida.id))[0]).toContain('Motivo: Faltou uma fatura');

      const aberta = await achar('Publicar a nota de versão do Kipi');
      await expect(cancelarAtividade(aberta.id, '')).rejects.toThrow('Informe o motivo para cancelar.');
      await cancelarAtividade(aberta.id, 'Versão adiada');
      expect(await repositorios.atividade.obter(aberta.id)).toMatchObject({ situacao: 'cancelada', cancelada_motivo: 'Versão adiada' });
      expect((await historico(aberta.id))[0]).toContain('Situação: de A fazer para Cancelada');
    });

    it('dispensar um alerta pede motivo e não muda a origem (RN-03.13)', async () => {
      const alvo = await achar('Exportar os dados da Central');
      await expect(dispensarAlerta(alvo.id, ' ')).rejects.toThrow('Informe o motivo para dispensar.');
      await dispensarAlerta(alvo.id, 'Backup feito fora da Central');
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ situacao: 'cancelada', dispensada_motivo: 'Backup feito fora da Central', origem_tipo: 'backup' });
    });

    it('mover pelo menu muda a situação e grava o histórico (CA-03.03)', async () => {
      const alvo = await achar('Publicar a nota de versão do Kipi');
      await moverAtividade(alvo.id, 'em_andamento');
      expect((await repositorios.atividade.obter(alvo.id))?.situacao).toBe('em_andamento');
      expect((await historico(alvo.id))[0]).toContain('alterou a atividade Publicar a nota de versão do Kipi: Situação: de A fazer para Em andamento');
    });

    it('aguardando pede de quem, com data de acompanhamento opcional (RN-03.09)', async () => {
      const alvo = await achar('Publicar a nota de versão do Kipi');
      await expect(moverParaAguardando(alvo.id, { pessoaId: '', texto: ' ', acompanhamento: '' }, HOJE)).rejects.toThrow('Diga de quem está aguardando.');
      await moverParaAguardando(alvo.id, { pessoaId: ID_BRUNA, texto: '', acompanhamento: '2026-11-10' }, HOJE);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ situacao: 'aguardando', aguardando_de_pessoa_id: ID_BRUNA, aguardando_de_texto: null, aguardando_desde: HOJE, acompanhamento_em: '2026-11-10' });
      await moverAtividade(alvo.id, 'em_andamento');
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ situacao: 'em_andamento', aguardando_de_pessoa_id: null, acompanhamento_em: null });
      await moverParaAguardando(alvo.id, { pessoaId: '', texto: 'Fornecedor', acompanhamento: '' }, HOJE);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ aguardando_de_texto: 'Fornecedor', acompanhamento_em: null });
    });

    it('adiar exige nova data, conta as vezes e deixa a anterior no histórico (RN-03.08)', async () => {
      const alvo = await achar('Organizar a pasta de contratos no Drive');
      await expect(adiarAtividade(alvo.id, '', HOJE)).rejects.toThrow('Escolha a nova data.');
      await expect(adiarAtividade(alvo.id, '2026-11-01', HOJE)).rejects.toThrow('Escolha hoje ou uma data futura.');
      await expect(adiarAtividade(alvo.id, alvo.prazo as string, HOJE)).rejects.toThrow('Esta já é a data da atividade.');
      const antes = await adiarAtividade(alvo.id, '2026-11-20', HOJE);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ prazo: '2026-11-20', adiamentos: 3 });
      expect((await historico(alvo.id))[0]).toContain('Prazo: de 08/11/2026 para 20/11/2026');
      await desfazerAdiamento(alvo.id, antes);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ prazo: '2026-11-08', adiamentos: 2 });
    });

    it('quem não tinha prazo ganha um, sem contar como adiamento', async () => {
      const alvo = await achar('Mapear o fluxo de cadastro do Zarpa');
      await adiarAtividade(alvo.id, '2026-11-07', HOJE);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ prazo: '2026-11-07', adiamentos: 0 });
    });

    it('lembrete adia o aviso e mantém a hora', async () => {
      const alvo = await achar('Ligar para o banco sobre a conta da empresa');
      await adiarAtividade(alvo.id, '2026-11-07', HOJE);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ aviso_em: '2026-11-07T18:00:00.000Z', prazo: null, adiamentos: 1 });
    });

    it('os atalhos de adiar contam de hoje, quando o prazo já passou', () => {
      expect(novaDataDoAdiamento({ tipo: 'tarefa', prazo: '2026-11-01', aviso_em: null }, 1, HOJE)).toBe('2026-11-07');
      expect(novaDataDoAdiamento({ tipo: 'tarefa', prazo: '2026-11-20', aviso_em: null }, 7, HOJE)).toBe('2026-11-27');
      expect(novaDataDoAdiamento({ tipo: 'tarefa', prazo: null, aviso_em: null }, 1, HOJE)).toBe('2026-11-07');
    });

    it('bloquear exige motivo, e desbloquear limpa (RN-03.10)', async () => {
      const alvo = await achar('Publicar a nota de versão do Kipi');
      await expect(bloquearAtividade(alvo.id, '')).rejects.toThrow('Informe o motivo do bloqueio.');
      await bloquearAtividade(alvo.id, 'Sem acesso à loja');
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ bloqueada: true, bloqueio_motivo: 'Sem acesso à loja', bloqueada_em: '2026-11-06T15:00:00.000Z' });
      await desbloquearAtividade(alvo.id);
      expect(await repositorios.atividade.obter(alvo.id)).toMatchObject({ bloqueada: false, bloqueio_motivo: null, bloqueada_em: null });
    });

    it('trocar a responsável grava o nome no histórico', async () => {
      const alvo = await achar('Publicar a nota de versão do Kipi');
      await trocarResponsavel(alvo.id, ID_KIMBERLY);
      expect((await historico(alvo.id))[0]).toContain('Responsável: de Camila Lima para Kimberly Grebe');
    });
  });

  describe('vínculos com os cadastros (RN-02.04)', () => {
    it('só as abertas prendem a pessoa', async () => {
      expect(await vinculosDeAtividadeDaPessoa(ID_BRUNA)).toEqual(['Responsável por 1 atividade aberta']);
      expect(await vinculosDaPessoa(ID_BRUNA)).toContain('Responsável por 1 atividade aberta');
      expect(await vinculosDeAtividadeDaPessoa(ID_KIMBERLY)).toEqual(['Responsável por 6 atividades abertas', 'Participa de 2 atividades abertas']);
    });

    it('área e produto com atividades abertas não arquivam', async () => {
      const dados = await carregarMeuDia();
      const juridico = dados.areas.find((area) => area.nome === 'Jurídico e privacidade');
      expect(await quantasAtividadesAbertasNaArea(juridico?.id as string)).toBe(1);
      expect(await quantasAtividadesAbertasNoProduto(ID_PRODUTO_KIPI)).toBe(3);
      await expect(arquivarProduto(ID_PRODUTO_KIPI)).rejects.toThrow('Este produto tem 3 atividades abertas.');
      for (const ligacao of await repositorios.pessoa_area.listar({ onde: { area_id: juridico?.id as string } })) await repositorios.pessoa_area.arquivar(ligacao.id);
      await expect(arquivarArea(juridico?.id as string)).rejects.toThrow('Esta área tem 1 atividade aberta.');
    });
  });

  describe('limpar exemplos', () => {
    it('tira as fictícias e cuida da atividade de verdade que apontava para quem saiu', async () => {
      const nova = await repositorios.atividade.criar({ ...atividade({ titulo: 'Real', situacao: 'aguardando', aguardando_de_pessoa_id: ID_BRUNA, solicitante_pessoa_id: ID_BRUNA }), id: undefined });
      await repositorios.atividade_participante.criar({ atividade_id: nova.id, pessoa_id: ID_BRUNA });
      await repositorios.atividade_participante.criar({ atividade_id: nova.id, pessoa_id: ID_CAMILA });
      await limparExemplos();
      const { atividades } = await carregarMeuDia();
      expect(atividades.map((item) => item.titulo)).toEqual(['Real']);
      expect(atividades[0]).toMatchObject({ aguardando_de_pessoa_id: null, aguardando_de_texto: 'Bruna Alves', solicitante_pessoa_id: null, solicitante_texto: 'Bruna Alves', participantes: [ID_CAMILA] });
    });

    it('as atividades contam como registros; as ligações, não', async () => {
      const { registros } = await resumoDosDados();
      const nova = await repositorios.atividade.criar({ ...atividade({ titulo: 'Real' }), id: undefined });
      await repositorios.atividade_produto.criar({ atividade_id: nova.id, produto_id: ID_PRODUTO_KIPI });
      expect((await resumoDosDados()).registros).toBe(registros + 1);
    });
  });

  describe('dados da versão anterior', () => {
    function voltarParaVersao6() {
      for (const tabela of ['atividade', 'atividade_produto', 'atividade_participante']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 6 });
      esquecerMetaEmMemoria();
    }

    it('acrescenta sem tocar no que existia', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      voltarParaVersao6();
      expect((await carregarMeuDia()).atividades).toHaveLength(ATIVIDADES_INICIAIS);
      expect((await repositorios.configuracao.ler()).organizacao_nome).toBe('Numa Planejada');
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });

    it('quem já limpou os exemplos não recebe atividades de exemplo', async () => {
      await limparExemplos();
      voltarParaVersao6();
      expect((await carregarMeuDia()).atividades).toEqual([]);
    });
  });
});
