import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();

/*
 * Tabelas do M06 (16 §4.6). Os nomes seguem o 16; o que foi acrescentado está dito em cada esquema
 * e registrado no Mapa ("A revisar por Kimberly").
 */

/**
 * `socia`: a participação cadastrada de cada sócia (RN-06.01). `entrada_em` é obrigatória no 16, mas a data
 * real só Kimberly sabe: fica vazia até alguém preencher, nunca inventada (RT-08). `decisao_id` acompanha
 * `acordo_versao_id`: o fundamento pode ser um acordo ou uma decisão (T06.02).
 */
export const esquemaSocia = esquemaControle.extend({
  pessoa_id: z.string().min(1),
  participacao: z.number().min(0).max(100),
  entrada_em: dia,
  saida_em: dia,
  acordo_versao_id: texto,
  decisao_id: texto,
  dedicacao: texto,
});
export type Socia = z.infer<typeof esquemaSocia>;

/** `socia_participacao_historico`: uma linha por sócia a cada mudança, com o fundamento. */
export const esquemaParticipacaoHistorico = esquemaControle.extend({
  pessoa_id: z.string().min(1),
  participacao: z.number().min(0).max(100),
  vigente_desde: z.iso.date(),
  acordo_versao_id: texto,
  decisao_id: texto,
});
export type ParticipacaoHistorico = z.infer<typeof esquemaParticipacaoHistorico>;

export const TIPOS_DE_ACORDO = ['memorando', 'acordo_socias', 'ata', 'cessao_pi', 'alteracao_contratual', 'outro'] as const;
export const SITUACOES_DA_VERSAO = ['rascunho', 'em_revisao', 'aguardando_assinaturas', 'vigente', 'substituida', 'cancelada'] as const;

/** `acordo_societario` (ACO). */
export const esquemaAcordo = esquemaControle.extend({
  codigo: z.string().min(1),
  titulo: z.string().trim().min(1),
  tipo: z.enum(TIPOS_DE_ACORDO),
  versao_vigente_id: texto,
});
export type Acordo = z.infer<typeof esquemaAcordo>;

/**
 * O resumo estruturado (RN-06.05). Os valores por sócia vão em listas: participação e aporte em número, dedicação em
 * texto. `partes` não está no 16; é o campo "Partes" de T06.03, obrigatório para Vigente.
 */
export const esquemaResumoDoAcordo = z.object({
  partes: z.array(z.string()),
  parte_entidade_id: texto,
  participacao: z.array(z.object({ pessoa_id: z.string(), percentual: z.number().min(0).max(100) })),
  aportes: texto,
  aportes_valores: z.array(z.object({ pessoa_id: z.string(), valor: z.number().nonnegative() })),
  dedicacao: z.array(z.object({ pessoa_id: z.string(), texto: z.string() })),
  decisao: texto,
  destino_produtos: texto,
  saida: texto,
  observacoes: texto,
});
export type ResumoDoAcordo = z.infer<typeof esquemaResumoDoAcordo>;

/** `acordo_versao`. Só uma vigente por acordo (RN-06.03); vigente exige arquivo, data e as confirmações (RN-06.04). */
export const esquemaAcordoVersao = esquemaControle
  .extend({
    acordo_id: z.string().min(1),
    numero: z.number().int().positive(),
    situacao: z.enum(SITUACOES_DA_VERSAO),
    resumo: esquemaResumoDoAcordo,
    titularidade_numa: z.boolean(),
    arquivo_url: texto,
    data_assinatura: dia,
    revisao_prevista: dia,
    validacao_id: texto,
    cancelada_motivo: texto,
  })
  .superRefine((versao, contexto) => {
    if (versao.situacao === 'vigente' && (!versao.arquivo_url || !versao.data_assinatura)) contexto.addIssue({ code: 'custom', path: ['situacao'], message: 'Versão vigente exige o arquivo assinado e a data de assinatura.' });
  });
export type AcordoVersao = z.infer<typeof esquemaAcordoVersao>;

/** `acordo_assinatura`: cada sócia confirma a própria (RN-06.04). Na etapa local, quem está em "Você é". */
export const esquemaAcordoAssinatura = esquemaControle.extend({
  versao_id: z.string().min(1),
  pessoa_id: z.string().min(1),
  confirmado_em: z.iso.datetime(),
});
export type AcordoAssinatura = z.infer<typeof esquemaAcordoAssinatura>;

export const RESULTADOS_DA_PESQUISA = ['disponivel', 'conflito_possivel', 'indisponivel'] as const;

/** `marca_pesquisa`: registro manual da pesquisa de anterioridade (RN-06.08). */
export const esquemaMarcaPesquisa = esquemaControle.extend({
  marca_id: z.string().min(1),
  data: z.iso.date(),
  feita_por: z.string().min(1),
  bases: texto,
  resultado: z.enum(RESULTADOS_DA_PESQUISA),
  observacoes: texto,
  evidencia_url: texto,
});
export type MarcaPesquisa = z.infer<typeof esquemaMarcaPesquisa>;

export const APRESENTACOES_DA_MARCA = ['nominativa', 'mista', 'figurativa'] as const;
export const SITUACOES_DO_PROCESSO = ['planejado', 'protocolado', 'em_exame', 'publicado', 'oposicao', 'exigencia', 'deferido', 'registrado', 'indeferido', 'arquivado'] as const;

/** `marca_processo`: um por classe ou grupo de classes. Número e depósito a partir de Protocolado (T06.05). */
export const esquemaMarcaProcesso = esquemaControle
  .extend({
    marca_id: z.string().min(1),
    classes: z.string().trim().min(1),
    apresentacao: z.enum(APRESENTACOES_DA_MARCA),
    titular_entidade_id: texto,
    numero_processo: texto,
    data_deposito: dia,
    situacao: z.enum(SITUACOES_DO_PROCESSO),
    procurador_id: texto,
    observacoes: texto,
  })
  .superRefine((processo, contexto) => {
    if (processo.situacao !== 'planejado' && (!processo.numero_processo || !processo.data_deposito)) contexto.addIssue({ code: 'custom', path: ['numero_processo'], message: 'A partir de Protocolado, o processo precisa do número e da data do depósito.' });
  });
export type MarcaProcesso = z.infer<typeof esquemaMarcaProcesso>;

/** `marca_prazo`: cadastrado à mão, sem consulta ao INPI (RN-06.09). */
export const esquemaMarcaPrazo = esquemaControle.extend({
  processo_id: z.string().min(1),
  descricao: z.string().trim().min(1),
  data_limite: z.iso.date(),
  responsavel_id: z.string().min(1),
  cumprido_em: dia,
});
export type MarcaPrazo = z.infer<typeof esquemaMarcaPrazo>;

export const SITUACOES_DO_ITEM = ['a_fazer', 'em_andamento', 'concluido', 'nao_se_aplica'] as const;
/** O tipo de evidência da coluna "Exige evidência" de T06.06: link, acordo vigente, decisão ou o próprio T06.04. */
export const EVIDENCIAS_DO_ITEM = ['arquivo', 'acordo', 'decisao', 'ativos'] as const;
/** "Ambas" e "Contador" da coluna "Responsável padrão" de T06.06: não cabem num único `responsavel_id`. */
export const RESPONSAVEIS_DO_ITEM = ['pessoa', 'ambas', 'contador'] as const;

/**
 * `constituicao_item` (RN-06.10). Acréscimos ao 16: `chave` (o item padrão, para as integrações de RN-06.11),
 * `evidencia_tipo`, `evidencia_registro_id` (o acordo ou a decisão que servem de evidência), `responsavel_tipo`
 * e `motivo_reabertura` não existem lá.
 */
export const esquemaConstituicaoItem = esquemaControle
  .extend({
    ordem: z.number().int().positive(),
    chave: texto,
    titulo: z.string().trim().min(1),
    descricao: texto,
    depende_de: z.array(z.string()),
    exige_evidencia: z.boolean(),
    evidencia_tipo: z.enum(EVIDENCIAS_DO_ITEM).nullable(),
    responsavel_tipo: z.enum(RESPONSAVEIS_DO_ITEM),
    responsavel_id: texto,
    prazo: dia,
    situacao: z.enum(SITUACOES_DO_ITEM),
    evidencia_url: texto,
    evidencia_registro_id: texto,
    motivo_nao_aplica: texto,
    atividade_id: texto,
    concluido_em: dia,
  })
  .superRefine((item, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (item.situacao === 'nao_se_aplica' && !item.motivo_nao_aplica) falha('motivo_nao_aplica', '“Não se aplica” exige o motivo.');
    if (item.situacao === 'concluido' && !item.concluido_em) falha('concluido_em', 'Concluído registra a data.');
    if (item.responsavel_tipo === 'pessoa' && !item.responsavel_id) falha('responsavel_id', 'Escolha a responsável.');
  });
export type ConstituicaoItem = z.infer<typeof esquemaConstituicaoItem>;

export const PERIODICIDADES = ['mensal', 'trimestral', 'anual', 'outra'] as const;
export const SITUACOES_DA_OBRIGACAO = ['rascunho', 'ativa', 'encerrada'] as const;

/**
 * `obrigacao_corporativa` (F1, RN-06.12). `vencimento_base` é o "Próximo vencimento" do formulário: a partir
 * dele saem as ocorrências, mês a mês, de três em três meses ou ano a ano; "Outra" não gera sozinha. `dia` fica
 * como no 16, igual ao dia do vencimento base. Rascunho não gera nada (LEIA-ME do M06).
 */
export const esquemaObrigacao = esquemaControle
  .extend({
    nome: z.string().trim().min(1),
    descricao: texto,
    entidade_id: z.string().min(1),
    orgao: texto,
    periodicidade: z.enum(PERIODICIDADES),
    dia: z.number().int().min(1).max(31).nullable(),
    vencimento_base: z.iso.date(),
    antecedencia_dias: z.number().int().min(0).max(365),
    responsavel_id: z.string().min(1),
    categoria_id: texto,
    gera_titulo: z.boolean(),
    valor_estimado: z.number().positive().nullable(),
    situacao: z.enum(SITUACOES_DA_OBRIGACAO),
  })
  .superRefine((obrigacao, contexto) => {
    if (obrigacao.gera_titulo && !obrigacao.categoria_id) contexto.addIssue({ code: 'custom', path: ['categoria_id'], message: 'Quem gera título precisa da categoria financeira.' });
  });
export type Obrigacao = z.infer<typeof esquemaObrigacao>;

/** `obrigacao_corporativa_ocorrencia`: única por (obrigação, referência). Cumprida exige comprovante. */
export const esquemaObrigacaoOcorrencia = esquemaControle
  .extend({
    obrigacao_id: z.string().min(1),
    referencia: z.iso.date(),
    vencimento: z.iso.date(),
    cumprida_em: dia,
    comprovante_url: texto,
    titulo_id: texto,
    atividade_id: texto,
    observacao: texto,
  })
  .superRefine((ocorrencia, contexto) => {
    if (ocorrencia.cumprida_em && !ocorrencia.comprovante_url) contexto.addIssue({ code: 'custom', path: ['comprovante_url'], message: 'Cumprida exige o comprovante.' });
  });
export type ObrigacaoOcorrencia = z.infer<typeof esquemaObrigacaoOcorrencia>;

/** `reuniao` (REU). A pauta é uma lista de itens. */
export const esquemaReuniao = esquemaControle.extend({
  codigo: z.string().min(1),
  titulo: z.string().trim().min(1),
  data_hora: z.iso.datetime(),
  produto_id: texto,
  pauta: z.array(z.string()),
  notas: texto,
});
export type Reuniao = z.infer<typeof esquemaReuniao>;

export const esquemaReuniaoParticipante = esquemaControle.extend({
  reuniao_id: z.string().min(1),
  pessoa_id: z.string().min(1),
});
export type ReuniaoParticipante = z.infer<typeof esquemaReuniaoParticipante>;
