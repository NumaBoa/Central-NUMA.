import type { Metadata } from 'next';
import { TelaSla } from './tela-sla';

export const metadata: Metadata = { title: 'Regras de SLA' };

export default function PaginaSla() {
  return <TelaSla />;
}
