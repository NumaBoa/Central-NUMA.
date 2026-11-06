import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { FUSO_PADRAO, fusoConfigurado } from '@/dados/fuso';

export { FUSO_PADRAO, fusoConfigurado };

/** O instante de um dia e uma hora escritos no fuso configurado (RT-06). */
export function instanteNoFuso(dia: string, hora: string, fuso: string = fusoConfigurado()): string {
  return fromZonedTime(`${dia}T${hora}:00`, fuso).toISOString();
}

/** "Hoje" no fuso configurado em T02.01, como aaaa-mm-dd (RT-06). */
export function hojeISO(agora: Date = new Date(), fuso: string = fusoConfigurado()): string {
  return formatInTimeZone(agora, fuso, 'yyyy-MM-dd');
}
