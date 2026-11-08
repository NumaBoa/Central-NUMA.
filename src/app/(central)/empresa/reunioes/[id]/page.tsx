import type { Metadata } from 'next';
import { FichaDaReuniao } from './ficha-reuniao';

export const metadata: Metadata = { title: 'Reunião' };

export default function Reuniao() {
  return <FichaDaReuniao />;
}
