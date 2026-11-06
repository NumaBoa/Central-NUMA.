import { formatInTimeZone } from 'date-fns-tz';
import { fusoConfigurado } from './datas';

/** Datas de negócio (`aaaa-mm-dd`) não têm hora nem fuso: o dia é o que está escrito (RT-06). */
export function formatarDiaISO(dia: string): string {
  return dia.split('-').reverse().join('/');
}

/** Câmbio em reais: pelo menos 2 casas e até as 6 de RT-07. */
export function formatarCotacao(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

/** Na moeda do registro (RT-07). Não soma moedas diferentes: só mostra. */
export function formatarDinheiro(valor: number, moeda: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(valor);
}

export function formatarData(iso: string, fuso: string = fusoConfigurado()): string {
  return formatInTimeZone(iso, fuso, 'dd/MM/yyyy');
}

export function formatarHora(iso: string, fuso: string = fusoConfigurado()): string {
  return formatInTimeZone(iso, fuso, 'HH:mm');
}

export function formatarDataHora(iso: string, fuso: string = fusoConfigurado()): string {
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
