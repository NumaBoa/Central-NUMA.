import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import { diasParaVencer, ROTULOS_TRANSFERENCIA } from '@/dominio/ativos';
import { formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

export function EtiquetaCritica({ rotulo = 'Crítica' }: { rotulo?: string }) {
  return <span className="inline-flex min-h-6 items-center rounded-pill bg-err-wash px-2.5 text-xs font-semibold text-err">{rotulo}</span>;
}

const TIPOS_DA_TRANSFERENCIA: Readonly<Record<AtivoDigital['transferencia_situacao'], TipoSituacao>> = { nao_necessaria: 'neutro', pendente: 'atencao', em_andamento: 'info', concluida: 'sucesso', impedida: 'erro' };

export function SituacaoDaTransferencia({ situacao }: { situacao: AtivoDigital['transferencia_situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DA_TRANSFERENCIA[situacao]}>{ROTULOS_TRANSFERENCIA[situacao]}</EtiquetaSituacao>;
}

/** RN-04.18: até 45 dias antes, o vencimento chama atenção. A antecedência configurável vale para os alertas (etapa 15). */
const DIAS_PARA_DESTACAR = 45;

export function TextoDoVencimento({ vencimento, hoje }: { vencimento: string | null; hoje: string }) {
  if (!vencimento) return <span className="text-ink-soft">—</span>;
  const dias = diasParaVencer({ vencimento }, hoje) as number;
  return (
    <span className={cn('whitespace-nowrap tabular-nums', dias < 0 ? 'font-semibold text-err' : dias <= DIAS_PARA_DESTACAR && 'font-semibold text-warn')}>
      {formatarDiaISO(vencimento)}
      {dias < 0 && ' (vencido)'}
    </span>
  );
}
