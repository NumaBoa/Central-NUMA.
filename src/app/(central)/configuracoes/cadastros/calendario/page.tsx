import type { Metadata } from 'next';
import { TelaCalendario } from './tela-calendario';

export const metadata: Metadata = { title: 'Calendário e feriados' };

export default function Calendario() {
  return <TelaCalendario />;
}
