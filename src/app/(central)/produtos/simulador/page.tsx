import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaSimulador } from './tela-simulador';

export const metadata: Metadata = { title: 'Simulador de preços' };

export default function Simulador() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaSimulador />
    </Suspense>
  );
}
