import type { Metadata } from 'next';
import { FichaIncidente } from './ficha-incidente';

export const metadata: Metadata = { title: 'Incidente' };

export default function PaginaIncidente() {
  return <FichaIncidente />;
}
