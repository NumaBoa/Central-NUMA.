import { gravarTabelas, lerTabela } from './armazenamento';
import { garantirCarga } from './carga';
import { novoEvento, type DadosDoEvento } from './evento';
import type { EventoAuditoria } from './tipos/auditoria';

export { novoEvento };

/** Somente inserção (RT-04): não existe caminho para alterar um evento. */
export function registrarEvento(dados: DadosDoEvento) {
  garantirCarga();
  gravarTabelas({ auditoria: [...lerTabela<EventoAuditoria>('auditoria'), novoEvento(dados)] });
}

type FiltrosHistorico = { tabela?: string; registroId?: string; limite?: number };

/** Mais recentes primeiro, como aparece nas abas Histórico das fichas. */
export async function listarHistorico({ tabela, registroId, limite }: FiltrosHistorico = {}): Promise<EventoAuditoria[]> {
  garantirCarga();
  const eventos = lerTabela<EventoAuditoria>('auditoria')
    .filter((evento) => (!tabela || evento.tabela === tabela) && (!registroId || evento.registro_id === registroId))
    .reverse();
  return limite ? eventos.slice(0, limite) : eventos;
}
