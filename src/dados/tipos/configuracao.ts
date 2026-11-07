import { z } from 'zod';
import { FASES } from '@/dominio/navegacao';
import { ID_CAMILA } from '../exemplos/base';
import { FUSO_PADRAO, FUSOS } from '../fuso';
import { esquemaControle } from './controle';

const dias = z.int().nonnegative();

/**
 * Chaves de `configuracao` (16 §4.1) usadas na F0a e o valor aceito em cada uma. As chaves das
 * outras fases entram junto com as telas delas (RT-23).
 */
export const ESQUEMAS_DAS_CHAVES = {
  organizacao_nome: z.string().trim().min(1),
  organizacao_logo_url: z.string().nullable(),
  organizacao_email: z.email().nullable(),
  fuso: z.enum(FUSOS),
  moeda_padrao: z.string().regex(/^[A-Z]{3}$/),
  uf_padrao: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  municipio_padrao: z.string().min(1).nullable(),
  fase_ativa: z.enum(FASES),
  alerta_vencimento_dias: dias,
  alerta_renovacao_ferramenta_dias: dias,
  alerta_fim_teste_dias: dias,
  alerta_dominio_dias: dias,
  /** Regra fixa: comprovante sempre obrigatório, com exceção justificada na baixa (D17). */
  comprovante_obrigatorio: z.literal(true),
  responsavel_backup_id: z.uuid(),
  // M09 e M10: chaves de 16 §4.2. Sem padrão inventado: encarregado, canal e prazo do titular começam vazios.
  encarregado_pessoa_id: z.uuid().nullable(),
  canal_titular_email: z.email().nullable(),
  prazo_resposta_titular_dias: dias.nullable(),
  validade_proposta_dias: dias,
};

export const esquemaValoresConfiguracao = z.object(ESQUEMAS_DAS_CHAVES);

export type ValoresConfiguracao = z.infer<typeof esquemaValoresConfiguracao>;
export type ChaveConfiguracao = keyof ValoresConfiguracao;

/** Padrões de T02.01. E-mail e logotipo não informados ficam vazios, nunca inventados. */
export const VALORES_PADRAO: ValoresConfiguracao = {
  organizacao_nome: 'Numa',
  organizacao_logo_url: null,
  organizacao_email: null,
  fuso: FUSO_PADRAO,
  moeda_padrao: 'BRL',
  uf_padrao: 'RJ',
  municipio_padrao: 'Rio de Janeiro',
  fase_ativa: 'f0a',
  alerta_vencimento_dias: 3,
  alerta_renovacao_ferramenta_dias: 15,
  alerta_fim_teste_dias: 3,
  alerta_dominio_dias: 45,
  comprovante_obrigatorio: true,
  responsavel_backup_id: ID_CAMILA,
  encarregado_pessoa_id: null,
  canal_titular_email: null,
  prazo_resposta_titular_dias: null,
  validade_proposta_dias: 15,
};

/** O nome de cada chave na tela e no histórico, e o texto da coluna `descricao`. */
export const CATALOGO_CONFIGURACAO: Record<ChaveConfiguracao, { rotulo: string; descricao: string }> = {
  organizacao_nome: { rotulo: 'Nome da organização', descricao: 'Nome da organização.' },
  organizacao_logo_url: { rotulo: 'Link do logotipo', descricao: 'Logotipo usado em e-mails e documentos.' },
  organizacao_email: { rotulo: 'E-mail institucional', descricao: 'Conta Gmail da Numa.' },
  fuso: { rotulo: 'Fuso horário', descricao: 'Define o "hoje" do sistema (RT-06).' },
  moeda_padrao: { rotulo: 'Moeda padrão', descricao: 'Moeda sugerida nos novos registros.' },
  uf_padrao: { rotulo: 'Estado dos feriados', descricao: 'Estado padrão do calendário de feriados (D16).' },
  municipio_padrao: { rotulo: 'Município dos feriados', descricao: 'Município padrão do calendário de feriados (D16).' },
  fase_ativa: { rotulo: 'Fase ativa', descricao: 'Fase em que a Numa está (RT-23).' },
  alerta_vencimento_dias: { rotulo: 'Vencimentos financeiros', descricao: 'Antecedência, em dias, do alerta de vencimento.' },
  alerta_renovacao_ferramenta_dias: { rotulo: 'Renovação de ferramentas', descricao: 'Antecedência, em dias, do alerta de renovação.' },
  alerta_fim_teste_dias: { rotulo: 'Fim de períodos de teste', descricao: 'Antecedência, em dias, do alerta de fim de teste.' },
  alerta_dominio_dias: { rotulo: 'Vencimento de domínios', descricao: 'Antecedência, em dias, do alerta de domínio.' },
  comprovante_obrigatorio: { rotulo: 'Comprovante obrigatório em baixas', descricao: 'Regra fixa (D17 e RN-05.12).' },
  responsavel_backup_id: { rotulo: 'Responsável pelo backup semanal', descricao: 'Pessoa que faz o backup semanal.' },
  encarregado_pessoa_id: { rotulo: 'Encarregado de dados (DPO)', descricao: 'Exigido para publicar a Política de Privacidade (RN-09.04).' },
  canal_titular_email: { rotulo: 'Canal do titular', descricao: 'E-mail para pedidos de titulares (RN-09.04).' },
  prazo_resposta_titular_dias: { rotulo: 'Prazo de resposta ao titular (dias)', descricao: 'Vazio: o prazo fica pendente em cada solicitação (M09 §5).' },
  validade_proposta_dias: { rotulo: 'Validade das propostas (dias)', descricao: 'Padrão de novas propostas (D22).' },
};

export const CHAVES_CONFIGURACAO = Object.keys(ESQUEMAS_DAS_CHAVES) as ChaveConfiguracao[];

export function chaveConhecida(chave: string): chave is ChaveConfiguracao {
  return Object.hasOwn(ESQUEMAS_DAS_CHAVES, chave);
}

/** `configuracao` (16 §4.1): uma linha por chave. O valor é conferido conforme a chave. */
export const esquemaConfiguracao = esquemaControle
  .extend({
    chave: z.string().min(1),
    valor: z.json(),
    descricao: z.string().nullable(),
  })
  .superRefine((linha, contexto) => {
    if (chaveConhecida(linha.chave) && !ESQUEMAS_DAS_CHAVES[linha.chave].safeParse(linha.valor).success) {
      contexto.addIssue({ code: 'custom', path: ['valor'], message: `Valor inválido para ${linha.chave}.` });
    }
  });

export type Configuracao = z.infer<typeof esquemaConfiguracao>;
