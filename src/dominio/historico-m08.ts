/** A aba Histórico das fichas do M08: o registro e as partes dele, do mais recente ao mais antigo. */
import { repositorios } from '@/dados/repositorios';
import type { Tabela } from '@/dados/tabelas';
import { historicoDoRegistro, type LinhaHistorico } from './historico';

async function juntar(partes: readonly (readonly [Tabela, readonly string[]])[]): Promise<LinhaHistorico[]> {
  const linhas = await Promise.all(partes.flatMap(([tabela, ids]) => ids.map((id) => historicoDoRegistro(tabela, id))));
  return linhas.flat().sort((a, b) => b.em.localeCompare(a.em));
}

const ids = (linhas: readonly { id: string }[]) => linhas.map((linha) => linha.id);

export async function historicoDoArquivo(id: string): Promise<LinhaHistorico[]> {
  const [versoes, vinculos, contextos] = await Promise.all([repositorios.arquivo_versao.listar({ onde: { arquivo_id: id }, incluirArquivados: true }), repositorios.arquivo_vinculo.listar({ onde: { arquivo_id: id }, incluirArquivados: true }), repositorios.arquivo_contexto.listar({ onde: { arquivo_id: id }, incluirArquivados: true })]);
  return juntar([
    ['arquivo', [id]],
    ['arquivo_versao', ids(versoes)],
    ['arquivo_vinculo', ids(vinculos)],
    ['arquivo_contexto', ids(contextos)],
  ]);
}

export async function historicoDaLista(id: string): Promise<LinhaHistorico[]> {
  const [textos, inscritos] = await Promise.all([repositorios.consentimento_texto.listar({ onde: { lista_id: id }, incluirArquivados: true }), repositorios.inscrito.listar({ onde: { lista_id: id }, incluirArquivados: true })]);
  return juntar([
    ['lista_espera', [id]],
    ['consentimento_texto', ids(textos)],
    ['inscrito', ids(inscritos)],
  ]);
}
