import type { Metadata } from 'next';
import { TelaCustos } from './tela-custos';

export const metadata: Metadata = { title: 'Custos por produto' };

export default function Custos() {
  return <TelaCustos />;
}
