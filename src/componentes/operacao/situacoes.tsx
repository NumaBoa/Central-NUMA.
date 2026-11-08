'use client';

import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import type { Implantacao, SolicitacaoSuporte } from '@/dados/tipos/operacao';
import { ROTULOS_SITUACAO_IMPLANTACAO, type Desvio } from '@/dominio/implantacoes';
import type { SituacaoDoPrazo } from '@/dominio/sla';
import { ROTULOS_SITUACAO_SUPORTE } from '@/dominio/suporte';
import { cn } from '@/lib/utils';

const TOM_DA_SITUACAO: Readonly<Record<Implantacao['situacao'], TipoSituacao>> = { nao_iniciada: 'neutro', em_andamento: 'info', em_validacao: 'info', entregue: 'sucesso', acompanhamento: 'info', concluida: 'sucesso', suspensa: 'atencao', cancelada: 'erro' };

/** Situação com texto, ícone e cor (18 §9.13). */
export function SituacaoDaImplantacao({ situacao }: { situacao: Implantacao['situacao'] }) {
  return <EtiquetaSituacao tipo={TOM_DA_SITUACAO[situacao]}>{ROTULOS_SITUACAO_IMPLANTACAO[situacao]}</EtiquetaSituacao>;
}

const TOM_DO_SUPORTE: Readonly<Record<SolicitacaoSuporte['situacao'], TipoSituacao>> = { aberta: 'info', em_atendimento: 'info', aguardando_cliente: 'atencao', aguardando_proposta: 'atencao', resolvida: 'sucesso', fechada: 'neutro', cancelada: 'neutro' };

export function SituacaoDaSolicitacao({ situacao }: { situacao: SolicitacaoSuporte['situacao'] }) {
  return <EtiquetaSituacao tipo={TOM_DO_SUPORTE[situacao]}>{ROTULOS_SITUACAO_SUPORTE[situacao]}</EtiquetaSituacao>;
}

const TOM_DO_PRAZO: Readonly<Record<SituacaoDoPrazo['estado'], TipoSituacao>> = { sem_sla: 'neutro', no_prazo: 'info', em_risco: 'atencao', violado: 'erro', cumprido: 'sucesso', cumprido_fora: 'erro', pausado: 'neutro' };

/** O SLA com texto, ícone e cor: no prazo, em risco a 80%, violado, cumprido. */
export function EtiquetaDoPrazo({ situacao }: { situacao: SituacaoDoPrazo }) {
  return <EtiquetaSituacao tipo={TOM_DO_PRAZO[situacao.estado]}>{situacao.texto}</EtiquetaSituacao>;
}

const COR_DO_DESVIO: Readonly<Record<Desvio['tom'], string>> = { neutro: 'text-ink-soft', sucesso: 'text-ok', atencao: 'text-warn', erro: 'text-err' };

export function TextoDoDesvio({ desvio, className }: { desvio: Desvio; className?: string }) {
  return <span className={cn(COR_DO_DESVIO[desvio.tom], desvio.tom !== 'neutro' && 'font-semibold', className)}>{desvio.texto}</span>;
}
