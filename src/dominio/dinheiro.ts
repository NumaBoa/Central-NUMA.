/** RT-07: dinheiro com 2 casas, na moeda do registro. */
const COM_VIRGULA = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;
const COM_PONTO = /^-?\d+\.\d{1,2}$/;
/** numeric(14,2). */
const MAIOR_VALOR = 999_999_999_999.99;

/** Aceita 1.234,56 · 1234,56 · 1234.56 · -50. Devolve `null` quando não dá para ter certeza do valor. */
export function lerValor(texto: string): number | null {
  const limpo = texto.trim();
  let valor: number | null = null;
  if (COM_VIRGULA.test(limpo)) valor = Number(limpo.replaceAll('.', '').replace(',', '.'));
  else if (COM_PONTO.test(limpo)) valor = Number(limpo);
  return valor !== null && Math.abs(valor) <= MAIOR_VALOR ? valor : null;
}

/** RT-07: câmbio é `numeric(12,6)`. Devolve `null` quando não dá para ter certeza do valor. */
export function lerCambio(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d{1,6}([.,]\d{1,6})?$/.test(limpo)) return null;
  return Number(limpo.replace(',', '.'));
}

/** Para mostrar de volta no campo, com a vírgula de quem digita. */
export function valorParaCampo(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
