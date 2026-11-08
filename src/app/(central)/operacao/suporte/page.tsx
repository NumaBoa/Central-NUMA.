import type { Metadata } from 'next';
import { TelaSuporte } from './tela-suporte';

export const metadata: Metadata = { title: 'Solicitações de suporte' };

export default function PaginaSuporte() {
  return <TelaSuporte />;
}
