import type { Metadata } from 'next';
import { FichaContraparte } from './ficha-contraparte';

export const metadata: Metadata = { title: 'Ficha da contraparte' };

export default function PaginaFichaContraparte() {
  return <FichaContraparte />;
}
