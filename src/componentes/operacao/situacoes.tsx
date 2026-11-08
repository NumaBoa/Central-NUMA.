'use client';

import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import type { Implantacao } from '@/dados/tipos/operacao';
import { ROTULOS_SITUACAO_IMPLANTACAO, type Desvio } from '@/dominio/implantacoes';
import { cn } from '@/lib/utils';

const TOM_DA_SITUACAO: Readonly<Record<Implantacao['situacao'], TipoSituacao>> = { nao_iniciada: 'neutro', em_andamento: 'info', em_validacao: 'info', entregue: 'sucesso', acompanhamento: 'info', concluida: 'sucesso', suspensa: 'atencao', cancelada: 'erro' };

/** Situação com texto, ícone e cor (18 §9.13). */
export function SituacaoDaImplantacao({ situacao }: { situacao: Implantacao['situacao'] }) {
  return <EtiquetaSituacao tipo={TOM_DA_SITUACAO[situacao]}>{ROTULOS_SITUACAO_IMPLANTACAO[situacao]}</EtiquetaSituacao>;
}

const COR_DO_DESVIO: Readonly<Record<Desvio['tom'], string>> = { neutro: 'text-ink-soft', sucesso: 'text-ok', atencao: 'text-warn', erro: 'text-err' };

export function TextoDoDesvio({ desvio, className }: { desvio: Desvio; className?: string }) {
  return <span className={cn(COR_DO_DESVIO[desvio.tom], desvio.tom !== 'neutro' && 'font-semibold', className)}>{desvio.texto}</span>;
}
