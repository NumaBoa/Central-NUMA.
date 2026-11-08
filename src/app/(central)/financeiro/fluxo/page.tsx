import type { Metadata } from 'next';
import { TelaFluxo } from './tela-fluxo';

export const metadata: Metadata = { title: 'Fluxo de caixa' };

export default function PaginaFluxo() {
  return <TelaFluxo />;
}
