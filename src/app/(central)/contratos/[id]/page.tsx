import type { Metadata } from 'next';
import { FichaContrato } from './ficha-contrato';

export const metadata: Metadata = { title: 'Contrato' };

export default function PaginaContrato() {
  return <FichaContrato />;
}
