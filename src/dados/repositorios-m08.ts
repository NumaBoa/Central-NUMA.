import type { Repositorio } from './repositorio';
import { criarRepositorioLocal } from './repositorio-local';
import { esquemaArquivo, esquemaArquivoContexto, esquemaArquivoVersao, esquemaArquivoVinculo, esquemaCampanha, esquemaConsentimentoTexto, esquemaInscrito, esquemaListaEspera, esquemaMarcaIdentidade, esquemaPecaConteudo, type Arquivo, type ArquivoContexto, type ArquivoVersao, type ArquivoVinculo, type Campanha, type ConsentimentoTexto, type Inscrito, type ListaEspera, type MarcaIdentidade, type PecaConteudo } from './tipos/marketing';

export type RepositoriosM08 = {
  arquivo: Repositorio<Arquivo>;
  arquivo_contexto: Repositorio<ArquivoContexto>;
  arquivo_versao: Repositorio<ArquivoVersao>;
  arquivo_vinculo: Repositorio<ArquivoVinculo>;
  marca_identidade: Repositorio<MarcaIdentidade>;
  campanha: Repositorio<Campanha>;
  peca_conteudo: Repositorio<PecaConteudo>;
  lista_espera: Repositorio<ListaEspera>;
  consentimento_texto: Repositorio<ConsentimentoTexto>;
  inscrito: Repositorio<Inscrito>;
};

export const repositoriosM08: RepositoriosM08 = {
  arquivo: criarRepositorioLocal({ tabela: 'arquivo', esquema: esquemaArquivo, prefixoCodigo: 'ARQ' }),
  arquivo_contexto: criarRepositorioLocal({ tabela: 'arquivo_contexto', esquema: esquemaArquivoContexto }),
  arquivo_versao: criarRepositorioLocal({ tabela: 'arquivo_versao', esquema: esquemaArquivoVersao }),
  arquivo_vinculo: criarRepositorioLocal({ tabela: 'arquivo_vinculo', esquema: esquemaArquivoVinculo }),
  marca_identidade: criarRepositorioLocal({ tabela: 'marca_identidade', esquema: esquemaMarcaIdentidade }),
  campanha: criarRepositorioLocal({ tabela: 'campanha', esquema: esquemaCampanha, prefixoCodigo: 'CAM' }),
  peca_conteudo: criarRepositorioLocal({ tabela: 'peca_conteudo', esquema: esquemaPecaConteudo, prefixoCodigo: 'PEC' }),
  lista_espera: criarRepositorioLocal({ tabela: 'lista_espera', esquema: esquemaListaEspera }),
  consentimento_texto: criarRepositorioLocal({ tabela: 'consentimento_texto', esquema: esquemaConsentimentoTexto }),
  inscrito: criarRepositorioLocal({ tabela: 'inscrito', esquema: esquemaInscrito }),
};
