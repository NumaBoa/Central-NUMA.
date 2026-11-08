import type { Repositorio } from './repositorio';
import { criarRepositorioLocal } from './repositorio-local';
import { esquemaApontamentoHoras, esquemaImplantacao, esquemaImplantacaoMarco, esquemaIncidenteDisponibilidade, esquemaNotaLiberacao, esquemaNotaLiberacaoItem, esquemaSlaRegra, esquemaSolicitacaoSuporte, esquemaSuporteInteracao, type ApontamentoHoras, type Implantacao, type ImplantacaoMarco, type IncidenteDisponibilidade, type NotaLiberacao, type NotaLiberacaoItem, type SlaRegra, type SolicitacaoSuporte, type SuporteInteracao } from './tipos/operacao';

export type RepositoriosM12 = {
  implantacao: Repositorio<Implantacao>;
  implantacao_marco: Repositorio<ImplantacaoMarco>;
  sla_regra: Repositorio<SlaRegra>;
  solicitacao_suporte: Repositorio<SolicitacaoSuporte>;
  suporte_interacao: Repositorio<SuporteInteracao>;
  incidente_disponibilidade: Repositorio<IncidenteDisponibilidade>;
  apontamento_horas: Repositorio<ApontamentoHoras>;
  nota_liberacao: Repositorio<NotaLiberacao>;
  nota_liberacao_item: Repositorio<NotaLiberacaoItem>;
};

export const repositoriosM12: RepositoriosM12 = {
  implantacao: criarRepositorioLocal({ tabela: 'implantacao', esquema: esquemaImplantacao, prefixoCodigo: 'IMP' }),
  implantacao_marco: criarRepositorioLocal({ tabela: 'implantacao_marco', esquema: esquemaImplantacaoMarco }),
  sla_regra: criarRepositorioLocal({ tabela: 'sla_regra', esquema: esquemaSlaRegra }),
  solicitacao_suporte: criarRepositorioLocal({ tabela: 'solicitacao_suporte', esquema: esquemaSolicitacaoSuporte, prefixoCodigo: 'SUP' }),
  suporte_interacao: criarRepositorioLocal({ tabela: 'suporte_interacao', esquema: esquemaSuporteInteracao }),
  incidente_disponibilidade: criarRepositorioLocal({ tabela: 'incidente_disponibilidade', esquema: esquemaIncidenteDisponibilidade, prefixoCodigo: 'INC' }),
  apontamento_horas: criarRepositorioLocal({ tabela: 'apontamento_horas', esquema: esquemaApontamentoHoras }),
  nota_liberacao: criarRepositorioLocal({ tabela: 'nota_liberacao', esquema: esquemaNotaLiberacao, prefixoCodigo: 'REL' }),
  nota_liberacao_item: criarRepositorioLocal({ tabela: 'nota_liberacao_item', esquema: esquemaNotaLiberacaoItem }),
};
