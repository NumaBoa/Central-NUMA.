'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
export function Dialogo({ aberto, titulo, fechar, children }: { aberto: boolean; titulo: string; fechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (aberto && !dialog.open) dialog.showModal(); else if (!aberto && dialog.open) dialog.close(); if (!aberto) return; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = overflow; }; }, [aberto]);
  return <dialog ref={ref} className="modal" aria-labelledby="dialogo-titulo" onCancel={(event) => { event.preventDefault(); fechar(); }} onClick={(event) => { if (event.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) fechar(); } }}><div className="modal-top"><h2 id="dialogo-titulo">{titulo}</h2><Button variant="ghost" size="icon" aria-label="Fechar" onClick={fechar}><X/></Button></div>{children}</dialog>;
}
