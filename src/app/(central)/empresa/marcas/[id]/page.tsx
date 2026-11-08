import type { Metadata } from 'next';
import { FichaDaMarca } from './ficha-marca';

export const metadata: Metadata = { title: 'Marca' };

export default function Marca() {
  return <FichaDaMarca />;
}
