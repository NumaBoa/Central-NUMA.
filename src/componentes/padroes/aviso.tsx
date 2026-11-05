'use client';

import { toast, Toaster } from 'sonner';
import { useEhCelular } from '@/lib/use-eh-celular';

/** Avisos (18 §9.10): canto inferior direito; no celular, acima da barra de navegação. Some em 5s. */
export function RegiaoAvisos() {
  const celular = useEhCelular();
  return (
    <Toaster
      position="bottom-right"
      duration={5000}
      visibleToasts={3}
      gap={8}
      offset={celular ? { bottom: 'calc(84px + var(--area-segura-baixo))', left: 16, right: 16 } : { bottom: 24, right: 28 }}
      mobileOffset={{ bottom: 'calc(84px + var(--area-segura-baixo))', left: 16, right: 16 }}
      toastOptions={{ unstyled: true, classNames: { toast: 'aviso-numa' } }}
    />
  );
}

type OpcoesAviso = { acao?: { rotulo: string; aoClicar: () => void } };

/** Mensagem curta com ponto índigo à esquerda e, se fizer sentido, uma ação ("Abrir", "Desfazer"). */
export function aviso(texto: string, { acao }: OpcoesAviso = {}) {
  toast(texto, {
    icon: <span className="block size-2 rounded-full bg-indigo" aria-hidden />,
    action: acao ? { label: acao.rotulo, onClick: acao.aoClicar } : undefined,
  });
}
