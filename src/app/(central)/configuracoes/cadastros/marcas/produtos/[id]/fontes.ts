import { Baloo_2, Bricolage_Grotesque, DM_Serif_Display, Fraunces, Italiana, Space_Grotesk } from 'next/font/google';
import { ID_MARCA_KIPI, ID_MARCA_MIMO, ID_MARCA_NUMA, ID_MARCA_URBANA, ID_MARCA_ZARPA, ID_MARCA_ZUPI } from '@/dados/exemplos/base';

/**
 * Fontes das marcas (18 §3.2): só no nome do produto em tamanho grande, e só carregadas nas telas
 * que as mostram (18 §4). Italiana não tem negrito: o peso 700 é simulado pelo navegador.
 */
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: '700', display: 'swap', preload: false });
const fraunces = Fraunces({ subsets: ['latin'], weight: '600', display: 'swap', preload: false });
const baloo = Baloo_2({ subsets: ['latin'], weight: '700', display: 'swap', preload: false });
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: '400', display: 'swap', preload: false });
const italiana = Italiana({ subsets: ['latin'], weight: '400', display: 'swap', preload: false });
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: '700', display: 'swap', preload: false });

/** Marca nova fica com a fonte da Central até definir a própria identidade (F0b). */
export const FONTE_DA_MARCA: Readonly<Record<string, string>> = {
  [ID_MARCA_NUMA]: bricolage.className,
  [ID_MARCA_URBANA]: spaceGrotesk.className,
  [ID_MARCA_KIPI]: fraunces.className,
  [ID_MARCA_ZUPI]: baloo.className,
  [ID_MARCA_ZARPA]: dmSerif.className,
  [ID_MARCA_MIMO]: `${italiana.className} font-bold`,
};
