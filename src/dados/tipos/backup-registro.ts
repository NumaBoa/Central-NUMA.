import { z } from 'zod';
import { esquemaControle } from './controle';

/** `backup_registro` (16 §4.2): cada exportação completa dos dados. */
export const esquemaBackupRegistro = esquemaControle.extend({
  gerado_em: z.iso.datetime(),
  gerado_por: z.uuid().nullable(),
  tabelas: z.number().int().nonnegative(),
  observacao: z.string().nullable(),
});

export type BackupRegistro = z.infer<typeof esquemaBackupRegistro>;
