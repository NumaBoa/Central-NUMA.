import type { Metadata } from 'next';
import { TelaContrapartes } from './tela-contrapartes';

export const metadata: Metadata = { title: 'Contrapartes' };

export default function Contrapartes() {
  return <TelaContrapartes />;
}
