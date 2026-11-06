import type { Metadata } from 'next';
import { TelaEntidades } from './tela-entidades';

export const metadata: Metadata = { title: 'Entidades' };

export default function Entidades() {
  return <TelaEntidades />;
}
