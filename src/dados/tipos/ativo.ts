import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();

export const TIPOS_DE_ATIVO = ['dominio', 'loja_apple', 'loja_google', 'repositorio', 'rede_social', 'email', 'analytics', 'outro'] as const;
export const SITUACOES_DE_TRANSFERENCIA = ['nao_necessaria', 'pendente', 'em_andamento', 'concluida', 'impedida'] as const;

/** `ativo_digital` (16 §4.4). Sem produto, é da Numa. As regras da própria linha valem também em um arquivo importado. */
export const esquemaAtivoDigital = esquemaControle
  .extend({
    codigo: z.string().min(1),
    tipo: z.enum(TIPOS_DE_ATIVO),
    identificador: z.string().trim().min(1),
    produto_id: texto,
    ferramenta_id: texto,
    titular_atual_tipo: z.enum(['numa', 'pessoa_fisica', 'terceiro']),
    titular_atual_pessoa_id: texto,
    titular_atual_texto: texto,
    titular_desejado: z.string().trim().min(1),
    transferencia_situacao: z.enum(SITUACOES_DE_TRANSFERENCIA),
    requisito_transferencia: texto,
    /** Por que a transferência está impedida (T06.04). Não está em 16: o motivo precisa aparecer na lista, e não só no histórico. */
    impedimento_motivo: z.string().nullable().optional(),
    registrado_em: dia,
    vencimento: dia,
    renovacao_automatica: z.boolean().nullable(),
    assinatura_id: texto,
    critico: z.boolean(),
    responsavel_id: z.string().min(1),
    evidencia_transferencia_url: texto,
    transferido_em: dia,
    observacoes: texto,
  })
  .superRefine((ativo, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    // CA-04.06 e CA-04.07.
    if (ativo.tipo === 'dominio' && !ativo.vencimento) falha('vencimento', 'Domínio precisa da data de vencimento.');
    if (ativo.transferencia_situacao === 'concluida' && !ativo.evidencia_transferencia_url) falha('evidencia_transferencia_url', 'Transferência concluída precisa do link da evidência.');
    if (ativo.titular_atual_tipo === 'pessoa_fisica' && !ativo.titular_atual_pessoa_id) falha('titular_atual_pessoa_id', 'Diga de quem é a conta.');
    if (ativo.titular_atual_tipo === 'terceiro' && !ativo.titular_atual_texto) falha('titular_atual_texto', 'Diga de quem é a conta.');
  });

export type AtivoDigital = z.infer<typeof esquemaAtivoDigital>;
