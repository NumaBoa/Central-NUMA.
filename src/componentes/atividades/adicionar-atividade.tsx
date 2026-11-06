'use client';

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { CAMINHO_DA_ATIVIDADE } from '@/dominio/atividades-painel';
import { MENSAGEM_DE_CRIADA, type TipoNovo } from '@/dominio/atividades-formulario';
import { FormularioAtividade } from './formulario-atividade';

type ValorAdicionar = {
  abrirAdicionar: (tipo: TipoNovo) => void;
  /** A que acabou de ser criada: o cartão ganha um destaque breve (T03.03). */
  recenteId: string | null;
};

const ContextoAdicionar = createContext<ValorAdicionar | null>(null);

/**
 * T03.03 abre de qualquer tela: do "+ Novo", do "+" do celular e do "Adicionar" do Meu dia. O
 * formulário só é montado na primeira vez que alguém pede.
 */
export function AdicionarAtividadeProvider({ children }: { children: ReactNode }) {
  const roteador = useRouter();
  const { pessoa, contexto } = useCentral();
  const [tipo, setTipo] = useState<TipoNovo>('tarefa');
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [recenteId, setRecenteId] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abrirAdicionar = useCallback((novo: TipoNovo) => {
    setTipo(novo);
    setMontado(true);
    setAberto(true);
  }, []);

  const aoCriar = useCallback(
    (id: string, criado: TipoNovo) => {
      setRecenteId(id);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setRecenteId(null), 2500);
      aviso(MENSAGEM_DE_CRIADA[criado], { acao: { rotulo: 'Abrir', aoClicar: () => roteador.push(CAMINHO_DA_ATIVIDADE(id)) } });
    },
    [roteador],
  );

  const valor = useMemo(() => ({ abrirAdicionar, recenteId }), [abrirAdicionar, recenteId]);

  return (
    <ContextoAdicionar value={valor}>
      {children}
      {montado && <FormularioAtividade aberto={aberto} aoFechar={() => setAberto(false)} tipoInicial={tipo} pessoaId={pessoa.id} contextoGlobalId={contexto.id} aoCriar={aoCriar} />}
    </ContextoAdicionar>
  );
}

export function useAdicionarAtividade(): ValorAdicionar {
  const valor = use(ContextoAdicionar);
  if (!valor) throw new Error('useAdicionarAtividade precisa do AdicionarAtividadeProvider');
  return valor;
}
