import type { Repositorio } from './repositorio';
import { criarRepositorioLocal } from './repositorio-local';
import {
  esquemaAcordo,
  esquemaAcordoAssinatura,
  esquemaAcordoVersao,
  esquemaConstituicaoItem,
  esquemaMarcaPesquisa,
  esquemaMarcaPrazo,
  esquemaMarcaProcesso,
  esquemaObrigacao,
  esquemaObrigacaoOcorrencia,
  esquemaParticipacaoHistorico,
  esquemaReuniao,
  esquemaReuniaoParticipante,
  esquemaSocia,
  type Acordo,
  type AcordoAssinatura,
  type AcordoVersao,
  type ConstituicaoItem,
  type MarcaPesquisa,
  type MarcaPrazo,
  type MarcaProcesso,
  type Obrigacao,
  type ObrigacaoOcorrencia,
  type ParticipacaoHistorico,
  type Reuniao,
  type ReuniaoParticipante,
  type Socia,
} from './tipos/sociedade';

export type RepositoriosM06 = {
  socia: Repositorio<Socia>;
  socia_participacao_historico: Repositorio<ParticipacaoHistorico>;
  acordo_societario: Repositorio<Acordo>;
  acordo_versao: Repositorio<AcordoVersao>;
  acordo_assinatura: Repositorio<AcordoAssinatura>;
  marca_pesquisa: Repositorio<MarcaPesquisa>;
  marca_processo: Repositorio<MarcaProcesso>;
  marca_prazo: Repositorio<MarcaPrazo>;
  constituicao_item: Repositorio<ConstituicaoItem>;
  obrigacao_corporativa: Repositorio<Obrigacao>;
  obrigacao_corporativa_ocorrencia: Repositorio<ObrigacaoOcorrencia>;
  reuniao: Repositorio<Reuniao>;
  reuniao_participante: Repositorio<ReuniaoParticipante>;
};

export const repositoriosM06: RepositoriosM06 = {
  socia: criarRepositorioLocal({ tabela: 'socia', esquema: esquemaSocia }),
  socia_participacao_historico: criarRepositorioLocal({ tabela: 'socia_participacao_historico', esquema: esquemaParticipacaoHistorico }),
  acordo_societario: criarRepositorioLocal({ tabela: 'acordo_societario', esquema: esquemaAcordo, prefixoCodigo: 'ACO' }),
  acordo_versao: criarRepositorioLocal({ tabela: 'acordo_versao', esquema: esquemaAcordoVersao }),
  acordo_assinatura: criarRepositorioLocal({ tabela: 'acordo_assinatura', esquema: esquemaAcordoAssinatura }),
  marca_pesquisa: criarRepositorioLocal({ tabela: 'marca_pesquisa', esquema: esquemaMarcaPesquisa }),
  marca_processo: criarRepositorioLocal({ tabela: 'marca_processo', esquema: esquemaMarcaProcesso }),
  marca_prazo: criarRepositorioLocal({ tabela: 'marca_prazo', esquema: esquemaMarcaPrazo }),
  constituicao_item: criarRepositorioLocal({ tabela: 'constituicao_item', esquema: esquemaConstituicaoItem }),
  obrigacao_corporativa: criarRepositorioLocal({ tabela: 'obrigacao_corporativa', esquema: esquemaObrigacao }),
  obrigacao_corporativa_ocorrencia: criarRepositorioLocal({ tabela: 'obrigacao_corporativa_ocorrencia', esquema: esquemaObrigacaoOcorrencia }),
  reuniao: criarRepositorioLocal({ tabela: 'reuniao', esquema: esquemaReuniao, prefixoCodigo: 'REU' }),
  reuniao_participante: criarRepositorioLocal({ tabela: 'reuniao_participante', esquema: esquemaReuniaoParticipante }),
};
