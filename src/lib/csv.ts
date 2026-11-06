/** Ponto e vírgula e BOM: é como o Excel em português abre um CSV com acentos sem pedir nada. */
const SEPARADOR = ';';
const BOM = '﻿';

function celula(valor: string): string {
  // Planilhas executam o que começa com estes caracteres: o apóstrofo faz virar texto.
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export function gerarCsv(cabecalho: readonly string[], linhas: ReadonlyArray<readonly string[]>): string {
  return BOM + [cabecalho, ...linhas].map((linha) => linha.map(celula).join(SEPARADOR)).join('\r\n');
}
