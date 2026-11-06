import type { Metadata } from 'next';
import { TelaMeuDia } from './tela-meu-dia';

export const metadata: Metadata = { title: 'Meu dia' };

export default function MeuDia() {
  return <TelaMeuDia />;
}
