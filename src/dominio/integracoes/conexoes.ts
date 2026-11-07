/**
 * Ponto de conexão das integrações desta frente. A frente do M07 troca `catalogoAusente` pelo adaptador
 * real numa linha só, e nada mais em M10 e M11 precisa mudar.
 */
import { catalogoAusente, type CatalogoComercial } from './catalogo-comercial';
import { criarCatalogoDeExemplo } from './catalogo-de-exemplo';

let catalogoDeTeste: CatalogoComercial | null = null;

/** Só para os testes. */
export function usarCatalogoDeTeste(catalogo: CatalogoComercial | null) {
  catalogoDeTeste = catalogo;
}

/** O exemplo só liga com a variável, e nunca num build de produção. */
const exemploLigado = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_CATALOGO_EXEMPLO === '1';
const catalogoPadrao: CatalogoComercial = exemploLigado ? criarCatalogoDeExemplo() : catalogoAusente;

export function catalogoComercial(): CatalogoComercial {
  return catalogoDeTeste ?? catalogoPadrao;
}
