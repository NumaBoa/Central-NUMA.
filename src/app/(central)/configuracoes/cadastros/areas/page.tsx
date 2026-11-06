import type { Metadata } from 'next';
import { TelaAreas } from './tela-areas';

export const metadata: Metadata = { title: 'Áreas' };

export default function Areas() {
  return <TelaAreas />;
}
