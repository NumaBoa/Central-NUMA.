import type { Metadata } from 'next';
import { TelaCustos } from './tela-custos';

export const metadata: Metadata = { title: 'Resultado por produto' };

export default function Custos() {
  return <TelaCustos />;
}
