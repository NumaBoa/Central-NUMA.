import { gravarMeta, lerMeta } from '@/dados/meta';
import { registrarEvento } from '@/dados/historico';
import { idDaPessoaAtual } from '@/dados/sessao';
import { hojeISO } from '@/lib/datas';

/** Uma rotina diz quantos itens novos gerou. Rodar de novo não duplica (RT-09). */
export type Rotina = {
  nome: string;
  /** Só no dia 1 do mês, como a extensão da programação. */
  soNoDiaPrimeiro?: boolean;
  executar: () => Promise<number>;
};

const nadaAFazerAinda = async () => 0;

/**
 * Rotinas do dia, nesta ordem (02 §0.5). Elas ainda não têm o que gerar: cada uma ganha conteúdo
 * junto com a sua tela (alertas e ocorrências no Meu dia, situações e programação no Financeiro).
 */
export const ROTINAS_DO_DIA: readonly Rotina[] = [
  { nome: 'Gerar alertas', executar: nadaAFazerAinda },
  { nome: 'Gerar ocorrências de rotinas', executar: nadaAFazerAinda },
  { nome: 'Atualizar situações', executar: nadaAFazerAinda },
  { nome: 'Estender programação', soNoDiaPrimeiro: true, executar: nadaAFazerAinda },
];

export type ResultadoRotinas = { executou: boolean; novos: number; falhas: string[] };

function jaRodouHoje(ultimaEm: string | null, hoje: string): boolean {
  return Boolean(ultimaEm) && hojeISO(new Date(ultimaEm!)) === hoje;
}

type OpcoesRotinas = {
  /** "Rodar rotinas agora" (02 §0.3), mesmo se já rodaram hoje. */
  manual?: boolean;
  rotinas?: readonly Rotina[];
};

/**
 * Ao abrir o app, se a última execução for anterior a hoje (02 §0.5). Uma rotina que falha não
 * impede as outras, e o dia só conta como feito se todas passarem, para tentar de novo depois.
 */
export async function executarRotinas({ manual = false, rotinas = ROTINAS_DO_DIA }: OpcoesRotinas = {}): Promise<ResultadoRotinas> {
  const agora = new Date();
  const hoje = hojeISO(agora);
  if (!manual && jaRodouHoje(lerMeta().ultima_rotina_em, hoje)) return { executou: false, novos: 0, falhas: [] };

  const diaPrimeiro = hoje.endsWith('-01');
  let novos = 0;
  const falhas: string[] = [];
  for (const rotina of rotinas) {
    if (rotina.soNoDiaPrimeiro && !diaPrimeiro) continue;
    try {
      novos += await rotina.executar();
    } catch {
      falhas.push(rotina.nome);
    }
  }

  if (!falhas.length) gravarMeta({ ultima_rotina_em: agora.toISOString() });
  if (manual || novos > 0 || falhas.length > 0) {
    registrarEvento({ usuarioId: manual ? idDaPessoaAtual() : null, acao: 'executou_acao', depois: { funcao: 'rodar_rotinas', novos, falhas } });
  }
  return { executou: true, novos, falhas };
}

/** Aviso discreto (02 §0.5): "Rotinas do dia executadas: 3 alertas novos". */
export function mensagemDasRotinas({ novos, falhas }: Pick<ResultadoRotinas, 'novos' | 'falhas'>): string {
  if (falhas.length) return `Algumas rotinas não terminaram: ${falhas.join(', ')}. Elas rodam de novo na próxima abertura.`;
  if (novos === 0) return 'Rotinas do dia executadas: nenhum alerta novo.';
  return `Rotinas do dia executadas: ${novos} ${novos === 1 ? 'alerta novo' : 'alertas novos'}.`;
}
