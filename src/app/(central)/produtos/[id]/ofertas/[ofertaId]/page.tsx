import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { FichaDaOferta } from './ficha-da-oferta';

export const metadata: Metadata = { title: 'Ficha da oferta' };

export default function Oferta() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <FichaDaOferta />
    </Suspense>
  );
}
