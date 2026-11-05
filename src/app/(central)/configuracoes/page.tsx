import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, Settings } from 'lucide-react';
import { AbasPagina, CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoVazio } from '@/componentes/padroes/estados';
import { Button } from '@/componentes/ui/button';

export const metadata: Metadata = { title: 'Configurações' };

/** Até a entrega 2 e a T02.01, Configurações só apresenta o que vem pela frente. */
export default function Configuracoes() {
  return (
    <>
      <CabecalhoPagina migalhas={['Central Numa', 'Configurações']} kicker="Configurações" titulo="Configurações" resumo="Uma base bem cuidada. O resto flui." />
      <AbasPagina
        rotulo="Seções de configurações"
        abas={[
          { rotulo: 'Geral', icone: Settings },
          { rotulo: 'Dados', icone: Database },
        ]}
      />
      <EstadoVazio
        className="mt-7"
        icone={Settings}
        titulo="As configurações vêm a seguir."
        texto="Primeiro chega Configurações › Dados, depois as configurações gerais. Enquanto isso, veja os padrões que todas as telas vão usar."
        acao={
          <Button asChild variante="secundario">
            <Link href="/padroes">Ver os padrões da Central</Link>
          </Button>
        }
      />
    </>
  );
}
