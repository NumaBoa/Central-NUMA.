import type { Metadata } from 'next';
import { TelaCampanhas } from './tela-campanhas';

export const metadata: Metadata = { title: 'Campanhas' };

export default function Campanhas() {
  return <TelaCampanhas />;
}
