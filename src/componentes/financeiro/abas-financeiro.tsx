import { ArrowLeftRight, Landmark, Receipt, Users } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

/** As seções do Financeiro na F0a. */
export function AbasFinanceiro({ ativa }: { ativa: 'lancamentos' | 'socias' | 'transferencias' | 'contas' }) {
  return (
    <AbasPagina
      rotulo="Seções do financeiro"
      className="!mt-0"
      abas={[
        { rotulo: 'Lançamentos', icone: Receipt, href: '/financeiro', ativa: ativa === 'lancamentos' },
        { rotulo: 'Sócias', icone: Users, href: '/financeiro/socias', ativa: ativa === 'socias' },
        { rotulo: 'Transferências', icone: ArrowLeftRight, href: '/financeiro/transferencias', ativa: ativa === 'transferencias' },
        { rotulo: 'Contas e saldos', icone: Landmark, href: '/financeiro/contas', ativa: ativa === 'contas' },
      ]}
    />
  );
}
