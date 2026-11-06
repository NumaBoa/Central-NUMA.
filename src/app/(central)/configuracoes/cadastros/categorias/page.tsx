import type { Metadata } from 'next';
import { TelaCategorias } from './tela-categorias';

export const metadata: Metadata = { title: 'Categorias financeiras' };

export default function Categorias() {
  return <TelaCategorias />;
}
