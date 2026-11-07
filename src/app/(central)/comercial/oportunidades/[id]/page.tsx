import type { Metadata } from 'next';
import { FichaOportunidade } from './ficha-oportunidade';

export const metadata: Metadata = { title: 'Oportunidade' };

export default function PaginaOportunidade() {
  return <FichaOportunidade />;
}
