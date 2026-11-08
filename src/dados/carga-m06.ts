import { chaveDaTabela, driver } from './armazenamento';
import { ID_CAMILA, ID_KIMBERLY } from './exemplos/base';
import { controle } from './exemplos/controle';
import { NOMES_TABELAS_M06 } from './tabelas-m06';
import type { Acordo, AcordoVersao, ConstituicaoItem, Socia } from './tipos/sociedade';

/*
 * Carga inicial do M06: só o que vem da especificação, nada das imagens (LEIA-ME do M06). Não são exemplos:
 * "Limpar exemplos" não mexe nestes registros.
 * - Sócias com 50% cada (D18, 08-M06 §4), sem data de entrada: só Kimberly sabe (RT-08).
 * - O "resumo do memorando" (08-M06 §4): o memorando entre sócias em Rascunho, só com partes e participação.
 * - O checklist padrão de T06.06, editável e a conferir com o contador.
 */

export const ID_MEMORANDO = '6e1a2b3c-4d5e-4f60-8a71-0b2c3d4e5f01';
export const ID_MEMORANDO_V1 = '6e1a2b3c-4d5e-4f60-8a71-0b2c3d4e5f02';
const ID_SOCIA_KIMBERLY = '6e1a2b3c-4d5e-4f60-8a71-0b2c3d4e5f11';
const ID_SOCIA_CAMILA = '6e1a2b3c-4d5e-4f60-8a71-0b2c3d4e5f12';

/** Os ids dos 17 itens padrão, para as dependências apontarem para eles. */
export const idDoItemPadrao = (numero: number) => `7f2b3c4d-5e6f-4a70-9b82-1c3d4e5f6a${String(numero).padStart(2, '0')}`;

export function sociasIniciais(agora: string): Socia[] {
  return [
    { ...controle(ID_SOCIA_KIMBERLY, false, agora), pessoa_id: ID_KIMBERLY, participacao: 50, entrada_em: null, saida_em: null, acordo_versao_id: ID_MEMORANDO_V1, decisao_id: null, dedicacao: null },
    { ...controle(ID_SOCIA_CAMILA, false, agora), pessoa_id: ID_CAMILA, participacao: 50, entrada_em: null, saida_em: null, acordo_versao_id: ID_MEMORANDO_V1, decisao_id: null, dedicacao: null },
  ];
}

export function acordosIniciais(agora: string): Acordo[] {
  return [{ ...controle(ID_MEMORANDO, false, agora), codigo: `ACO-${agora.slice(0, 4)}-0001`, titulo: 'Memorando entre sócias', tipo: 'memorando', versao_vigente_id: null }];
}

export function versoesIniciais(agora: string): AcordoVersao[] {
  return [
    {
      ...controle(ID_MEMORANDO_V1, false, agora),
      acordo_id: ID_MEMORANDO,
      numero: 1,
      situacao: 'rascunho',
      resumo: {
        partes: [ID_KIMBERLY, ID_CAMILA],
        parte_entidade_id: null,
        participacao: [
          { pessoa_id: ID_KIMBERLY, percentual: 50 },
          { pessoa_id: ID_CAMILA, percentual: 50 },
        ],
        aportes: null,
        aportes_valores: [],
        dedicacao: [],
        decisao: null,
        destino_produtos: null,
        saida: null,
        observacoes: null,
      },
      titularidade_numa: false,
      arquivo_url: null,
      data_assinatura: null,
      revisao_prevista: null,
      validacao_id: null,
      cancelada_motivo: null,
    },
  ];
}

type ItemPadrao = Pick<ConstituicaoItem, 'chave' | 'titulo' | 'descricao' | 'evidencia_tipo' | 'responsavel_tipo' | 'responsavel_id'> & { depende: number[] };

const AMBAS = { responsavel_tipo: 'ambas', responsavel_id: null } as const;
const CONTADOR = { responsavel_tipo: 'contador', responsavel_id: null } as const;
const KIMBERLY = { responsavel_tipo: 'pessoa', responsavel_id: ID_KIMBERLY } as const;
const CAMILA = { responsavel_tipo: 'pessoa', responsavel_id: ID_CAMILA } as const;

/** T06.06, na ordem e com as dependências da especificação. */
const ITENS_PADRAO: readonly ItemPadrao[] = [
  { chave: 'memorando', titulo: 'Memorando entre sócias vigente', descricao: null, evidencia_tipo: 'acordo', ...AMBAS, depende: [] },
  { chave: 'contador', titulo: 'Escolher contador', descricao: null, evidencia_tipo: null, ...KIMBERLY, depende: [] },
  { chave: 'tipo_regime', titulo: 'Definir tipo societário e regime tributário com o contador', descricao: null, evidencia_tipo: 'decisao', ...AMBAS, depende: [2] },
  { chave: 'cnaes', titulo: 'Definir atividades (CNAEs) cobrindo software e serviços', descricao: null, evidencia_tipo: 'arquivo', ...KIMBERLY, depende: [3] },
  { chave: 'sede', titulo: 'Definir endereço da sede', descricao: null, evidencia_tipo: null, ...AMBAS, depende: [3] },
  { chave: 'contrato_social', titulo: 'Redigir contrato social', descricao: 'Com cláusulas de PI e participação coerentes com o memorando.', evidencia_tipo: 'arquivo', ...KIMBERLY, depende: [1, 3] },
  { chave: 'registro', titulo: 'Registro na junta comercial ou órgão competente', descricao: null, evidencia_tipo: 'arquivo', ...CONTADOR, depende: [6] },
  { chave: 'cnpj', titulo: 'CNPJ emitido', descricao: 'Ao concluir, a entidade passa a Ativa (T02.05).', evidencia_tipo: 'arquivo', ...CONTADOR, depende: [7] },
  { chave: 'inscricao_municipal', titulo: 'Inscrição municipal', descricao: 'Para a nota de serviço.', evidencia_tipo: 'arquivo', ...CONTADOR, depende: [8] },
  { chave: 'certificado', titulo: 'Certificado digital da empresa', descricao: null, evidencia_tipo: 'arquivo', ...KIMBERLY, depende: [8] },
  { chave: 'conta_pj', titulo: 'Abrir conta bancária PJ', descricao: 'Ao concluir, a conta entra em Contas financeiras (T02.08).', evidencia_tipo: 'arquivo', ...KIMBERLY, depende: [8] },
  { chave: 'titular_ferramentas', titulo: 'Cadastrar a entidade como titular nas ferramentas críticas', descricao: null, evidencia_tipo: null, ...CAMILA, depende: [8] },
  { chave: 'transferir_ativos', titulo: 'Transferir ativos', descricao: 'Cada ativo com a própria evidência, em Ativos a transferir (T06.04).', evidencia_tipo: 'ativos', ...CAMILA, depende: [8] },
  { chave: 'conta_lojas', titulo: 'Conta de desenvolvedor de organização nas lojas', descricao: 'Se aplicável.', evidencia_tipo: 'arquivo', ...CAMILA, depende: [8] },
  { chave: 'nota_servico', titulo: 'Configurar a emissão de nota de serviço', descricao: null, evidencia_tipo: 'arquivo', ...KIMBERLY, depende: [9, 10] },
  { chave: 'obrigacoes', titulo: 'Cadastrar as obrigações corporativas recorrentes', descricao: 'Em Obrigações (T06.08), definidas com o contador.', evidencia_tipo: null, ...KIMBERLY, depende: [3, 8] },
  { chave: 'cessao_pi', titulo: 'Termo de cessão de PI das sócias para a empresa', descricao: null, evidencia_tipo: 'acordo', ...KIMBERLY, depende: [8] },
];

export function constituicaoInicial(agora: string): ConstituicaoItem[] {
  return ITENS_PADRAO.map(({ depende, ...item }, indice) => ({
    ...controle(idDoItemPadrao(indice + 1), false, agora),
    ...item,
    ordem: indice + 1,
    depende_de: depende.map(idDoItemPadrao),
    exige_evidencia: item.evidencia_tipo !== null,
    prazo: null,
    situacao: 'a_fazer',
    evidencia_url: null,
    evidencia_registro_id: null,
    motivo_nao_aplica: null,
    atividade_id: null,
    concluido_em: null,
  }));
}

export const VALORES_INICIAIS_M06 = { socia: sociasIniciais, acordo_societario: acordosIniciais, acordo_versao: versoesIniciais, constituicao_item: constituicaoInicial } as const;

/** As tabelas do M06 numa abertura nova: a carga da especificação e o resto vazio. */
export function tabelasIniciaisM06(agora: string) {
  return {
    socia: sociasIniciais(agora),
    socia_participacao_historico: [],
    acordo_societario: acordosIniciais(agora),
    acordo_versao: versoesIniciais(agora),
    acordo_assinatura: [],
    marca_pesquisa: [],
    marca_processo: [],
    marca_prazo: [],
    constituicao_item: constituicaoInicial(agora),
    obrigacao_corporativa: [],
    obrigacao_corporativa_ocorrencia: [],
    reuniao: [],
    reuniao_participante: [],
  } satisfies Record<(typeof NOMES_TABELAS_M06)[number], readonly unknown[]>;
}

/** Só acrescenta tabelas que faltam: quem já usa a Central não perde nada (versão 18). */
export function acrescentarTabelasM06(alteracoes: Record<string, readonly unknown[]>, agora: string) {
  const iniciais: Record<string, readonly unknown[]> = tabelasIniciaisM06(agora);
  for (const tabela of NOMES_TABELAS_M06) if (driver().getItem(chaveDaTabela(tabela)) === null) alteracoes[tabela] = iniciais[tabela] ?? [];
}
