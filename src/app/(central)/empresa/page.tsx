import type { Metadata } from 'next';
import { TelaPainelDaEmpresa } from './tela-painel';

export const metadata: Metadata = { title: 'Empresa' };

export default function Empresa() {
  return <TelaPainelDaEmpresa />;
}
