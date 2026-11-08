'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FormularioContraparte } from '@/app/(central)/configuracoes/cadastros/contrapartes/formulario-contraparte';
import { aviso } from '@/componentes/padroes/aviso';
import { useConsulta } from '@/dados/use-consulta';
import { carregarContrapartes } from '@/dominio/contrapartes';

const CAMINHO_DE_CONTRAPARTES = '/comercial/contrapartes';

const ContextoNovaContraparte = createContext<{ abrirNovaContraparte: () => void } | null>(null);

function FormularioGlobal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const roteador = useRouter();
  const consulta = useConsulta(carregarContrapartes);
  if (!consulta.dados) return null;
  return <FormularioContraparte aberto={aberto} aoFechar={aoFechar} pessoas={consulta.dados.pessoas} aoCadastrar={(contraparte) => aviso('Contraparte cadastrada.', { acao: { rotulo: 'Abrir', aoClicar: () => roteador.push(`${CAMINHO_DE_CONTRAPARTES}/${contraparte.id}/cadastro`) } })} />;
}

/** "+ Novo" abre de qualquer tela, sem sair dela (02 §4). O formulário só é montado na primeira vez. */
export function NovaContraparteProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const abrirNovaContraparte = useCallback(() => {
    setMontado(true);
    setAberto(true);
  }, []);
  const valor = useMemo(() => ({ abrirNovaContraparte }), [abrirNovaContraparte]);
  return (
    <ContextoNovaContraparte value={valor}>
      {children}
      {montado && <FormularioGlobal aberto={aberto} aoFechar={() => setAberto(false)} />}
    </ContextoNovaContraparte>
  );
}

export function useNovaContraparte() {
  const valor = use(ContextoNovaContraparte);
  if (!valor) throw new Error('useNovaContraparte precisa do NovaContraparteProvider');
  return valor;
}
