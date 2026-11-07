import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { FUSO_PADRAO, fusoConfigurado } from '@/dados/fuso';

export { FUSO_PADRAO, fusoConfigurado };

/** O instante de um dia e uma hora escritos no fuso configurado (RT-06). */
/** O fuso, para dizer a que horário o campo se refere. */
export function rotuloDoFuso(fuso: string = fusoConfigurado()): string {
  return fuso === 'America/Sao_Paulo' ? `Horário de Brasília · ${fuso}` : fuso;
}

export function instanteNoFuso(dia: string, hora: string, fuso: string = fusoConfigurado()): string {
  return fromZonedTime(`${dia}T${hora}:00`, fuso).toISOString();
}

/** O dia e a hora de um instante no fuso configurado, para preencher os campos. */
export function diaEHoraNoFuso(instante: string, fuso: string = fusoConfigurado()): { dia: string; hora: string } {
  return { dia: formatInTimeZone(instante, fuso, 'yyyy-MM-dd'), hora: formatInTimeZone(instante, fuso, 'HH:mm') };
}

/** "Hoje" no fuso configurado em T02.01, como aaaa-mm-dd (RT-06). */
export function hojeISO(agora: Date = new Date(), fuso: string = fusoConfigurado()): string {
  return formatInTimeZone(agora, fuso, 'yyyy-MM-dd');
}
