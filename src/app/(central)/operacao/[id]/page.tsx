import type { Metadata } from 'next';
import { FichaImplantacao } from './ficha-implantacao';

export const metadata: Metadata = { title: 'Implantação' };

export default function PaginaImplantacao() {
  return <FichaImplantacao />;
}
