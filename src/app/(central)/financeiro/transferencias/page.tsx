import type { Metadata } from 'next';
import { TelaTransferencias } from './tela-transferencias';

export const metadata: Metadata = { title: 'Transferências' };

export default function Transferencias() {
  return <TelaTransferencias />;
}
