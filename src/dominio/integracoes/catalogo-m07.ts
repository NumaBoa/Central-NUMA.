/**
 * O catálogo real de M10 e M11: ofertas, recursos, canais e preços do M07, lidos dos repositórios.
 * Converte os nomes do M07 para o contrato de `catalogo-comercial.ts` sem inventar nada:
 * - os campos de T07.04 que o M07 ainda não tem (regras de uso, suporte, disponibilidade, teste e adicionais) ficam vazios;
 * - o limite, que no M07 é texto livre, só vira número quando o texto é um número; o resto é "não informado" (decisão vigente 4);
 * - T07.10 (configuração contratual) ainda não existe: nenhuma configuração, e a emissão final do contrato SaaS fica pendente.
 */
import { repositorios } from '@/dados/repositorios';
import type { CanalVenda, Oferta, OfertaRecurso, PrecoVersao } from '@/dados/tipos/precificacao';
import type { CanalDoCatalogo, CatalogoComercial, LimiteDoRecurso, OfertaDoCatalogo, PrecoDoCatalogo, RecursoDaOferta } from './catalogo-comercial';

const FORMALIZACAO: Record<Oferta['formalizacao'], OfertaDoCatalogo['formalizacao']> = { adesao: 'adesao_padrao', negociado: 'contrato_negociado', ambos: 'ambos' };

const COBRANCA: Partial<Record<CanalVenda['tipo'], CanalDoCatalogo['cobranca']>> = { direto: 'Direto', web_gateway: 'Gateway', loja_android: 'Google Play' };

/** "15", "1.000" ou "200 por mês" viram número; "Ilimitado" é ilimitado; vazio ou qualquer outro texto fica "não informado". */
export function limiteDoTexto(texto: string | null): LimiteDoRecurso {
  const limpo = texto?.trim() ?? '';
  if (!limpo) return { tipo: 'nao_informado' };
  if (/^ilimitad[oa]s?$/i.test(limpo)) return { tipo: 'ilimitado' };
  if (/^n[aã]o se aplica$/i.test(limpo)) return { tipo: 'nao_se_aplica' };
  const numero = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:\s+(.+))?$/.exec(limpo);
  if (!numero) return { tipo: 'nao_informado' };
  return { tipo: 'limitado', valor: Number(numero[1]!.replace(/\./g, '')), unidade: numero[2]?.trim() || null };
}

function recursoDoCatalogo(recurso: OfertaRecurso): RecursoDaOferta {
  return { id: recurso.id, nome: recurso.nome, incluido: recurso.incluido, limite: limiteDoTexto(recurso.limite), planejado: recurso.planejado, disponivel_previsto_em: recurso.disponivel_previsto_em, ordem: recurso.ordem };
}

export function ofertaDoCatalogo(oferta: Oferta, recursos: readonly OfertaRecurso[]): OfertaDoCatalogo {
  return {
    id: oferta.id,
    produto_id: oferta.produto_id,
    nome: oferta.nome,
    tipo: oferta.tipo,
    publico: oferta.publico,
    formalizacao: FORMALIZACAO[oferta.formalizacao],
    situacao: oferta.situacao,
    descricao: oferta.descricao,
    exclusoes: oferta.exclusoes,
    regras_uso: null,
    suporte: null,
    disponibilidade_meta: null,
    disponibilidade_compensacao: null,
    teste_dias: null,
    adicionais_ids: [],
    recursos: recursos.filter((recurso) => recurso.oferta_id === oferta.id).sort((a, b) => a.ordem - b.ordem).map(recursoDoCatalogo),
  };
}

export function canalDoCatalogo(canal: CanalVenda): CanalDoCatalogo {
  const cobranca = COBRANCA[canal.tipo] ?? null;
  return { id: canal.id, nome: canal.nome, tipo: canal.tipo, situacao: canal.situacao === 'ativo' ? 'ativa' : 'inativa', cobranca, gateway_nome: cobranca === 'Gateway' ? canal.nome : null };
}

export function precoDoCatalogo(preco: PrecoVersao): PrecoDoCatalogo {
  return { id: preco.id, oferta_id: preco.oferta_id, canal_id: preco.canal_id, versao: preco.versao, valor: preco.valor, moeda: preco.moeda, periodicidade: preco.periodicidade, valido_de: preco.valido_de, valido_ate: preco.valido_ate, situacao: preco.situacao };
}

export const catalogoDoM07: CatalogoComercial = {
  estado: 'conectado',
  async ofertasDoProduto(produtoId) {
    const [ofertas, recursos] = await Promise.all([repositorios.oferta.listar({ onde: { produto_id: produtoId } }), repositorios.oferta_recurso.listar()]);
    return ofertas.map((oferta) => ofertaDoCatalogo(oferta, recursos));
  },
  async oferta(ofertaId) {
    const oferta = await repositorios.oferta.obter(ofertaId);
    if (!oferta || oferta.arquivado_em) return null;
    return ofertaDoCatalogo(oferta, await repositorios.oferta_recurso.listar({ onde: { oferta_id: ofertaId } }));
  },
  async canais() {
    return (await repositorios.canal_venda.listar()).map(canalDoCatalogo);
  },
  async precosDaOferta(ofertaId) {
    return (await repositorios.preco_versao.listar({ onde: { oferta_id: ofertaId } })).map(precoDoCatalogo);
  },
  // T07.10 ainda não foi construída: não há configuração contratual de nenhum produto.
  configuracaoValidada: async () => null,
  configuracaoMaisRecente: async () => null,
};
