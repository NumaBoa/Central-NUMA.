import { z } from 'zod';
import { esquemaControle } from './controle';

/** `feriado` (16 §4.2): estadual diz o estado; municipal, o estado e o município. */
export const esquemaFeriado = esquemaControle
  .extend({
    data: z.iso.date(),
    nome: z.string().trim().min(1),
    abrangencia: z.enum(['nacional', 'estadual', 'municipal']),
    uf: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    municipio: z.string().min(1).nullable(),
  })
  .superRefine((feriado, contexto) => {
    if (feriado.abrangencia === 'nacional' && (feriado.uf || feriado.municipio)) contexto.addIssue({ code: 'custom', path: ['uf'], message: 'Feriado nacional não tem estado nem município.' });
    if (feriado.abrangencia !== 'nacional' && !feriado.uf) contexto.addIssue({ code: 'custom', path: ['uf'], message: 'Informe o estado.' });
    if (feriado.abrangencia === 'municipal' && !feriado.municipio) contexto.addIssue({ code: 'custom', path: ['municipio'], message: 'Informe o município.' });
    if (feriado.abrangencia === 'estadual' && feriado.municipio) contexto.addIssue({ code: 'custom', path: ['municipio'], message: 'Feriado estadual não tem município.' });
  });

export type Feriado = z.infer<typeof esquemaFeriado>;
