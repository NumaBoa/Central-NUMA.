import { z } from 'zod';
import { esquemaControle } from './controle';

/** `pessoa` (16 §4.2). A tela de cadastro é a T02.02; a moldura já usa para "Você é". */
export const esquemaPessoa = esquemaControle.extend({
  nome_completo: z.string().trim().min(1, 'Informe o nome completo.'),
  nome_exibicao: z.string().nullable(),
  tipo: z.enum(['interna', 'externa']),
  eh_socia: z.boolean(),
  contraparte_id: z.uuid().nullable(),
  papeis_contato: z.array(z.enum(['principal', 'financeiro', 'tecnico', 'juridico', 'outro'])),
  funcao: z.string().nullable(),
  email: z.email('Informe um e-mail válido.').nullable(),
  telefone: z.string().nullable(),
  cpf: z.string().regex(/^\d{11}$/, 'O CPF tem 11 dígitos.').nullable(),
  observacoes: z.string().nullable(),
  situacao: z.enum(['ativa', 'inativa']),
});

export type Pessoa = z.infer<typeof esquemaPessoa>;
