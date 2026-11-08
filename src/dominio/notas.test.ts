import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_CAMILA, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { instanteNoFuso } from '@/lib/datas';
import { criarCatalogoDeExemplo } from './integracoes/catalogo-de-exemplo';
import { usarCatalogoDeTeste } from './integracoes/conexoes';
import { candidatosParaPuxar, criarNota, itensDaNota, moverItem, previaDaNota, publicarNota, puxarItens, registrarComunicacao, removerItem, removerRascunho, salvarCabecalho, salvarItem } from './notas';
import { abrirSolicitacao, formularioSolicitacaoVazio, resolverSolicitacao } from './suporte';

const em = (dia: string, hora: string) => instanteNoFuso(dia, hora, 'America/Sao_Paulo');
const nota = (versao = '1.4.0', extra = {}) => criarNota({ produto_id: ID_PRODUTO_KIPI, versao, data: '2026-11-20', publico: 'clientes', resumo: '', ...extra });
const solicitacaoResolvida = async (titulo: string, tipo: 'falha' | 'melhoria_incluida' | 'novo_escopo', quando: string, produto = ID_PRODUTO_KIPI) => {
  const aberta = await abrirSolicitacao({ ...formularioSolicitacaoVazio(ID_CAMILA), solicitante_texto: 'Maria', produto_id: produto, titulo, tipo }, quando);
  if (tipo !== 'novo_escopo') await resolverSolicitacao(aberta.id, 'Feito.', quando);
  return aberta;
};

describe('T12.07 Notas de liberação', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    usarCatalogoDeTeste(criarCatalogoDeExemplo());
    garantirCarga();
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    usarCatalogoDeTeste(null);
  });

  it('única por produto e versão, sem diferenciar "v1.4.0" de "1.4.0"', async () => {
    const primeira = await nota();
    expect(primeira).toMatchObject({ codigo: 'REL-2026-0001', situacao: 'rascunho', canais: [] });
    await expect(nota('v1.4.0')).rejects.toThrow('Já existe uma nota desta versão');
    await expect(criarNota({ produto_id: ID_PRODUTO_ZUPI, versao: '1.4.0', data: '', publico: 'todos', resumo: '' })).resolves.toBeTruthy();
    await expect(nota(' ')).rejects.toThrow('Informe a versão');
  });

  it('itens por categoria, em ordem, que sobem e descem', async () => {
    const criada = await nota();
    const a = await salvarItem(criada.id, { categoria: 'novidade', texto: 'Agenda compartilhada' });
    const b = await salvarItem(criada.id, { categoria: 'correcao', texto: 'Login no Android' });
    await moverItem(b.id, -1);
    expect((await itensDaNota(criada.id)).map((item) => item.texto)).toEqual(['Login no Android', 'Agenda compartilhada']);
    await salvarItem(criada.id, { categoria: 'melhoria', texto: 'Agenda compartilhada, mais rápida' }, a.id);
    await removerItem(b.id);
    expect((await itensDaNota(criada.id)).map((item) => [item.categoria, item.texto])).toEqual([['melhoria', 'Agenda compartilhada, mais rápida']]);
    await expect(salvarItem(criada.id, { categoria: 'novidade', texto: ' ' })).rejects.toThrow('Escreva o item.');
  });

  it('RN-12.13: publicar exige item e data; publicada não muda, só a comunicação', async () => {
    const criada = await criarNota({ produto_id: ID_PRODUTO_KIPI, versao: '2.0', data: '', publico: 'todos', resumo: '' });
    await expect(publicarNota(criada.id)).rejects.toThrow('pelo menos um item');
    await salvarItem(criada.id, { categoria: 'novidade', texto: 'Modo escuro' });
    await expect(publicarNota(criada.id)).rejects.toThrow('exige a data');
    await salvarCabecalho(criada.id, { versao: '2.0', data: '2026-11-20', publico: 'todos', resumo: 'A maior até agora.' });
    const publicada = await publicarNota(criada.id);
    expect(publicada).toMatchObject({ situacao: 'publicada', resumo: 'A maior até agora.' });
    expect(publicada.publicada_em).toBeTruthy();
    await expect(salvarItem(criada.id, { categoria: 'novidade', texto: 'Mais um' })).rejects.toThrow('Nota publicada não muda');
    await expect(salvarCabecalho(criada.id, { versao: '2.0.1', data: '2026-11-20', publico: 'todos', resumo: '' })).rejects.toThrow('Nota publicada não muda');
    await expect(removerRascunho(criada.id)).rejects.toThrow('Nota publicada não muda');
    expect(await registrarComunicacao(criada.id, ['loja', 'email', 'loja'], 'Texto da loja atualizado')).toMatchObject({ canais: ['loja', 'email'], comunicacao_observacao: 'Texto da loja atualizado' });
  });

  it('puxa solicitações resolvidas e tarefas concluídas desde a última versão, sem repetir', async () => {
    await solicitacaoResolvida('Login falhava no Android', 'falha', em('2026-11-05', '10:00'));
    await solicitacaoResolvida('Filtro por cliente', 'melhoria_incluida', em('2026-11-15', '10:00'));
    await solicitacaoResolvida('Integração nova', 'novo_escopo', em('2026-11-15', '10:00'));
    await solicitacaoResolvida('Do Zupi', 'falha', em('2026-11-15', '10:00'), ID_PRODUTO_ZUPI);
    const tarefa = (await repositorios.atividade.listar()).find((linha) => linha.tipo === 'tarefa' && linha.situacao === 'concluida');
    if (tarefa) await repositorios.atividade_produto.criar({ atividade_id: tarefa.id, produto_id: ID_PRODUTO_KIPI });
    const anterior = await nota('1.3.0', { data: '2026-11-10' });
    await salvarItem(anterior.id, { categoria: 'novidade', texto: 'Algo da 1.3' });
    await publicarNota(anterior.id);
    const atual = await nota('1.4.0');
    const { desde, candidatos } = await candidatosParaPuxar(atual.id);
    expect(desde).toBe('2026-11-10');
    expect(candidatos.filter((linha) => linha.tipo === 'solicitacao_suporte').map((linha) => [linha.texto, linha.categoria])).toEqual([['Filtro por cliente', 'melhoria']]);
    expect(await puxarItens(atual.id, candidatos.map((linha) => ({ tipo: linha.tipo, id: linha.id })))).toBe(candidatos.length);
    expect((await candidatosParaPuxar(atual.id)).candidatos).toHaveLength(0);
    const [item] = await itensDaNota(atual.id);
    expect(item).toMatchObject({ origem_tipo: 'solicitacao_suporte', texto: 'Filtro por cliente' });
    // O texto puxado se edita sem mudar a origem.
    await salvarItem(atual.id, { categoria: 'melhoria', texto: 'Agora dá para filtrar por cliente' }, item!.id);
    expect((await repositorios.solicitacao_suporte.obter(item!.origem_id!))?.titulo).toBe('Filtro por cliente');
    await publicarNota(atual.id);
    expect((await repositorios.solicitacao_suporte.obter(item!.origem_id!))?.nota_id).toBe(atual.id);
  });

  it('a prévia agrupa por categoria; para clientes, sem referências internas', async () => {
    const criada = await nota();
    const itens = [{ categoria: 'correcao', texto: 'Login', origem_id: 's1' }, { categoria: 'novidade', texto: 'Agenda', origem_id: null }].map((item, ordem) => ({ ...item, ordem, origem_tipo: item.origem_id ? 'solicitacao_suporte' : null })) as never[];
    const referencias = new Map([['s1', 'SUP-2026-0001']]);
    const externa = previaDaNota(criada, itens, 'Kipi', referencias);
    expect(externa).toMatchObject({ titulo: 'Kipi 1.4.0', interna: false, grupos: [{ rotulo: 'Novidades', itens: [{ texto: 'Agenda', referencia: null }] }, { rotulo: 'Correções', itens: [{ texto: 'Login', referencia: null }] }] });
    expect(previaDaNota({ ...criada, publico: 'interno' }, itens, 'Kipi', referencias).grupos[1]?.itens[0]?.referencia).toBe('SUP-2026-0001');
  });

  it('rascunho se remove, com os itens', async () => {
    const criada = await nota();
    await salvarItem(criada.id, { categoria: 'novidade', texto: 'Agenda' });
    await removerRascunho(criada.id);
    expect(await repositorios.nota_liberacao.listar()).toHaveLength(0);
    expect(await repositorios.nota_liberacao_item.listar()).toHaveLength(0);
  });
});
