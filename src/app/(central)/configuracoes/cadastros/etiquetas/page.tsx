import type { Metadata } from 'next';
import { TelaEtiquetas } from './tela-etiquetas';

export const metadata: Metadata = { title: 'Etiquetas' };

export default function Etiquetas() {
  return <TelaEtiquetas />;
}
