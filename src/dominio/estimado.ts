/**
 * RN-12.06 (adaptação da viabilidade histórica): horas estimadas × apontadas e prazo estimado × realizado.
 * O prazo realizado vai do Início realizado à Entrega realizada. Sem um dos lados, não há desvio (RT-08).
 */
import type { Implantacao, ImplantacaoMarco } from '@/dados/tipos/operacao';
import { diasEntre } from './implantacoes';

export type EstimadoRealizado = {
  horasEstimadas: number | null;
  horasApontadas: number;
  /** (apontadas − estimadas) / estimadas, em %. */
  desvioHoras: number | null;
  prazoEstimadoDias: number | null;
  prazoRealizadoDias: number | null;
  desvioPrazo: number | null;
};

const percentual = (realizado: number, estimado: number) => Math.round(((realizado - estimado) / estimado) * 1000) / 10;

export function estimadoRealizado(implantacao: Pick<Implantacao, 'horas_estimadas' | 'prazo_estimado_dias'>, marcos: readonly Pick<ImplantacaoMarco, 'marco' | 'realizado_em'>[], horasApontadas: number): EstimadoRealizado {
  const inicio = marcos.find((marco) => marco.marco === 'inicio')?.realizado_em ?? null;
  const entrega = marcos.find((marco) => marco.marco === 'entrega')?.realizado_em ?? null;
  const prazoRealizadoDias = inicio && entrega ? Math.max(0, diasEntre(inicio, entrega)) : null;
  const estimadas = implantacao.horas_estimadas;
  return {
    horasEstimadas: estimadas,
    horasApontadas,
    desvioHoras: estimadas ? percentual(horasApontadas, estimadas) : null,
    prazoEstimadoDias: implantacao.prazo_estimado_dias,
    prazoRealizadoDias,
    desvioPrazo: implantacao.prazo_estimado_dias && prazoRealizadoDias !== null ? percentual(prazoRealizadoDias, implantacao.prazo_estimado_dias) : null,
  };
}

// ---------- Referência histórica do produto (RN-12.06, T12.08 e T10.04) ----------

export type LinhaParaReferencia = { id: string; codigo: string; produto_id: string; contraparte_id: string; concluida_em: string | null; situacao: Implantacao['situacao'] } & Pick<Implantacao, 'horas_estimadas' | 'prazo_estimado_dias'> & { marcos: Pick<ImplantacaoMarco, 'marco' | 'realizado_em'>[]; horasApontadas: number };

export type ReferenciaDoProduto = {
  produtoId: string;
  /** Implantações concluídas: a amostra. */
  amostra: number;
  amostraHoras: number;
  amostraPrazo: number;
  mediaHoras: number | null;
  mediaPrazoDias: number | null;
  desvioMedioHoras: number | null;
  desvioMedioPrazo: number | null;
  implantacoes: (LinhaParaReferencia & { resultado: EstimadoRealizado })[];
};

const media = (valores: readonly number[]) => (valores.length ? Math.round((valores.reduce((total, valor) => total + valor, 0) / valores.length) * 10) / 10 : null);

/**
 * Média das implantações concluídas do produto, cada lado com a própria amostra: horas só das que têm horas
 * apontadas, prazo só das que têm Início e Entrega realizados. Sem amostra, nada de média (RT-08).
 */
export function referenciaDoProduto(produtoId: string, linhas: readonly LinhaParaReferencia[]): ReferenciaDoProduto {
  const concluidas = linhas.filter((linha) => linha.produto_id === produtoId && linha.situacao === 'concluida' && linha.concluida_em).map((linha) => ({ ...linha, resultado: estimadoRealizado(linha, linha.marcos, linha.horasApontadas) }));
  const comHoras = concluidas.filter((linha) => linha.horasApontadas > 0);
  const comPrazo = concluidas.filter((linha) => linha.resultado.prazoRealizadoDias !== null);
  return {
    produtoId,
    amostra: concluidas.length,
    amostraHoras: comHoras.length,
    amostraPrazo: comPrazo.length,
    mediaHoras: media(comHoras.map((linha) => linha.horasApontadas)),
    mediaPrazoDias: media(comPrazo.map((linha) => linha.resultado.prazoRealizadoDias as number)),
    desvioMedioHoras: media(comHoras.flatMap((linha) => (linha.resultado.desvioHoras === null ? [] : [linha.resultado.desvioHoras]))),
    desvioMedioPrazo: media(comPrazo.flatMap((linha) => (linha.resultado.desvioPrazo === null ? [] : [linha.resultado.desvioPrazo]))),
    implantacoes: concluidas,
  };
}

/** "Kipi: média de 32 h e 28 dias, em 3 implantações concluídas." Sem amostra, "Histórico insuficiente". Nunca soma produtos. */
export function textoDaReferencia(referencia: ReferenciaDoProduto, nomeDoProduto: string): string {
  if (!referencia.amostra || (referencia.mediaHoras === null && referencia.mediaPrazoDias === null)) return `${nomeDoProduto}: Histórico insuficiente`;
  const partes = [referencia.mediaHoras === null ? null : `${referencia.mediaHoras.toLocaleString('pt-BR')} h (${referencia.amostraHoras} com horas)`, referencia.mediaPrazoDias === null ? null : `${referencia.mediaPrazoDias.toLocaleString('pt-BR')} dias (${referencia.amostraPrazo} com prazo)`].filter(Boolean);
  return `${nomeDoProduto}: média de ${partes.join(' e ')}, em ${referencia.amostra} ${referencia.amostra === 1 ? 'implantação concluída' : 'implantações concluídas'}`;
}

export async function carregarLinhasParaReferencia(): Promise<LinhaParaReferencia[]> {
  const { carregarImplantacoes } = await import('./implantacoes');
  return (await carregarImplantacoes()).linhas.filter((linha) => !linha.arquivado_em);
}

/** T10.04: uma referência por produto da oportunidade, lado a lado, sem somar (RN-12.06). */
export async function referenciasDosProdutos(produtoIds: readonly string[]): Promise<ReferenciaDoProduto[]> {
  const linhas = await carregarLinhasParaReferencia();
  return produtoIds.map((produtoId) => referenciaDoProduto(produtoId, linhas));
}

export function textoDoPercentual(valor: number | null): string {
  if (valor === null) return '—';
  if (valor === 0) return 'Igual ao estimado';
  return `${valor > 0 ? '+' : '−'}${Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
