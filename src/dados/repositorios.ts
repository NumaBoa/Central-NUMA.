import type { Repositorio, RepositorioConfiguracao } from './repositorio';
import { criarRepositorioConfiguracaoLocal } from './repositorio-configuracao-local';
import { criarRepositorioLocal } from './repositorio-local';
import { esquemaArea, esquemaPessoaArea, type Area, type PessoaArea } from './tipos/area';
import { esquemaBackupRegistro, type BackupRegistro } from './tipos/backup-registro';
import { esquemaCambioReferencia, type CambioReferencia } from './tipos/cambio-referencia';
import { esquemaContraparte, esquemaEntidade, esquemaEntidadeRepresentante, type Contraparte, type Entidade, type EntidadeRepresentante } from './tipos/contraparte';
import { esquemaMarca, esquemaProduto, type Marca, type Produto } from './tipos/marca';
import { esquemaPessoa, type Pessoa } from './tipos/pessoa';

/** Ponto de acesso aos dados. Na etapa com servidor, só estas implementações mudam (02 §0.3). */
export const repositorios: {
  pessoa: Repositorio<Pessoa>;
  backup_registro: Repositorio<BackupRegistro>;
  configuracao: RepositorioConfiguracao;
  cambio_referencia: Repositorio<CambioReferencia>;
  area: Repositorio<Area>;
  pessoa_area: Repositorio<PessoaArea>;
  marca: Repositorio<Marca>;
  produto: Repositorio<Produto>;
  contraparte: Repositorio<Contraparte>;
  entidade: Repositorio<Entidade>;
  entidade_representante: Repositorio<EntidadeRepresentante>;
} = {
  pessoa: criarRepositorioLocal({ tabela: 'pessoa', esquema: esquemaPessoa }),
  backup_registro: criarRepositorioLocal({ tabela: 'backup_registro', esquema: esquemaBackupRegistro }),
  configuracao: criarRepositorioConfiguracaoLocal(),
  cambio_referencia: criarRepositorioLocal({ tabela: 'cambio_referencia', esquema: esquemaCambioReferencia }),
  area: criarRepositorioLocal({ tabela: 'area', esquema: esquemaArea }),
  pessoa_area: criarRepositorioLocal({ tabela: 'pessoa_area', esquema: esquemaPessoaArea }),
  marca: criarRepositorioLocal({ tabela: 'marca', esquema: esquemaMarca }),
  produto: criarRepositorioLocal({ tabela: 'produto', esquema: esquemaProduto }),
  contraparte: criarRepositorioLocal({ tabela: 'contraparte', esquema: esquemaContraparte }),
  entidade: criarRepositorioLocal({ tabela: 'entidade', esquema: esquemaEntidade }),
  entidade_representante: criarRepositorioLocal({ tabela: 'entidade_representante', esquema: esquemaEntidadeRepresentante }),
};
