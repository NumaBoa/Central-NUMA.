import { z } from 'zod';
import { esquemaControle } from './controle';

const dia = z.iso.date().nullable();
const instante = z.iso.datetime().nullable();
const texto = z.string().nullable();

/**
 * `atividade` (16 §4.3). Atrasada não é campo: é derivada do prazo (RN-03.04). As regras que olham
 * só para a própria linha ficam aqui, para valerem também em um arquivo importado.
 */
export const esquemaAtividade = esquemaControle
  .extend({
    codigo: z.string().min(1),
    tipo: z.enum(['tarefa', 'demanda', 'lembrete', 'alerta']),
    titulo: z.string().trim().min(1).max(140),
    descricao: texto,
    area_id: texto,
    responsavel_id: z.string().min(1),
    prioridade: z.enum(['baixa', 'normal', 'alta', 'urgente']),
    situacao: z.enum(['a_fazer', 'em_andamento', 'aguardando', 'concluida', 'cancelada']),
    bloqueada: z.boolean(),
    bloqueio_motivo: texto,
    bloqueada_em: instante,
    inicio: dia,
    prazo: dia,
    prazo_hora: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    aviso_em: instante,
    solicitante_pessoa_id: texto,
    solicitante_texto: texto,
    resultado_esperado: texto,
    aguardando_de_pessoa_id: texto,
    aguardando_de_texto: texto,
    aguardando_desde: dia,
    acompanhamento_em: dia,
    recorrencia_id: texto,
    ocorrencia_numero: z.number().int().positive().nullable(),
    ocorrencia_data: dia,
    editada_individualmente: z.boolean(),
    origem_tipo: texto,
    origem_id: texto,
    alerta_motivo: texto,
    alerta_data_referencia: dia,
    /** Chave da ação sugerida (ver `ACOES_DE_ALERTA`, em `dominio/atividades.ts`). */
    alerta_acao: texto,
    chave_idempotencia: texto,
    adiamentos: z.number().int().nonnegative(),
    concluida_em: instante,
    concluida_por: texto,
    conclusao_nota: texto,
    cancelada_motivo: texto,
    dispensada_motivo: texto,
  })
  .superRefine((atividade, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (atividade.bloqueada && !atividade.bloqueio_motivo) falha('bloqueio_motivo', 'Bloqueada exige motivo.');
    if (atividade.tipo === 'lembrete' && !atividade.aviso_em) falha('aviso_em', 'Lembrete exige data e hora do aviso.');
    if (atividade.situacao === 'aguardando' && !atividade.aguardando_de_pessoa_id && !atividade.aguardando_de_texto) falha('aguardando_de_texto', 'Diga de quem está aguardando.');
    if (atividade.situacao === 'concluida' && !atividade.concluida_em) falha('concluida_em', 'Concluída registra a data e a hora.');
    if (atividade.situacao === 'cancelada' && !atividade.cancelada_motivo) falha('cancelada_motivo', 'Cancelar exige motivo.');
  });

export type Atividade = z.infer<typeof esquemaAtividade>;

/** `atividade_produto` (16 §4.3). Sem nenhuma linha, a atividade é da Numa. */
export const esquemaAtividadeProduto = esquemaControle.extend({
  atividade_id: z.string().min(1),
  produto_id: z.string().min(1),
});

export type AtividadeProduto = z.infer<typeof esquemaAtividadeProduto>;

/** `atividade_participante` (16 §4.3). */
export const esquemaAtividadeParticipante = esquemaControle.extend({
  atividade_id: z.string().min(1),
  pessoa_id: z.string().min(1),
});

export type AtividadeParticipante = z.infer<typeof esquemaAtividadeParticipante>;
