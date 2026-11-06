import type { Metadata } from 'next';
import { FichaFerramenta } from './ficha-ferramenta';

export const metadata: Metadata = { title: 'Ferramenta' };

export default function PaginaDaFerramenta() {
  return <FichaFerramenta />;
}
