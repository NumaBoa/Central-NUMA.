import { formatInTimeZone } from 'date-fns-tz';

export const FUSO_PADRAO = 'America/Sao_Paulo';

/** "Hoje" no fuso configurado, como aaaa-mm-dd (RT-06). */
export function hojeISO(agora: Date = new Date(), fuso: string = FUSO_PADRAO): string {
  return formatInTimeZone(agora, fuso, 'yyyy-MM-dd');
}
