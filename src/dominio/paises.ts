export type OpcaoPais = { codigo: string; nome: string };

export const PAIS_BRASIL = 'BR';

/** Códigos que o Intl conhece, mas que não são países: blocos, testes e territórios especiais. */
const NAO_SAO_PAISES = new Set(['AC', 'CP', 'CQ', 'DG', 'EA', 'EU', 'EZ', 'IC', 'QO', 'TA', 'UN', 'XA', 'XB', 'ZZ']);

const nomes = new Intl.DisplayNames(['pt-BR'], { type: 'region', fallback: 'none' });

let lista: readonly OpcaoPais[] | null = null;

/**
 * Os países vêm do próprio navegador, como as moedas: o Intl não lista as regiões, mas diz o nome de
 * cada código de 2 letras que conhece. Brasil no topo, os demais em ordem alfabética.
 */
export function listarPaises(): readonly OpcaoPais[] {
  if (lista) return lista;
  const encontrados: OpcaoPais[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const codigo = String.fromCharCode(a, b);
      if (NAO_SAO_PAISES.has(codigo) || codigo === PAIS_BRASIL) continue;
      const nome = nomes.of(codigo);
      if (nome && nome !== codigo) encontrados.push({ codigo, nome });
    }
  }
  encontrados.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  lista = [{ codigo: PAIS_BRASIL, nome: 'Brasil' }, ...encontrados];
  return lista;
}

export function nomeDoPais(codigo: string): string {
  return nomes.of(codigo) ?? codigo;
}
