import type { ReactNode } from 'react';
import { CentralProvider } from '@/componentes/layout/central-provider';
import { Moldura } from '@/componentes/layout/moldura';
import { Abertura } from '@/componentes/marca/abertura';
import { RegiaoAvisos } from '@/componentes/padroes/aviso';

export default function LayoutCentral({ children }: { children: ReactNode }) {
  return (
    <CentralProvider>
      <Moldura>{children}</Moldura>
      <RegiaoAvisos />
      <Abertura />
    </CentralProvider>
  );
}
