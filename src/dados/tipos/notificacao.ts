import { z } from 'zod';
import { esquemaControle } from './controle';

/**
 * `notificacao` (16 §4.2). Fica fora da auditoria (16 §0). `chave` não está na especificação: é o que
 * impede repetir a mesma notificação quando as rotinas passam de novo (RT-09). `criada_em` é o
 * `criado_em` dos campos de controle.
 */
export const esquemaNotificacao = esquemaControle.extend({
  usuario_id: z.string().min(1),
  tipo: z.enum(['alerta', 'mencao', 'lembrete', 'job']),
  titulo: z.string().trim().min(1),
  registro_tipo: z.string().nullable(),
  registro_id: z.string().nullable(),
  lida_em: z.iso.datetime().nullable(),
  chave: z.string().nullable(),
});

export type Notificacao = z.infer<typeof esquemaNotificacao>;
