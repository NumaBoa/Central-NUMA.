/**
 * Decisões (RN-06.13 e RN-06.15). A tabela é a de 16 §4.6, a fonte única: quando a T06.09 (M06) for construída,
 * ela usa esta mesma tabela. Aqui só existe o que o M07 precisa: registrar, vincular e listar. Nada edita uma
 * decisão registrada.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { parDoVinculo } from '@/dados/tipos/apoio';
import type { Decisao } from '@/dados/tipos/decisao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { hojeISO } from '@/lib/datas';

export type AssuntoDecisao = Decisao['assunto'];

export const ROTULOS_ASSUNTO_DECISAO: Readonly<Record<AssuntoDecisao, string>> = { geral: 'Geral', estagio: 'Estágio do produto', fila: 'Fila de produtos', preco: 'Preço', excecao_preco: 'Exceção de preço' };

export type NovaDecisao = {
  modo: 'registrar';
  titulo: string;
  descricao: string;
  motivo: string;
  alternativas: string;
  impacto: string;
  data: string;
  decisores: readonly string[];
};

export type EntradaDecisao = { modo: 'vincular'; decisao_id: string } | NovaDecisao;

export function novaDecisaoVazia(hoje: string, decisores: readonly string[] = []): NovaDecisao {
  return { modo: 'registrar', titulo: '', descricao: '', motivo: '', alternativas: '', impacto: '', data: hoje, decisores };
}

/** Sócias ativas: só elas decidem (T06.09). */
export function sociasParaDecidir(pessoas: readonly Pessoa[]): Pessoa[] {
  return pessoas.filter((pessoa) => pessoa.eh_socia && pessoa.situacao === 'ativa' && !pessoa.arquivado_em);
}

/** Por campo, para aparecer junto dele. */
export function errosDaDecisao(entrada: EntradaDecisao | null, hoje: string = hojeISO()): Readonly<Record<string, string>> {
  if (!entrada) return { decisao_id: 'Vincule ou registre a decisão.' };
  if (entrada.modo === 'vincular') return entrada.decisao_id ? {} : { decisao_id: 'Escolha a decisão.' };
  const erros: Record<string, string> = {};
  if (!entrada.titulo.trim()) erros.titulo = 'Informe o título da decisão.';
  if (!entrada.descricao.trim()) erros.descricao = 'Diga o que foi decidido.';
  if (!entrada.data) erros.data = 'Informe a data.';
  else if (entrada.data > hoje) erros.data = 'A decisão precisa já ter sido tomada: use hoje ou uma data passada.';
  if (!entrada.decisores.length) erros.decisores = 'Marque quem decidiu.';
  return erros;
}

export type RegrasDaDecisao = {
  /** O produto a que a decisão nova pertence. Sem produto, é da Numa. */
  produto_id: string | null;
  assunto: AssuntoDecisao;
  /** Decisão existente precisa ser deste assunto (exceção de preço, RN-07.06). */
  exigirAssunto?: boolean;
  /** Sem isto, só as decisões do próprio produto e as da Numa. A fila envolve vários produtos. */
  qualquerProduto?: boolean;
};

export function decisaoServe(decisao: Pick<Decisao, 'situacao' | 'produto_id' | 'assunto' | 'arquivado_em'>, regras: RegrasDaDecisao): boolean {
  if (decisao.situacao !== 'registrada' || decisao.arquivado_em) return false;
  if (regras.exigirAssunto && decisao.assunto !== regras.assunto) return false;
  return Boolean(regras.qualquerProduto) || decisao.produto_id === null || decisao.produto_id === regras.produto_id;
}

export async function decisoesParaVincular(regras: RegrasDaDecisao): Promise<Decisao[]> {
  const decisoes = await repositorios.decisao.listar();
  return decisoes.filter((decisao) => decisaoServe(decisao, regras)).sort((a, b) => b.data.localeCompare(a.data) || b.codigo.localeCompare(a.codigo));
}

export type OpcoesDaDecisao = { decisoes: Decisao[]; socias: Pessoa[] };

/** Quem registrou a saída em T06.02 não decide mais. */
async function sociasQueDecidem(pessoas: readonly Pessoa[], hoje: string): Promise<Pessoa[]> {
  const saidas = (await repositorios.socia.listar()).filter((socia) => socia.saida_em && socia.saida_em <= hoje).map((socia) => socia.pessoa_id);
  return sociasParaDecidir(pessoas).filter((pessoa) => !saidas.includes(pessoa.id));
}

export async function carregarOpcoesDaDecisao(regras: RegrasDaDecisao): Promise<OpcoesDaDecisao> {
  const [decisoes, pessoas] = await Promise.all([decisoesParaVincular(regras), repositorios.pessoa.listar()]);
  return { decisoes, socias: await sociasQueDecidem(pessoas, hojeISO()) };
}

/** Registra a decisão nova ou confere a existente. Falhar aqui desfaz tudo o que vier na mesma transação. */
export async function resolverDecisao(entrada: EntradaDecisao | null, regras: RegrasDaDecisao, hoje: string = hojeISO()): Promise<Decisao> {
  const erro = Object.values(errosDaDecisao(entrada, hoje))[0];
  if (erro || !entrada) throw new ErroDeRegra(erro ?? 'Vincule ou registre a decisão.');

  if (entrada.modo === 'vincular') {
    const decisao = await repositorios.decisao.obter(entrada.decisao_id);
    if (!decisao) throw new ErroDeRegra('Esta decisão não existe mais. Escolha outra ou registre agora.');
    if (regras.exigirAssunto && decisao.assunto !== regras.assunto) throw new ErroDeRegra(`Esta decisão não é de ${ROTULOS_ASSUNTO_DECISAO[regras.assunto].toLocaleLowerCase('pt-BR')}. Escolha uma específica ou registre agora.`);
    if (!decisaoServe(decisao, regras)) throw new ErroDeRegra('Esta decisão foi substituída ou é de outro produto. Escolha outra ou registre agora.');
    return decisao;
  }

  const pessoas = await repositorios.pessoa.listar();
  const socias = new Set((await sociasQueDecidem(pessoas, hoje)).map((pessoa) => pessoa.id));
  if (!entrada.decisores.every((id) => socias.has(id))) throw new ErroDeRegra('Só uma sócia ativa pode constar como quem decidiu.');

  return emTransacao(async () => {
    const decisao = await repositorios.decisao.criar({
      titulo: entrada.titulo.trim(),
      descricao: entrada.descricao.trim(),
      motivo: entrada.motivo.trim() || null,
      alternativas: entrada.alternativas.trim() || null,
      impacto: entrada.impacto.trim() || null,
      data: entrada.data,
      area_id: null,
      produto_id: regras.produto_id,
      reuniao_id: null,
      situacao: 'registrada',
      substituida_por_id: null,
      assunto: regras.assunto,
    });
    for (const pessoa_id of entrada.decisores) await repositorios.decisao_decisor.criar({ decisao_id: decisao.id, pessoa_id });
    return decisao;
  });
}

/** Registros afetados (T06.09). Repetir não duplica o vínculo. */
export async function vincularDecisao(decisaoId: string, tipo: string, id: string): Promise<void> {
  const par = parDoVinculo({ tipo: 'decisao', id: decisaoId }, { tipo, id });
  const existentes = await repositorios.vinculo.listar({ onde: par });
  if (!existentes.length) await repositorios.vinculo.criar(par);
}

export type LinhaDaDecisao = Decisao & { decisores: string[] };

/** As do produto e as que apontam para ele pelo vínculo, como as da fila. */
export async function decisoesDoProduto(produtoId: string): Promise<LinhaDaDecisao[]> {
  const [decisoes, vinculos, decisores, pessoas] = await Promise.all([repositorios.decisao.listar(), repositorios.vinculo.listar(), repositorios.decisao_decisor.listar(), repositorios.pessoa.listar({ incluirArquivados: true })]);
  const ligadas = new Set(
    vinculos.flatMap((vinculo) => {
      if (vinculo.origem_tipo === 'decisao' && vinculo.destino_tipo === 'produto' && vinculo.destino_id === produtoId) return [vinculo.origem_id];
      if (vinculo.destino_tipo === 'decisao' && vinculo.origem_tipo === 'produto' && vinculo.origem_id === produtoId) return [vinculo.destino_id];
      return [];
    }),
  );
  return decisoes
    .filter((decisao) => decisao.produto_id === produtoId || ligadas.has(decisao.id))
    .map((decisao) => ({ ...decisao, decisores: decisores.filter((linha) => linha.decisao_id === decisao.id).map((linha) => pessoas.find((pessoa) => pessoa.id === linha.pessoa_id)?.nome_completo ?? 'Pessoa removida') }))
    .sort((a, b) => b.data.localeCompare(a.data) || b.codigo.localeCompare(a.codigo));
}
