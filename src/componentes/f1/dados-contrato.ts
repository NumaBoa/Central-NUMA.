import { repositorios } from '@/dados/repositorios';
import { carregarContrato, diferencasDaProposta, montarDocumentoDoContrato } from '@/dominio/contratos';
import { documentosDoRegistro } from '@/dominio/documentos-emitidos';

/** O que a ficha (T11.02) e o assistente (T11.03 e T11.14) leem de uma vez. */
export async function carregarTelaDoContrato(id: string) {
  const ficha = await carregarContrato(id);
  if (!ficha) return null;
  const [documento, documentos, pessoas, entidades, contrapartes, modelos, versoesModelo, produtos, feriados, categorias, programacoes, diferencas, encerramento, decisoes] = await Promise.all([
    montarDocumentoDoContrato(ficha),
    documentosDoRegistro(ficha.atual.id),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.entidade.listar({ incluirArquivados: true }),
    repositorios.contraparte.listar({ incluirArquivados: true }),
    repositorios.modelo_documento.listar(),
    repositorios.modelo_versao.listar(),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.feriado.listar(),
    repositorios.categoria_financeira.listar(),
    repositorios.programacao_financeira.listar({ onde: { contrato_id: id } }),
    diferencasDaProposta(ficha.itens),
    repositorios.encerramento_contrato.listar({ onde: { contrato_id: id } }),
    repositorios.renovacao_decisao.listar({ onde: { contrato_id: id } }),
  ]);
  const modelosDeContrato = modelos.filter((modelo) => (modelo.tipo_documento === 'contrato' || modelo.tipo_documento === 'aditivo' || modelo.tipo_documento === 'termo') && modelo.codigo !== 'MOD-SAAS-LIC' && (!modelo.familia || modelo.familia === ficha.contrato.familia)).flatMap((modelo) => versoesModelo.filter((versao) => versao.modelo_id === modelo.id && versao.situacao !== 'obsoleta').map((versao) => ({ id: versao.id, rotulo: `${modelo.nome} v${versao.rotulo_versao}${versao.situacao === 'validada' ? '' : ' (não validado)'}` })));
  return { ficha, documento, documentos, pessoas, entidades, contrapartes, modelosDeContrato, produtos, feriados, categorias, programacoes, diferencas, encerramento: encerramento[0] ?? null, decisoes };
}
export type TelaDoContrato = NonNullable<Awaited<ReturnType<typeof carregarTelaDoContrato>>>;
