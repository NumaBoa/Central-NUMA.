import type { Metadata } from 'next';
import { TelaContrapartesComercial } from './tela-contrapartes-comercial';

export const metadata: Metadata = { title: 'Contrapartes' };

export default function PaginaContrapartesComercial() {
  return <TelaContrapartesComercial />;
}
