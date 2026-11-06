'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { aviso } from '@/componentes/padroes/aviso';
import { useConsulta } from '@/dados/use-consulta';
import { carregarLancamentos } from '@/dominio/lancamentos';
import { hojeISO } from '@/lib/datas';
import { FormularioDeDespesa } from './formulario-despesa';

const ContextoNovaDespesa = createContext<{ abrirNovaDespesa: () => void } | null>(null);

function FormularioGlobal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarLancamentos(hoje), [hoje]);
  if (!consulta.dados) return null;
  return <FormularioDeDespesa aberto={aberto} aoFechar={aoFechar} dados={consulta.dados} aoCriar={() => aviso('Despesa lançada.')} />;
}

/** "+ Novo" abre de qualquer tela, sem sair dela (02 §4). O formulário só é montado na primeira vez. */
export function NovaDespesaProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const abrirNovaDespesa = useCallback(() => {
    setMontado(true);
    setAberto(true);
  }, []);
  const valor = useMemo(() => ({ abrirNovaDespesa }), [abrirNovaDespesa]);
  return (
    <ContextoNovaDespesa value={valor}>
      {children}
      {montado && <FormularioGlobal aberto={aberto} aoFechar={() => setAberto(false)} />}
    </ContextoNovaDespesa>
  );
}

export function useNovaDespesa() {
  const valor = use(ContextoNovaDespesa);
  if (!valor) throw new Error('useNovaDespesa precisa do NovaDespesaProvider');
  return valor;
}
