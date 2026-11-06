import { z } from 'zod';
import { esquemaControle } from './controle';

/** `checklist_item` (16 §4.2): itens de qualquer registro. */
export const esquemaChecklistItem = esquemaControle.extend({
  registro_tipo: z.string().min(1),
  registro_id: z.string().min(1),
  ordem: z.number().int().nonnegative(),
  texto: z.string().trim().min(1),
  responsavel_id: z.string().nullable(),
  feito: z.boolean(),
  feito_por: z.string().nullable(),
  feito_em: z.iso.datetime().nullable(),
});

export type ChecklistItem = z.infer<typeof esquemaChecklistItem>;

/** `comentario` (16 §4.2). Sem login, o autor é a pessoa de "Você é" (02 §0.4). */
export const esquemaComentario = esquemaControle.extend({
  registro_tipo: z.string().min(1),
  registro_id: z.string().min(1),
  autor_id: z.string().min(1),
  texto: z.string().trim().min(1),
  mencoes: z.array(z.string()),
  editado_em: z.iso.datetime().nullable(),
  removido_em: z.iso.datetime().nullable(),
});

export type Comentario = z.infer<typeof esquemaComentario>;

/** `vinculo` (16 §4.2): único nos dois sentidos, guardado sempre na mesma ordem. */
export const esquemaVinculo = esquemaControle.extend({
  origem_tipo: z.string().min(1),
  origem_id: z.string().min(1),
  destino_tipo: z.string().min(1),
  destino_id: z.string().min(1),
});

export type Vinculo = z.infer<typeof esquemaVinculo>;

export type RegistroDoVinculo = { tipo: string; id: string };

/** A mesma ligação vira sempre o mesmo par, seja qual for o lado de onde foi feita. */
export function parDoVinculo(a: RegistroDoVinculo, b: RegistroDoVinculo) {
  const [origem, destino] = `${a.tipo}:${a.id}` <= `${b.tipo}:${b.id}` ? [a, b] : [b, a];
  return { origem_tipo: origem.tipo, origem_id: origem.id, destino_tipo: destino.tipo, destino_id: destino.id };
}

/**
 * Link do Drive em um registro. A biblioteca (`arquivo`, M08) só chega na F0b; até lá, o T03.03 e o
 * T03.02 guardam o link aqui, e a M08 poderá migrar estas linhas para `arquivo_vinculo`.
 */
export const esquemaAnexoLink = esquemaControle.extend({
  registro_tipo: z.string().min(1),
  registro_id: z.string().min(1),
  titulo: z.string().trim().min(1),
  url: z.string().min(1),
});

export type AnexoLink = z.infer<typeof esquemaAnexoLink>;
