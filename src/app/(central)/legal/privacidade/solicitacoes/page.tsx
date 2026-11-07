import type { Metadata } from 'next';
import { TelaSolicitacoes } from './tela-solicitacoes';

export const metadata: Metadata = { title: 'Solicitações de titulares' };

export default function PaginaSolicitacoes() {
  return <TelaSolicitacoes />;
}
