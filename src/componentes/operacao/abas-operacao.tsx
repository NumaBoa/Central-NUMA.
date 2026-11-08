'use client';

import { BarChart3, Clock, Gauge, LifeBuoy, Megaphone, Rocket, ShieldAlert } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

export type AreaOperacao = 'implantacoes' | 'suporte' | 'sla' | 'incidentes' | 'horas' | 'notas' | 'estimado';

/** As áreas do M12 (14-M12 §3), todas construídas. */
const AREAS: readonly { id: AreaOperacao; rotulo: string; icone: typeof Rocket; href?: string }[] = [
  { id: 'implantacoes', rotulo: 'Implantações', icone: Rocket, href: '/operacao' },
  { id: 'suporte', rotulo: 'Suporte', icone: LifeBuoy, href: '/operacao/suporte' },
  { id: 'sla', rotulo: 'Regras de SLA', icone: Gauge, href: '/operacao/sla' },
  { id: 'incidentes', rotulo: 'Incidentes', icone: ShieldAlert, href: '/operacao/incidentes' },
  { id: 'horas', rotulo: 'Horas', icone: Clock, href: '/operacao/horas' },
  { id: 'notas', rotulo: 'Notas de liberação', icone: Megaphone, href: '/operacao/notas' },
  { id: 'estimado', rotulo: 'Estimado × realizado', icone: BarChart3, href: '/operacao/estimado' },
];

export function AbasOperacao({ ativa }: { ativa: AreaOperacao }) {
  return <AbasPagina rotulo="Áreas da Operação" abas={AREAS.map((area) => ({ rotulo: area.rotulo, icone: area.icone, href: area.href, ativa: area.id === ativa }))} />;
}
