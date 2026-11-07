/**
 * Lê um CSV colado ou enviado (RT-24): vírgula ou ponto e vírgula, aspas, BOM e quebras de linha do Excel.
 * O separador é o que aparece mais vezes na primeira linha, fora das aspas.
 */
function separadorDe(primeiraLinha: string): string {
  let dentro = false;
  let pontoEVirgula = 0;
  let virgula = 0;
  for (const caractere of primeiraLinha) {
    if (caractere === '"') dentro = !dentro;
    else if (!dentro && caractere === ';') pontoEVirgula += 1;
    else if (!dentro && caractere === ',') virgula += 1;
  }
  return pontoEVirgula >= virgula ? ';' : ',';
}

export type LinhaDoCsv = { numero: number; celulas: string[] };

/** `numero` é a linha do arquivo, contando o cabeçalho: é o que a pessoa vê na planilha. Linhas em branco ficam de fora. */
export function lerCsv(texto: string): { cabecalho: string[]; linhas: LinhaDoCsv[] } {
  const limpo = texto.replace(/^﻿/, '');
  const separador = separadorDe(limpo.split(/\r?\n/, 1)[0] ?? '');
  const registros: LinhaDoCsv[] = [];
  let celulas: string[] = [];
  let celula = '';
  let dentro = false;
  let numero = 1;
  let inicio = 1;
  const fecharCelula = () => {
    celulas.push(celula.trim());
    celula = '';
  };
  const fecharLinha = () => {
    fecharCelula();
    if (celulas.some(Boolean)) registros.push({ numero: inicio, celulas });
    celulas = [];
  };
  for (let i = 0; i < limpo.length; i += 1) {
    const caractere = limpo[i];
    if (dentro) {
      if (caractere === '"' && limpo[i + 1] === '"') {
        celula += '"';
        i += 1;
      } else if (caractere === '"') dentro = false;
      else {
        if (caractere === '\n') numero += 1;
        celula += caractere;
      }
    } else if (caractere === '"') dentro = true;
    else if (caractere === separador) fecharCelula();
    else if (caractere === '\n') {
      fecharLinha();
      numero += 1;
      inicio = numero;
    } else if (caractere !== '\r') celula += caractere;
  }
  fecharLinha();
  const [primeira, ...demais] = registros;
  return { cabecalho: primeira?.celulas ?? [], linhas: demais };
}
