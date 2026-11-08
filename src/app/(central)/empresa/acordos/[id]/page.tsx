import type { Metadata } from 'next';
import { FichaDoAcordo } from './ficha-acordo';

export const metadata: Metadata = { title: 'Acordo societário' };

export default function Acordo() {
  return <FichaDoAcordo />;
}
