import { esquemaAtivoDigital, type AtivoDigital } from './tipos/ativo';
import { esquemaBaixa, esquemaMovimentoSocietario, esquemaTitulo, esquemaTituloRateio, type Baixa, type MovimentoSocietario, type Titulo, type TituloRateio } from './tipos/titulo';
import { esquemaConferenciaSaldo, esquemaTransferencia, type ConferenciaSaldo, type Transferencia } from './tipos/transferencia';
import { esquemaAssinaturaFerramenta, esquemaAssinaturaValorHistorico, esquemaCategoriaFerramenta, esquemaFerramenta, esquemaFerramentaContexto, type AssinaturaFerramenta, type AssinaturaValorHistorico, type CategoriaFerramenta, type Ferramenta, type FerramentaContexto } from './tipos/ferramenta';
import { esquemaNotificacao, type Notificacao } from './tipos/notificacao';
import { esquemaRecorrencia, type Recorrencia } from './tipos/recorrencia';
import type { Repositorio, RepositorioConfiguracao } from './repositorio';
import { criarRepositorioConfiguracaoLocal } from './repositorio-configuracao-local';
import { criarRepositorioLocal } from './repositorio-local';
import { repositoriosM06, type RepositoriosM06 } from './repositorios-m06';
import { protegerDecisoes } from './decisao-imutavel';
import { esquemaAnexoLink, esquemaChecklistItem, esquemaComentario, esquemaVinculo, type AnexoLink, type ChecklistItem, type Comentario, type Vinculo } from './tipos/apoio';
import { esquemaArea, esquemaPessoaArea, type Area, type PessoaArea } from './tipos/area';
import { esquemaAtividade, esquemaAtividadeParticipante, esquemaAtividadeProduto, type Atividade, type AtividadeParticipante, type AtividadeProduto } from './tipos/atividade';
import { esquemaBackupRegistro, type BackupRegistro } from './tipos/backup-registro';
import { esquemaFeriado, type Feriado } from './tipos/calendario';
import { esquemaCambioReferencia, type CambioReferencia } from './tipos/cambio-referencia';
import { esquemaContraparte, esquemaEntidade, esquemaEntidadeRepresentante, type Contraparte, type Entidade, type EntidadeRepresentante } from './tipos/contraparte';
import { esquemaEtiqueta, esquemaEtiquetaVinculo, type Etiqueta, type EtiquetaVinculo } from './tipos/etiqueta';
import { esquemaCategoriaFinanceira, esquemaContaFinanceira, type CategoriaFinanceira, type ContaFinanceira } from './tipos/financeiro';
import { esquemaMarca, esquemaProduto, type Marca, type Produto } from './tipos/marca';
import { esquemaPessoa, type Pessoa } from './tipos/pessoa';
import { esquemaDecisao, esquemaDecisaoDecisor, type Decisao, type DecisaoDecisor } from './tipos/decisao';
import { esquemaCanalVenda, esquemaConcorrente, esquemaConfiguracaoContratual, esquemaEstagioHistorico, esquemaKpiDefinicao, esquemaKpiMensal, esquemaObjetivo, esquemaOferta, esquemaOfertaRecurso, esquemaPrecoVersao, esquemaSimulacao, type CanalVenda, type Concorrente, type ConfiguracaoContratualRegistro, type EstagioHistorico, type KpiDefinicao, type KpiMensal, type Objetivo, type Oferta, type OfertaRecurso, type PrecoVersao, type Simulacao } from './tipos/precificacao';
import { repositoriosF1, type RepositoriosF1 } from './repositorios-f1';
import { repositoriosM12, type RepositoriosM12 } from './repositorios-m12';
import { repositoriosM08, type RepositoriosM08 } from './repositorios-m08';
import { esquemaOrcamento, type Orcamento } from './tipos/orcamento';
import { esquemaCompetenciaFechamento, type CompetenciaFechamento } from './tipos/fechamento';
import { esquemaReajusteAplicado, type ReajusteAplicado } from './tipos/reajuste';
import { esquemaRepasse, esquemaVendaParceiro, type Repasse, type VendaParceiro } from './tipos/repasse';
import { esquemaReceitaCanal, type ReceitaCanal } from './tipos/receita-canal';

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
  categoria_financeira: Repositorio<CategoriaFinanceira>;
  conta_financeira: Repositorio<ContaFinanceira>;
  feriado: Repositorio<Feriado>;
  etiqueta: Repositorio<Etiqueta>;
  etiqueta_vinculo: Repositorio<EtiquetaVinculo>;
  atividade: Repositorio<Atividade>;
  atividade_produto: Repositorio<AtividadeProduto>;
  atividade_participante: Repositorio<AtividadeParticipante>;
  checklist_item: Repositorio<ChecklistItem>;
  comentario: Repositorio<Comentario>;
  vinculo: Repositorio<Vinculo>;
  anexo_link: Repositorio<AnexoLink>;
  recorrencia: Repositorio<Recorrencia>;
  notificacao: Repositorio<Notificacao>;
  categoria_ferramenta: Repositorio<CategoriaFerramenta>;
  ferramenta: Repositorio<Ferramenta>;
  ferramenta_contexto: Repositorio<FerramentaContexto>;
  assinatura_ferramenta: Repositorio<AssinaturaFerramenta>;
  assinatura_valor_historico: Repositorio<AssinaturaValorHistorico>;
  ativo_digital: Repositorio<AtivoDigital>;
  titulo: Repositorio<Titulo>;
  titulo_rateio: Repositorio<TituloRateio>;
  baixa: Repositorio<Baixa>;
  movimento_societario: Repositorio<MovimentoSocietario>;
  transferencia: Repositorio<Transferencia>;
  conferencia_saldo: Repositorio<ConferenciaSaldo>;
  decisao: Repositorio<Decisao>;
  decisao_decisor: Repositorio<DecisaoDecisor>;
  produto_estagio_historico: Repositorio<EstagioHistorico>;
  objetivo: Repositorio<Objetivo>;
  oferta: Repositorio<Oferta>;
  oferta_recurso: Repositorio<OfertaRecurso>;
  canal_venda: Repositorio<CanalVenda>;
  simulacao: Repositorio<Simulacao>;
  preco_versao: Repositorio<PrecoVersao>;
  configuracao_contratual: Repositorio<ConfiguracaoContratualRegistro>;
  orcamento: Repositorio<Orcamento>;
  receita_canal: Repositorio<ReceitaCanal>;
  reajuste_aplicado: Repositorio<ReajusteAplicado>;
  competencia_fechamento: Repositorio<CompetenciaFechamento>;
  venda_parceiro: Repositorio<VendaParceiro>;
  repasse: Repositorio<Repasse>;
  concorrente_referencia: Repositorio<Concorrente>;
  kpi_definicao: Repositorio<KpiDefinicao>;
  kpi_mensal: Repositorio<KpiMensal>;
} & RepositoriosF1 &
  RepositoriosM06 &
  RepositoriosM12 &
  RepositoriosM08 = {
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
  categoria_financeira: criarRepositorioLocal({ tabela: 'categoria_financeira', esquema: esquemaCategoriaFinanceira }),
  conta_financeira: criarRepositorioLocal({ tabela: 'conta_financeira', esquema: esquemaContaFinanceira }),
  feriado: criarRepositorioLocal({ tabela: 'feriado', esquema: esquemaFeriado }),
  etiqueta: criarRepositorioLocal({ tabela: 'etiqueta', esquema: esquemaEtiqueta }),
  etiqueta_vinculo: criarRepositorioLocal({ tabela: 'etiqueta_vinculo', esquema: esquemaEtiquetaVinculo }),
  atividade: criarRepositorioLocal({ tabela: 'atividade', esquema: esquemaAtividade, prefixoCodigo: 'ATV' }),
  atividade_produto: criarRepositorioLocal({ tabela: 'atividade_produto', esquema: esquemaAtividadeProduto }),
  atividade_participante: criarRepositorioLocal({ tabela: 'atividade_participante', esquema: esquemaAtividadeParticipante }),
  checklist_item: criarRepositorioLocal({ tabela: 'checklist_item', esquema: esquemaChecklistItem }),
  comentario: criarRepositorioLocal({ tabela: 'comentario', esquema: esquemaComentario }),
  vinculo: criarRepositorioLocal({ tabela: 'vinculo', esquema: esquemaVinculo }),
  anexo_link: criarRepositorioLocal({ tabela: 'anexo_link', esquema: esquemaAnexoLink }),
  recorrencia: criarRepositorioLocal({ tabela: 'recorrencia', esquema: esquemaRecorrencia }),
  notificacao: criarRepositorioLocal({ tabela: 'notificacao', esquema: esquemaNotificacao, semHistorico: true }),
  categoria_ferramenta: criarRepositorioLocal({ tabela: 'categoria_ferramenta', esquema: esquemaCategoriaFerramenta }),
  ferramenta: criarRepositorioLocal({ tabela: 'ferramenta', esquema: esquemaFerramenta, prefixoCodigo: 'FER' }),
  ferramenta_contexto: criarRepositorioLocal({ tabela: 'ferramenta_contexto', esquema: esquemaFerramentaContexto }),
  assinatura_ferramenta: criarRepositorioLocal({ tabela: 'assinatura_ferramenta', esquema: esquemaAssinaturaFerramenta }),
  assinatura_valor_historico: criarRepositorioLocal({ tabela: 'assinatura_valor_historico', esquema: esquemaAssinaturaValorHistorico }),
  ativo_digital: criarRepositorioLocal({ tabela: 'ativo_digital', esquema: esquemaAtivoDigital, prefixoCodigo: 'ATI' }),
  titulo: criarRepositorioLocal({ tabela: 'titulo', esquema: esquemaTitulo, prefixoCodigo: 'TIT' }),
  titulo_rateio: criarRepositorioLocal({ tabela: 'titulo_rateio', esquema: esquemaTituloRateio }),
  baixa: criarRepositorioLocal({ tabela: 'baixa', esquema: esquemaBaixa }),
  movimento_societario: criarRepositorioLocal({ tabela: 'movimento_societario', esquema: esquemaMovimentoSocietario, prefixoCodigo: 'MOV' }),
  transferencia: criarRepositorioLocal({ tabela: 'transferencia', esquema: esquemaTransferencia }),
  conferencia_saldo: criarRepositorioLocal({ tabela: 'conferencia_saldo', esquema: esquemaConferenciaSaldo }),
  decisao: protegerDecisoes(criarRepositorioLocal({ tabela: 'decisao', esquema: esquemaDecisao, prefixoCodigo: 'DEC' })),
  decisao_decisor: criarRepositorioLocal({ tabela: 'decisao_decisor', esquema: esquemaDecisaoDecisor }),
  produto_estagio_historico: criarRepositorioLocal({ tabela: 'produto_estagio_historico', esquema: esquemaEstagioHistorico }),
  objetivo: criarRepositorioLocal({ tabela: 'objetivo', esquema: esquemaObjetivo }),
  oferta: criarRepositorioLocal({ tabela: 'oferta', esquema: esquemaOferta, prefixoCodigo: 'OFE' }),
  oferta_recurso: criarRepositorioLocal({ tabela: 'oferta_recurso', esquema: esquemaOfertaRecurso }),
  canal_venda: criarRepositorioLocal({ tabela: 'canal_venda', esquema: esquemaCanalVenda }),
  simulacao: criarRepositorioLocal({ tabela: 'simulacao', esquema: esquemaSimulacao, prefixoCodigo: 'SIM' }),
  preco_versao: criarRepositorioLocal({ tabela: 'preco_versao', esquema: esquemaPrecoVersao }),
  configuracao_contratual: criarRepositorioLocal({ tabela: 'configuracao_contratual', esquema: esquemaConfiguracaoContratual }),
  orcamento: criarRepositorioLocal({ tabela: 'orcamento', esquema: esquemaOrcamento }),
  receita_canal: criarRepositorioLocal({ tabela: 'receita_canal', esquema: esquemaReceitaCanal }),
  reajuste_aplicado: criarRepositorioLocal({ tabela: 'reajuste_aplicado', esquema: esquemaReajusteAplicado }),
  competencia_fechamento: criarRepositorioLocal({ tabela: 'competencia_fechamento', esquema: esquemaCompetenciaFechamento }),
  venda_parceiro: criarRepositorioLocal({ tabela: 'venda_parceiro', esquema: esquemaVendaParceiro }),
  repasse: criarRepositorioLocal({ tabela: 'repasse', esquema: esquemaRepasse }),
  concorrente_referencia: criarRepositorioLocal({ tabela: 'concorrente_referencia', esquema: esquemaConcorrente }),
  kpi_definicao: criarRepositorioLocal({ tabela: 'kpi_definicao', esquema: esquemaKpiDefinicao }),
  kpi_mensal: criarRepositorioLocal({ tabela: 'kpi_mensal', esquema: esquemaKpiMensal }),
  ...repositoriosF1,
  ...repositoriosM06,
  ...repositoriosM12,
  ...repositoriosM08,
};
