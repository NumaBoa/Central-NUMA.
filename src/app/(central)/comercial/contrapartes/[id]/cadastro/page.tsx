import type { Metadata } from 'next';
import { FichaContraparte } from '@/app/(central)/configuracoes/cadastros/contrapartes/[id]/ficha-contraparte';

export const metadata: Metadata = { title: 'Ficha da contraparte' };

/** O cadastro completo da contraparte, em Comercial › Contrapartes (decisão de Kimberly em 07/11/2026). */
export default function CadastroDaContraparte() {
  return <FichaContraparte />;
}
