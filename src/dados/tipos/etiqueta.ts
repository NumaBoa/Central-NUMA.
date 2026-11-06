import { z } from 'zod';
import { esquemaControle } from './controle';

/**
 * `etiqueta` (16 §4.2). A T02.10 acrescenta os módulos onde pode ser usada: vazio vale para todos,
 * inclusive os que ainda não existem.
 */
export const esquemaEtiqueta = esquemaControle.extend({
  nome: z.string().trim().min(1),
  cor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  modulos: z.array(z.string()),
});

export type Etiqueta = z.infer<typeof esquemaEtiqueta>;

/** `etiqueta_vinculo` (16 §4.2): a etiqueta em um registro de qualquer módulo. */
export const esquemaEtiquetaVinculo = esquemaControle.extend({
  etiqueta_id: z.string().min(1),
  registro_tipo: z.string().min(1),
  registro_id: z.string().min(1),
});

export type EtiquetaVinculo = z.infer<typeof esquemaEtiquetaVinculo>;
