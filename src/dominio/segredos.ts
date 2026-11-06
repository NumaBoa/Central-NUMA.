/** RT-14: nenhum campo guarda senha, token ou código. Texto livre avisa e pede confirmação. */
const ENDERECO = /\bhttps?:\/\/\S+/gi;
const PALAVRA_DE_SEGREDO = /\bsenha\s*[:=]|\bpassword\b|\bpasswd\b|\btoken\b|\bapi[\s_-]?key\b|\bchave\s+de\s+api\b/i;
/** Letras e números misturados, sem espaço, com pelo menos 20 caracteres: não parece uma palavra. */
const SEQUENCIA_ALEATORIA = /(?=[A-Za-z0-9+/_=-]*[A-Za-z])(?=[A-Za-z0-9+/_=-]*\d)[A-Za-z0-9+/_=-]{20,}/;

export function pareceCredencial(texto: string): boolean {
  // Link costuma ter uma sequência longa, como os do Drive, e não é segredo.
  const semEnderecos = texto.replace(ENDERECO, ' ');
  return PALAVRA_DE_SEGREDO.test(semEnderecos) || SEQUENCIA_ALEATORIA.test(semEnderecos);
}

export const AVISO_CREDENCIAL = 'Isto parece uma senha ou um token, e a Central não guarda segredos. Se não for, confirme para continuar.';
