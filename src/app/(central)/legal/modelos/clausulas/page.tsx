import type { Metadata } from 'next';
import { TelaClausulas } from './tela-clausulas';

export const metadata: Metadata = { title: 'Biblioteca de cláusulas' };

export default function PaginaClausulas() {
  return <TelaClausulas />;
}
