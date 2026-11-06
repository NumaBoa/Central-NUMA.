import { gerarUuid } from '@/lib/ids';
import type { EventoAuditoria } from './tipos/auditoria';

export type DadosDoEvento = {
  usuarioId: string | null;
  acao: EventoAuditoria['acao'];
  tabela?: string | null;
  registroId?: string | null;
  registroCodigo?: string | null;
  antes?: Record<string, unknown> | null;
  depois?: Record<string, unknown> | null;
  camposAlterados?: readonly string[];
  motivo?: string | null;
};

export function novoEvento(dados: DadosDoEvento): EventoAuditoria {
  return {
    id: gerarUuid(),
    ocorrido_em: new Date().toISOString(),
    usuario_id: dados.usuarioId,
    acao: dados.acao,
    tabela: dados.tabela ?? null,
    registro_id: dados.registroId ?? null,
    registro_codigo: dados.registroCodigo ?? null,
    antes: dados.antes ?? null,
    depois: dados.depois ?? null,
    campos_alterados: [...(dados.camposAlterados ?? [])],
    motivo: dados.motivo ?? null,
  };
}
