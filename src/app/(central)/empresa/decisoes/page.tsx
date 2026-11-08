import type { Metadata } from 'next';
import { TelaDecisoes } from './tela-decisoes';

export const metadata: Metadata = { title: 'Decisões' };

export default function Decisoes() {
  return <TelaDecisoes />;
}
