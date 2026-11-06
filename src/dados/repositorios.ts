import type { Repositorio } from './repositorio';
import { criarRepositorioLocal } from './repositorio-local';
import { esquemaBackupRegistro, type BackupRegistro } from './tipos/backup-registro';
import { esquemaPessoa, type Pessoa } from './tipos/pessoa';

/** Ponto de acesso aos dados. Na etapa com servidor, só estas implementações mudam (02 §0.3). */
export const repositorios: {
  pessoa: Repositorio<Pessoa>;
  backup_registro: Repositorio<BackupRegistro>;
} = {
  pessoa: criarRepositorioLocal({ tabela: 'pessoa', esquema: esquemaPessoa }),
  backup_registro: criarRepositorioLocal({ tabela: 'backup_registro', esquema: esquemaBackupRegistro }),
};
