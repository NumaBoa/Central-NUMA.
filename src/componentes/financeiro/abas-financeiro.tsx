import { ArrowLeftRight, Gauge, Landmark, Receipt, Users } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

/** As seções do Financeiro já construídas (F0a e, desde 07/11/2026, o Orçamento da F0b). */
export function AbasFinanceiro({ ativa }: { ativa: 'lancamentos' | 'socias' | 'transferencias' | 'contas' | 'orcamento' }) {
  return (
    <AbasPagina
      rotulo="Seções do financeiro"
      className="!mt-0"
      abas={[
        { rotulo: 'Lançamentos', icone: Receipt, href: '/financeiro', ativa: ativa === 'lancamentos' },
        { rotulo: 'Sócias', icone: Users, href: '/financeiro/socias', ativa: ativa === 'socias' },
        { rotulo: 'Transferências', icone: ArrowLeftRight, href: '/financeiro/transferencias', ativa: ativa === 'transferencias' },
        { rotulo: 'Contas e saldos', icone: Landmark, href: '/financeiro/contas', ativa: ativa === 'contas' },
        { rotulo: 'Orçamento', icone: Gauge, href: '/financeiro/orcamento', ativa: ativa === 'orcamento' },
      ]}
    />
  );
}
