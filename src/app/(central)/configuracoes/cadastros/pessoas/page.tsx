import type { Metadata } from 'next';
import { TelaPessoas } from './tela-pessoas';

export const metadata: Metadata = { title: 'Pessoas' };

export default function Pessoas() {
  return <TelaPessoas />;
}
