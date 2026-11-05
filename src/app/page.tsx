import { redirect } from 'next/navigation';
import { TELA_INICIAL } from '@/dominio/navegacao';

export default function Inicio() {
  redirect(TELA_INICIAL);
}
