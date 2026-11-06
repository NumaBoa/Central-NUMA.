import { Globe, Wrench } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';

/** O módulo tem duas listas: Ferramentas (T04.01) e Ativos digitais (T04.04). */
export function AbasFerramentas({ ativa }: { ativa: 'ferramentas' | 'ativos' }) {
  return (
    <AbasPagina
      rotulo="Seções de ferramentas e ativos"
      className="!mt-0"
      abas={[
        { rotulo: 'Ferramentas', icone: Wrench, href: '/ferramentas', ativa: ativa === 'ferramentas' },
        { rotulo: 'Ativos digitais', icone: Globe, href: '/ferramentas/ativos', ativa: ativa === 'ativos' },
      ]}
    />
  );
}
