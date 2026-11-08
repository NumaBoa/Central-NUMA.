/**
 * T05.13 Repasses a parceiros (F2, RN-05.22) e o mínimo de RN-11.26 (termos de repasse no item do contrato de
 * parceiro). As vendas de origem são lançadas à mão por contrato. O cálculo usa, para cada venda, os termos da versão
 * do contrato vigente na data da venda; desconta a retenção configurada; e gera um título a pagar ao parceiro, um por
 * parceiro × período (idempotente). A liberação do valor retido e a importação de vendas ficam para depois.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Contrato, ContratoVersao, ItemContrato } from '@/dados/tipos/contrato';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import type { LinhaDoRepasse, Repasse, VendaParceiro } from '@/dados/tipos/repasse';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { garantirCompetenciaAberta } from './competencias';
import { ID_INSTITUCIONAL } from './contextos';
import { versaoVigente } from './contratos';
import { lerValor } from './dinheiro';
import { gravarRateio } from './titulos';

const redondo = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Termos de repasse no item (RN-11.26) ----------

export type TermosDeRepasse = { percentual: string; base: '' | 'bruta' | 'liquida'; retencao: string };
export const ROTULOS_BASE_REPASSE = { bruta: 'venda bruta', liquida: 'venda líquida de taxas' } as const;

const percentualOuVazio = (texto: string, nome: string): number | null => {
  if (!texto.trim()) return null;
  const valor = lerValor(texto);
  if (valor === null || Number.isNaN(valor) || valor < 0 || valor > 100) throw new ErroDeRegra(`${nome}: informe um percentual de 0 a 100.`);
  return valor;
};

/** Grava os termos no item, só no rascunho de contrato de parceiro. Percentual sem base, ou base sem percentual, não vale. */
export async function salvarTermosDeRepasse(itemId: string, termos: TermosDeRepasse): Promise<void> {
  const item = await repositorios.item_contrato.obter(itemId);
  if (!item) throw new ErroDeRegra('Este item não existe mais.');
  const versao = await repositorios.contrato_versao.obter(item.versao_id);
  if (!versao || versao.situacao !== 'em_elaboracao' || versao.fluxo !== 'rascunho') throw new ErroDeRegra('Só o rascunho se edita. Devolva para rascunho antes, ou crie uma nova versão (RN-11.03).');
  const contrato = await repositorios.contrato.obter(versao.contrato_id);
  if (contrato?.familia !== 'parceiro') throw new ErroDeRegra('Termos de repasse só em contrato de parceiro.');
  const percentual = percentualOuVazio(termos.percentual, 'Repasse');
  const retencao = percentualOuVazio(termos.retencao, 'Retenção');
  if (percentual !== null && !termos.base) throw new ErroDeRegra('Escolha a base do repasse: venda bruta ou líquida de taxas.');
  if (percentual === null && (termos.base || retencao !== null)) throw new ErroDeRegra('Informe o percentual de repasse, ou deixe os termos vazios.');
  await repositorios.item_contrato.atualizar(itemId, { percentual_repasse: percentual, base_repasse: percentual === null ? null : termos.base || null, retencao: percentual === null ? null : retencao });
}

export const temTermosDeRepasse = (item: Pick<ItemContrato, 'percentual_repasse'>) => item.percentual_repasse !== null && item.percentual_repasse !== undefined;

// ---------- Termos vigentes na data da venda ----------

/** A raiz de um item, seguindo as cópias de versão em versão (`item_origem_id`). */
function raizDoItem(item: ItemContrato, porId: ReadonlyMap<string, ItemContrato>): string {
  let atual = item;
  const vistos = new Set<string>();
  while (atual.item_origem_id && porId.has(atual.item_origem_id) && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    atual = porId.get(atual.item_origem_id) as ItemContrato;
  }
  return atual.id;
}

export type TermosNaData = { versao: ContratoVersao; item: ItemContrato; percentual: number; base: 'bruta' | 'liquida'; retencao: number };

/** RN-05.22: a versão vigente na data da venda e, nela, o mesmo item (ou a cópia dele) com os termos. Sem isso, explica o porquê. */
export function termosNaData(itemId: string, data: string, versoes: readonly ContratoVersao[], itens: readonly ItemContrato[]): TermosNaData | string {
  const versao = versaoVigente(versoes, data);
  if (!versao) return 'o contrato não tinha versão assinada em vigor na data da venda';
  const porId = new Map(itens.map((item) => [item.id, item]));
  const escolhido = porId.get(itemId);
  if (!escolhido) return 'o item do contrato não existe mais';
  const raiz = raizDoItem(escolhido, porId);
  const item = itens.find((candidato) => candidato.versao_id === versao.id && !candidato.arquivado_em && raizDoItem(candidato, porId) === raiz);
  if (!item) return `a versão ${versao.numero}, vigente na data, não tem este item`;
  if (!temTermosDeRepasse(item) || !item.base_repasse) return `o item não tem termos de repasse na versão ${versao.numero}`;
  return { versao, item, percentual: item.percentual_repasse as number, base: item.base_repasse, retencao: item.retencao ?? 0 };
}

/** Uma venda pelos termos: base (bruta ou líquida), repasse, retenção e valor a repassar. */
export function linhaDoRepasse(venda: Pick<VendaParceiro, 'id' | 'data' | 'valor_bruto' | 'taxas'>, termos: Pick<TermosNaData, 'percentual' | 'base' | 'retencao'> & { versao: Pick<ContratoVersao, 'numero'> }): LinhaDoRepasse {
  const base = redondo(termos.base === 'bruta' ? venda.valor_bruto : venda.valor_bruto - venda.taxas);
  const bruto = redondo((base * termos.percentual) / 100);
  const retencao = redondo((bruto * termos.retencao) / 100);
  return { venda_id: venda.id, data: venda.data, versao_numero: termos.versao.numero, base, percentual: termos.percentual, retencao, valor: redondo(bruto - retencao) };
}

// ---------- Vendas ----------

export type FormularioVenda = { contrato_id: string; item_contrato_id: string; data: string; descricao: string; moeda: string; valor_bruto: string; taxas: string; referencia: string };
export const FORMULARIO_VENDA_VAZIO: FormularioVenda = { contrato_id: '', item_contrato_id: '', data: '', descricao: '', moeda: 'BRL', valor_bruto: '', taxas: '', referencia: '' };

async function dadosDoContrato(contratoId: string) {
  const versoes = await repositorios.contrato_versao.listar({ onde: { contrato_id: contratoId } });
  const itens = (await Promise.all(versoes.map((versao) => repositorios.item_contrato.listar({ onde: { versao_id: versao.id } })))).flat();
  return { versoes, itens };
}

export async function salvarVenda(formulario: FormularioVenda, id?: string): Promise<VendaParceiro> {
  if (!formulario.contrato_id) throw new ErroDeRegra('Escolha o contrato do parceiro.');
  if (!formulario.item_contrato_id) throw new ErroDeRegra('Escolha o item do contrato.');
  if (!DIA.test(formulario.data)) throw new ErroDeRegra('Informe a data da venda.');
  if (formulario.data > hojeISO()) throw new ErroDeRegra('A data da venda não pode ser no futuro.');
  if (!formulario.descricao.trim()) throw new ErroDeRegra('Descreva a venda (ex.: vendas do dia, pedido 123).');
  const bruto = lerValor(formulario.valor_bruto);
  if (bruto === null || Number.isNaN(bruto) || bruto <= 0) throw new ErroDeRegra('Informe o valor bruto da venda.');
  const taxas = formulario.taxas.trim() ? lerValor(formulario.taxas) : 0;
  if (taxas === null || Number.isNaN(taxas) || taxas < 0) throw new ErroDeRegra('Taxas: informe um valor, ou deixe vazio.');
  if (taxas > bruto) throw new ErroDeRegra('As taxas não podem passar do valor bruto.');
  const contrato = await repositorios.contrato.obter(formulario.contrato_id);
  if (contrato?.familia !== 'parceiro') throw new ErroDeRegra('Escolha um contrato de parceiro.');
  const atual = id ? await repositorios.venda_parceiro.obter(id) : null;
  if (id && !atual) throw new ErroDeRegra('Esta venda não existe mais.');
  if (atual?.repasse_id) throw new ErroDeRegra('Esta venda já entrou num repasse. Cancele o repasse antes de mudar a venda.');
  const { versoes, itens } = await dadosDoContrato(contrato.id);
  const termos = termosNaData(formulario.item_contrato_id, formulario.data, versoes, itens);
  if (typeof termos === 'string') throw new ErroDeRegra(`Não dá para lançar: ${termos}.`);
  const dados = { contrato_id: contrato.id, item_contrato_id: formulario.item_contrato_id, produto_id: termos.item.produto_id, data: formulario.data, descricao: formulario.descricao.trim(), moeda: formulario.moeda || contrato.moeda, valor_bruto: redondo(bruto), taxas: redondo(taxas), referencia: formulario.referencia.trim() || null };
  return atual ? repositorios.venda_parceiro.atualizar(atual.id, dados) : repositorios.venda_parceiro.criar({ ...dados, repasse_id: null, exemplo: false });
}

export async function removerVenda(id: string): Promise<void> {
  const venda = await repositorios.venda_parceiro.obter(id);
  if (!venda) return;
  if (venda.repasse_id) throw new ErroDeRegra('Esta venda já entrou num repasse. Cancele o repasse antes de tirar a venda.');
  await repositorios.venda_parceiro.arquivar(id);
}

// ---------- Cálculo do período (prévia, P6) ----------

export const chaveDoRepasse = (parceiroId: string, inicio: string, fim: string) => `repasse:${parceiroId}:${inicio}:${fim}`;

export type PreviaDoRepasse = { parceiroId: string; contratoId: string | null; inicio: string; fim: string; moeda: string; linhas: LinhaDoRepasse[]; base: number; retencao: number; valor: number; percentual: number | null; vendas: VendaParceiro[] };

export async function calcularPrevia(parceiroId: string, inicio: string, fim: string): Promise<PreviaDoRepasse> {
  if (!parceiroId) throw new ErroDeRegra('Escolha o parceiro.');
  if (!DIA.test(inicio) || !DIA.test(fim)) throw new ErroDeRegra('Informe o início e o fim do período.');
  if (fim < inicio) throw new ErroDeRegra('O fim do período não pode ser antes do início.');
  const chave = chaveDoRepasse(parceiroId, inicio, fim);
  if ((await repositorios.repasse.listar({ onde: { chave_idempotencia: chave } })).some((repasse) => repasse.situacao !== 'cancelado')) throw new ErroDeRegra('Já há repasse deste parceiro neste período. Para refazer, cancele o repasse existente.');
  const contratos = (await repositorios.contrato.listar({ onde: { contraparte_id: parceiroId } })).filter((contrato) => contrato.familia === 'parceiro');
  const vendas = (await repositorios.venda_parceiro.listar())
    .filter((venda) => !venda.repasse_id && venda.data >= inicio && venda.data <= fim && contratos.some((contrato) => contrato.id === venda.contrato_id))
    .sort((a, b) => a.data.localeCompare(b.data));
  if (!vendas.length) throw new ErroDeRegra('Nenhuma venda deste parceiro no período, fora de repasse.');
  const moedas = new Set(vendas.map((venda) => venda.moeda));
  if (moedas.size > 1) throw new ErroDeRegra('As vendas do período estão em mais de uma moeda. Calcule um período por moeda.');
  const porContrato = new Map(await Promise.all([...new Set(vendas.map((venda) => venda.contrato_id))].map(async (id) => [id, await dadosDoContrato(id)] as const)));
  const linhas: LinhaDoRepasse[] = [];
  for (const venda of vendas) {
    const dados = porContrato.get(venda.contrato_id)!;
    const termos = termosNaData(venda.item_contrato_id, venda.data, dados.versoes, dados.itens);
    if (typeof termos === 'string') throw new ErroDeRegra(`Venda de ${venda.data.split('-').reverse().join('/')} (${venda.descricao}): ${termos}.`);
    linhas.push(linhaDoRepasse(venda, termos));
  }
  const percentuais = new Set(linhas.map((linha) => linha.percentual));
  const contratosDasVendas = [...porContrato.keys()];
  return {
    parceiroId,
    contratoId: contratosDasVendas.length === 1 ? (contratosDasVendas[0] as string) : null,
    inicio,
    fim,
    moeda: [...moedas][0] as string,
    linhas,
    base: redondo(linhas.reduce((total, linha) => total + linha.base, 0)),
    retencao: redondo(linhas.reduce((total, linha) => total + linha.retencao, 0)),
    valor: redondo(linhas.reduce((total, linha) => total + linha.valor, 0)),
    percentual: percentuais.size === 1 ? ([...percentuais][0] as number) : null,
    vendas,
  };
}

/** Rateio do título pelo produto de cada venda, na proporção do valor; venda sem produto vai para o institucional. */
export function rateioDoRepasse(previa: Pick<PreviaDoRepasse, 'linhas' | 'vendas' | 'valor'>): { contexto: string; percentual: number }[] {
  const porContexto = new Map<string, number>();
  for (const linha of previa.linhas) {
    const contexto = previa.vendas.find((venda) => venda.id === linha.venda_id)?.produto_id ?? ID_INSTITUCIONAL;
    porContexto.set(contexto, (porContexto.get(contexto) ?? 0) + linha.valor);
  }
  const entradas = [...porContexto.entries()];
  const linhas = entradas.map(([contexto, valor]) => ({ contexto, percentual: Math.round((valor / previa.valor) * 10000) / 100 }));
  const ultimo = linhas.at(-1);
  if (ultimo) ultimo.percentual = Math.round((100 - linhas.slice(0, -1).reduce((total, linha) => total + linha.percentual, 0)) * 100) / 100;
  return linhas;
}

export type DadosDoRepasse = { parceiroId: string; inicio: string; fim: string; vencimento: string; categoriaId: string };

/** Confirma a prévia: grava o repasse, liga as vendas e gera o título a pagar ao parceiro, aberto (nunca nasce pago). */
export async function gerarRepasse(dados: DadosDoRepasse, responsavelId: string): Promise<Repasse> {
  if (!responsavelId) throw new ErroDeRegra('Escolha quem você é, no topo, antes de gerar o repasse.');
  if (!DIA.test(dados.vencimento)) throw new ErroDeRegra('Informe o vencimento do repasse.');
  if (!dados.categoriaId) throw new ErroDeRegra('Escolha a categoria da despesa.');
  const categoria = await repositorios.categoria_financeira.obter(dados.categoriaId);
  if (!categoria || categoria.tipo !== 'despesa' || !categoria.pai_id) throw new ErroDeRegra('Escolha uma categoria de despesa.');
  const previa = await calcularPrevia(dados.parceiroId, dados.inicio, dados.fim);
  if (previa.valor <= 0) throw new ErroDeRegra('O valor a repassar do período é zero: não há título a gerar.');
  const competencia = `${dados.fim.slice(0, 7)}-01`;
  await garantirCompetenciaAberta(competencia);
  const parceiro = await repositorios.contraparte.obter(dados.parceiroId);
  const periodo = `${dados.inicio.split('-').reverse().join('/')} a ${dados.fim.split('-').reverse().join('/')}`;
  return emTransacao(async () => {
    const repasse = await repositorios.repasse.criar({ parceiro_id: dados.parceiroId, contrato_id: previa.contratoId, periodo_inicio: dados.inicio, periodo_fim: dados.fim, moeda: previa.moeda, base_calculo: previa.base, percentual: previa.percentual, retencao: previa.retencao, valor: previa.valor, linhas: previa.linhas, titulo_id: null, situacao: 'aprovado', cancelado_motivo: null, chave_idempotencia: chaveDoRepasse(dados.parceiroId, dados.inicio, dados.fim), exemplo: false });
    const titulo = await repositorios.titulo.criar({
      natureza: 'pagar',
      descricao: `Repasse ${parceiro?.nome ?? 'parceiro'} · ${periodo}`,
      contraparte_id: dados.parceiroId,
      beneficiario_pessoa_id: null,
      categoria_id: categoria.id,
      competencia,
      vencimento: dados.vencimento,
      valor: previa.valor,
      moeda: previa.moeda,
      situacao: 'aberto',
      responsavel_id: responsavelId,
      entidade_id: null,
      origem: 'repasse',
      origem_id: repasse.id,
      chave_idempotencia: `repasse:${repasse.id}`,
      ajustado_manualmente: false,
      ferramenta_id: null,
      assinatura_id: null,
      periodo_inicio: dados.inicio,
      periodo_fim: dados.fim,
      suspenso: false,
      cancelado_motivo: null,
      observacao: `Gerado pelo repasse do período (T05.13). Retido para estornos: ${previa.retencao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    });
    await gravarRateio(titulo.id, titulo.valor, rateioDoRepasse(previa));
    for (const venda of previa.vendas) await repositorios.venda_parceiro.atualizar(venda.id, { repasse_id: repasse.id });
    return repositorios.repasse.atualizar(repasse.id, { titulo_id: titulo.id });
  });
}

/** Cancela o repasse sem pagamento: o título é cancelado e as vendas voltam a ficar livres para outro cálculo. */
export async function cancelarRepasse(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroDeRegra('Diga o motivo do cancelamento.');
  const repasse = await repositorios.repasse.obter(id);
  if (!repasse || repasse.situacao === 'cancelado') throw new ErroDeRegra('Este repasse não está mais ativo.');
  const baixas = repasse.titulo_id ? (await repositorios.baixa.listar({ onde: { titulo_id: repasse.titulo_id } })).filter((baixa) => !baixa.arquivado_em) : [];
  if (baixas.length) throw new ErroDeRegra('O título deste repasse já tem pagamento. Estorne o pagamento antes de cancelar.');
  await garantirCompetenciaAberta(repasse.periodo_fim);
  await emTransacao(async () => {
    if (repasse.titulo_id) await repositorios.titulo.atualizar(repasse.titulo_id, { situacao: 'cancelado', cancelado_motivo: motivo.trim() });
    for (const venda of await repositorios.venda_parceiro.listar({ onde: { repasse_id: id } })) await repositorios.venda_parceiro.atualizar(venda.id, { repasse_id: null });
    await repositorios.repasse.atualizar(id, { situacao: 'cancelado', cancelado_motivo: motivo.trim() });
  });
}

// ---------- Tela ----------

/** "Pago" vem do título quitado; o repasse guarda só aprovado ou cancelado. */
export const situacaoDoRepasse = (repasse: Pick<Repasse, 'situacao'>, titulo: Pick<Titulo, 'situacao'> | undefined): Repasse['situacao'] => (repasse.situacao === 'aprovado' && titulo?.situacao === 'quitado' ? 'pago' : repasse.situacao);

export type ItemComTermos = { id: string; descricao: string; termos: string };
export type ContratoDeParceiro = Pick<Contrato, 'id' | 'codigo' | 'titulo' | 'contraparte_id' | 'moeda'> & { parceiro: string; itens: ItemComTermos[] };
export type LinhaDaVenda = VendaParceiro & { contrato: string; parceiro: string; item: string };
export type LinhaDeRepasse = Repasse & { parceiro: string; situacaoExibida: Repasse['situacao']; titulo: Titulo | undefined };
export type TelaDeRepasses = { repasses: LinhaDeRepasse[]; vendas: LinhaDaVenda[]; contratos: ContratoDeParceiro[]; parceiros: { id: string; nome: string }[]; categorias: CategoriaFinanceira[] };

export const textoDosTermos = (item: Pick<ItemContrato, 'percentual_repasse' | 'base_repasse' | 'retencao'>) =>
  temTermosDeRepasse(item) ? `${(item.percentual_repasse as number).toLocaleString('pt-BR')}% da ${item.base_repasse ? ROTULOS_BASE_REPASSE[item.base_repasse] : 'base vazia'}${item.retencao ? ` · retém ${item.retencao.toLocaleString('pt-BR')}%` : ''}` : 'Sem termos de repasse';

export async function carregarRepasses(hoje: string = hojeISO()): Promise<TelaDeRepasses> {
  const [contratos, contrapartes, vendas, repasses, titulos, categorias] = await Promise.all([repositorios.contrato.listar(), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.venda_parceiro.listar(), repositorios.repasse.listar(), repositorios.titulo.listar({ incluirArquivados: true }), repositorios.categoria_financeira.listar()]);
  const nome = (id: string | null) => contrapartes.find((item) => item.id === id)?.nome ?? 'Parceiro removido';
  const deParceiro = contratos.filter((contrato) => contrato.familia === 'parceiro');
  const comItens: ContratoDeParceiro[] = [];
  const nomesDosItens = new Map<string, string>();
  for (const contrato of deParceiro) {
    const { versoes, itens } = await dadosDoContrato(contrato.id);
    for (const item of itens) nomesDosItens.set(item.id, item.descricao);
    const vigente = versaoVigente(versoes, hoje);
    if (!vigente) continue;
    const daVigente = itens.filter((item) => item.versao_id === vigente.id && !item.arquivado_em && temTermosDeRepasse(item));
    if (daVigente.length) comItens.push({ id: contrato.id, codigo: contrato.codigo, titulo: contrato.titulo, contraparte_id: contrato.contraparte_id, moeda: contrato.moeda, parceiro: nome(contrato.contraparte_id), itens: daVigente.map((item) => ({ id: item.id, descricao: item.descricao, termos: textoDosTermos(item) })) });
  }
  const tituloDe = new Map(titulos.map((titulo) => [titulo.id, titulo]));
  return {
    repasses: repasses.sort((a, b) => b.periodo_fim.localeCompare(a.periodo_fim)).map((repasse) => {
      const titulo = repasse.titulo_id ? tituloDe.get(repasse.titulo_id) : undefined;
      return { ...repasse, parceiro: nome(repasse.parceiro_id), titulo, situacaoExibida: situacaoDoRepasse(repasse, titulo) };
    }),
    vendas: vendas
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((venda) => {
        const contrato = deParceiro.find((item) => item.id === venda.contrato_id);
        return { ...venda, contrato: contrato ? `${contrato.codigo ?? ''} ${contrato.titulo}`.trim() : 'Contrato removido', parceiro: nome(contrato?.contraparte_id ?? null), item: nomesDosItens.get(venda.item_contrato_id) ?? 'Item removido' };
      }),
    contratos: comItens,
    parceiros: [...new Map(deParceiro.map((contrato) => [contrato.contraparte_id, { id: contrato.contraparte_id, nome: nome(contrato.contraparte_id) }])).values()].sort((a, b) => a.nome.localeCompare(b.nome)),
    categorias: categorias.filter((categoria) => categoria.tipo === 'despesa' && categoria.pai_id && !categoria.arquivado_em),
  };
}
