/**
 * O Legal de cada produto, lido do M09 para a ficha e o portfólio (M07) e para a ficha da ferramenta (M04): os
 * documentos do produto, o que falta publicar (RN-09.02: com usuários reais, Termos de Uso e Política de Privacidade
 * publicados) e as operações do inventário. Só leitura: tudo se edita em Legal e privacidade.
 */
import { repositorios } from '@/dados/repositorios';
import type { DocumentoLegal, DocumentoLegalVersao, TratamentoDados } from '@/dados/tipos/legal';
import type { Produto } from '@/dados/tipos/marca';
import { carregarDocumentosLegais, documentosFaltandoNoProduto, ROTULOS_SITUACAO_DOCUMENTO_LEGAL, ROTULOS_TIPO_DOCUMENTO_LEGAL, type LinhaDocumentoLegal } from './legal';

export type DocumentoDoProduto = { id: string; codigo: string; tipo: string; situacao: string; publicado: boolean };
export type ResumoLegal = { documentos: DocumentoDoProduto[]; faltando: string[]; tratamentos: Pick<TratamentoDados, 'id' | 'nome'>[]; texto: string; pendente: boolean };

const situacaoDe = (documento: Pick<LinhaDocumentoLegal, 'vigente' | 'atual'>): DocumentoLegalVersao['situacao'] => (documento.vigente ?? documento.atual).situacao;

export function resumoLegal(produto: Pick<Produto, 'id' | 'tem_usuarios_reais'>, documentos: readonly LinhaDocumentoLegal[], tratamentos: readonly Pick<TratamentoDados, 'id' | 'nome' | 'produto_id' | 'arquivado_em'>[]): ResumoLegal {
  const doProduto = documentos.filter((documento) => documento.produto_id === produto.id && !documento.arquivado_em);
  const faltando = produto.tem_usuarios_reais ? documentosFaltandoNoProduto(produto, doProduto).map((tipo: DocumentoLegal['tipo']) => ROTULOS_TIPO_DOCUMENTO_LEGAL[tipo]) : [];
  const lista = doProduto.map((documento) => ({ id: documento.id, codigo: documento.codigo, tipo: ROTULOS_TIPO_DOCUMENTO_LEGAL[documento.tipo], situacao: ROTULOS_SITUACAO_DOCUMENTO_LEGAL[situacaoDe(documento)], publicado: documento.vigente?.situacao === 'publicado' }));
  const publicados = lista.filter((documento) => documento.publicado).length;
  const texto = faltando.length
    ? `Falta publicar: ${faltando.join(' e ')}`
    : lista.length
      ? `${lista.length} ${lista.length === 1 ? 'documento' : 'documentos'}, ${publicados} ${publicados === 1 ? 'publicado' : 'publicados'}`
      : 'Nenhum documento legal';
  return { documentos: lista, faltando, tratamentos: tratamentos.filter((tratamento) => tratamento.produto_id === produto.id && !tratamento.arquivado_em).map(({ id, nome }) => ({ id, nome })), texto, pendente: faltando.length > 0 };
}

export async function carregarLegalDosProdutos(): Promise<{ documentos: LinhaDocumentoLegal[]; tratamentos: TratamentoDados[] }> {
  const [dados, tratamentos] = await Promise.all([carregarDocumentosLegais(), repositorios.tratamento_dados.listar()]);
  return { documentos: dados.documentos, tratamentos };
}

export async function carregarLegalDoProduto(produto: Pick<Produto, 'id' | 'tem_usuarios_reais'>): Promise<ResumoLegal> {
  const { documentos, tratamentos } = await carregarLegalDosProdutos();
  return resumoLegal(produto, documentos, tratamentos);
}

/** As operações do inventário que acontecem nesta ferramenta (`tratamento_ferramenta`). */
export async function tratamentosDaFerramenta(ferramentaId: string): Promise<Pick<TratamentoDados, 'id' | 'nome'>[]> {
  const [ligacoes, tratamentos] = await Promise.all([repositorios.tratamento_ferramenta.listar({ onde: { ferramenta_id: ferramentaId } }), repositorios.tratamento_dados.listar()]);
  return tratamentos.filter((tratamento) => ligacoes.some((ligacao) => ligacao.tratamento_id === tratamento.id)).map(({ id, nome }) => ({ id, nome }));
}
