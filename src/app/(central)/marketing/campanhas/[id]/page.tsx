import type { Metadata } from 'next';
import { FichaCampanha } from './ficha-campanha';

export const metadata: Metadata = { title: 'Ficha da campanha' };

export default function Campanha() {
  return <FichaCampanha />;
}
