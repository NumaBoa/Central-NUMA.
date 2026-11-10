/**
 * Com estas duas variáveis, a Central usa o Supabase e pede login. Sem elas (no computador, nos
 * testes e nas verificações), segue como antes: tudo no navegador.
 * A chave é a publicável: vai no site mesmo, e quem protege os dados são as regras do banco.
 */
export const URL_NUVEM = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const CHAVE_NUVEM = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export function nuvemConfigurada(): boolean {
  return Boolean(URL_NUVEM && CHAVE_NUVEM);
}
