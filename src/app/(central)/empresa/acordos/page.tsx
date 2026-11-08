import type { Metadata } from 'next';
import { TelaAcordos } from './tela-acordos';

export const metadata: Metadata = { title: 'Acordos societários' };

export default function Acordos() {
  return <TelaAcordos />;
}
