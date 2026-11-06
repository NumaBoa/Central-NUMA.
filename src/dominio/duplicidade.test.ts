import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, formatarCnpj, nomesParecidos, normalizarCnpj, normalizarTexto, semelhancaDeNomes, soDigitos, telefoneValido } from './duplicidade';

/** CPFs só de teste: calculados para passar na conta, não são de ninguém conhecido. */
const CPF_VALIDO = '529.982.247-25';

describe('normalização', () => {
  it('ignora acentos, maiúsculas e espaços a mais', () => {
    expect(normalizarTexto('  Áurea   LOPES ')).toBe('aurea lopes');
    expect(soDigitos('(21) 99999-0000')).toBe('21999990000');
  });
});

describe('nomes parecidos (RN-02.02)', () => {
  it('iguais, sem considerar acentos e maiúsculas', () => {
    expect(nomesParecidos('Bruna Alves', 'BRUNA ÁLVES')).toBe(true);
    expect(semelhancaDeNomes('Bruna Alves', 'bruna alves')).toBe(1);
  });

  it('com uma letra diferente', () => {
    expect(nomesParecidos('Camila Lima', 'Camilla Lima')).toBe(true);
    expect(nomesParecidos('Kimberly Grebe', 'Kimberli Grebe')).toBe(true);
  });

  it('nomes diferentes não incomodam', () => {
    expect(nomesParecidos('Camila Lima', 'Rafael Souza')).toBe(false);
    expect(nomesParecidos('Camila Lima', 'Camila Souza')).toBe(false);
    expect(nomesParecidos('', '')).toBe(false);
  });
});

describe('CPF (RN-02.03)', () => {
  it('aceita com ou sem pontuação', () => {
    expect(cpfValido(CPF_VALIDO)).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('529.982.247-35')).toBe(false);
  });

  it('recusa tamanho errado e sequências repetidas', () => {
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });
});

describe('CNPJ (RN-02.03)', () => {
  it('aceita o formato numérico, com ou sem pontuação', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000181')).toBe(true);
  });

  it('aceita o formato alfanumérico da Receita, desde julho de 2026', () => {
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(cnpjValido('12abc34501de35')).toBe(true);
  });

  it('recusa dígito verificador errado, tamanho errado e repetidos', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('12.ABC.345/01DE-36')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
    expect(cnpjValido('11.111.111/1111-11')).toBe(false);
    expect(cnpjValido('')).toBe(false);
  });

  it('os dois últimos são sempre números', () => {
    expect(cnpjValido('12.ABC.345/01DE-3A')).toBe(false);
  });

  it('máscara enquanto se digita', () => {
    expect(formatarCnpj('11')).toBe('11');
    expect(formatarCnpj('112')).toBe('11.2');
    expect(formatarCnpj('112223')).toBe('11.222.3');
    expect(formatarCnpj('112223330')).toBe('11.222.333/0');
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(formatarCnpj('112223330001819999')).toBe('11.222.333/0001-81');
  });

  it('normaliza para comparar', () => {
    expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });
});

describe('telefone BR', () => {
  it('aceita celular e fixo com DDD', () => {
    expect(telefoneValido('(21) 99999-0000')).toBe(true);
    expect(telefoneValido('(21) 3333-0000')).toBe(true);
  });

  it('recusa o que não é telefone BR', () => {
    expect(telefoneValido('99999-0000')).toBe(false);
    expect(telefoneValido('(21) 89999-0000')).toBe(false);
    expect(telefoneValido('(01) 99999-0000')).toBe(false);
    expect(telefoneValido('(21) 1333-0000')).toBe(false);
    expect(telefoneValido('')).toBe(false);
  });
});
