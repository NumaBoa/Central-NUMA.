import type { Metadata } from 'next';
import { NovoContrato } from './novo-contrato';

export const metadata: Metadata = { title: 'Novo contrato' };

export default function PaginaNovoContrato() {
  return <NovoContrato />;
}
