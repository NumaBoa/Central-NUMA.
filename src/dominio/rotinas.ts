import { gravarMeta, lerMeta } from '@/dados/meta';
import { registrarEvento } from '@/dados/historico';
import { comoSistema, idDaPessoaAtual } from '@/dados/sessao';
import { hojeISO } from '@/lib/datas';
import { gerarAlertas } from './alertas';
import { atualizarSituacoesF1, gerarAlertasF1 } from './alertas-f1';
import { gerarAlertasM08 } from './alertas-m08';
import { estenderProgramacaoDosContratos } from './contratos';
import { atualizarSituacoesDasFerramentas } from './ferramentas';
import { atualizarSituacoesDosTitulos, estenderProgramacao } from './titulos';
import { notificarFalhasDasRotinas } from './notificacoes';
import { gerarOcorrencias } from './recorrencias';

/** Uma rotina diz quantos itens novos gerou. Rodar de novo não duplica (RT-09). */
export type Rotina = {
  nome: string;
  /** Como contar o que ela gerou, no aviso: `['alerta novo', 'alertas novos']`. */
  novidade?: readonly [string, string];
  /** Só no dia 1 do mês, como a extensão da programação. */
  soNoDiaPrimeiro?: boolean;
  executar: () => Promise<number>;
};


/**
 * Rotinas do dia, nesta ordem (02 §0.5).
 */
export const ROTINAS_DO_DIA: readonly Rotina[] = [
  { nome: 'Gerar alertas', novidade: ['alerta novo', 'alertas novos'], executar: async () => (await gerarAlertas()) + (await gerarAlertasF1()) + (await gerarAlertasM08()) },
  { nome: 'Gerar ocorrências de rotinas', novidade: ['ocorrência nova', 'ocorrências novas'], executar: () => gerarOcorrencias() },
  { nome: 'Atualizar situações', executar: async () => (await atualizarSituacoesDasFerramentas()) + (await atualizarSituacoesDosTitulos()) + (await atualizarSituacoesF1()) },
  { nome: 'Estender programação', soNoDiaPrimeiro: true, novidade: ['lançamento previsto', 'lançamentos previstos'], executar: async () => (await estenderProgramacao()) + (await estenderProgramacaoDosContratos()) },
];

export type ResultadoRotinas = { executou: boolean; novos: number; falhas: string[]; novidades: string[] };

function jaRodouHoje(ultimaEm: string | null, hoje: string): boolean {
  return Boolean(ultimaEm) && hojeISO(new Date(ultimaEm!)) === hoje;
}

type OpcoesRotinas = {
  /** "Rodar rotinas agora" (02 §0.3), mesmo se já rodaram hoje. */
  manual?: boolean;
  rotinas?: readonly Rotina[];
};

/** Duas rodadas ao mesmo tempo leriam a mesma lista e gerariam tudo em dobro. */
let emAndamento: Promise<ResultadoRotinas> | null = null;

const NAO_RODOU: ResultadoRotinas = { executou: false, novos: 0, falhas: [], novidades: [] };

/**
 * Ao abrir o app, se a última execução for anterior a hoje (02 §0.5). Uma rotina que falha não
 * impede as outras, e o dia só conta como feito se todas passarem, para tentar de novo depois.
 */
export async function executarRotinas(opcoes: OpcoesRotinas = {}): Promise<ResultadoRotinas> {
  // A da abertura não espera: se outra já está rodando, basta ela. "Rodar rotinas agora" espera a vez e roda,
  // para o aviso contar o que aconteceu, e não dizer "nada novo" sem ter rodado (o clique logo ao abrir a página).
  while (emAndamento) {
    if (!opcoes.manual) return NAO_RODOU;
    await emAndamento.catch(() => undefined);
  }
  const rodada = rodarRotinas(opcoes);
  emAndamento = rodada;
  try {
    return await rodada;
  } finally {
    if (emAndamento === rodada) emAndamento = null;
  }
}

async function rodarRotinas({ manual = false, rotinas = ROTINAS_DO_DIA }: OpcoesRotinas): Promise<ResultadoRotinas> {
  const agora = new Date();
  const hoje = hojeISO(agora);
  if (!manual && jaRodouHoje(lerMeta().ultima_rotina_em, hoje)) return NAO_RODOU;

  // Sem servidor, ninguém garante abrir a Central no dia 1: quem abre depois, no mês seguinte, não perde a extensão.
  const ultimaEm = lerMeta().ultima_rotina_em;
  const diaPrimeiro = hoje.endsWith('-01') || (Boolean(ultimaEm) && hojeISO(new Date(ultimaEm as string)).slice(0, 7) !== hoje.slice(0, 7));
  let novos = 0;
  const falhas: string[] = [];
  const novidades: string[] = [];
  for (const rotina of rotinas) {
    if (rotina.soNoDiaPrimeiro && !diaPrimeiro) continue;
    try {
      const geradas = await comoSistema(rotina.executar);
      novos += geradas;
      if (geradas > 0 && rotina.novidade) novidades.push(`${geradas} ${geradas === 1 ? rotina.novidade[0] : rotina.novidade[1]}`);
    } catch {
      falhas.push(rotina.nome);
    }
  }

  if (!falhas.length) gravarMeta({ ultima_rotina_em: agora.toISOString() });
  else await notificarFalhasDasRotinas(falhas, hoje).catch(() => undefined);
  if (manual || novos > 0 || falhas.length > 0) {
    registrarEvento({ usuarioId: manual ? idDaPessoaAtual() : null, acao: 'executou_acao', depois: { funcao: 'rodar_rotinas', novos, falhas } });
  }
  return { executou: true, novos, falhas, novidades };
}

/** Aviso discreto (02 §0.5): "Rotinas do dia executadas: 3 alertas novos". */
export function mensagemDasRotinas({ falhas, novidades }: Pick<ResultadoRotinas, 'falhas' | 'novidades'>): string {
  if (falhas.length) return `Algumas rotinas não terminaram: ${falhas.join(', ')}. Elas rodam de novo na próxima abertura.`;
  if (!novidades.length) return 'Rotinas do dia executadas: nada novo.';
  return `Rotinas do dia executadas: ${novidades.join(' e ')}.`;
}
