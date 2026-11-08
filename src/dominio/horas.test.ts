import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_CAMILA, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { ApontamentoHoras } from '@/dados/tipos/operacao';
import { esquemaApontamentoHoras } from '@/dados/tipos/operacao';
import { ID_INSTITUCIONAL } from './contextos';
import { erroDoContexto, esquemaFormularioHoras, formularioHorasVazio, horasDoRegistro, horasEReceita, horasPorPessoaEProduto, lerHoras, mediaMensalApontada, mesesAntes, opcoesDeVinculo, removerApontamento, repetirApontamento, salvarApontamento, ultimoApontamento, type DadosDosVinculos } from './horas';

const HOJE = '2026-11-08';

const apontamento = (alteracoes: Partial<ApontamentoHoras>): ApontamentoHoras => ({ id: crypto.randomUUID(), criado_em: '2026-11-01T12:00:00.000Z', criado_por: null, atualizado_em: '2026-11-01T12:00:00.000Z', atualizado_por: null, arquivado_em: null, arquivado_por: null, versao_registro: 1, exemplo: false, pessoa_id: ID_KIMBERLY, data: '2026-10-10', horas: 1, produto_id: ID_PRODUTO_KIPI, registro_tipo: null, registro_id: null, descricao: null, ...alteracoes });

describe('T12.06 Horas', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date(`${HOJE}T15:00:00.000Z`), toFake: ['Date'] });
    garantirCarga();
  });
  afterEach(() => vi.useRealTimers());

  describe('leitura das horas', () => {
    it('aceita decimal com vírgula ou ponto, relógio e "h"', () => {
      expect(lerHoras('1,5')).toBe(1.5);
      expect(lerHoras('2.25')).toBe(2.25);
      expect(lerHoras('1:30')).toBe(1.5);
      expect(lerHoras('1h15')).toBe(1.25);
      expect(lerHoras('3h')).toBe(3);
      expect(lerHoras('')).toBeNull();
      expect(lerHoras('meia hora')).toBeNaN();
      expect(lerHoras('1:75')).toBeNaN();
    });

    it('só múltiplos de 0,25 (RN-12.12), até 24 horas', () => {
      const erro = (horas: string) => esquemaFormularioHoras.safeParse({ ...formularioHorasVazio(HOJE, '', ID_INSTITUCIONAL), horas }).error?.issues[0]?.message;
      expect(erro('1,25')).toBeUndefined();
      expect(erro('0:45')).toBeUndefined();
      expect(erro('1,1')).toBe('Use múltiplos de 15 minutos: 0,25, 0,5, 1,75…');
      expect(erro('1:10')).toBe('Use múltiplos de 15 minutos: 0,25, 0,5, 1,75…');
      expect(erro('25')).toBe('Um apontamento vai até 24 horas.');
      expect(erro('0')).toBe('Use um número de horas, como 1,5 ou 1:30.');
      expect(esquemaApontamentoHoras.safeParse(apontamento({ horas: 0.3 })).success).toBe(false);
    });
  });

  describe('gravar', () => {
    it('aponta na Numa institucional, sem produto, e repete o último com a data de hoje', async () => {
      const salvo = await salvarApontamento({ data: '2026-11-07', horas: '2', contexto: ID_INSTITUCIONAL, vinculo: '', descricao: 'Organizar o Drive' }, ID_CAMILA, undefined, HOJE);
      expect(salvo).toMatchObject({ pessoa_id: ID_CAMILA, horas: 2, produto_id: null, registro_tipo: null, descricao: 'Organizar o Drive' });
      const ultimo = await ultimoApontamento(ID_CAMILA);
      expect(repetirApontamento(ultimo!, HOJE)).toEqual({ data: HOJE, horas: '2', contexto: ID_INSTITUCIONAL, vinculo: '', descricao: 'Organizar o Drive' });
      expect(await ultimoApontamento(ID_KIMBERLY)).toBeNull();
    });

    it('não aponta no futuro nem sem pessoa', async () => {
      await expect(salvarApontamento({ ...formularioHorasVazio('2026-11-09', '', ID_PRODUTO_KIPI), horas: '1' }, ID_KIMBERLY, undefined, HOJE)).rejects.toThrow('a data vai até hoje');
      await expect(salvarApontamento({ ...formularioHorasVazio(HOJE, '', ID_PRODUTO_KIPI), horas: '1' }, '', undefined, HOJE)).rejects.toThrow('Escolha quem você é');
    });

    it('edição livre guarda a autora original; remover arquiva', async () => {
      const salvo = await salvarApontamento({ ...formularioHorasVazio(HOJE, '', ID_PRODUTO_KIPI), horas: '1' }, ID_KIMBERLY, undefined, HOJE);
      const editado = await salvarApontamento({ ...formularioHorasVazio('2026-11-06', '', ID_PRODUTO_ZUPI), horas: '0,75' }, ID_CAMILA, salvo.id, HOJE);
      expect(editado).toMatchObject({ pessoa_id: ID_KIMBERLY, horas: 0.75, data: '2026-11-06', produto_id: ID_PRODUTO_ZUPI });
      await removerApontamento(salvo.id);
      expect(await repositorios.apontamento_horas.listar()).toHaveLength(0);
      expect(await repositorios.apontamento_horas.listar({ incluirArquivados: true })).toHaveLength(1);
    });

    it('o contexto acompanha o produto do vínculo', async () => {
      const comProduto = new Set((await repositorios.atividade_produto.listar()).map((ligacao) => ligacao.atividade_id));
      const atividade = (await repositorios.atividade.listar()).find((linha) => linha.situacao !== 'concluida' && linha.situacao !== 'cancelada' && linha.tipo === 'tarefa' && !comProduto.has(linha.id))!;
      await repositorios.atividade_produto.criar({ atividade_id: atividade.id, produto_id: ID_PRODUTO_KIPI });
      await expect(salvarApontamento({ ...formularioHorasVazio(HOJE, `atividade:${atividade.id}`, ID_PRODUTO_ZUPI), horas: '1' }, ID_KIMBERLY, undefined, HOJE)).rejects.toThrow('o contexto precisa ser o mesmo');
      const salvo = await salvarApontamento({ ...formularioHorasVazio(HOJE, `atividade:${atividade.id}`, ID_PRODUTO_KIPI), horas: '1' }, ID_KIMBERLY, undefined, HOJE);
      expect(salvo).toMatchObject({ registro_tipo: 'atividade', registro_id: atividade.id, produto_id: ID_PRODUTO_KIPI });
      await expect(salvarApontamento({ ...formularioHorasVazio(HOJE, 'atividade:nao-existe', ID_PRODUTO_KIPI), horas: '1' }, ID_KIMBERLY, undefined, HOJE)).rejects.toThrow('não está mais disponível');
    });
  });

  describe('vínculos', () => {
    const vazio: DadosDosVinculos = { implantacoes: [], contratos: [], itens: [], solicitacoes: [], atividades: [], produtosDasAtividades: [], produtos: [] };

    it('atividade concluída há mais de 30 dias e alertas ficam de fora; o vínculo antigo continua', () => {
      const base = { codigo: 'ATV-2026-0001', titulo: 'Corrigir login', tipo: 'tarefa', situacao: 'concluida', concluida_em: '2026-09-01T12:00:00.000Z' } as never;
      const opcoes = opcoesDeVinculo({ ...vazio, atividades: [{ ...(base as object), id: 'a1' } as never, { ...(base as object), id: 'a2', concluida_em: '2026-11-01T12:00:00.000Z' } as never, { ...(base as object), id: 'a3', tipo: 'alerta', situacao: 'a_fazer' } as never] }, HOJE, 'atividade:a1');
      expect(opcoes.map((opcao) => opcao.id)).toEqual(['a2', 'a1']);
      expect(opcoes[1]!.rotulo).toBe('Atividade (encerrado ou removido)');
    });

    it('com vários produtos, qualquer um deles serve', () => {
      const opcao = { valor: 'contrato:c1', tipo: 'contrato' as const, id: 'c1', rotulo: 'CTR', produtos: [ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI] };
      const produtos = [{ id: ID_PRODUTO_KIPI, nome: 'Kipi' }, { id: ID_PRODUTO_ZUPI, nome: 'Zupi' }];
      expect(erroDoContexto(opcao, ID_PRODUTO_ZUPI, produtos)).toBeNull();
      expect(erroDoContexto(opcao, ID_INSTITUCIONAL, produtos)).toBe('O vínculo é de Kipi, Zupi: escolha um desses produtos.');
    });
  });

  describe('relatórios', () => {
    const linhas = [apontamento({ horas: 2 }), apontamento({ horas: 1.5, pessoa_id: ID_CAMILA }), apontamento({ horas: 1, produto_id: null }), apontamento({ horas: 4, data: '2026-09-02' }), apontamento({ horas: 9, arquivado_em: '2026-10-11T00:00:00.000Z' })];

    it('pessoa × produto no mês, sem as removidas', () => {
      const tabela = horasPorPessoaEProduto(linhas, '2026-10');
      expect(tabela.total).toBe(4.5);
      expect(tabela.celula(ID_KIMBERLY, ID_PRODUTO_KIPI)).toBe(2);
      expect(tabela.celula(ID_KIMBERLY, ID_INSTITUCIONAL)).toBe(1);
      expect(tabela.totalDaPessoa(ID_CAMILA)).toBe(1.5);
      expect(tabela.totalDoContexto(ID_PRODUTO_KIPI)).toBe(3.5);
      expect(tabela.contextos).toEqual([ID_PRODUTO_KIPI, ID_INSTITUCIONAL]);
    });

    it('no contrato somam as horas das implantações e solicitações dele', () => {
      const ligadas = [apontamento({ registro_tipo: 'contrato', registro_id: 'c1', horas: 1 }), apontamento({ registro_tipo: 'implantacao', registro_id: 'i1', horas: 2 }), apontamento({ registro_tipo: 'solicitacao_suporte', registro_id: 's1', horas: 0.5 }), apontamento({ registro_tipo: 'implantacao', registro_id: 'i2', horas: 8 })];
      const ligados = { implantacoes: [{ id: 'i1', contrato_id: 'c1' }, { id: 'i2', contrato_id: 'c2' }], solicitacoes: [{ id: 's1', contrato_id: 'c1' }] };
      expect(horasDoRegistro(ligadas, 'contrato', 'c1', ligados).reduce((total, linha) => total + linha.horas, 0)).toBe(3.5);
      expect(horasDoRegistro(ligadas, 'implantacao', 'i2')).toHaveLength(1);
    });

    it('horas × receita: sem títulos não há receita, sem horas não há "por hora"', () => {
      const contrato = { id: 'c1' } as never;
      const titulo = (valor: number, situacao = 'em_aberto') => ({ natureza: 'receber', situacao, valor, arquivado_em: null }) as never;
      expect(horasEReceita(contrato, 10, [], () => 0)).toMatchObject({ receitaContratada: null, porHora: null });
      expect(horasEReceita(contrato, 0, [titulo(1000)], () => 0)).toMatchObject({ receitaContratada: 1000, porHora: null });
      expect(horasEReceita(contrato, 8, [titulo(1000), titulo(600), titulo(50, 'cancelado')], (linha) => ((linha as { valor: number }).valor === 1000 ? 1000 : 0))).toMatchObject({ receitaContratada: 1600, recebido: 1000, porHora: 200 });
    });

    it('média do simulador (D20): 3 meses completos, só os que têm apontamento', () => {
      expect(mesesAntes(HOJE, 3)).toEqual(['2026-10', '2026-09', '2026-08']);
      expect(mesesAntes('2026-01-15', 2)).toEqual(['2025-12', '2025-11']);
      const media = mediaMensalApontada([...linhas, apontamento({ data: HOJE, horas: 50 }), apontamento({ data: '2026-07-31', horas: 50 })], ID_PRODUTO_KIPI, HOJE);
      expect(media).toMatchObject({ media: 3.75, mesesComHoras: 2 });
      expect(mediaMensalApontada(linhas, ID_PRODUTO_ZUPI, HOJE)).toMatchObject({ media: null, mesesComHoras: 0 });
    });
  });
});
