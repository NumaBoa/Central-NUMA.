import type { Metadata } from 'next';
import { TelaSocias } from './tela-socias';

export const metadata: Metadata = { title: 'Sócias' };

export default function Socias() {
  return <TelaSocias />;
}
