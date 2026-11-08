import { z } from 'zod';
import { esquemaControle } from './controle';

const dia = z.iso.date();
const hora = z.string().regex(/^\d{2}:\d{2}$/);
const texto = z.string().nullable();

/** O que cada ocorrência recebe ao nascer: os campos da atividade (16 §4.3). */
export const esquemaModeloDaRecorrencia = z.object({
  tipo: z.enum(['tarefa', 'demanda', 'lembrete']),
  descricao: texto,
  area_id: texto,
  prioridade: z.enum(['baixa', 'normal', 'alta', 'urgente']),
  produtos: z.array(z.string()),
  participantes: z.array(z.string()),
  solicitante_pessoa_id: texto,
  solicitante_texto: texto,
  resultado_esperado: texto,
  checklist: z.array(z.string()),
  vinculos: z.array(z.object({ tipo: z.string(), id: z.string() })),
  arquivos: z.array(z.string()),
});

export type ModeloDaRecorrencia = z.infer<typeof esquemaModeloDaRecorrencia>;

/**
 * `recorrencia` (16 §4.3). A `fase_minima` saiu em 08/11/2026, com a fase da Numa: toda rotina ativa gera
 * ocorrências, e as rotinas iniciais de telas ainda não construídas começam pausadas.
 */
export const esquemaRecorrencia = esquemaControle
  .extend({
    titulo: z.string().trim().min(1).max(140),
    modelo: esquemaModeloDaRecorrencia,
    frequencia: z.enum(['diaria', 'semanal', 'mensal', 'anual']),
    intervalo: z.number().int().positive(),
    dias_semana: z.array(z.number().int().min(0).max(6)),
    dia_mes: z.number().int().min(1).max(31).nullable(),
    ultimo_dia: z.boolean(),
    mes: z.number().int().min(1).max(12).nullable(),
    hora: hora.nullable(),
    inicio: dia,
    fim_data: dia.nullable(),
    fim_ocorrencias: z.number().int().positive().nullable(),
    situacao: z.enum(['ativa', 'pausada', 'encerrada']),
    substitui_id: texto,
    responsavel_id: z.string().min(1),
  })
  .superRefine((regra, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (regra.frequencia === 'semanal' && !regra.dias_semana.length) falha('dias_semana', 'Semanal precisa de ao menos um dia.');
    if ((regra.frequencia === 'mensal' || regra.frequencia === 'anual') && !regra.ultimo_dia && !regra.dia_mes) falha('dia_mes', 'Informe o dia do mês.');
    if (regra.frequencia === 'anual' && !regra.mes) falha('mes', 'Informe o mês.');
    if (regra.modelo.tipo === 'lembrete' && !regra.hora) falha('hora', 'Lembrete exige a hora do aviso.');
  });

export type Recorrencia = z.infer<typeof esquemaRecorrencia>;
