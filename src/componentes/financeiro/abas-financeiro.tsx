import { ArrowLeftRight, ChartLine, FileSpreadsheet, FolderTree, Gauge, Handshake, Landmark, Lock, PieChart, Receipt, Users, Wallet } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

/** As seções do Financeiro já construídas (F0a, F0b e, desde 08/11/2026, a Receita por canal da F1). */
export function AbasFinanceiro({ ativa, className = '!mt-0' }: { ativa: 'lancamentos' | 'socias' | 'transferencias' | 'contas' | 'fluxo' | 'orcamento' | 'custos' | 'receitas' | 'repasses' | 'categorias' | 'fechamento' | 'contador'; className?: string }) {
  return (
    <AbasPagina
      rotulo="Seções do financeiro"
      className={className}
      abas={[
        { rotulo: 'Lançamentos', icone: Receipt, href: '/financeiro', ativa: ativa === 'lancamentos' },
        { rotulo: 'Sócias', icone: Users, href: '/financeiro/socias', ativa: ativa === 'socias' },
        { rotulo: 'Transferências', icone: ArrowLeftRight, href: '/financeiro/transferencias', ativa: ativa === 'transferencias' },
        { rotulo: 'Contas e saldos', icone: Landmark, href: '/financeiro/contas', ativa: ativa === 'contas' },
        { rotulo: 'Fluxo de caixa', icone: ChartLine, href: '/financeiro/fluxo', ativa: ativa === 'fluxo' },
        { rotulo: 'Orçamento', icone: Gauge, href: '/financeiro/orcamento', ativa: ativa === 'orcamento' },
        { rotulo: 'Resultado por produto', icone: PieChart, href: '/financeiro/custos', ativa: ativa === 'custos' },
        { rotulo: 'Receita por canal', icone: Wallet, href: '/financeiro/receitas', ativa: ativa === 'receitas' },
        { rotulo: 'Repasses', icone: Handshake, href: '/financeiro/repasses', ativa: ativa === 'repasses' },
        { rotulo: 'Fechamento', icone: Lock, href: '/financeiro/fechamento', ativa: ativa === 'fechamento' },
        { rotulo: 'Contador', icone: FileSpreadsheet, href: '/financeiro/contador', ativa: ativa === 'contador' },
        { rotulo: 'Categorias', icone: FolderTree, href: '/financeiro/categorias', ativa: ativa === 'categorias' },
      ]}
    />
  );
}
