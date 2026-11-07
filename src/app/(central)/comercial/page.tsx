import type { Metadata } from 'next';
import { TelaFunil } from './tela-funil';

export const metadata: Metadata = { title: 'Funil comercial' };

export default function PaginaFunil() {
  return <TelaFunil />;
}
