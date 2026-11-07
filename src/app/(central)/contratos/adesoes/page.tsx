import type { Metadata } from 'next';
import { TelaAdesoes } from './tela-adesoes';

export const metadata: Metadata = { title: 'Adesão padrão' };

export default function PaginaAdesoes() {
  return <TelaAdesoes />;
}
