import { chaveDaTabela, driver } from './armazenamento';
import { controle } from './exemplos/controle';
import { BLOCOS_MOD_SAAS_LIC, MOD_SAAS_LIC } from './referencia/mod-saas-lic';
import { NOMES_TABELAS_F1 } from './tabelas-f1';
import type { ModeloDocumento, ModeloVersao } from './tipos/legal';

export const ID_MODELO_SAAS = 'a1c2e3f4-5b6d-4e7f-8a9b-0c1d2e3f4a01';
export const ID_VERSAO_MODELO_SAAS = 'a1c2e3f4-5b6d-4e7f-8a9b-0c1d2e3f4a02';

export const AVISO_MODELO_SAAS = 'Rascunho para validação jurídica. Este texto só passa a Validado depois do parecer de advogada ou advogado inscrito na OAB (RN-09.13).';

/** Texto real da especificação, não exemplo: "Limpar exemplos" não mexe nele. Nasce em Rascunho, nunca Validado (decisão vigente 6). */
export function modeloSaasInicial(agora: string): ModeloDocumento[] {
  return [{ ...controle(ID_MODELO_SAAS, false, agora), codigo: MOD_SAAS_LIC.codigo, nome: 'Contrato de licença SaaS', tipo_documento: 'contrato', familia: null, marca_id: null }];
}

export function versaoSaasInicial(agora: string): ModeloVersao[] {
  return [
    {
      ...controle(ID_VERSAO_MODELO_SAAS, false, agora),
      modelo_id: ID_MODELO_SAAS,
      numero: 1,
      rotulo_versao: MOD_SAAS_LIC.versao,
      estrutura: BLOCOS_MOD_SAAS_LIC.map(({ titulo, conteudo }, indice) => ({ id: `saas-${indice + 1}`, tipo: 'texto' as const, titulo, clausula_versao_id: null, conteudo, condicao: null, blocos: [] })),
      variaveis: [],
      cabecalho: null,
      situacao: 'rascunho',
      validacao_id: null,
      aviso: AVISO_MODELO_SAAS,
      observacoes: null,
    },
  ];
}

export const VALORES_INICIAIS_F1 = { modelo_documento: modeloSaasInicial, modelo_versao: versaoSaasInicial } as const;

/** Só acrescenta tabelas que faltam: quem já usa a Central não perde nada, seja qual for o número da versão. */
export function acrescentarTabelasF1(alteracoes: Record<string, readonly unknown[]>, agora: string) {
  for (const tabela of NOMES_TABELAS_F1) {
    if (driver().getItem(chaveDaTabela(tabela)) !== null) continue;
    if (tabela === 'modelo_documento') alteracoes[tabela] = modeloSaasInicial(agora);
    else if (tabela === 'modelo_versao') alteracoes[tabela] = versaoSaasInicial(agora);
    else alteracoes[tabela] = [];
  }
}
