import type { Metadata } from 'next';
import { FichaLista } from './ficha-lista';

export const metadata: Metadata = { title: 'Ficha da lista de espera' };

export default function ListaDeEspera() {
  return <FichaLista />;
}
