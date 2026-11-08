/**
 * T12.07 Notas de liberação (RN-12.13), com a especificação do Fadami Flow simplificada: só Rascunho e
 * Publicada; publicada não muda (para corrigir, uma nova versão); o texto puxado de uma solicitação ou tarefa
 * é sugestão editável, e nunca altera a origem; a prévia para clientes não mostra referências internas.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import { CANAIS_NOTA, CATEGORIAS_ITEM_NOTA, PUBLICOS_NOTA, type NotaLiberacao, type NotaLiberacaoItem, type SolicitacaoSuporte } from '@/dados/tipos/operacao';
import type { Atividade } from '@/dados/tipos/atividade';

export type CategoriaItem = (typeof CATEGORIAS_ITEM_NOTA)[number];
export const ROTULOS_CATEGORIA_ITEM: Readonly<Record<CategoriaItem, string>> = { novidade: 'Novidades', melhoria: 'Melhorias', correcao: 'Correções' };
export const ROTULOS_CATEGORIA_ITEM_SINGULAR: Readonly<Record<CategoriaItem, string>> = { novidade: 'Novidade', melhoria: 'Melhoria', correcao: 'Correção' };
export const ROTULOS_PUBLICO_NOTA: Readonly<Record<(typeof PUBLICOS_NOTA)[number], string>> = { interno: 'Interno', clientes: 'Clientes', todos: 'Todos' };
export const ROTULOS_CANAL_NOTA: Readonly<Record<(typeof CANAIS_NOTA)[number], string>> = { loja: 'Loja de apps', email: 'E-mail', site: 'Site' };

const normalizar = (versao: string) => versao.trim().replace(/^v(?=\d)/i, '').toLowerCase();

export type DadosDaNota = { produto_id: string; versao: string; data: string; publico: NotaLiberacao['publico']; resumo: string };

async function versaoRepetida(produtoId: string, versao: string, idAtual?: string): Promise<boolean> {
  const notas = await repositorios.nota_liberacao.listar({ onde: { produto_id: produtoId }, incluirArquivados: true });
  return notas.some((nota) => nota.id !== idAtual && normalizar(nota.versao) === normalizar(versao));
}

function conferirCabecalho(dados: DadosDaNota) {
  if (!dados.produto_id) throw new ErroDeRegra('Escolha o produto.');
  if (!dados.versao.trim()) throw new ErroDeRegra('Informe a versão, como 1.4.0.');
  if (dados.versao.trim().length > 40) throw new ErroDeRegra('A versão vai até 40 caracteres.');
  if (!(PUBLICOS_NOTA as readonly string[]).includes(dados.publico)) throw new ErroDeRegra('Escolha o público.');
}

/** Única por produto e versão (16 §4.12), contando as removidas: "v1.4.0" e "1.4.0" são a mesma. */
export async function criarNota(dados: DadosDaNota): Promise<NotaLiberacao> {
  conferirCabecalho(dados);
  if (await versaoRepetida(dados.produto_id, dados.versao)) throw new ErroDeRegra('Já existe uma nota desta versão para o produto.');
  return repositorios.nota_liberacao.criar({ produto_id: dados.produto_id, versao: dados.versao.trim(), data: dados.data || null, publico: dados.publico, situacao: 'rascunho', publicada_em: null, publicada_por: null, canais: [], comunicacao_observacao: null, resumo: dados.resumo.trim() || null });
}

async function rascunho(id: string): Promise<NotaLiberacao> {
  const nota = await repositorios.nota_liberacao.obter(id);
  if (!nota) throw new ErroDeRegra('Esta nota não existe mais.');
  if (nota.situacao === 'publicada') throw new ErroDeRegra('Nota publicada não muda. Para corrigir, crie uma nova versão.');
  return nota;
}

export async function salvarCabecalho(id: string, dados: Omit<DadosDaNota, 'produto_id'>): Promise<NotaLiberacao> {
  const nota = await rascunho(id);
  conferirCabecalho({ ...dados, produto_id: nota.produto_id });
  if (await versaoRepetida(nota.produto_id, dados.versao, id)) throw new ErroDeRegra('Já existe uma nota desta versão para o produto.');
  return repositorios.nota_liberacao.atualizar(id, { versao: dados.versao.trim(), data: dados.data || null, publico: dados.publico, resumo: dados.resumo.trim() || null });
}

export async function removerRascunho(id: string): Promise<void> {
  await rascunho(id);
  await emTransacao(async () => {
    for (const item of await repositorios.nota_liberacao_item.listar({ onde: { nota_id: id } })) await repositorios.nota_liberacao_item.arquivar(item.id);
    await repositorios.nota_liberacao.arquivar(id, 'Rascunho removido');
  });
}

// ---------- Itens ----------

export async function itensDaNota(notaId: string): Promise<NotaLiberacaoItem[]> {
  return (await repositorios.nota_liberacao_item.listar({ onde: { nota_id: notaId } })).sort((a, b) => a.ordem - b.ordem);
}

export async function salvarItem(notaId: string, { categoria, texto }: { categoria: CategoriaItem; texto: string }, itemId?: string): Promise<NotaLiberacaoItem> {
  await rascunho(notaId);
  if (!(CATEGORIAS_ITEM_NOTA as readonly string[]).includes(categoria)) throw new ErroDeRegra('Escolha a categoria.');
  if (!texto.trim()) throw new ErroDeRegra('Escreva o item.');
  if (texto.trim().length > 500) throw new ErroDeRegra('O item vai até 500 caracteres.');
  if (itemId) return repositorios.nota_liberacao_item.atualizar(itemId, { categoria, texto: texto.trim() });
  const itens = await itensDaNota(notaId);
  return repositorios.nota_liberacao_item.criar({ nota_id: notaId, categoria, texto: texto.trim(), origem_tipo: null, origem_id: null, ordem: itens.length });
}

export async function removerItem(itemId: string): Promise<void> {
  const item = await repositorios.nota_liberacao_item.obter(itemId);
  if (!item) throw new ErroDeRegra('Este item não existe mais.');
  await rascunho(item.nota_id);
  await repositorios.nota_liberacao_item.arquivar(itemId);
}

/** Muda a ordem dentro da nota: sobe ou desce uma posição. */
export async function moverItem(itemId: string, direcao: -1 | 1): Promise<void> {
  const item = await repositorios.nota_liberacao_item.obter(itemId);
  if (!item) throw new ErroDeRegra('Este item não existe mais.');
  await rascunho(item.nota_id);
  const itens = await itensDaNota(item.nota_id);
  const indice = itens.findIndex((linha) => linha.id === itemId);
  const vizinho = itens[indice + direcao];
  if (!vizinho) return;
  await emTransacao(async () => {
    await repositorios.nota_liberacao_item.atualizar(item.id, { ordem: vizinho.ordem });
    await repositorios.nota_liberacao_item.atualizar(vizinho.id, { ordem: item.ordem });
  });
}

// ---------- Puxar das solicitações resolvidas e das tarefas concluídas (T12.07) ----------

export type Candidato = { tipo: 'solicitacao_suporte' | 'atividade'; id: string; codigo: string; texto: string; categoria: CategoriaItem; concluidoEm: string };

/** Falha vira correção; melhoria incluída, melhoria; tarefa, novidade. É só a sugestão: tudo se edita. */
export function categoriaSugerida(origem: { tipo: 'solicitacao_suporte'; solicitacao: Pick<SolicitacaoSuporte, 'tipo'> } | { tipo: 'atividade' }): CategoriaItem {
  if (origem.tipo === 'atividade') return 'novidade';
  return origem.solicitacao.tipo === 'falha' ? 'correcao' : 'melhoria';
}

/** "Desde a última versão": depois da data da última nota publicada do produto. Já usados em outra nota ficam de fora. */
export async function candidatosParaPuxar(notaId: string): Promise<{ desde: string | null; candidatos: Candidato[] }> {
  const nota = await rascunho(notaId);
  const [notas, itens, solicitacoes, atividades, ligacoes] = await Promise.all([repositorios.nota_liberacao.listar({ onde: { produto_id: nota.produto_id, situacao: 'publicada' } }), repositorios.nota_liberacao_item.listar(), repositorios.solicitacao_suporte.listar({ onde: { produto_id: nota.produto_id } }), repositorios.atividade.listar({ onde: { situacao: 'concluida' } }), repositorios.atividade_produto.listar({ onde: { produto_id: nota.produto_id } })]);
  const desde = notas.map((linha) => linha.data).filter(Boolean).sort().at(-1) ?? null;
  const usados = new Set(itens.filter((item) => item.origem_id).map((item) => `${item.origem_tipo}:${item.origem_id}`));
  const doProduto = new Set(ligacoes.map((ligacao) => ligacao.atividade_id));
  const depois = (instante: string | null) => Boolean(instante) && (!desde || (instante as string).slice(0, 10) > desde);
  const candidatos: Candidato[] = [
    ...solicitacoes.filter((linha) => (linha.situacao === 'resolvida' || linha.situacao === 'fechada') && linha.tipo !== 'novo_escopo' && depois(linha.resolvida_em) && !usados.has(`solicitacao_suporte:${linha.id}`)).map((linha) => ({ tipo: 'solicitacao_suporte' as const, id: linha.id, codigo: linha.codigo, texto: linha.titulo, categoria: categoriaSugerida({ tipo: 'solicitacao_suporte', solicitacao: linha }), concluidoEm: linha.resolvida_em as string })),
    ...atividades.filter((linha: Atividade) => linha.tipo === 'tarefa' && doProduto.has(linha.id) && depois(linha.concluida_em) && !usados.has(`atividade:${linha.id}`)).map((linha) => ({ tipo: 'atividade' as const, id: linha.id, codigo: linha.codigo, texto: linha.titulo, categoria: 'novidade' as const, concluidoEm: linha.concluida_em as string })),
  ];
  return { desde, candidatos: candidatos.sort((a, b) => a.concluidoEm.localeCompare(b.concluidoEm)) };
}

/** Puxar de novo não duplica: a mesma origem entra uma vez em todas as notas. */
export async function puxarItens(notaId: string, escolhidos: readonly { tipo: Candidato['tipo']; id: string }[]): Promise<number> {
  const { candidatos } = await candidatosParaPuxar(notaId);
  const itens = await itensDaNota(notaId);
  let ordem = itens.length;
  let novos = 0;
  await emTransacao(async () => {
    for (const escolhido of escolhidos) {
      const candidato = candidatos.find((linha) => linha.tipo === escolhido.tipo && linha.id === escolhido.id);
      if (!candidato) continue;
      await repositorios.nota_liberacao_item.criar({ nota_id: notaId, categoria: candidato.categoria, texto: candidato.texto, origem_tipo: candidato.tipo, origem_id: candidato.id, ordem });
      ordem += 1;
      novos += 1;
    }
  });
  return novos;
}

// ---------- Publicar (RN-12.13) e comunicar ----------

/** Publicar exige pelo menos um item e a data. As solicitações de origem passam a apontar para a nota. */
export async function publicarNota(id: string): Promise<NotaLiberacao> {
  const nota = await rascunho(id);
  const itens = await itensDaNota(id);
  if (!itens.length) throw new ErroDeRegra('Publicar exige pelo menos um item.');
  if (!nota.data) throw new ErroDeRegra('Publicar exige a data da versão.');
  return emTransacao(async () => {
    for (const item of itens) if (item.origem_tipo === 'solicitacao_suporte' && item.origem_id) {
      const solicitacao = await repositorios.solicitacao_suporte.obter(item.origem_id);
      if (solicitacao && !solicitacao.nota_id) await repositorios.solicitacao_suporte.atualizar(solicitacao.id, { nota_id: id });
    }
    return repositorios.nota_liberacao.atualizar(id, { situacao: 'publicada', publicada_em: new Date().toISOString(), publicada_por: idDaPessoaAtual() });
  });
}

/** Onde foi comunicada (loja, e-mail, site), depois de publicada. É o único dado que muda numa publicada. */
export async function registrarComunicacao(id: string, canais: readonly NotaLiberacao['canais'][number][], observacao: string): Promise<NotaLiberacao> {
  const nota = await repositorios.nota_liberacao.obter(id);
  if (!nota) throw new ErroDeRegra('Esta nota não existe mais.');
  if (nota.situacao !== 'publicada') throw new ErroDeRegra('Registre a comunicação depois de publicar.');
  if (canais.some((canal) => !(CANAIS_NOTA as readonly string[]).includes(canal))) throw new ErroDeRegra('Canal desconhecido.');
  return repositorios.nota_liberacao.atualizar(id, { canais: [...new Set(canais)], comunicacao_observacao: observacao.trim() || null });
}

// ---------- Prévia em formato de comunicação ----------

export type PreviaDaNota = { titulo: string; data: string | null; resumo: string | null; grupos: { categoria: CategoriaItem; rotulo: string; itens: { texto: string; referencia: string | null }[] }[]; interna: boolean };

/** Agrupada por categoria, na ordem Novidades, Melhorias, Correções. Para clientes, sem referências internas. */
export function previaDaNota(nota: Pick<NotaLiberacao, 'versao' | 'data' | 'resumo' | 'publico'>, itens: readonly NotaLiberacaoItem[], nomeDoProduto: string, referencias: ReadonlyMap<string, string>): PreviaDaNota {
  const interna = nota.publico === 'interno';
  return {
    titulo: `${nomeDoProduto} ${nota.versao}`,
    data: nota.data,
    resumo: nota.resumo,
    interna,
    grupos: CATEGORIAS_ITEM_NOTA.map((categoria) => ({ categoria, rotulo: ROTULOS_CATEGORIA_ITEM[categoria], itens: itens.filter((item) => item.categoria === categoria).map((item) => ({ texto: item.texto, referencia: interna && item.origem_id ? (referencias.get(item.origem_id) ?? null) : null })) })).filter((grupo) => grupo.itens.length),
  };
}

// ---------- Ler ----------

export async function carregarNotas() {
  const [notas, itens, produtos] = await Promise.all([repositorios.nota_liberacao.listar(), repositorios.nota_liberacao_item.listar(), repositorios.produto.listar({ incluirArquivados: true })]);
  return { notas: notas.sort((a, b) => (b.data ?? '9999').localeCompare(a.data ?? '9999') || b.criado_em.localeCompare(a.criado_em)), itens, produtos };
}

export async function carregarNota(id: string) {
  const nota = await repositorios.nota_liberacao.obter(id);
  if (!nota) return null;
  const [itens, produto, solicitacoes, atividades] = await Promise.all([itensDaNota(id), repositorios.produto.obter(nota.produto_id), repositorios.solicitacao_suporte.listar(), repositorios.atividade.listar()]);
  const marca = produto ? await repositorios.marca.obter(produto.marca_id) : null;
  const referencias = new Map<string, string>([...solicitacoes.map((linha) => [linha.id, linha.codigo] as const), ...atividades.map((linha) => [linha.id, linha.codigo] as const)]);
  return { nota, itens, produto, marca, referencias };
}

export async function historicoDaNota(id: string) {
  const { historicoDosRegistros } = await import('./historico');
  const itens = await repositorios.nota_liberacao_item.listar({ onde: { nota_id: id }, incluirArquivados: true });
  return historicoDosRegistros([id, ...itens.map((item) => item.id)]);
}
