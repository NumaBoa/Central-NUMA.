import type { Metadata } from 'next';
import { TelaSociasDaEmpresa } from './tela-socias';

export const metadata: Metadata = { title: 'Sócias e participação' };

export default function SociasDaEmpresa() {
  return <TelaSociasDaEmpresa />;
}
