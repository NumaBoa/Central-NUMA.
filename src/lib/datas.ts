import { formatInTimeZone } from 'date-fns-tz';
import { FUSO_PADRAO, fusoConfigurado } from '@/dados/fuso';

export { FUSO_PADRAO, fusoConfigurado };

/** "Hoje" no fuso configurado em T02.01, como aaaa-mm-dd (RT-06). */
export function hojeISO(agora: Date = new Date(), fuso: string = fusoConfigurado()): string {
  return formatInTimeZone(agora, fuso, 'yyyy-MM-dd');
}
