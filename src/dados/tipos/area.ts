import { z } from 'zod';
import { esquemaControle } from './controle';

/** `area` (16 §4.2). Compartilhada não tem responsável padrão: a escolha é feita em cada registro (RT-12). */
export const esquemaArea = esquemaControle.extend({
  nome: z.string().trim().min(1, 'Informe o nome da área.'),
  responsavel_padrao_id: z.uuid().nullable(),
  compartilhada: z.boolean(),
  ordem: z.int().nonnegative(),
});

export type Area = z.infer<typeof esquemaArea>;

/** `pessoa_area` (16 §4.2): as áreas em que cada pessoa atua. */
export const esquemaPessoaArea = esquemaControle.extend({
  pessoa_id: z.uuid(),
  area_id: z.uuid(),
});

export type PessoaArea = z.infer<typeof esquemaPessoaArea>;
