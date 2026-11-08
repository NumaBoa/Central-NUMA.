import type { Metadata } from 'next';
import { FichaDaDecisao } from './ficha-decisao';

export const metadata: Metadata = { title: 'Decisão' };

export default function Decisao() {
  return <FichaDaDecisao />;
}
