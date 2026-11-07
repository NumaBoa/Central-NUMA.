'use client';

import { usePathname } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { useEhCelular } from '@/lib/use-eh-celular';

/** Avisos (18 §9.10): canto inferior direito; no celular, acima da barra de navegação. Some em 5s. */
export function RegiaoAvisos() {
  const celular = useEhCelular();
  // Na T02.01, a barra de ações muda de altura com a rolagem e ocupa a parte de baixo: ali o aviso vai para o topo, para nunca cobrir os botões.
  const noTopo = usePathname() === '/configuracoes';
  return (
    <Toaster
      position={noTopo ? 'top-right' : 'bottom-right'}
      duration={5000}
      visibleToasts={3}
      gap={8}
      offset={celular ? { top: 'calc(72px + var(--area-segura-topo))', bottom: 'calc(84px + var(--area-segura-baixo))', left: 16, right: 16 } : { top: 76, bottom: 24, right: 28 }}
      mobileOffset={{ top: 'calc(72px + var(--area-segura-topo))', bottom: 'calc(84px + var(--area-segura-baixo))', left: 16, right: 16 }}
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
