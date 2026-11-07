import type { Metadata } from 'next';
import { TelaContratos } from './tela-contratos';

export const metadata: Metadata = { title: 'Contratos' };

export default function PaginaContratos() {
  return <TelaContratos />;
}
