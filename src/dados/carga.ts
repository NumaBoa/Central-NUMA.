import { gravarTabelas } from './armazenamento';
import { novoEvento } from './evento';
import { gravarMeta, lerMeta } from './meta';
import { VERSAO_DADOS } from './tabelas';
import { gerarExemplos } from './exemplos';

/** Linhas iniciais de todas as tabelas: os exemplos, com o histórico e os backups vazios. */
export function tabelasIniciais(agora: string) {
  return { ...gerarExemplos(agora), backup_registro: [] };
}

/** Dados de exemplo carregados na primeira abertura (02 §0.3). */
export function garantirCarga() {
  if (lerMeta().versao_dados !== null) return;
  const agora = new Date().toISOString();
  gravarTabelas({
    ...tabelasIniciais(agora),
    auditoria: [novoEvento({ usuarioId: null, acao: 'executou_acao', depois: { funcao: 'carga_inicial' } })],
  });
  gravarMeta({ versao_dados: VERSAO_DADOS });
}
