import type { Metadata } from 'next';
import { TelaRenovacao } from './tela-renovacao';

export const metadata: Metadata = { title: 'Renovação' };

export default function PaginaRenovacao() {
  return <TelaRenovacao />;
}
