import type { z } from 'zod';
import { esquemaApontamentoHoras, esquemaImplantacao, esquemaImplantacaoMarco, esquemaIncidenteDisponibilidade, esquemaNotaLiberacao, esquemaNotaLiberacaoItem, esquemaSlaRegra, esquemaSolicitacaoSuporte, esquemaSuporteInteracao } from './tipos/operacao';

/** Tabelas do M12 (16 §4.12), à parte para não disputar linhas com as frentes paralelas em `tabelas.ts`. */
export const TABELAS_M12 = {
  implantacao: { rotulo: 'Implantações', esquema: esquemaImplantacao },
  implantacao_marco: { rotulo: 'Marcos das implantações', esquema: esquemaImplantacaoMarco },
  sla_regra: { rotulo: 'Regras de SLA', esquema: esquemaSlaRegra },
  solicitacao_suporte: { rotulo: 'Solicitações de suporte', esquema: esquemaSolicitacaoSuporte },
  suporte_interacao: { rotulo: 'Respostas do suporte', esquema: esquemaSuporteInteracao },
  incidente_disponibilidade: { rotulo: 'Incidentes de disponibilidade', esquema: esquemaIncidenteDisponibilidade },
  apontamento_horas: { rotulo: 'Horas apontadas', esquema: esquemaApontamentoHoras },
  nota_liberacao: { rotulo: 'Notas de liberação', esquema: esquemaNotaLiberacao },
  nota_liberacao_item: { rotulo: 'Itens das notas de liberação', esquema: esquemaNotaLiberacaoItem },
} as const satisfies Record<string, { rotulo: string; esquema: z.ZodType }>;

export const NOMES_TABELAS_M12 = Object.keys(TABELAS_M12) as (keyof typeof TABELAS_M12)[];

/** Partes de outro registro: ficam fora da contagem de cadastros (`dominio/dados.ts`). */
export const TABELAS_M12_FORA_DA_CONTAGEM = ['implantacao_marco', 'suporte_interacao', 'nota_liberacao_item', 'sla_regra'] as const;
