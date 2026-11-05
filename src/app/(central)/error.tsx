'use client';

import { EstadoErro } from '@/componentes/padroes/estados';

export default function ErroDaTela({ retry }: { retry: () => void }) {
  return <EstadoErro aoTentarDeNovo={retry} />;
}
