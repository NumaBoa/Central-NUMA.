'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { aviso } from '@/componentes/padroes/aviso';
import { useConsulta } from '@/dados/use-consulta';
import { carregarFerramentas } from '@/dominio/ferramentas';
import { FormularioDeFerramenta } from './formulario-ferramenta';

export const CAMINHO_DE_FERRAMENTAS = '/ferramentas';

const ContextoNovaFerramenta = createContext<{ abrirNovaFerramenta: () => void } | null>(null);

function FormularioGlobal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const roteador = useRouter();
  const consulta = useConsulta(carregarFerramentas);
  if (!consulta.dados) return null;
  return (
    <FormularioDeFerramenta
      aberto={aberto}
      aoFechar={aoFechar}
      dados={consulta.dados}
      aoCriar={(criada) => aviso('Ferramenta criada.', { acao: { rotulo: 'Abrir', aoClicar: () => roteador.push(`${CAMINHO_DE_FERRAMENTAS}/${criada.id}`) } })}
    />
  );
}

/** "+ Novo" abre de qualquer tela, sem sair dela (02 §4). O formulário só é montado na primeira vez. */
export function NovaFerramentaProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const abrirNovaFerramenta = useCallback(() => {
    setMontado(true);
    setAberto(true);
  }, []);
  const valor = useMemo(() => ({ abrirNovaFerramenta }), [abrirNovaFerramenta]);
  return (
    <ContextoNovaFerramenta value={valor}>
      {children}
      {montado && <FormularioGlobal aberto={aberto} aoFechar={() => setAberto(false)} />}
    </ContextoNovaFerramenta>
  );
}

export function useNovaFerramenta() {
  const valor = use(ContextoNovaFerramenta);
  if (!valor) throw new Error('useNovaFerramenta precisa do NovaFerramentaProvider');
  return valor;
}
