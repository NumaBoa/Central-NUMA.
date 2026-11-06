import { ArrowLeftRight, Landmark, Receipt, Users } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

/** As seções do Financeiro na F0a. Cada uma ganha o link quando a tela chegar (etapa 14). */
export function AbasFinanceiro({ ativa }: { ativa: 'lancamentos' | 'socias' | 'transferencias' | 'contas' }) {
  return (
    <AbasPagina
      rotulo="Seções do financeiro"
      className="!mt-0"
      abas={[
        { rotulo: 'Lançamentos', icone: Receipt, href: '/financeiro', ativa: ativa === 'lancamentos' },
        { rotulo: 'Sócias', icone: Users },
        { rotulo: 'Transferências', icone: ArrowLeftRight },
        { rotulo: 'Contas e saldos', icone: Landmark },
      ]}
    />
  );
}
