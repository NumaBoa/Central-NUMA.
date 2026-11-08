import type { z } from 'zod';
import { esquemaAcordo, esquemaAcordoAssinatura, esquemaAcordoVersao, esquemaConstituicaoItem, esquemaMarcaPesquisa, esquemaMarcaPrazo, esquemaMarcaProcesso, esquemaObrigacao, esquemaObrigacaoOcorrencia, esquemaParticipacaoHistorico, esquemaReuniao, esquemaReuniaoParticipante, esquemaSocia } from './tipos/sociedade';

/** Tabelas do M06 (16 §4.6), à parte como as da F1. `decisao` já existe, desde o M07. */
export const TABELAS_M06 = {
  socia: { rotulo: 'Sócias', esquema: esquemaSocia },
  socia_participacao_historico: { rotulo: 'Histórico de participação', esquema: esquemaParticipacaoHistorico },
  acordo_societario: { rotulo: 'Acordos societários', esquema: esquemaAcordo },
  acordo_versao: { rotulo: 'Versões de acordos', esquema: esquemaAcordoVersao },
  acordo_assinatura: { rotulo: 'Confirmações de assinatura', esquema: esquemaAcordoAssinatura },
  marca_pesquisa: { rotulo: 'Pesquisas de marca', esquema: esquemaMarcaPesquisa },
  marca_processo: { rotulo: 'Processos de marca', esquema: esquemaMarcaProcesso },
  marca_prazo: { rotulo: 'Prazos de marca', esquema: esquemaMarcaPrazo },
  constituicao_item: { rotulo: 'Checklist de constituição', esquema: esquemaConstituicaoItem },
  obrigacao_corporativa: { rotulo: 'Obrigações corporativas', esquema: esquemaObrigacao },
  obrigacao_corporativa_ocorrencia: { rotulo: 'Ocorrências de obrigações', esquema: esquemaObrigacaoOcorrencia },
  reuniao: { rotulo: 'Reuniões', esquema: esquemaReuniao },
  reuniao_participante: { rotulo: 'Participantes das reuniões', esquema: esquemaReuniaoParticipante },
} as const satisfies Record<string, { rotulo: string; esquema: z.ZodType }>;

export const NOMES_TABELAS_M06 = Object.keys(TABELAS_M06) as (keyof typeof TABELAS_M06)[];

/** Partes de outro registro, ou itens de um checklist (como `checklist_item`): ficam fora da contagem de cadastros. */
export const TABELAS_M06_FORA_DA_CONTAGEM = ['socia_participacao_historico', 'acordo_versao', 'acordo_assinatura', 'marca_prazo', 'constituicao_item', 'obrigacao_corporativa_ocorrencia', 'reuniao_participante'] as const;
