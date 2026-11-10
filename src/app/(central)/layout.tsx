import type { ReactNode } from 'react';
import { AdicionarAtividadeProvider } from '@/componentes/atividades/adicionar-atividade';
import { NovaContraparteProvider } from '@/componentes/contrapartes/nova-contraparte';
import { NovaFerramentaProvider } from '@/componentes/ferramentas/nova-ferramenta';
import { NovaDespesaProvider } from '@/componentes/financeiro/nova-despesa';
import { CentralProvider } from '@/componentes/layout/central-provider';
import { Moldura } from '@/componentes/layout/moldura';
import { ProtecaoDeSaida } from '@/componentes/layout/protecao-saida';
import { Abertura } from '@/componentes/marca/abertura';
import { PortaoNuvem } from '@/componentes/nuvem/portao-nuvem';
import { RegiaoAvisos } from '@/componentes/padroes/aviso';

export default function LayoutCentral({ children }: { children: ReactNode }) {
  return (
    <PortaoNuvem>
      <CentralProvider>
        <ProtecaoDeSaida>
          <AdicionarAtividadeProvider>
            <NovaFerramentaProvider>
              <NovaContraparteProvider>
                <NovaDespesaProvider>
                  <Moldura>{children}</Moldura>
                </NovaDespesaProvider>
              </NovaContraparteProvider>
            </NovaFerramentaProvider>
          </AdicionarAtividadeProvider>
        </ProtecaoDeSaida>
        <RegiaoAvisos />
        <Abertura />
      </CentralProvider>
    </PortaoNuvem>
  );
}
