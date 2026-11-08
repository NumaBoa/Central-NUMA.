import type { Metadata } from 'next';
import { FichaSolicitacao } from './ficha-solicitacao';

export const metadata: Metadata = { title: 'Solicitação de suporte' };

export default function PaginaSolicitacao() {
  return <FichaSolicitacao />;
}
