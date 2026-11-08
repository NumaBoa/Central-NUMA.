import { Coins, Compass, FileSignature, Flag, Handshake, Layers, Megaphone, Settings, ShieldCheck, Sun, Wrench, type LucideIcon } from 'lucide-react';
import type { IconeModulo } from '@/dominio/navegacao';

/** Ícones de módulo (18 §6). */
export const ICONES_MODULO: Record<IconeModulo, LucideIcon> = {
  'meu-dia': Sun,
  empresa: Flag,
  produtos: Layers,
  comercial: Handshake,
  contratos: FileSignature,
  financeiro: Coins,
  operacao: Compass,
  ferramentas: Wrench,
  legal: ShieldCheck,
  marca: Megaphone,
  configuracoes: Settings,
};
