import type { ReactNode } from 'react';
import { CentralProvider } from '@/componentes/layout/central-provider';
import { Moldura } from '@/componentes/layout/moldura';
import { ProtecaoDeSaida } from '@/componentes/layout/protecao-saida';
import { Abertura } from '@/componentes/marca/abertura';
import { RegiaoAvisos } from '@/componentes/padroes/aviso';

export default function LayoutCentral({ children }: { children: ReactNode }) {
  return (
    <CentralProvider>
      <ProtecaoDeSaida>
        <Moldura>{children}</Moldura>
      </ProtecaoDeSaida>
      <RegiaoAvisos />
      <Abertura />
    </CentralProvider>
  );
}
