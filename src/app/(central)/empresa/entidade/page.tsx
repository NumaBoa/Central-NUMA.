import type { Metadata } from 'next';
import { TelaEntidadeDaEmpresa } from './tela-entidade';

export const metadata: Metadata = { title: 'Entidade' };

export default function EntidadeDaEmpresa() {
  return <TelaEntidadeDaEmpresa />;
}
