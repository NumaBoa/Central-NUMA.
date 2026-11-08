import { ArrowLeftRight, Gauge, Landmark, PieChart, Receipt, Users, Wallet } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

/** As seções do Financeiro já construídas (F0a, F0b e, desde 08/11/2026, a Receita por canal da F1). */
export function AbasFinanceiro({ ativa }: { ativa: 'lancamentos' | 'socias' | 'transferencias' | 'contas' | 'orcamento' | 'custos' | 'receitas' }) {
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
        { rotulo: 'Resultado por produto', icone: PieChart, href: '/financeiro/custos', ativa: ativa === 'custos' },
        { rotulo: 'Receita por canal', icone: Wallet, href: '/financeiro/receitas', ativa: ativa === 'receitas' },
      ]}
    />
  );
}
