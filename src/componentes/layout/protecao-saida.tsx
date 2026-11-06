'use client';

import { createContext, use, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Confirmacao } from '@/componentes/padroes/confirmacao';

type ValorProtecao = {
  definirPendencia: (pendente: boolean) => void;
  /** Verdadeiro quando a saída ficou esperando a confirmação. */
  reterSaida: (destino: string) => boolean;
};

const ContextoProtecao = createContext<ValorProtecao | null>(null);

function caminhoDe(destino: string): string {
  return destino.split(/[?#]/, 1)[0] ?? destino;
}

/**
 * "Fechar com alterações pendentes pede confirmação" (P3), em qualquer tela da Central. Fechar ou
 * recarregar a aba usa o aviso do próprio navegador. O botão Voltar do navegador não passa por aqui:
 * o Next não oferece como segurar essa navegação.
 */
export function ProtecaoDeSaida({ children }: { children: ReactNode }) {
  const roteador = useRouter();
  const caminho = usePathname();
  const pendente = useRef(false);
  const [destino, setDestino] = useState<string | null>(null);

  const valor = useMemo<ValorProtecao>(
    () => ({
      definirPendencia(novo) {
        pendente.current = novo;
      },
      reterSaida(alvo) {
        if (!pendente.current || caminhoDe(alvo) === caminho) return false;
        setDestino(alvo);
        return true;
      },
    }),
    [caminho],
  );

  useEffect(() => {
    const aoSairDaPagina = (evento: BeforeUnloadEvent) => {
      if (pendente.current) evento.preventDefault();
    };
    window.addEventListener('beforeunload', aoSairDaPagina);
    return () => window.removeEventListener('beforeunload', aoSairDaPagina);
  }, []);

  return (
    <ContextoProtecao value={valor}>
      {children}
      <Confirmacao
        aberto={destino !== null}
        aoFechar={() => setDestino(null)}
        titulo="Descartar as alterações?"
        texto="O que você preencheu neste formulário não será salvo."
        rotuloConfirmar="Descartar alterações"
        rotuloCancelar="Continuar editando"
        perigo
        aoConfirmar={() => {
          pendente.current = false;
          if (destino) roteador.push(destino);
          setDestino(null);
        }}
      />
    </ContextoProtecao>
  );
}

/** A tela avisa enquanto tiver algo sem salvar. Ao sair da tela, o aviso acaba. */
export function useAlteracoesPendentes(alterado: boolean) {
  const protecao = use(ContextoProtecao);
  useEffect(() => {
    protecao?.definirPendencia(alterado);
    return () => protecao?.definirPendencia(false);
  }, [protecao, alterado]);
}

/** Link interno da Central: passa pela proteção antes de sair da tela. */
export function LinkCentral({ onNavigate, href, ...props }: ComponentProps<typeof Link>) {
  const protecao = use(ContextoProtecao);
  return (
    <Link
      href={href}
      onNavigate={(evento) => {
        onNavigate?.(evento);
        if (typeof href === 'string' && protecao?.reterSaida(href)) evento.preventDefault();
      }}
      {...props}
    />
  );
}
