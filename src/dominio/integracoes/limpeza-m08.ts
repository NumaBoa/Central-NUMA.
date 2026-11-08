/**
 * "Limpar exemplos" no M08: o que dependia de um registro fictício sai com ele, mesmo que tenha sido feito
 * por alguém de verdade, e nenhum dado pessoal fica órfão. O que é de verdade continua, sem apontar para o que saiu.
 */
import type { Oportunidade } from '@/dados/tipos/comercial';
import type { Arquivo, ArquivoContexto, ArquivoVersao, ArquivoVinculo, Campanha, ConsentimentoTexto, Inscrito, PecaConteudo } from '@/dados/tipos/marketing';

export function limparReferenciasM08(linhas: Record<string, unknown>, removidos: ReadonlySet<string>, quemResponde: (id: string) => string) {
  const semCampanha = <T extends { campanha_id: string | null }>(registro: T): T => (registro.campanha_id && removidos.has(registro.campanha_id) ? { ...registro, campanha_id: null } : registro);
  linhas.arquivo_contexto = (linhas.arquivo_contexto as ArquivoContexto[]).filter((item) => !removidos.has(item.arquivo_id));
  linhas.arquivo_versao = (linhas.arquivo_versao as ArquivoVersao[]).filter((item) => !removidos.has(item.arquivo_id));
  linhas.arquivo_vinculo = (linhas.arquivo_vinculo as ArquivoVinculo[]).filter((item) => !removidos.has(item.arquivo_id) && !removidos.has(item.registro_id));
  linhas.consentimento_texto = (linhas.consentimento_texto as ConsentimentoTexto[]).filter((item) => !removidos.has(item.lista_id));
  linhas.inscrito = (linhas.inscrito as Inscrito[]).filter((item) => !removidos.has(item.lista_id)).map(semCampanha);
  linhas.peca_conteudo = (linhas.peca_conteudo as PecaConteudo[]).map(semCampanha).map((item) => ({ ...item, responsavel_id: quemResponde(item.responsavel_id) }));
  linhas.oportunidade = (linhas.oportunidade as Oportunidade[]).map(semCampanha);
  linhas.arquivo = (linhas.arquivo as Arquivo[]).map((item) => ({ ...item, responsavel_id: quemResponde(item.responsavel_id) }));
  linhas.campanha = (linhas.campanha as Campanha[]).map((item) => ({ ...item, responsavel_id: quemResponde(item.responsavel_id) }));
}
