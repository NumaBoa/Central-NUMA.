/**
 * T10.01: a visão comercial da contraparte. Lê o mesmo cadastro de T02.06 (um registro, vários lugares):
 * oportunidades, propostas, contratos, produtos contratados e títulos dela.
 */
import { repositorios } from '@/dados/repositorios';
import type { Oportunidade } from '@/dados/tipos/comercial';
import type { ItemContrato } from '@/dados/tipos/contrato';
import { hojeISO } from '@/lib/datas';
import { carregarComercial, ROTULOS_ETAPA } from './comercial';
import { carregarContratos, type LinhaDoContrato } from './contratos';
import { catalogoComercial } from './integracoes/conexoes';
import { textoDoLimite } from './integracoes/catalogo-comercial';

export { carregarComercial, ROTULOS_ETAPA };

/** Da menos para a mais avançada; "Ganha" fica no topo. */
export const ETAPAS_FUNIL_ORDEM: readonly Oportunidade['etapa'][] = ['perdida', 'novo', 'qualificacao', 'proposta', 'negociacao', 'ganha'];

export type ProdutoContratado = { produtoId: string; itens: (ItemContrato & { contrato: string })[]; inicio: string | null; fim: string | null; incluidos: string[]; disponiveis: { oferta: string; recurso: string }[] };

/**
 * CA-10.01: contratados (contrato vigente ou futuro) separados dos de interesse. Contratadas × Disponíveis vem dos
 * recursos das ofertas no catálogo: sem catálogo, as listas ficam vazias e a tela explica.
 */
export async function produtosDaContraparte(contraparteId: string, hoje: string = hojeISO()) {
  const [{ linhas }, itens, oportunidades, ligacoes] = await Promise.all([carregarContratos(hoje), repositorios.item_contrato.listar(), repositorios.oportunidade.listar({ onde: { contraparte_id: contraparteId } }), repositorios.oportunidade_produto.listar()]);
  const ativos = linhas.filter((linha) => linha.contraparte_id === contraparteId && (linha.vigencia === 'vigente' || linha.vigencia === 'futuro' || linha.vigencia === 'suspenso'));
  const catalogo = catalogoComercial();
  const porProduto = new Map<string, ProdutoContratado>();
  for (const contrato of ativos) {
    if (!contrato.vigente) continue;
    for (const item of itens.filter((linha) => linha.versao_id === contrato.vigente?.id && linha.produto_id)) {
      const atual = porProduto.get(item.produto_id as string) ?? { produtoId: item.produto_id as string, itens: [], inicio: contrato.inicio, fim: contrato.fim, incluidos: [], disponiveis: [] };
      atual.itens.push({ ...item, contrato: contrato.codigo });
      if (contrato.inicio && (!atual.inicio || contrato.inicio < atual.inicio)) atual.inicio = contrato.inicio;
      porProduto.set(item.produto_id as string, atual);
    }
  }
  for (const produto of porProduto.values()) {
    const ofertasContratadas = new Set(produto.itens.map((item) => item.oferta_id).filter(Boolean));
    const ofertas = await catalogo.ofertasDoProduto(produto.produtoId);
    const incluidos = ofertas.filter((oferta) => ofertasContratadas.has(oferta.id)).flatMap((oferta) => oferta.recursos.filter((recurso) => recurso.incluido).map((recurso) => `${recurso.nome}${textoDoLimite(recurso.limite) ? `: ${textoDoLimite(recurso.limite)}` : ''}`));
    produto.incluidos = [...new Set(incluidos)];
    const nomesIncluidos = new Set(ofertas.filter((oferta) => ofertasContratadas.has(oferta.id)).flatMap((oferta) => oferta.recursos.filter((recurso) => recurso.incluido).map((recurso) => recurso.nome)));
    produto.disponiveis = ofertas.filter((oferta) => !ofertasContratadas.has(oferta.id) && oferta.situacao === 'aprovada').flatMap((oferta) => oferta.recursos.filter((recurso) => recurso.incluido && !nomesIncluidos.has(recurso.nome)).map((recurso) => ({ oferta: oferta.nome, recurso: recurso.nome })));
  }
  const contratados = [...porProduto.values()];
  const interesse = [...new Set(ligacoes.filter((ligacao) => oportunidades.some((oportunidade) => oportunidade.id === ligacao.oportunidade_id && oportunidade.etapa !== 'perdida')).map((ligacao) => ligacao.produto_id))].filter((id) => !porProduto.has(id));
  return { contratados, interesse, contratos: linhas.filter((linha) => linha.contraparte_id === contraparteId) as LinhaDoContrato[], catalogoAusente: catalogo.estado === 'ausente' };
}
