import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const moeda = z.string().regex(/^[A-Z]{3}$/);
const valorOuVazio = z.number().nonnegative().nullable();

export const TIPOS_DE_OFERTA = ['assinatura', 'implantacao', 'servico_pontual', 'sob_medida', 'consumo', 'comissao', 'gratuidade'] as const;
export const PUBLICOS_DE_OFERTA = ['b2c', 'b2b', 'parceiro'] as const;
export const FORMALIZACOES_DE_OFERTA = ['adesao', 'negociado', 'ambos'] as const;
export const PERIODICIDADES_DE_PRECO = ['mensal', 'anual', 'unica', 'por_uso'] as const;
export const TIPOS_DE_CANAL = ['loja_ios', 'loja_android', 'web_gateway', 'direto', 'patrocinio', 'outro'] as const;
export const ESTAGIOS_DO_PRODUTO = ['ideia', 'validacao', 'mvp', 'em_uso', 'crescimento', 'pausado', 'descontinuado'] as const;

/** `produto_estagio_historico` (16 §4.7). `checklist` e a atividade guardam a revisão pedida ao descontinuar (RN-07.08). */
export const esquemaEstagioHistorico = esquemaControle.extend({
  produto_id: z.string().min(1),
  estagio_anterior: z.enum(ESTAGIOS_DO_PRODUTO).nullable(),
  estagio_novo: z.enum(ESTAGIOS_DO_PRODUTO),
  data: z.iso.date(),
  criterio: z.string().trim().min(1),
  metrica: texto,
  resultado: texto,
  decisao_id: z.string().min(1),
  atividade_encerramento_id: texto.default(null),
  checklist: z.array(z.string()).default([]),
});

export type EstagioHistorico = z.infer<typeof esquemaEstagioHistorico>;

/** `objetivo` (16 §4.7). */
export const esquemaObjetivo = esquemaControle.extend({
  produto_id: z.string().min(1),
  titulo: z.string().trim().min(1),
  metrica: texto,
  meta: texto,
  prazo: dia,
  situacao: z.enum(['aberto', 'atingido', 'nao_atingido', 'cancelado']),
  responsavel_id: z.string().min(1),
});

export type Objetivo = z.infer<typeof esquemaObjetivo>;

/** `oferta` (16 §4.7). A situação gravada é a da última ação: a que vale na tela vem de `situacaoDaOferta`, pela data (RN-07.07). */
export const esquemaOferta = esquemaControle.extend({
  codigo: z.string().min(1),
  produto_id: z.string().min(1),
  nome: z.string().trim().min(1),
  tipo: z.enum(TIPOS_DE_OFERTA),
  publico: z.enum(PUBLICOS_DE_OFERTA),
  descricao: texto,
  formalizacao: z.enum(FORMALIZACOES_DE_OFERTA),
  periodicidade: z.enum(PERIODICIDADES_DE_PRECO).nullable(),
  exclusoes: texto,
  /** SLA é da F2 (M12). */
  sla_regra_id: texto,
  situacao: z.enum(['em_estudo', 'aprovada', 'inativa']),
  // Campos de T07.04 para o contrato SaaS (19 §8). Vazio é pendência, nunca um padrão.
  regras_uso: texto,
  suporte_canal: texto,
  suporte_horario: texto,
  suporte_prazo_critico: texto,
  suporte_prazo_normal: texto,
  disponibilidade_meta: z.number().min(0).max(100).nullable(),
  disponibilidade_compensacao: texto,
  teste_dias: z.int().nonnegative().nullable(),
  /** Ofertas de adicional vinculadas a este plano, do mesmo produto. */
  adicionais_ids: z.array(z.string().min(1)),
});

export type Oferta = z.infer<typeof esquemaOferta>;

export const SITUACOES_DA_CONFIGURACAO = ['rascunho', 'em_validacao', 'validada', 'substituida'] as const;
export const MODALIDADES_DE_ACESSO = ['Navegador', 'Android', 'iOS'] as const;
export const FORMATOS_DE_EXPORTACAO = ['CSV', 'XLSX', 'PDF', 'JSON'] as const;

const inteiroOuVazio = z.int().nonnegative().nullable();

/** T07.10 (19 §4): configuração contratual do produto, versionada (RN-11.30). Texto vazio é pendência. */
export const esquemaConfiguracaoContratual = esquemaControle.extend({
  produto_id: z.string().min(1),
  versao: z.int().positive(),
  situacao: z.enum(SITUACOES_DA_CONFIGURACAO),
  nome_maiusculo: texto,
  descricao_contratual: texto,
  funcoes_de_apoio: texto,
  modalidades: z.array(z.enum(MODALIDADES_DE_ACESSO)),
  diferencas_modalidades: texto,
  /** Oferta do tipo Gratuidade do mesmo produto. */
  plano_apos_teste: texto,
  url_termos: texto,
  url_privacidade: texto,
  url_ajuda: texto,
  email_contato: texto,
  prazo_reembolso_dias: inteiroOuVazio,
  aviso_alteracao_dias: inteiroOuVazio,
  aviso_renovacao_anual_dias: inteiroOuVazio,
  aviso_manutencao_horas: inteiroOuVazio,
  aviso_suboperador_dias: inteiroOuVazio,
  prazo_encaminhar_titular_dias: inteiroOuVazio,
  prazo_aviso_incidente_horas: inteiroOuVazio,
  prazo_reativacao_horas: inteiroOuVazio,
  aviso_resilicao_dias: inteiroOuVazio,
  prazo_cura_dias: inteiroOuVazio,
  aviso_cessao_dias: inteiroOuVazio,
  prazo_exportacao_dias: inteiroOuVazio,
  prazo_exclusao_dias: inteiroOuVazio,
  prazo_expurgo_backup_dias: inteiroOuVazio,
  formatos_exportacao: z.array(z.enum(FORMATOS_DE_EXPORTACAO)),
  categorias_dados_operador: texto,
  categorias_titulares: texto,
  categorias_dados_controlador: texto,
  provedor_infraestrutura: texto,
  local_armazenamento: texto,
  transferencia_internacional_texto: texto,
  suboperadores: z.array(z.object({ nome: z.string().trim().min(1), finalidade: z.string().trim(), pais: z.string().trim() })),
  medidas_seguranca: texto,
  backup_frequencia: texto,
  backup_retencao_dias: inteiroOuVazio,
  procedimento_recuperacao: texto,
  canal_privacidade: texto,
  canal_incidentes: texto,
  enviado_por: texto,
  enviado_em: z.string().nullable(),
  validado_por: texto,
  validado_em: z.string().nullable(),
  devolucao_motivo: texto,
});

export type ConfiguracaoContratualRegistro = z.infer<typeof esquemaConfiguracaoContratual>;

/** `oferta_recurso` (16 §4.7): base do "Contratadas × Disponíveis" de M10 e M11. */
export const esquemaOfertaRecurso = esquemaControle.extend({
  oferta_id: z.string().min(1),
  nome: z.string().trim().min(1),
  incluido: z.boolean(),
  limite: texto,
  planejado: z.boolean(),
  disponivel_previsto_em: dia,
  observacao: texto,
  ordem: z.int().nonnegative(),
});

export type OfertaRecurso = z.infer<typeof esquemaOfertaRecurso>;

/** `canal_venda` (16 §4.7). Taxas vazias não são zero: são "não informado" (RN-07.09 e RT-08). */
export const esquemaCanalVenda = esquemaControle.extend({
  nome: z.string().trim().min(1),
  tipo: z.enum(TIPOS_DE_CANAL),
  taxa_percentual: z.number().min(0).max(100).nullable(),
  taxa_fixa: valorOuVazio,
  taxa_fixa_moeda: moeda.nullable(),
  prazo_repasse_dias: z.int().nonnegative().nullable(),
  moeda_repasse: moeda.nullable(),
  observacao: texto,
  verificado_em: dia,
  fonte_url: texto,
  situacao: z.enum(['ativo', 'inativo']),
});

export type CanalVenda = z.infer<typeof esquemaCanalVenda>;

/** O canal como estava na hora do cálculo: mudar a taxa depois não muda a simulação salva (RN-07.15). */
export const esquemaCanalDaSimulacao = z.object({
  canal_id: z.string().min(1),
  nome: z.string().min(1),
  taxa_percentual: z.number().min(0).max(100).nullable(),
  /** Em reais. Taxa em outra moeda só entra convertida (RT-07). */
  taxa_fixa: valorOuVazio,
  taxa_fixa_original: valorOuVazio,
  taxa_fixa_moeda: moeda.nullable(),
  cambio: z.number().positive().nullable(),
  verificado_em: dia,
  fonte_url: texto,
});

export type CanalDaSimulacao = z.infer<typeof esquemaCanalDaSimulacao>;

/** Todas as entradas, com vazio ≠ zero. `cf_calculado` é a média de RN-07.11 no momento do cálculo. */
export const esquemaPremissas = z.object({
  moeda: z.literal('BRL'),
  periodicidade: z.enum(PERIODICIDADES_DE_PRECO),
  cf: valorOuVazio,
  cf_calculado: valorOuVazio,
  cf_justificativa: texto,
  cv: valorOuVazio,
  tributos_pct: z.number().min(0).max(100).nullable(),
  margem_pct: z.number().min(0).max(100).nullable(),
  incluir_horas: z.boolean(),
  horas: valorOuVazio,
  valor_hora: valorOuVazio,
  canais: z.array(esquemaCanalDaSimulacao).max(4),
  volumes: z.array(z.int().positive()).max(5),
  preco_teste: valorOuVazio,
  principal: z.object({ canal_id: z.string().min(1), volume: z.int().positive() }).nullable(),
});

export type Premissas = z.infer<typeof esquemaPremissas>;

const numero = z.number().nullable();

export const esquemaLinhaDeResultado = z.object({
  canal_id: z.string(),
  volume: z.int(),
  preco_sugerido: numero,
  piso: numero,
  receita_liquida: numero,
  margem_contribuicao: numero,
  resultado_mensal: numero,
  markup: numero,
});

export type LinhaDeResultado = z.infer<typeof esquemaLinhaDeResultado>;

export const esquemaResultados = z.object({
  /** Canais em que taxas, tributos e margem somam 100% ou mais (RN-07.12). */
  bloqueios: z.array(z.object({ canal_id: z.string(), mensagem: z.string() })),
  /** "custo variável", "valor-hora": o que falta para os campos dependentes (RN-07.16). */
  faltas: z.array(z.string()),
  linhas: z.array(esquemaLinhaDeResultado),
  equilibrio: z.array(z.object({ canal_id: z.string(), clientes: z.int().nullable(), situacao: z.enum(['calculado', 'sem_equilibrio', 'falta', 'bloqueado']) })),
});

export type Resultados = z.infer<typeof esquemaResultados>;

/** `simulacao` (16 §4.7): premissas e resultados congelados. Recalcular cria outra linha (RN-07.15). */
export const esquemaSimulacao = esquemaControle.extend({
  codigo: z.string().min(1),
  produto_id: z.string().min(1),
  oferta_id: texto,
  nome: z.string().trim().min(1),
  versao: z.int().positive(),
  premissas: esquemaPremissas,
  resultados: esquemaResultados,
  observacao: texto,
  simulacao_anterior_id: texto,
});

export type Simulacao = z.infer<typeof esquemaSimulacao>;

/** `preco_versao` (16 §4.7). Sem canal, vale para todos. `valor` vazio é "Não definido", e nunca zero (RN-07.02). */
export const esquemaPrecoVersao = esquemaControle.extend({
  oferta_id: z.string().min(1),
  canal_id: texto,
  versao: z.int().positive(),
  valor: valorOuVazio,
  moeda,
  periodicidade: z.enum(PERIODICIDADES_DE_PRECO),
  valido_de: dia,
  valido_ate: dia,
  situacao: z.enum(['rascunho', 'aprovada', 'substituida']),
  simulacao_id: texto,
  decisao_id: texto,
  aprovado_por: texto,
  aprovado_em: z.iso.datetime().nullable(),
  justificativa_excecao: texto,
  /** O que estava valendo na aprovação (RT-10). */
  snapshot: z.record(z.string(), z.unknown()).nullable(),
});

export type PrecoVersao = z.infer<typeof esquemaPrecoVersao>;

/** `concorrente_referencia` (16 §4.7): lista opcional do simulador, por produto. */
export const esquemaConcorrente = esquemaControle.extend({
  produto_id: z.string().min(1),
  nome: z.string().trim().min(1),
  preco: valorOuVazio,
  moeda: moeda.nullable(),
  periodicidade: z.enum(PERIODICIDADES_DE_PRECO).nullable(),
  link: texto,
  data: dia,
});

export type Concorrente = z.infer<typeof esquemaConcorrente>;

/** `kpi_definicao` (16 §4.7), só os personalizados (até 5 por produto). Os padrão ficam em `dominio/kpis.ts`. */
export const esquemaKpiDefinicao = esquemaControle.extend({
  produto_id: z.string().min(1),
  /** `codigo` em 16; aqui `kpi_codigo`, porque `codigo` é o código legível que o repositório preenche (RT-01). */
  kpi_codigo: z.string().min(1),
  nome: z.string().trim().min(1),
  unidade: texto,
  definicao: texto,
  ordem: z.int().nonnegative(),
});

export type KpiDefinicao = z.infer<typeof esquemaKpiDefinicao>;

/**
 * `kpi_mensal`: um registro por produto e competência (RN-07.10), com os valores por código. Em 16 há uma
 * linha por KPI; o formulário, a fonte e as observações são do mês inteiro (Mapa, "A revisar por Kimberly").
 */
export const esquemaKpiMensal = esquemaControle.extend({
  produto_id: z.string().min(1),
  competencia: z.iso.date(),
  valores: z.record(z.string(), z.number().nullable()),
  observacao: texto,
  fonte_url: texto,
});

export type KpiMensal = z.infer<typeof esquemaKpiMensal>;
