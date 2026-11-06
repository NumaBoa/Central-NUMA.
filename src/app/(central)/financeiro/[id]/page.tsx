import type { Metadata } from 'next';
import { FichaTitulo } from './ficha-titulo';

export const metadata: Metadata = { title: 'Lançamento' };

export default function PaginaDoTitulo() {
  return <FichaTitulo />;
}
