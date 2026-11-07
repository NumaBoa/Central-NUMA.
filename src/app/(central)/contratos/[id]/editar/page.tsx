import type { Metadata } from 'next';
import { EdicaoDoContrato } from './edicao-contrato';

export const metadata: Metadata = { title: 'Editar contrato' };

export default function PaginaEditarContrato() {
  return <EdicaoDoContrato />;
}
