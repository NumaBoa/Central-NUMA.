import { z } from 'zod';
import { esquemaControle } from './controle';

/**
 * `categoria_financeira` (16 §4.2): árvore de 2 níveis, grupo e categoria. Sem pai, é um grupo. Quem
 * garante os 2 níveis e o nome único no grupo é o domínio, porque olha outras linhas.
 */
export const esquemaCategoriaFinanceira = esquemaControle
  .extend({
    nome: z.string().trim().min(1),
    tipo: z.enum(['receita', 'despesa', 'movimento_societario', 'transferencia']),
    /** Só despesa tem. Vazio na carga inicial: a especificação não diz qual é (RT-08). */
    natureza_custo: z.enum(['direto', 'compartilhado', 'investimento', 'operacional']).nullable(),
    pai_id: z.string().nullable(),
    situacao: z.enum(['ativa', 'inativa']),
  })
  .refine((categoria) => categoria.tipo === 'despesa' || categoria.natureza_custo === null, { path: ['natureza_custo'], message: 'Só despesa tem natureza do custo.' });

export type CategoriaFinanceira = z.infer<typeof esquemaCategoriaFinanceira>;

/**
 * `conta_financeira` (16 §4.2). O titular é uma entidade ou uma pessoa, nunca os dois. Que a pessoa
 * seja mesmo sócia, o domínio confere, porque olha outra tabela.
 */
export const esquemaContaFinanceira = esquemaControle
  .extend({
    nome: z.string().trim().min(1),
    tipo: z.enum(['banco', 'cartao', 'carteira', 'pessoal_socia', 'caixa']),
    titular_entidade_id: z.string().nullable(),
    titular_pessoa_id: z.string().nullable(),
    instituicao: z.string().nullable(),
    /** Nunca o número completo (RT-14). */
    final_numero: z
      .string()
      .regex(/^\d{4}$/)
      .nullable(),
    moeda: z.string().regex(/^[A-Z]{3}$/),
    saldo_inicial: z.number().nullable(),
    data_saldo_inicial: z.iso.date().nullable(),
    situacao: z.enum(['ativa', 'encerrada']),
  })
  .superRefine((conta, contexto) => {
    if (Boolean(conta.titular_entidade_id) === Boolean(conta.titular_pessoa_id)) contexto.addIssue({ code: 'custom', path: ['titular_pessoa_id'], message: 'A conta tem um titular: uma entidade ou uma sócia.' });
    if (conta.tipo === 'pessoal_socia' && !conta.titular_pessoa_id) contexto.addIssue({ code: 'custom', path: ['titular_pessoa_id'], message: 'Conta pessoal é de uma sócia.' });
  });

export type ContaFinanceira = z.infer<typeof esquemaContaFinanceira>;
