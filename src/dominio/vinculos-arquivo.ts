/**
 * Com o que um arquivo da biblioteca pode ser vinculado (RN-08.05). Os registros continuam nos módulos deles:
 * aqui só se lê o nome e o caminho de cada um. Títulos financeiros ficam de fora: não são "usos" do arquivo.
 */
import { repositorios } from '@/dados/repositorios';
import { ROTULOS_TIPO_DOCUMENTO_LEGAL } from './legal';

export const REGISTROS_DO_ARQUIVO: Readonly<Record<string, { rotulo: string; href: (id: string) => string }>> = {
  produto: { rotulo: 'Produto', href: (id) => `/produtos/${id}` },
  campanha: { rotulo: 'Campanha', href: (id) => `/marketing/campanhas/${id}` },
  peca_conteudo: { rotulo: 'Peça de conteúdo', href: (id) => `/marketing/conteudo?peca=${id}` },
  oportunidade: { rotulo: 'Oportunidade', href: (id) => `/comercial/oportunidades/${id}` },
  proposta: { rotulo: 'Proposta', href: (id) => `/comercial/propostas/${id}` },
  contrato: { rotulo: 'Contrato', href: (id) => `/contratos/${id}` },
  documento_legal: { rotulo: 'Documento legal', href: (id) => `/legal/documentos/${id}` },
  ferramenta: { rotulo: 'Ferramenta', href: (id) => `/ferramentas/${id}` },
  ativo_digital: { rotulo: 'Ativo digital', href: (id) => `/ferramentas/ativos/${id}` },
};

export type RegistroVinculavel = { tipo: string; id: string; nome: string };

/** Os registros ativos que podem receber o arquivo, para o seletor e para dar nome aos vínculos. */
export async function carregarRegistrosVinculaveis(): Promise<RegistroVinculavel[]> {
  const [produtos, campanhas, pecas, oportunidades, propostas, contratos, documentos, ferramentas, ativos] = await Promise.all([
    repositorios.produto.listar(),
    repositorios.campanha.listar(),
    repositorios.peca_conteudo.listar(),
    repositorios.oportunidade.listar(),
    repositorios.proposta.listar(),
    repositorios.contrato.listar(),
    repositorios.documento_legal.listar(),
    repositorios.ferramenta.listar(),
    repositorios.ativo_digital.listar(),
  ]);
  return [
    ...produtos.map((item) => ({ tipo: 'produto', id: item.id, nome: item.nome })),
    ...campanhas.map((item) => ({ tipo: 'campanha', id: item.id, nome: `${item.codigo} · ${item.nome}` })),
    ...pecas.map((item) => ({ tipo: 'peca_conteudo', id: item.id, nome: `${item.codigo} · ${item.titulo}` })),
    ...oportunidades.map((item) => ({ tipo: 'oportunidade', id: item.id, nome: `${item.codigo} · ${item.titulo}` })),
    ...propostas.map((item) => ({ tipo: 'proposta', id: item.id, nome: item.codigo })),
    ...contratos.map((item) => ({ tipo: 'contrato', id: item.id, nome: `${item.codigo} · ${item.titulo}` })),
    ...documentos.map((item) => ({ tipo: 'documento_legal', id: item.id, nome: `${item.codigo} · ${ROTULOS_TIPO_DOCUMENTO_LEGAL[item.tipo]}` })),
    ...ferramentas.map((item) => ({ tipo: 'ferramenta', id: item.id, nome: item.nome })),
    ...ativos.map((item) => ({ tipo: 'ativo_digital', id: item.id, nome: item.identificador })),
  ];
}
