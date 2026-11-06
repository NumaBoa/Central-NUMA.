/**
 * Os atalhos do campo de data (02, "Campo de data"): "Hoje", "+7 dias" e "Fim do mês", contados a partir de
 * hoje, no fuso configurado. Pedido de Kimberly em 06/11/2026.
 */
import { somarDias } from './repeticao';

export type AtalhoDeData = { rotulo: string; dia: string };

/** O último dia do mês de `dia` (aaaa-mm-dd). */
export function fimDoMes(dia: string): string {
  const [ano, mes] = dia.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

/** Só os que cabem nos limites do campo: numa data que não pode ser futura, sobra o "Hoje". */
export function atalhosDeData(hoje: string, { min, max }: { min?: string; max?: string } = {}): AtalhoDeData[] {
  return [
    { rotulo: 'Hoje', dia: hoje },
    { rotulo: '+7 dias', dia: somarDias(hoje, 7) },
    { rotulo: 'Fim do mês', dia: fimDoMes(hoje) },
  ].filter((atalho) => (!min || atalho.dia >= min) && (!max || atalho.dia <= max));
}
