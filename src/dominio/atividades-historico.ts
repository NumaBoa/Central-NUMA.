/** Regras de T03.04 (05-M03): o que já foi concluído ou cancelado. */
import type { Atividade } from '@/dados/tipos/atividade';
import { hojeISO } from '@/lib/datas';
import { estaAberta, passaNosFiltrosComuns, type AtividadeDoDia, type FiltrosComuns, type OpcoesDosFiltros } from './atividades';
import { somarDias } from './repeticao';

export type PeriodoDaConclusao = '' | 'hoje' | '7dias' | '30dias' | 'mes' | 'intervalo';

export const ROTULOS_PERIODO_CONCLUSAO = { hoje: 'Hoje', '7dias': 'Últimos 7 dias', '30dias': 'Últimos 30 dias', mes: 'Este mês', intervalo: 'Intervalo' } as const;

/** Quem encerrou pode ser o próprio sistema: um alerta que se resolveu na origem (RN-03.12). */
export const CONCLUIDA_PELO_SISTEMA = 'sistema';

export type FiltrosHistorico = FiltrosComuns & {
  situacao: '' | 'concluida' | 'cancelada';
  conclusao: PeriodoDaConclusao;
  conclusaoDe: string;
  conclusaoAte: string;
  concluidaPor: string;
};

export const FILTROS_HISTORICO_INICIAIS: FiltrosHistorico = { busca: '', pessoa: '', soResponsavel: false, contextos: [], area: '', tipo: '', prioridades: [], periodo: '', prazoDe: '', prazoAte: '', etiqueta: '', origem: '', situacao: '', conclusao: '', conclusaoDe: '', conclusaoAte: '', concluidaPor: '' };

/** Cancelar não tem data própria (16 §4.3), e encerrada não muda mais: a última alteração é o cancelamento. */
export function encerradaEm(atividade: Pick<Atividade, 'concluida_em' | 'atualizado_em'>): string {
  return atividade.concluida_em ?? atividade.atualizado_em;
}

const passaNoEncerramento = (dia: string, { conclusao, conclusaoDe, conclusaoAte }: Pick<FiltrosHistorico, 'conclusao' | 'conclusaoDe' | 'conclusaoAte'>, hoje: string) => {
  switch (conclusao) {
    case 'hoje':
      return dia === hoje;
    case '7dias':
      return dia >= somarDias(hoje, -6) && dia <= hoje;
    case '30dias':
      return dia >= somarDias(hoje, -29) && dia <= hoje;
    case 'mes':
      return dia.slice(0, 7) === hoje.slice(0, 7);
    case 'intervalo':
      return (!conclusaoDe || dia >= conclusaoDe) && (!conclusaoAte || dia <= conclusaoAte);
    default:
      return true;
  }
};

/** Os mesmos filtros do Meu dia, mais o período e quem concluiu. As mais recentes primeiro. */
export function atividadesDoHistorico(atividades: readonly AtividadeDoDia[], filtros: FiltrosHistorico, opcoes: OpcoesDosFiltros): AtividadeDoDia[] {
  return atividades
    .filter((atividade) => !estaAberta(atividade) && !atividade.arquivado_em)
    .filter((atividade) => !filtros.situacao || atividade.situacao === filtros.situacao)
    .filter((atividade) => passaNosFiltrosComuns(atividade, filtros, opcoes))
    .filter((atividade) => passaNoEncerramento(hojeISO(new Date(encerradaEm(atividade))), filtros, opcoes.hoje))
    .filter((atividade) => {
      if (!filtros.concluidaPor) return true;
      if (filtros.concluidaPor === CONCLUIDA_PELO_SISTEMA) return atividade.situacao === 'concluida' && !atividade.concluida_por;
      return atividade.concluida_por === filtros.concluidaPor;
    })
    .sort((a, b) => encerradaEm(b).localeCompare(encerradaEm(a)));
}
