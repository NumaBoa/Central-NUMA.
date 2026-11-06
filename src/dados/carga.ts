import { chaveDaTabela, driver, gravarTabelas, lerTabela } from './armazenamento';
import { novoEvento } from './evento';
import { controle, gerarExemplos } from './exemplos';
import { gerarUuid } from '@/lib/ids';
import { gravarMeta, lerMeta } from './meta';
import { VERSAO_DADOS } from './tabelas';
import type { EventoAuditoria } from './tipos/auditoria';
import { CATALOGO_CONFIGURACAO, CHAVES_CONFIGURACAO, VALORES_PADRAO, type Configuracao } from './tipos/configuracao';

/** Os padrões de T02.01, uma linha por chave. Não são exemplos: "Limpar exemplos" não mexe neles. */
export function configuracoesIniciais(agora: string): Configuracao[] {
  return CHAVES_CONFIGURACAO.map((chave) => ({
    ...controle(gerarUuid(), false, agora),
    chave,
    valor: VALORES_PADRAO[chave],
    descricao: CATALOGO_CONFIGURACAO[chave].descricao,
  }));
}

/** Linhas iniciais de todas as tabelas: os exemplos e os padrões, com o histórico e os backups vazios. */
export function tabelasIniciais(agora: string) {
  return { ...gerarExemplos(agora), configuracao: configuracoesIniciais(agora), cambio_referencia: [], backup_registro: [] };
}

/**
 * Acrescenta o que falta sem tocar no que existe: quem já usa a Central não perde nada. Não pode
 * depender de tabelas inteiras, porque importar e restaurar são a saída para dados danificados.
 */
function migrar(versao: number) {
  const agora = new Date().toISOString();
  const alteracoes: Record<string, readonly unknown[]> = {};
  if (versao < 2) {
    if (driver().getItem(chaveDaTabela('configuracao')) === null) alteracoes.configuracao = configuracoesIniciais(agora);
    if (driver().getItem(chaveDaTabela('cambio_referencia')) === null) alteracoes.cambio_referencia = [];
  }
  try {
    alteracoes.auditoria = [...lerTabela<EventoAuditoria>('auditoria'), novoEvento({ usuarioId: null, acao: 'executou_acao', depois: { funcao: 'migrar_dados', de: versao, para: VERSAO_DADOS } })];
  } catch {
    // histórico danificado: a migração segue sem esse registro
  }
  gravarTabelas(alteracoes);
  gravarMeta({ versao_dados: VERSAO_DADOS });
}

/** Dados de exemplo carregados na primeira abertura; depois, só a migração de versões antigas (02 §0.3). */
export function garantirCarga() {
  const versao = lerMeta().versao_dados;
  if (versao !== null) {
    if (versao < VERSAO_DADOS) migrar(versao);
    return;
  }
  const agora = new Date().toISOString();
  gravarTabelas({
    ...tabelasIniciais(agora),
    auditoria: [novoEvento({ usuarioId: null, acao: 'executou_acao', depois: { funcao: 'carga_inicial' } })],
  });
  gravarMeta({ versao_dados: VERSAO_DADOS });
}
