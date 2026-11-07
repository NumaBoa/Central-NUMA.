import type { Metadata } from 'next';
import { FichaComercialDaContraparte } from './ficha-comercial';

export const metadata: Metadata = { title: 'Contraparte' };

export default function PaginaContraparteComercial() {
  return <FichaComercialDaContraparte />;
}
