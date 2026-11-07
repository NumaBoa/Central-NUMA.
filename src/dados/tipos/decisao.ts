import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();

export const ASSUNTOS_DA_DECISAO = ['geral', 'estagio', 'fila', 'preco', 'excecao_preco'] as const;

/**
 * `decisao` (16 §4.6), a fonte única das decisões. A tela completa é a T06.09 (M06), que ainda não existe;
 * o M07 só registra e vincula (RN-06.15). `assunto` não está em 16: é o que distingue a "exceção de preço"
 * pedida por RN-07.06. Registrada não muda: só é substituída (RN-06.13).
 */
export const esquemaDecisao = esquemaControle.extend({
  codigo: z.string().min(1),
  titulo: z.string().trim().min(1),
  descricao: z.string().trim().min(1),
  motivo: texto,
  alternativas: texto,
  impacto: texto,
  data: z.iso.date(),
  area_id: texto,
  /** Sem produto, é da Numa. */
  produto_id: texto,
  reuniao_id: texto,
  situacao: z.enum(['registrada', 'substituida']),
  substituida_por_id: texto,
  assunto: z.enum(ASSUNTOS_DA_DECISAO).default('geral'),
});

export type Decisao = z.infer<typeof esquemaDecisao>;

export const esquemaDecisaoDecisor = esquemaControle.extend({
  decisao_id: z.string().min(1),
  pessoa_id: z.string().min(1),
});

export type DecisaoDecisor = z.infer<typeof esquemaDecisaoDecisor>;
