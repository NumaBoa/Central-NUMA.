/** Comparações de RN-02.02 (detecção de duplicidade) e de RN-02.03 (CPF), para pessoas e contrapartes. */

export function soDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Sem acentos, sem maiúsculas e com um espaço só entre as palavras. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function trigramas(texto: string): Set<string> {
  const comBordas = `  ${normalizarTexto(texto)} `;
  const conjunto = new Set<string>();
  for (let i = 0; i < comBordas.length - 2; i++) conjunto.add(comBordas.slice(i, i + 3));
  return conjunto;
}

/** Mesma ideia do índice trigram de 16 §4.2: de 0 (nada em comum) a 1 (iguais). */
export function semelhancaDeNomes(a: string, b: string): number {
  const deA = trigramas(a);
  const deB = trigramas(b);
  const emComum = [...deA].filter((trigrama) => deB.has(trigrama)).length;
  return emComum / (deA.size + deB.size - emComum);
}

const NOME_PARECIDO = 0.6;

export function nomesParecidos(a: string, b: string): boolean {
  return Boolean(normalizarTexto(a)) && Boolean(normalizarTexto(b)) && semelhancaDeNomes(a, b) >= NOME_PARECIDO;
}

/** Dígitos verificadores (RN-02.03). Sequências como 111.111.111-11 passam na conta, mas não existem. */
export function cpfValido(cpf: string): boolean {
  const digitos = soDigitos(cpf);
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  const verificador = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(digitos[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return verificador(9) === Number(digitos[9]) && verificador(10) === Number(digitos[10]);
}

/** Letras maiúsculas e dígitos: o CNPJ pode ter letras desde julho de 2026 (Receita Federal). */
export function normalizarCnpj(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Dígitos verificadores (RN-02.03), no formato numérico e no alfanumérico: cada caractere vale o
 * código dele menos 48, então os dígitos continuam valendo o mesmo. Os dois últimos são sempre números.
 */
export function cnpjValido(cnpj: string): boolean {
  const limpo = normalizarCnpj(cnpj);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(limpo) || /^(.)\1{13}$/.test(limpo)) return false;
  const verificador = (tamanho: number) => {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += (limpo.charCodeAt(i) - 48) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return verificador(12) === Number(limpo[12]) && verificador(13) === Number(limpo[13]);
}

/** 00.000.000/0000-00, enquanto se digita. */
export function formatarCnpj(texto: string): string {
  const limpo = normalizarCnpj(texto).slice(0, 14);
  return limpo
    .replace(/^(.{2})(.)/, '$1.$2')
    .replace(/^(.{2})\.(.{3})(.)/, '$1.$2.$3')
    .replace(/^(.{2})\.(.{3})\.(.{3})(.)/, '$1.$2.$3/$4')
    .replace(/^(.{2})\.(.{3})\.(.{3})\/(.{4})(.)/, '$1.$2.$3/$4-$5');
}

/** Telefone BR com DDD: fixo tem 10 dígitos, celular tem 11 e começa com 9 depois do DDD. */
export function telefoneValido(telefone: string): boolean {
  const digitos = soDigitos(telefone);
  return /^[1-9]\d(?:[2-8]\d{7}|9\d{8})$/.test(digitos);
}
