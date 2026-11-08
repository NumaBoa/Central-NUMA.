/**
 * Classes de informação (RN-01.15) no M08. Nesta etapa local não há login nem permissões (D27, 03 §0):
 * tudo aparece para quem abre a Central. A verificação fica concentrada aqui, para a etapa com servidor
 * acrescentar a regra num lugar só, e as listas, a busca e as exportações do M08 já passam por ela.
 */
import type { ClasseDeInformacao } from '@/dados/tipos/marketing';

export const ROTULOS_CLASSE: Readonly<Record<ClasseDeInformacao, string>> = { pub: 'PUB', int: 'INT', fin: 'FIN', doc: 'DOC' };

export const DESCRICOES_CLASSE: Readonly<Record<ClasseDeInformacao, string>> = {
  pub: 'Público: pode circular fora da Numa',
  int: 'Interno: só para quem trabalha na Numa',
  fin: 'Financeiro: valores e dados financeiros',
  doc: 'Documento restrito: contratos e documentos pessoais',
};

/** FIN e DOC pedem a confirmação de que a pasta no Drive está restrita (RN-08.03). */
export const classeRestrita = (classe: ClasseDeInformacao) => classe === 'fin' || classe === 'doc';

/**
 * Quem pode ver um item desta classe. Hoje sempre pode (D27). Na etapa com servidor: FIN exige
 * `financeiro.ver` ou `contratos.ver_valores`; DOC exige `contratos.ver_documentos` ou `biblioteca.ver_restritos`.
 */
export function podeVerClasse(_classe: ClasseDeInformacao): boolean {
  return true;
}

/** Exportar inscritos exige `marketing.editar` (RN-08.10). Hoje sempre pode (D27); a exportação é auditada do mesmo jeito. */
export function podeExportarInscritos(): boolean {
  return true;
}

export const AVISO_CLASSE_DRIVE = 'A classe limita quem vê o item na Central. A permissão do arquivo é a do Drive e precisa ser conferida lá.';
