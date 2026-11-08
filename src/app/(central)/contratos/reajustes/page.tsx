import type { Metadata } from 'next';
import { TelaReajustes } from './tela-reajustes';

export const metadata: Metadata = { title: 'Reajuste' };

export default function PaginaReajustes() {
  return <TelaReajustes />;
}
