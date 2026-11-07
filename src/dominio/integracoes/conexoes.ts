/**
 * Ponto de conexão das integrações de M10 e M11. O catálogo real é o do M07 (`catalogo-m07.ts`);
 * o de exemplo só liga em desenvolvimento, com a variável.
 */
import type { CatalogoComercial } from './catalogo-comercial';
import { criarCatalogoDeExemplo } from './catalogo-de-exemplo';
import { catalogoDoM07 } from './catalogo-m07';

let catalogoDeTeste: CatalogoComercial | null = null;

/** Só para os testes. */
export function usarCatalogoDeTeste(catalogo: CatalogoComercial | null) {
  catalogoDeTeste = catalogo;
}

/** O exemplo só liga com a variável, e nunca num build de produção. */
const exemploLigado = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_CATALOGO_EXEMPLO === '1';
const catalogoPadrao: CatalogoComercial = exemploLigado ? criarCatalogoDeExemplo() : catalogoDoM07;

export function catalogoComercial(): CatalogoComercial {
  return catalogoDeTeste ?? catalogoPadrao;
}
