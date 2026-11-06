import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaveDaTabela, criarArmazenamentoEmMemoria, usarDriverDeTeste, type Driver } from '@/dados/armazenamento';
import { AREAS_INICIAIS, ID_BRUNA, ID_CAMILA, ID_CONTRAPARTE_CONTABILIDADE, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria, gravarMeta, lerMeta } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { VERSAO_DADOS } from '@/dados/tabelas';
import { parDoVinculo, type Comentario } from '@/dados/tipos/apoio';
import type { Atividade } from '@/dados/tipos/atividade';
import { ATIVIDADES_INICIAIS, REGISTROS_INICIAIS } from './apoio-testes';
import { carregarMeuDia, concluirAtividade, quantasAtividadesAbertasNoProduto, trocarResponsavel } from './atividades';
import {
  areaCompartilhada,
  avisosDaAtividade,
  carregarFormularioAtividade,
  contextosIniciais,
  criarAtividade,
  dataDoPrazoRapido,
  esquemaFormularioAtividade,
  formularioAtividadeVazio,
  formularioDoProximo,
  itensDoChecklist,
  responsavelDaArea,
  SOLICITANTE_OUTRA,
  type FormularioAtividade,
} from './atividades-formulario';
import {
  adicionarAnexo,
  adicionarItem,
  adicionarVinculo,
  alterarAviso,
  alterarCampos,
  alterarInicio,
  alterarPrazo,
  alterarTitulo,
  atividadesDaPessoa,
  atividadesDoRegistro,
  carregarPainel,
  comentar,
  converterAtividade,
  definirContextos,
  definirParticipantes,
  definirResponsavelDoItem,
  duplicarAtividade,
  editarComentario,
  extrairMencoes,
  marcarItem,
  podeEditarComentario,
  removerAnexo,
  removerComentario,
  removerItem,
  removerVinculo,
  vinculosDaAtividade,
} from './atividades-painel';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { vinculosDaContraparte } from './contrapartes';
import { limparExemplos, resumoDosDados } from './dados';
import { historicoDaAtividade, historicoRecente } from './historico';

const HOJE = '2026-11-06';
const LINK = 'https://drive.google.com/file/d/abc';
const TECNOLOGIA = AREAS_INICIAIS.find((area) => area.nome === 'Tecnologia')!.id;
const COMERCIAL = AREAS_INICIAIS.find((area) => area.nome === 'Comercial')!.id;

function novo(alteracoes: Partial<FormularioAtividade> = {}): FormularioAtividade {
  return { ...formularioAtividadeVazio('tarefa', ID_KIMBERLY, ID_CONSOLIDADA), titulo: 'Atividade nova', ...alteracoes };
}

function mensagens(alteracoes: Partial<FormularioAtividade>): string[] {
  const resultado = esquemaFormularioAtividade.safeParse(novo(alteracoes));
  return resultado.success ? [] : resultado.error.issues.map((falha) => falha.message);
}

describe('T03.02 e T03.03', () => {
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
  const textos = async (id: string) => (await historicoDaAtividade(id)).map((linha) => linha.texto);

  describe('T03.03: validação', () => {
    it('título obrigatório, de até 140 caracteres', () => {
      expect(mensagens({ titulo: ' ' })).toEqual(['Informe o título.']);
      expect(mensagens({ titulo: 'x'.repeat(141) })).toEqual(['Use até 140 caracteres.']);
      expect(mensagens({ titulo: 'x'.repeat(140) })).toEqual([]);
    });

    it('responsável obrigatória', () => {
      expect(mensagens({ responsavel_id: '' })).toEqual(['Escolha a responsável.']);
    });

    it('lembrete sem data e hora é bloqueado, junto ao campo (CA-03.06)', () => {
      const resultado = esquemaFormularioAtividade.safeParse(novo({ tipo: 'lembrete' }));
      expect(resultado.success ? [] : resultado.error.issues.map((falha) => [falha.path[0], falha.message])).toEqual([
        ['aviso_dia', 'Informe a data do aviso.'],
        ['aviso_hora', 'Informe a hora do aviso.'],
      ]);
      expect(mensagens({ tipo: 'lembrete', aviso_dia: HOJE, aviso_hora: '15:00' })).toEqual([]);
    });

    it('tarefa e demanda podem ficar sem prazo (RN-03.03)', () => {
      expect(mensagens({ tipo: 'tarefa' })).toEqual([]);
      expect(mensagens({ tipo: 'demanda' })).toEqual([]);
    });

    it('demanda pede quem pediu, pessoa ou texto', () => {
      expect(mensagens({ tipo: 'demanda', solicitante: '' })).toEqual(['Diga quem pediu.']);
      expect(mensagens({ tipo: 'demanda', solicitante: SOLICITANTE_OUTRA })).toEqual(['Escreva quem pediu.']);
      expect(mensagens({ tipo: 'demanda', solicitante: SOLICITANTE_OUTRA, solicitante_texto: 'Cliente' })).toEqual([]);
    });

    it('datas coerentes', () => {
      expect(mensagens({ prazo_hora: '10:00' })).toEqual(['Informe o dia do prazo.']);
      expect(mensagens({ inicio: '2026-11-10', prazo: '2026-11-09' })).toEqual(['O início precisa ser antes do prazo.']);
      expect(mensagens({ aviso_dia: HOJE })).toEqual(['Informe o dia e a hora do aviso.']);
      expect(mensagens({ aviso_dia: '2026-11-10', aviso_hora: '09:00', prazo: '2026-11-09' })).toEqual(['O aviso precisa ser antes do prazo.']);
    });

    it('arquivo precisa ser do Drive', () => {
      expect(mensagens({ arquivo: 'https://exemplo.com/x' })).toEqual(['Use um link de drive.google.com ou docs.google.com.']);
      expect(mensagens({ arquivo: LINK })).toEqual([]);
    });

    it('texto que parece segredo só avisa (RT-14)', () => {
      expect(avisosDaAtividade(novo({ descricao: 'senha: 1234' }))[0]).toContain('senha ou um token');
      expect(avisosDaAtividade(novo())).toEqual([]);
    });
  });

  describe('T03.03: padrões e sugestões', () => {
    it('contexto: o global atual; a Numa e a consolidada ficam vazias', () => {
      expect(contextosIniciais(ID_PRODUTO_KIPI)).toEqual([ID_PRODUTO_KIPI]);
      expect(contextosIniciais(ID_CONSOLIDADA)).toEqual([]);
      expect(contextosIniciais(ID_INSTITUCIONAL)).toEqual([]);
    });

    it('responsável: a pessoa conectada; área sugere a padrão; compartilhada exige escolha (RN-03.02)', async () => {
      expect(formularioAtividadeVazio('tarefa', ID_CAMILA, ID_CONSOLIDADA).responsavel_id).toBe(ID_CAMILA);
      const { areas, pessoas } = await carregarFormularioAtividade();
      expect(responsavelDaArea(TECNOLOGIA, areas, pessoas)).toBe(ID_CAMILA);
      expect(responsavelDaArea(COMERCIAL, areas, pessoas)).toBeNull();
      expect(areaCompartilhada(COMERCIAL, areas)).toBe(true);
      expect(areaCompartilhada(TECNOLOGIA, areas)).toBe(false);
      expect(responsavelDaArea(TECNOLOGIA, areas, pessoas.filter((pessoa) => pessoa.id !== ID_CAMILA))).toBeNull();
    });

    it('"Salvar e adicionar outro" mantém tipo, contexto e responsável (CA-03.07)', () => {
      const atual = novo({ tipo: 'demanda', contextos: [ID_PRODUTO_KIPI], responsavel_id: ID_CAMILA, descricao: 'Texto', prazo: HOJE, prioridade: 'alta' });
      expect(formularioDoProximo(atual, ID_KIMBERLY)).toMatchObject({ tipo: 'demanda', contextos: [ID_PRODUTO_KIPI], responsavel_id: ID_CAMILA, titulo: '', descricao: '', prazo: '', prioridade: 'normal' });
    });

    it('atalhos de prazo', () => {
      expect(dataDoPrazoRapido('hoje', HOJE)).toBe(HOJE);
      expect(dataDoPrazoRapido('amanha', HOJE)).toBe('2026-11-07');
      // 06/11/2026 é sexta: "esta semana" vai para o domingo seguinte só depois da sexta
      expect(dataDoPrazoRapido('semana', '2026-11-03')).toBe('2026-11-06');
      expect(dataDoPrazoRapido('semana', HOJE)).toBe(HOJE);
      expect(dataDoPrazoRapido('semana', '2026-11-07')).toBe('2026-11-08');
      expect(dataDoPrazoRapido('semana', '2026-11-08')).toBe('2026-11-08');
    });

    it('checklist: um item por linha', () => {
      expect(itensDoChecklist(' um \n\n dois\n')).toEqual(['um', 'dois']);
    });
  });

  describe('T03.03: criar', () => {
    it('grava tudo de uma vez, com código, contexto, participantes, checklist, vínculo e link', async () => {
      const criada = await criarAtividade(novo({ titulo: 'Completa', descricao: 'Texto', area_id: TECNOLOGIA, contextos: [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI], participantes: [ID_CAMILA, ID_KIMBERLY], prioridade: 'alta', inicio: HOJE, prazo: '2026-11-10', prazo_hora: '09:30', aviso_dia: '2026-11-09', aviso_hora: '08:00', checklist: 'Um\nDois', vinculo: `contraparte:${ID_CONTRAPARTE_CONTABILIDADE}`, arquivo: LINK }));
      expect(criada).toMatchObject({ situacao: 'a_fazer', tipo: 'tarefa', prazo: '2026-11-10', prazo_hora: '09:30', aviso_em: '2026-11-09T11:00:00.000Z', prioridade: 'alta', area_id: TECNOLOGIA, exemplo: false });
      expect(criada.codigo).toBe(`ATV-2026-${String(ATIVIDADES_INICIAIS + 1).padStart(4, '0')}`);
      const painel = await carregarPainel(criada.id);
      expect(painel?.produtos).toEqual([ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI]);
      expect(painel?.participantes).toEqual([ID_CAMILA]);
      expect(painel?.itens.map((item) => item.texto)).toEqual(['Um', 'Dois']);
      expect(painel?.vinculos[0]).toMatchObject({ rotulo: 'Contraparte', nome: 'Souza Contabilidade' });
      expect(painel?.anexos[0]).toMatchObject({ titulo: 'Arquivo do Drive', url: LINK });
    });

    it('sem espaço no navegador, nada fica pela metade', async () => {
      const antes = (await repositorios.atividade.listar()).length;
      const gravar = armazenamento.setItem.bind(armazenamento);
      let chamadas = 0;
      armazenamento.setItem = (chave, valor) => {
        if (chave === chaveDaTabela('atividade') && ++chamadas >= 1) throw new DOMException('cheio', 'QuotaExceededError');
        gravar(chave, valor);
      };
      await expect(criarAtividade(novo({ contextos: [ID_PRODUTO_KIPI] }))).rejects.toBeDefined();
      armazenamento.setItem = gravar;
      expect((await repositorios.atividade.listar()).length).toBe(antes);
      expect((await repositorios.atividade_produto.listar({ onde: { produto_id: ID_PRODUTO_KIPI } })).length).toBe(3);
    });

    it('lembrete guarda o aviso, sem prazo', async () => {
      const criada = await criarAtividade(novo({ tipo: 'lembrete', aviso_dia: HOJE, aviso_hora: '18:00', prazo: '2026-12-01', checklist: 'Ignorado' }));
      expect(criada).toMatchObject({ tipo: 'lembrete', prazo: null, aviso_em: '2026-11-06T21:00:00.000Z' });
      expect((await carregarPainel(criada.id))?.itens).toEqual([]);
    });

    it('demanda guarda quem pediu; só demanda guarda isso', async () => {
      const comPessoa = await criarAtividade(novo({ tipo: 'demanda', solicitante: ID_CAMILA, resultado_esperado: 'Um relatório' }));
      expect(comPessoa).toMatchObject({ solicitante_pessoa_id: ID_CAMILA, solicitante_texto: null, resultado_esperado: 'Um relatório' });
      const comTexto = await criarAtividade(novo({ tipo: 'demanda', solicitante: SOLICITANTE_OUTRA, solicitante_texto: 'Cliente Lumi' }));
      expect(comTexto).toMatchObject({ solicitante_pessoa_id: null, solicitante_texto: 'Cliente Lumi' });
      const tarefa = await criarAtividade(novo({ solicitante: ID_CAMILA, resultado_esperado: 'Ignorado' }));
      expect(tarefa).toMatchObject({ solicitante_pessoa_id: null, resultado_esperado: null });
    });

    it('aparece no Meu dia e no resumo de registros', async () => {
      const { registros } = await resumoDosDados();
      const criada = await criarAtividade(novo());
      expect((await carregarMeuDia()).atividades.map((item) => item.id)).toContain(criada.id);
      expect((await resumoDosDados()).registros).toBe(registros + 1);
    });
  });

  describe('T03.02: editar', () => {
    let id: string;
    beforeEach(async () => {
      id = (await criarAtividade(novo({ prazo: '2026-11-10' }))).id;
    });

    it('título', async () => {
      await expect(alterarTitulo(id, ' ')).rejects.toThrow('Informe o título.');
      await expect(alterarTitulo(id, 'x'.repeat(141))).rejects.toThrow('Use até 140 caracteres.');
      await alterarTitulo(id, 'Outro título');
      expect((await obter(id)).titulo).toBe('Outro título');
      expect((await textos(id))[0]).toContain('Título: de Atividade nova para Outro título');
    });

    it('mudar o prazo deixa a data anterior no histórico; para depois, conta como adiamento (CA-03.05)', async () => {
      await alterarPrazo(id, '2026-11-20', '');
      expect(await obter(id)).toMatchObject({ prazo: '2026-11-20', adiamentos: 1 });
      expect((await textos(id))[0]).toContain('Prazo: de 10/11/2026 para 20/11/2026');
      await alterarPrazo(id, '2026-11-15', '10:00');
      expect(await obter(id)).toMatchObject({ prazo: '2026-11-15', prazo_hora: '10:00', adiamentos: 1 });
      await alterarPrazo(id, '', '');
      expect(await obter(id)).toMatchObject({ prazo: null, prazo_hora: null, adiamentos: 1 });
      await expect(alterarPrazo(id, '', '10:00')).rejects.toThrow('Informe o dia do prazo.');
    });

    it('aviso: lembrete exige; tarefa pode tirar', async () => {
      await alterarAviso(id, '2026-11-09', '08:00');
      expect((await obter(id)).aviso_em).toBe('2026-11-09T11:00:00.000Z');
      await alterarAviso(id, '', '');
      expect((await obter(id)).aviso_em).toBeNull();
      await expect(alterarAviso(id, HOJE, '')).rejects.toThrow('Informe o dia e a hora do aviso.');
      const lembrete = await criarAtividade(novo({ tipo: 'lembrete', aviso_dia: HOJE, aviso_hora: '18:00' }));
      await expect(alterarAviso(lembrete.id, '', '')).rejects.toThrow('Lembrete exige a data e a hora do aviso.');
    });

    it('datas coerentes também no painel', async () => {
      await expect(alterarInicio(id, '2026-11-11')).rejects.toThrow('O início precisa ser antes do prazo.');
      await alterarInicio(id, '2026-11-05');
      expect((await obter(id)).inicio).toBe('2026-11-05');
      await expect(alterarPrazo(id, '2026-11-04', '')).rejects.toThrow('O prazo precisa ser depois do início.');
      await alterarInicio(id, '');
      expect((await obter(id)).inicio).toBeNull();
      await expect(alterarAviso(id, '2026-11-11', '08:00')).rejects.toThrow('O aviso precisa ser antes do prazo.');
      await alterarAviso(id, '2026-11-09', '08:00');
      await expect(alterarPrazo(id, '2026-11-08', '')).rejects.toThrow('O aviso está depois deste prazo: mude o aviso antes.');
      expect((await obter(id)).prazo).toBe('2026-11-10');
    });

    it('quem vira responsável deixa de ser participante', async () => {
      await definirParticipantes(id, [ID_CAMILA, ID_BRUNA]);
      await trocarResponsavel(id, ID_CAMILA);
      expect(await obter(id)).toMatchObject({ responsavel_id: ID_CAMILA });
      expect((await carregarPainel(id))?.participantes).toEqual([ID_BRUNA]);
    });

    it('encerrada fica só para leitura; comentar continua valendo', async () => {
      await adicionarItem(id, 'Um item');
      await adicionarAnexo(id, LINK, '');
      await adicionarVinculo(id, 'contraparte', ID_CONTRAPARTE_CONTABILIDADE);
      const painel = (await carregarPainel(id))!;
      const item = painel.itens[0]!.id;
      await concluirAtividade(id, ID_KIMBERLY);
      const mensagem = 'Esta atividade está encerrada: reabra para mudar.';
      for (const tentativa of [
        () => alterarTitulo(id, 'Outro'),
        () => alterarCampos(id, { descricao: 'Outra' }),
        () => alterarInicio(id, '2026-11-01'),
        () => alterarPrazo(id, '2026-11-20', ''),
        () => alterarAviso(id, '2026-11-09', '08:00'),
        () => definirContextos(id, [ID_PRODUTO_KIPI]),
        () => definirParticipantes(id, [ID_CAMILA]),
        () => adicionarItem(id, 'Outro item'),
        () => marcarItem(item, true, ID_KIMBERLY),
        () => definirResponsavelDoItem(item, ID_CAMILA),
        () => removerItem(item),
        () => adicionarVinculo(id, 'produto', ID_PRODUTO_KIPI),
        () => removerVinculo(painel.vinculos[0]!.id),
        () => adicionarAnexo(id, LINK, 'Outro'),
        () => removerAnexo(painel.anexos[0]!.id),
        () => converterAtividade(id, 'demanda', ID_KIMBERLY),
      ]) {
        await expect(tentativa()).rejects.toThrow(mensagem);
      }
      await comentar(id, 'Depois de pronto', ID_KIMBERLY, []);
      expect((await carregarPainel(id))?.comentarios.map((comentario) => comentario.texto)).toEqual(['Depois de pronto']);
    });

    it('contexto e participantes trocam só o que mudou, com histórico por extenso', async () => {
      await definirContextos(id, [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI]);
      await definirContextos(id, [ID_PRODUTO_ZUPI]);
      expect((await carregarPainel(id))?.produtos).toEqual([ID_PRODUTO_ZUPI]);
      await definirParticipantes(id, [ID_CAMILA]);
      await definirParticipantes(id, []);
      expect((await carregarPainel(id))?.participantes).toEqual([]);
      const historico = await textos(id);
      expect(historico).toContain('Kimberly Grebe tirou Camila Lima dos participantes');
      expect(historico).toContain('Kimberly Grebe colocou Camila Lima como participante');
      expect(historico).toContain('Kimberly Grebe tirou do contexto Kipi');
      expect(historico).toContain('Kimberly Grebe colocou no contexto Zupi');
    });

    it('campos simples', async () => {
      await alterarCampos(id, { descricao: 'Nova', area_id: TECNOLOGIA, prioridade: 'urgente', responsavel_id: ID_BRUNA });
      expect(await obter(id)).toMatchObject({ descricao: 'Nova', area_id: TECNOLOGIA, prioridade: 'urgente', responsavel_id: ID_BRUNA });
      const [ultimo] = await textos(id);
      expect(ultimo).toContain('Descrição');
      expect(ultimo).not.toContain('Nova');
      expect(ultimo).toContain('Área: de não informado para Tecnologia');
      expect(ultimo).toContain('Prioridade: de Normal para Urgente');
      expect(ultimo).toContain('Responsável: de Kimberly Grebe para Bruna Alves');
    });
  });

  describe('T03.02: checklist', () => {
    it('acrescenta, marca com quem e quando, desmarca e tira', async () => {
      const { id } = await criarAtividade(novo());
      await expect(adicionarItem(id, ' ')).rejects.toThrow('Escreva o item.');
      await adicionarItem(id, 'Primeiro');
      await adicionarItem(id, 'Segundo');
      const [primeiro, segundo] = (await carregarPainel(id))?.itens ?? [];
      expect(segundo?.ordem).toBe(1);
      await marcarItem(primeiro?.id as string, true, ID_CAMILA);
      expect((await carregarPainel(id))?.itens[0]).toMatchObject({ feito: true, feito_por: ID_CAMILA, feito_em: '2026-11-06T15:00:00.000Z' });
      expect((await carregarMeuDia()).atividades.find((item) => item.id === id)).toMatchObject({ itensFeitos: 1, itensTotal: 2 });
      await marcarItem(primeiro?.id as string, false, ID_CAMILA);
      expect((await carregarPainel(id))?.itens[0]).toMatchObject({ feito: false, feito_por: null, feito_em: null });
      await definirResponsavelDoItem(segundo?.id as string, ID_BRUNA);
      expect((await carregarPainel(id))?.itens[1]?.responsavel_id).toBe(ID_BRUNA);
      await removerItem(segundo?.id as string);
      expect((await carregarPainel(id))?.itens).toHaveLength(1);
      const historico = await textos(id);
      expect(historico).toContain('Kimberly Grebe acrescentou o item “Primeiro”');
      expect(historico).toContain('Kimberly Grebe concluiu o item “Primeiro”');
      expect(historico).toContain('Kimberly Grebe reabriu o item “Primeiro”');
      expect(historico).toContain('Kimberly Grebe tirou o item “Segundo”');
    });

    it('a carga de exemplo traz um checklist pela metade', async () => {
      const oferta = (await carregarMeuDia()).atividades.find((item) => item.titulo === 'Definir o preço da oferta anual');
      expect(oferta).toMatchObject({ itensFeitos: 2, itensTotal: 4, comentarios: 2 });
    });
  });

  describe('T03.02: comentários (RN-03.22)', () => {
    const pessoas = [
      { id: ID_KIMBERLY, nome_completo: 'Kimberly Grebe' },
      { id: ID_CAMILA, nome_completo: 'Camila Lima' },
    ];

    it('@pessoa vira menção, sem ligar para acento ou maiúscula', () => {
      expect(extrairMencoes('Olha isso, @camila e @KimberlyGrebe.', pessoas)).toEqual([ID_CAMILA, ID_KIMBERLY]);
      expect(extrairMencoes('@camíla', pessoas)).toEqual([ID_CAMILA]);
      expect(extrairMencoes('@ninguem e email@camila.com', pessoas)).toEqual([ID_CAMILA]);
      expect(extrairMencoes('sem menção', pessoas)).toEqual([]);
    });

    it('edição até 15 minutos, só de quem escreveu (02 §6)', async () => {
      const { id } = await criarAtividade(novo());
      const feito = (await comentar(id, 'Fala @camila', ID_KIMBERLY, pessoas)) as Comentario;
      expect(podeEditarComentario(feito, ID_KIMBERLY)).toBe(true);
      expect(podeEditarComentario(feito, ID_CAMILA)).toBe(false);
      await expect(editarComentario(feito.id, 'De outra pessoa', pessoas, ID_CAMILA)).rejects.toThrow('Só dá para editar um comentário seu');
      vi.setSystemTime(new Date('2026-11-06T15:15:00.000Z'));
      expect(podeEditarComentario(feito, ID_KIMBERLY)).toBe(true);
      vi.setSystemTime(new Date('2026-11-06T15:15:01.000Z'));
      expect(podeEditarComentario(feito, ID_KIMBERLY)).toBe(false);
      await expect(editarComentario(feito.id, 'Tarde demais', pessoas, ID_KIMBERLY)).rejects.toThrow('até 15 minutos depois de publicar');
      expect((await repositorios.comentario.obter(feito.id))?.texto).toBe('Fala @camila');
    });

    it('comenta, edita e remove; o removido fica na lista como "comentário removido", fora do contador', async () => {
      const { id } = await criarAtividade(novo());
      await expect(comentar(id, ' ', ID_KIMBERLY, pessoas)).rejects.toThrow('Escreva o comentário.');
      const feito = (await comentar(id, 'Fala @camila', ID_KIMBERLY, pessoas)) as Comentario;
      expect(feito.mencoes).toEqual([ID_CAMILA]);
      await editarComentario(feito.id, 'Corrigindo', pessoas, ID_KIMBERLY);
      expect((await carregarPainel(id))?.comentarios[0]).toMatchObject({ texto: 'Corrigindo', mencoes: [], editado_em: '2026-11-06T15:00:00.000Z' });
      expect((await carregarMeuDia()).atividades.find((item) => item.id === id)?.comentarios).toBe(1);
      await removerComentario(feito.id);
      expect((await carregarPainel(id))?.comentarios[0]).toMatchObject({ texto: 'Comentário removido', mencoes: [], removido_em: '2026-11-06T15:00:00.000Z' });
      expect(podeEditarComentario({ ...feito, removido_em: '2026-11-06T15:00:00.000Z' }, ID_KIMBERLY)).toBe(false);
      expect((await carregarMeuDia()).atividades.find((item) => item.id === id)?.comentarios).toBe(0);
      const historico = await textos(id);
      expect(historico).toContain('Kimberly Grebe comentou');
      expect(historico).toContain('Kimberly Grebe editou um comentário');
      expect(historico).toContain('Kimberly Grebe removeu um comentário');
    });
  });

  describe('T03.02: vínculos e arquivos', () => {
    it('vínculo é único nos dois sentidos', () => {
      const a = { tipo: 'atividade', id: 'x' };
      const b = { tipo: 'contraparte', id: 'y' };
      expect(parDoVinculo(a, b)).toEqual(parDoVinculo(b, a));
    });

    it('vincula, não repete e tira', async () => {
      const { id } = await criarAtividade(novo());
      await adicionarVinculo(id, 'produto', ID_PRODUTO_KIPI);
      await expect(adicionarVinculo(id, 'produto', ID_PRODUTO_KIPI)).rejects.toThrow('Este vínculo já existe.');
      const [vinculo] = await vinculosDaAtividade(id);
      expect(vinculo).toMatchObject({ rotulo: 'Produto', nome: 'Kipi', href: `/configuracoes/cadastros/marcas/produtos/${ID_PRODUTO_KIPI}` });
      await removerVinculo(vinculo?.id as string);
      expect(await vinculosDaAtividade(id)).toEqual([]);
      const historico = await textos(id);
      expect(historico).toContain('Kimberly Grebe vinculou Kipi');
      expect(historico).toContain('Kimberly Grebe tirou o vínculo com Kipi');
    });

    it('link só do Drive; título padrão', async () => {
      const { id } = await criarAtividade(novo());
      await expect(adicionarAnexo(id, 'https://exemplo.com', '')).rejects.toThrow('Use um link de drive.google.com');
      await adicionarAnexo(id, LINK, '');
      const [anexo] = (await carregarPainel(id))?.anexos ?? [];
      expect(anexo).toMatchObject({ titulo: 'Arquivo do Drive', url: LINK });
      await removerAnexo(anexo?.id as string);
      expect((await carregarPainel(id))?.anexos).toEqual([]);
      expect(await textos(id)).toContain('Kimberly Grebe acrescentou o link “Arquivo do Drive”');
    });
  });

  describe('T03.02: duplicar e converter', () => {
    it('duplica como nova, com contexto, participantes e checklist desmarcado', async () => {
      const original = await criarAtividade(novo({ titulo: 'Original', contextos: [ID_PRODUTO_KIPI], participantes: [ID_CAMILA], checklist: 'Um' }));
      const [item] = (await carregarPainel(original.id))?.itens ?? [];
      await marcarItem(item?.id as string, true, ID_KIMBERLY);
      await repositorios.atividade.atualizar(original.id, { situacao: 'concluida', concluida_em: '2026-11-06T15:00:00.000Z', concluida_por: ID_KIMBERLY, adiamentos: 3 });
      const copia = await duplicarAtividade(original.id);
      expect(copia).toMatchObject({ titulo: 'Original (cópia)', situacao: 'a_fazer', concluida_em: null, adiamentos: 0 });
      expect(copia.codigo).not.toBe(original.codigo);
      const painel = await carregarPainel(copia.id);
      expect(painel?.produtos).toEqual([ID_PRODUTO_KIPI]);
      expect(painel?.participantes).toEqual([ID_CAMILA]);
      expect(painel?.itens[0]).toMatchObject({ texto: 'Um', feito: false, feito_por: null });
    });

    it('título no limite continua dentro do limite; alerta não duplica', async () => {
      const longa = await criarAtividade(novo({ titulo: 'x'.repeat(140) }));
      expect((await duplicarAtividade(longa.id)).titulo.length).toBeLessThanOrEqual(140);
      const alerta = (await repositorios.atividade.listar({ onde: { tipo: 'alerta' } }))[0] as Atividade;
      await expect(duplicarAtividade(alerta.id)).rejects.toThrow('Alerta não pode ser duplicado');
    });

    it('converte, e o que era da demanda fica guardado', async () => {
      const { id } = await criarAtividade(novo());
      await converterAtividade(id, 'demanda', ID_CAMILA);
      expect(await obter(id)).toMatchObject({ tipo: 'demanda', solicitante_pessoa_id: ID_CAMILA });
      await converterAtividade(id, 'tarefa', ID_KIMBERLY);
      expect(await obter(id)).toMatchObject({ tipo: 'tarefa', solicitante_pessoa_id: ID_CAMILA });
      await converterAtividade(id, 'demanda', ID_KIMBERLY);
      expect((await obter(id)).solicitante_pessoa_id).toBe(ID_CAMILA);
    });
  });

  describe('RN-03.20: a atividade aparece na ficha do registro', () => {
    it('contraparte pelo vínculo; produto pelo contexto e pelo vínculo; pessoa como responsável ou participante', async () => {
      const doExemplo = (await atividadesDoRegistro('contraparte', ID_CONTRAPARTE_CONTABILIDADE)).map((item) => item.titulo);
      expect(doExemplo).toEqual(['Confirmar os documentos para abrir a empresa']);
      const { id } = await criarAtividade(novo({ titulo: 'Vinculada', vinculo: `produto:${ID_PRODUTO_ZUPI}` }));
      const doProduto = (await atividadesDoRegistro('produto', ID_PRODUTO_ZUPI)).map((item) => item.titulo);
      expect(doProduto).toEqual(expect.arrayContaining(['Revisar os textos da página de preços do Zupi', 'Vinculada']));
      expect((await atividadesDaPessoa(ID_BRUNA)).map((item) => item.titulo)).toEqual(expect.arrayContaining(['Entregar a nova versão do logotipo do Mimo']));
      await definirParticipantes(id, [ID_BRUNA]);
      expect((await atividadesDaPessoa(ID_BRUNA)).map((item) => item.id)).toContain(id);
    });

    it('vínculo aberto prende a contraparte e o produto (RN-02.04)', async () => {
      expect(await vinculosDaContraparte(ID_CONTRAPARTE_CONTABILIDADE)).toContain('1 atividade aberta');
      const antes = await quantasAtividadesAbertasNoProduto(ID_PRODUTO_ZUPI);
      await criarAtividade(novo({ vinculo: `produto:${ID_PRODUTO_ZUPI}` }));
      expect(await quantasAtividadesAbertasNoProduto(ID_PRODUTO_ZUPI)).toBe(antes + 1);
    });
  });

  describe('painel e histórico', () => {
    it('atividade que não existe mais', async () => {
      expect(await carregarPainel('nao-existe')).toBeNull();
    });

    it('diz quem bloqueou, pelo histórico', async () => {
      const { id } = await criarAtividade(novo());
      gravarMeta({ pessoa_atual_id: ID_CAMILA });
      await repositorios.atividade.atualizar(id, { bloqueada: true, bloqueio_motivo: 'x', bloqueada_em: '2026-11-06T15:00:00.000Z' });
      expect((await carregarPainel(id))?.quemBloqueou).toBe(ID_CAMILA);
    });

    it('o histórico da aba Dados continua legível', async () => {
      const { id } = await criarAtividade(novo());
      await comentar(id, 'Oi', ID_KIMBERLY, []);
      expect((await historicoRecente(2)).map((linha) => linha.texto)).toEqual(['Kimberly Grebe comentou', 'Kimberly Grebe criou a atividade Atividade nova']);
    });
  });

  describe('com os outros dados', () => {
    it('apoio não conta como registro, e sai junto com o que é fictício', async () => {
      expect((await resumoDosDados()).registros).toBe(REGISTROS_INICIAIS);
      const real = await criarAtividade(novo({ titulo: 'Real', checklist: 'Fica', vinculo: `contraparte:${ID_CONTRAPARTE_CONTABILIDADE}` }));
      const [item] = (await carregarPainel(real.id))?.itens ?? [];
      await definirResponsavelDoItem(item?.id as string, ID_BRUNA);
      await comentar(real.id, 'Fica', ID_KIMBERLY, []);
      await limparExemplos();
      for (const tabela of ['checklist_item', 'comentario', 'anexo_link'] as const) expect((await repositorios[tabela].listar()).every((linha) => linha.registro_id === real.id)).toBe(true);
      const painel = await carregarPainel(real.id);
      expect(painel?.itens[0]).toMatchObject({ texto: 'Fica', responsavel_id: null });
      expect(painel?.comentarios).toHaveLength(1);
      expect(painel?.vinculos).toEqual([]);
    });
  });

  describe('dados da versão anterior', () => {
    function voltarParaVersao7() {
      for (const tabela of ['checklist_item', 'comentario', 'vinculo', 'anexo_link']) armazenamento.removeItem(chaveDaTabela(tabela));
      gravarMeta({ versao_dados: 7 });
      esquecerMetaEmMemoria();
    }

    it('acrescenta sem tocar no que existia', async () => {
      await repositorios.configuracao.salvar({ organizacao_nome: 'Numa Planejada' });
      voltarParaVersao7();
      expect((await repositorios.checklist_item.listar()).length).toBeGreaterThan(0);
      expect((await repositorios.configuracao.ler()).organizacao_nome).toBe('Numa Planejada');
      expect(lerMeta().versao_dados).toBe(VERSAO_DADOS);
    });

    it('quem já limpou os exemplos não recebe exemplos novos', async () => {
      await limparExemplos();
      voltarParaVersao7();
      expect(await repositorios.checklist_item.listar()).toEqual([]);
      expect(await repositorios.vinculo.listar()).toEqual([]);
    });
  });
});
