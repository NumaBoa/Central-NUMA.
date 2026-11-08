import type { Metadata } from 'next';
import { TelaListas } from './tela-listas';

export const metadata: Metadata = { title: 'Listas de espera' };

export default function Listas() {
  return <TelaListas />;
}
