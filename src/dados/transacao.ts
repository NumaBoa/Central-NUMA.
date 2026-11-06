import { abrirTransacao, descartarTransacao, gravarTransacao } from './armazenamento';
import { garantirCarga } from './carga';

/**
 * Várias gravações como uma só: ou tudo, ou nada (AR-02). Dentro do corpo, os repositórios leem o
 * que acabou de ser gravado; só no fim tudo vai para o armazenamento. Se o corpo falhar, nada muda.
 * Na etapa com servidor, vira uma transação do banco e as regras continuam iguais.
 */
export async function emTransacao<R>(corpo: () => Promise<R>): Promise<R> {
  // A carga inicial fica de fora: ela não pode ser desfeita junto com o que vem depois.
  garantirCarga();
  if (!abrirTransacao()) return corpo();
  let resultado: R;
  try {
    resultado = await corpo();
  } catch (erro) {
    descartarTransacao();
    throw erro;
  }
  gravarTransacao();
  return resultado;
}
