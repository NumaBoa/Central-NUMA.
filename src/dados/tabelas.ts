import type { z } from 'zod';
import { esquemaAnexoLink, esquemaChecklistItem, esquemaComentario, esquemaVinculo } from './tipos/apoio';
import { esquemaArea, esquemaPessoaArea } from './tipos/area';
import { esquemaAtividade, esquemaAtividadeParticipante, esquemaAtividadeProduto } from './tipos/atividade';
import { esquemaFeriado } from './tipos/calendario';
import { esquemaEventoAuditoria } from './tipos/auditoria';
import { esquemaBackupRegistro } from './tipos/backup-registro';
import { esquemaCambioReferencia } from './tipos/cambio-referencia';
import { esquemaConfiguracao } from './tipos/configuracao';
import { esquemaContraparte, esquemaEntidade, esquemaEntidadeRepresentante } from './tipos/contraparte';
import { esquemaDecisao, esquemaDecisaoDecisor } from './tipos/decisao';
import { esquemaEtiqueta, esquemaEtiquetaVinculo } from './tipos/etiqueta';
import { esquemaAtivoDigital } from './tipos/ativo';
import { esquemaCanalVenda, esquemaConcorrente, esquemaEstagioHistorico, esquemaKpiDefinicao, esquemaKpiMensal, esquemaObjetivo, esquemaOferta, esquemaOfertaRecurso, esquemaPrecoVersao, esquemaSimulacao } from './tipos/precificacao';
import { esquemaBaixa, esquemaMovimentoSocietario, esquemaTitulo, esquemaTituloRateio } from './tipos/titulo';
import { esquemaConferenciaSaldo, esquemaTransferencia } from './tipos/transferencia';
import { esquemaAssinaturaFerramenta, esquemaAssinaturaValorHistorico, esquemaCategoriaFerramenta, esquemaFerramenta, esquemaFerramentaContexto } from './tipos/ferramenta';
import { esquemaCategoriaFinanceira, esquemaContaFinanceira } from './tipos/financeiro';
import { esquemaMarca, esquemaProduto } from './tipos/marca';
import { esquemaNotificacao } from './tipos/notificacao';
import { esquemaPessoa } from './tipos/pessoa';
import { esquemaRecorrencia } from './tipos/recorrencia';

/**
 * Tabelas que existem nesta etapa. Cada tela acrescenta as suas (16 §0), e elas entram sozinhas em
 * exportar, importar, restaurar e limpar exemplos.
 */
export const TABELAS = {
  pessoa: { rotulo: 'Pessoas', esquema: esquemaPessoa },
  area: { rotulo: 'Áreas', esquema: esquemaArea },
  pessoa_area: { rotulo: 'Pessoas nas áreas', esquema: esquemaPessoaArea },
  marca: { rotulo: 'Marcas', esquema: esquemaMarca },
  produto: { rotulo: 'Produtos', esquema: esquemaProduto },
  contraparte: { rotulo: 'Contrapartes', esquema: esquemaContraparte },
  entidade: { rotulo: 'Entidades', esquema: esquemaEntidade },
  entidade_representante: { rotulo: 'Representantes das entidades', esquema: esquemaEntidadeRepresentante },
  categoria_financeira: { rotulo: 'Categorias financeiras', esquema: esquemaCategoriaFinanceira },
  conta_financeira: { rotulo: 'Contas financeiras', esquema: esquemaContaFinanceira },
  feriado: { rotulo: 'Feriados', esquema: esquemaFeriado },
  etiqueta: { rotulo: 'Etiquetas', esquema: esquemaEtiqueta },
  etiqueta_vinculo: { rotulo: 'Etiquetas nos registros', esquema: esquemaEtiquetaVinculo },
  atividade: { rotulo: 'Atividades', esquema: esquemaAtividade },
  atividade_produto: { rotulo: 'Produtos das atividades', esquema: esquemaAtividadeProduto },
  atividade_participante: { rotulo: 'Participantes das atividades', esquema: esquemaAtividadeParticipante },
  checklist_item: { rotulo: 'Itens de checklist', esquema: esquemaChecklistItem },
  comentario: { rotulo: 'Comentários', esquema: esquemaComentario },
  vinculo: { rotulo: 'Vínculos', esquema: esquemaVinculo },
  anexo_link: { rotulo: 'Links do Drive', esquema: esquemaAnexoLink },
  recorrencia: { rotulo: 'Rotinas', esquema: esquemaRecorrencia },
  notificacao: { rotulo: 'Notificações', esquema: esquemaNotificacao },
  categoria_ferramenta: { rotulo: 'Categorias de ferramenta', esquema: esquemaCategoriaFerramenta },
  ferramenta: { rotulo: 'Ferramentas', esquema: esquemaFerramenta },
  ferramenta_contexto: { rotulo: 'Produtos das ferramentas', esquema: esquemaFerramentaContexto },
  assinatura_ferramenta: { rotulo: 'Assinaturas de ferramentas', esquema: esquemaAssinaturaFerramenta },
  assinatura_valor_historico: { rotulo: 'Histórico de valores', esquema: esquemaAssinaturaValorHistorico },
  ativo_digital: { rotulo: 'Ativos digitais', esquema: esquemaAtivoDigital },
  titulo: { rotulo: 'Lançamentos', esquema: esquemaTitulo },
  titulo_rateio: { rotulo: 'Rateios dos lançamentos', esquema: esquemaTituloRateio },
  baixa: { rotulo: 'Baixas', esquema: esquemaBaixa },
  movimento_societario: { rotulo: 'Movimentos societários', esquema: esquemaMovimentoSocietario },
  transferencia: { rotulo: 'Transferências', esquema: esquemaTransferencia },
  conferencia_saldo: { rotulo: 'Conferências de saldo', esquema: esquemaConferenciaSaldo },
  decisao: { rotulo: 'Decisões', esquema: esquemaDecisao },
  decisao_decisor: { rotulo: 'Quem decidiu', esquema: esquemaDecisaoDecisor },
  produto_estagio_historico: { rotulo: 'Estágios dos produtos', esquema: esquemaEstagioHistorico },
  objetivo: { rotulo: 'Objetivos dos produtos', esquema: esquemaObjetivo },
  oferta: { rotulo: 'Ofertas', esquema: esquemaOferta },
  oferta_recurso: { rotulo: 'Recursos das ofertas', esquema: esquemaOfertaRecurso },
  canal_venda: { rotulo: 'Canais de venda', esquema: esquemaCanalVenda },
  simulacao: { rotulo: 'Simulações', esquema: esquemaSimulacao },
  preco_versao: { rotulo: 'Versões de preço', esquema: esquemaPrecoVersao },
  concorrente_referencia: { rotulo: 'Concorrentes de referência', esquema: esquemaConcorrente },
  kpi_definicao: { rotulo: 'Indicadores próprios', esquema: esquemaKpiDefinicao },
  kpi_mensal: { rotulo: 'KPIs mensais', esquema: esquemaKpiMensal },
  configuracao: { rotulo: 'Configurações', esquema: esquemaConfiguracao },
  cambio_referencia: { rotulo: 'Câmbio de referência', esquema: esquemaCambioReferencia },
  backup_registro: { rotulo: 'Backups registrados', esquema: esquemaBackupRegistro },
  auditoria: { rotulo: 'Histórico', esquema: esquemaEventoAuditoria },
} as const satisfies Record<string, { rotulo: string; esquema: z.ZodType }>;

export type Tabela = keyof typeof TABELAS;

export const NOMES_TABELAS = Object.keys(TABELAS) as Tabela[];

/**
 * Sobe quando o formato das tabelas muda; dados antigos passam pela migração em `carga.ts` (02 §0.3).
 * 2: T02.01 acrescenta `configuracao` e `cambio_referencia`.
 * 3: T02.03 acrescenta `area` e `pessoa_area`.
 * 4: T02.04 acrescenta `marca` e `produto`; o contexto escolhido passa a ser o id do produto.
 * 5: T02.05 e T02.06 acrescentam `entidade`, `entidade_representante` e `contraparte`.
 * 6: T02.07 a T02.10 acrescentam `categoria_financeira`, `conta_financeira`, `feriado`, `etiqueta` e `etiqueta_vinculo`.
 * 7: T03.01 acrescenta `atividade`, `atividade_produto` e `atividade_participante`.
 * 8: T03.02 e T03.03 acrescentam `checklist_item`, `comentario`, `vinculo` e `anexo_link`.
 * 9: T03.05 acrescenta `recorrencia`.
 * 10: T13.04 acrescenta `notificacao`.
 * 11: T04.01 a T04.03 acrescentam `categoria_ferramenta`, `ferramenta`, `ferramenta_contexto`, `assinatura_ferramenta` e `assinatura_valor_historico`.
 * 12: T04.04 e T04.05 acrescentam `ativo_digital`.
 * 13: T05.01 e T05.02 acrescentam `titulo`, `titulo_rateio`, `baixa` e `movimento_societario`.
 * 14: T05.06 e T05.07 acrescentam `transferencia` e `conferencia_saldo`.
 * 15: a transferência ganha `transferencia_original_id`, para o estorno.
 * 16: M07 acrescenta `decisao`, `decisao_decisor`, `produto_estagio_historico`, `objetivo`, `oferta`, `oferta_recurso`, `canal_venda`, `simulacao`, `preco_versao`, `concorrente_referencia`, `kpi_definicao` e `kpi_mensal`.
 */
export const VERSAO_DADOS = 16;
