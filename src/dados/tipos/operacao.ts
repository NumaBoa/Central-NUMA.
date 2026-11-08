import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const instante = z.iso.datetime().nullable();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// ---------- Enumerações (16 §2) ----------

export const SITUACOES_IMPLANTACAO = ['nao_iniciada', 'em_andamento', 'em_validacao', 'entregue', 'acompanhamento', 'concluida', 'suspensa', 'cancelada'] as const;
export const MARCOS_IMPLANTACAO = ['inicio', 'configuracao', 'validacao', 'entrega', 'acompanhamento'] as const;
export const TIPOS_SUPORTE = ['falha', 'duvida', 'melhoria_incluida', 'novo_escopo'] as const;
export const SITUACOES_SUPORTE = ['aberta', 'em_atendimento', 'aguardando_cliente', 'aguardando_proposta', 'resolvida', 'fechada', 'cancelada'] as const;
export const PRIORIDADES_SUPORTE = ['baixa', 'normal', 'alta', 'critica'] as const;
export const CONTAGENS_SLA = ['horas_uteis', 'horas_corridas'] as const;
export const IMPACTOS_INCIDENTE = ['total', 'parcial', 'degradado'] as const;
export const CANAIS_SUPORTE = ['email', 'whatsapp', 'loja', 'formulario'] as const;
export const CATEGORIAS_ITEM_NOTA = ['novidade', 'melhoria', 'correcao'] as const;
export const PUBLICOS_NOTA = ['interno', 'clientes', 'todos'] as const;
export const CANAIS_NOTA = ['loja', 'email', 'site'] as const;
/** Registros a que uma hora apontada pode se ligar (RN-12.12). */
export const REGISTROS_DAS_HORAS = ['implantacao', 'contrato', 'solicitacao_suporte', 'atividade'] as const;

/**
 * `implantacao` (IMP, 16 §4.12). A entrega contratual não é copiada: vem da regra de prazo do contrato,
 * sempre atual e só para leitura (RN-12.02). Planejada e realizada espelham o marco Entrega.
 * A situação é calculada pelos marcos e gravada junto, para os filtros e a exportação.
 */
export const esquemaImplantacao = esquemaControle.extend({
  codigo: z.string().min(1),
  contrato_id: z.string().min(1),
  /** A versão do contrato de onde vieram o escopo e os critérios de aceite. */
  versao_id: z.string().min(1),
  produto_id: z.string().min(1),
  contraparte_id: z.string().min(1),
  responsavel_id: z.string().min(1),
  situacao: z.enum(SITUACOES_IMPLANTACAO),
  entrega_planejada: dia,
  entrega_realizada: dia,
  horas_estimadas: z.number().nonnegative().nullable(),
  prazo_estimado_dias: z.number().int().positive().nullable(),
  aceite_em: dia,
  aceite_por_texto: texto,
  aceite_evidencia_url: texto,
  /** Suspensa ou cancelada: o motivo é obrigatório, e retomar volta à situação dos marcos. */
  interrupcao: z.object({ tipo: z.enum(['suspensa', 'cancelada']), motivo: z.string().min(1), em: z.iso.date() }).nullable(),
  concluida_em: dia,
  observacoes: texto,
});
export type Implantacao = z.infer<typeof esquemaImplantacao>;

export const esquemaImplantacaoMarco = esquemaControle.extend({
  implantacao_id: z.string().min(1),
  marco: z.enum(MARCOS_IMPLANTACAO),
  planejado_em: dia,
  realizado_em: dia,
  nao_se_aplica: z.boolean(),
  observacao: texto,
});
export type ImplantacaoMarco = z.infer<typeof esquemaImplantacaoMarco>;

/**
 * `sla_regra`: uma linha por prioridade, de uma oferta (padrão) ou de um contrato (exceção). Canal, horário
 * prometido, meta de disponibilidade e compensação da oferta ficam na própria oferta (M07): aqui, só o que
 * a conta do prazo precisa, e a exceção do contrato.
 */
export const esquemaSlaRegra = esquemaControle
  .extend({
    oferta_id: texto,
    contrato_id: texto,
    prioridade: z.enum(PRIORIDADES_SUPORTE),
    resposta_horas: z.number().positive(),
    resolucao_horas: z.number().positive(),
    contagem: z.enum(CONTAGENS_SLA),
    horario_inicio: hora.nullable(),
    horario_fim: hora.nullable(),
    disponibilidade_minima: z.number().min(0).max(100).nullable(),
    creditos: texto,
  })
  .refine((regra) => Boolean(regra.oferta_id) !== Boolean(regra.contrato_id), { message: 'A regra é de uma oferta ou de um contrato.' });
export type SlaRegra = z.infer<typeof esquemaSlaRegra>;

/** O SLA congelado na abertura (RN-12.08): mudar a regra depois não muda o prazo de quem já abriu. */
export const esquemaSlaAplicado = z.object({
  regra_id: z.string().min(1),
  origem: z.enum(['oferta', 'contrato']),
  resposta_horas: z.number().positive(),
  resolucao_horas: z.number().positive(),
  contagem: z.enum(CONTAGENS_SLA),
  horario_inicio: hora,
  horario_fim: hora,
});
export type SlaAplicado = z.infer<typeof esquemaSlaAplicado>;

/** `solicitacao_suporte` (SUP). Os prazos são calculados na abertura; as pausas os empurram. */
export const esquemaSolicitacaoSuporte = esquemaControle.extend({
  codigo: z.string().min(1),
  contraparte_id: texto,
  /** Usuário final sem cadastro: nome e contato livres (T12.03). */
  solicitante_texto: texto,
  contato_pessoa_id: texto,
  produto_id: z.string().min(1),
  contrato_id: texto,
  tipo: z.enum(TIPOS_SUPORTE),
  prioridade: z.enum(PRIORIDADES_SUPORTE),
  canal: z.enum(CANAIS_SUPORTE).nullable(),
  titulo: z.string().trim().min(1),
  descricao: texto,
  situacao: z.enum(SITUACOES_SUPORTE),
  responsavel_id: z.string().min(1),
  aberta_em: z.iso.datetime(),
  sla: esquemaSlaAplicado.nullable(),
  prazo_resposta_em: instante,
  prazo_resolucao_em: instante,
  primeira_resposta_em: instante,
  resolvida_em: instante,
  fechada_em: instante,
  pausas: z.array(z.object({ inicio: z.iso.datetime(), fim: instante })),
  solucao: texto,
  oportunidade_id: texto,
  incidente_id: texto,
  nota_id: texto,
  cancelada_motivo: texto,
});
export type SolicitacaoSuporte = z.infer<typeof esquemaSolicitacaoSuporte>;

export const esquemaSuporteInteracao = esquemaControle.extend({
  solicitacao_id: z.string().min(1),
  autor_id: z.string().min(1),
  tipo: z.enum(['resposta', 'nota_interna', 'mudanca']),
  texto: texto,
  ocorrido_em: z.iso.datetime(),
});
export type SuporteInteracao = z.infer<typeof esquemaSuporteInteracao>;

/**
 * `incidente_disponibilidade` (INC). O incidente de segurança (M09, T09.05) ficou fora do que será construído:
 * a pergunta sobre dados pessoais fica registrada, e o vínculo espera a tela existir.
 */
export const esquemaIncidenteDisponibilidade = esquemaControle.extend({
  codigo: z.string().min(1),
  produto_id: z.string().min(1),
  titulo: z.string().trim().min(1),
  inicio: z.iso.datetime(),
  fim: instante,
  impacto: z.enum(IMPACTOS_INCIDENTE),
  causa: texto,
  acoes: texto,
  comunicado: z.boolean(),
  comunicado_em: instante,
  canal: texto,
  envolve_dados_pessoais: z.boolean().nullable(),
  incidente_seguranca_id: texto,
  responsavel_id: z.string().min(1),
});
export type IncidenteDisponibilidade = z.infer<typeof esquemaIncidenteDisponibilidade>;

/** `apontamento_horas` (RN-12.12): múltiplos de 0,25. O produto vazio é a Numa institucional. */
export const esquemaApontamentoHoras = esquemaControle
  .extend({
    pessoa_id: z.string().min(1),
    data: z.iso.date(),
    horas: z.number().positive().max(24),
    produto_id: texto,
    registro_tipo: z.enum(REGISTROS_DAS_HORAS).nullable(),
    registro_id: texto,
    descricao: texto,
  })
  .refine((linha) => Number.isInteger(linha.horas * 4), { message: 'As horas vão de 0,25 em 0,25.', path: ['horas'] })
  .refine((linha) => Boolean(linha.registro_tipo) === Boolean(linha.registro_id), { message: 'O vínculo precisa do tipo e do registro.', path: ['registro_id'] });
export type ApontamentoHoras = z.infer<typeof esquemaApontamentoHoras>;

/** `nota_liberacao` (REL). Única por produto e versão. */
export const esquemaNotaLiberacao = esquemaControle.extend({
  codigo: z.string().min(1),
  produto_id: z.string().min(1),
  versao: z.string().trim().min(1),
  data: dia,
  publico: z.enum(PUBLICOS_NOTA),
  situacao: z.enum(['rascunho', 'publicada']),
  publicada_em: instante,
  publicada_por: texto,
  canais: z.array(z.enum(CANAIS_NOTA)),
  /** Onde e quando foi comunicada (T12.07), além dos canais. */
  comunicacao_observacao: texto,
  resumo: texto,
});
export type NotaLiberacao = z.infer<typeof esquemaNotaLiberacao>;

export const esquemaNotaLiberacaoItem = esquemaControle.extend({
  nota_id: z.string().min(1),
  categoria: z.enum(CATEGORIAS_ITEM_NOTA),
  texto: z.string().trim().min(1),
  origem_tipo: z.enum(['solicitacao_suporte', 'atividade']).nullable(),
  origem_id: texto,
  ordem: z.number().int().nonnegative(),
});
export type NotaLiberacaoItem = z.infer<typeof esquemaNotaLiberacaoItem>;
