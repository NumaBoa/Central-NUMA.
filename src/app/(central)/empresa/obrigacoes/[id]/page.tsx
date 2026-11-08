import type { Metadata } from 'next';
import { FichaDaObrigacao } from './ficha-obrigacao';

export const metadata: Metadata = { title: 'Obrigação corporativa' };

export default function Obrigacao() {
  return <FichaDaObrigacao />;
}
