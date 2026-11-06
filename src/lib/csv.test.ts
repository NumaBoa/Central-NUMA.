import { describe, expect, it } from 'vitest';
import { gerarCsv } from './csv';

describe('gerarCsv', () => {
  it('usa ponto e vírgula, BOM e quebra de linha do Windows, para o Excel em português abrir direto', () => {
    expect(gerarCsv(['Nome', 'Valor'], [['Kipi', 'R$ 20,00']])).toBe('﻿Nome;Valor\r\nKipi;R$ 20,00');
  });

  it('coloca entre aspas o que tem separador, aspas ou quebra de linha', () => {
    expect(gerarCsv(['A'], [['um;dois'], ['diz "oi"'], ['linha\nduas']])).toBe('﻿A\r\n"um;dois"\r\n"diz ""oi"""\r\n"linha\nduas"');
  });

  it('não deixa uma célula virar fórmula na planilha', () => {
    const linhas = ['=SOMA(A1)', '+1', '-1', '@x'].map((valor) => [valor]);
    expect(gerarCsv(['A'], linhas).split('\r\n').slice(1)).toEqual(["'=SOMA(A1)", "'+1", "'-1", "'@x"]);
  });

  it('sem linhas, sai só o cabeçalho', () => {
    expect(gerarCsv(['A', 'B'], [])).toBe('﻿A;B');
  });
});
