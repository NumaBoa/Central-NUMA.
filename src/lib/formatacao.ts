import { formatInTimeZone } from 'date-fns-tz';
import { FUSO_PADRAO } from './datas';

export function formatarData(iso: string, fuso: string = FUSO_PADRAO): string {
  return formatInTimeZone(iso, fuso, 'dd/MM/yyyy');
}

export function formatarHora(iso: string, fuso: string = FUSO_PADRAO): string {
  return formatInTimeZone(iso, fuso, 'HH:mm');
}

export function formatarDataHora(iso: string, fuso: string = FUSO_PADRAO): string {
  return formatInTimeZone(iso, fuso, 'dd/MM/yyyy HH:mm');
}

export function formatarNumero(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const emKb = bytes / 1024;
  if (emKb < 1024) return `${emKb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
  return `${(emKb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
