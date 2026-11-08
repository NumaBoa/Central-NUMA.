'use client';

import { BarChart3, Clock, Gauge, LifeBuoy, Megaphone, Rocket, ShieldAlert } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

export type AreaOperacao = 'implantacoes' | 'suporte' | 'sla' | 'incidentes' | 'horas' | 'notas' | 'estimado';

/** As áreas do M12 (14-M12 §3). Só as construídas têm link; as outras ficam "Em breve". */
const AREAS: readonly { id: AreaOperacao; rotulo: string; icone: typeof Rocket; href?: string }[] = [
  { id: 'implantacoes', rotulo: 'Implantações', icone: Rocket, href: '/operacao' },
  { id: 'suporte', rotulo: 'Suporte', icone: LifeBuoy },
  { id: 'sla', rotulo: 'Regras de SLA', icone: Gauge },
  { id: 'incidentes', rotulo: 'Incidentes', icone: ShieldAlert },
  { id: 'horas', rotulo: 'Horas', icone: Clock, href: '/operacao/horas' },
  { id: 'notas', rotulo: 'Notas de liberação', icone: Megaphone },
  { id: 'estimado', rotulo: 'Estimado × realizado', icone: BarChart3 },
];

export function AbasOperacao({ ativa }: { ativa: AreaOperacao }) {
  return <AbasPagina rotulo="Áreas da Operação" abas={AREAS.map((area) => ({ rotulo: area.rotulo, icone: area.icone, href: area.href, ativa: area.id === ativa }))} />;
}
