import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { TelaBiblioteca } from './tela-biblioteca';

export const metadata: Metadata = { title: 'Biblioteca' };

export default function Biblioteca() {
  return (
    <Suspense fallback={<EstadoCarregando />}>
      <TelaBiblioteca />
    </Suspense>
  );
}
