/** Cobranças previstas de uma assinatura (RN-04.03). Só contas de data, sem acesso a dados. */
import type { AssinaturaFerramenta } from '@/dados/tipos/ferramenta';
import { hojeISO } from '@/lib/datas';

export const MESES_DA_PERIODICIDADE: Partial<Record<NonNullable<AssinaturaFerramenta['periodicidade']>, number>> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };

/** `diaAlvo` é o dia de cobrança: depois de um fevereiro curto, a cobrança do dia 31 volta para o 31. */
export function somarMeses(dia: string, meses: number, diaAlvo?: number | null): string {
  const [ano, mes, data] = dia.split('-').map(Number) as [number, number, number];
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(diaAlvo ?? data, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Até 3 meses à frente para mensais; a próxima para as demais. Gratuita e sem geração não têm cobrança (RN-04.02). */
export function cobrancasPrevistas(assinatura: Pick<AssinaturaFerramenta, 'modalidade' | 'valor' | 'periodicidade' | 'proxima_cobranca' | 'gerar_titulos'>, hoje: string = hojeISO()): string[] {
  if (assinatura.modalidade !== 'paga' || !assinatura.gerar_titulos || !assinatura.proxima_cobranca || !assinatura.periodicidade) return [];
  if (assinatura.periodicidade !== 'mensal') return [assinatura.proxima_cobranca];
  const limite = somarMeses(hoje, 3);
  const datas: string[] = [];
  for (let dia = assinatura.proxima_cobranca, volta = 0; dia <= limite && volta < 12; volta += 1, dia = somarMeses(assinatura.proxima_cobranca, volta)) datas.push(dia);
  return datas.length ? datas : [assinatura.proxima_cobranca];
}
