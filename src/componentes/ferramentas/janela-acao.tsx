'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';

type JanelaDeAcaoProps = {
  titulo: string;
  /** O registro sobre o qual a ação cai: "Supabase · Ferramenta". */
  subtitulo?: string;
  aoFechar: () => void;
  aoConfirmar: () => void;
  rotuloConfirmar: string;
  perigo?: boolean;
  confirmando?: boolean;
  /** À esquerda dos botões: o que ainda impede a confirmação, dito por extenso. */
  rodape?: ReactNode;
  children: ReactNode;
};

/**
 * Ação da ficha com prévia (P6): janela central no computador, tela inteira no celular (18 §9.9), como a
 * `JanelaFormulario`, mas com o botão de perigo quando a ação desfaz algo (cancelar uma ferramenta).
 */
export function JanelaDeAcao({ titulo, subtitulo, aoFechar, aoConfirmar, rotuloConfirmar, perigo = false, confirmando = false, rodape, children }: JanelaDeAcaoProps) {
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent variante="janela" semFechar comDescricao={Boolean(subtitulo)} data-largura="larga">
        <header className="flex items-start gap-3 border-b border-line px-4 py-3 md:px-7 md:py-4">
          <Button variante="icone" tamanho="icone" aria-label="Voltar" className="md:hidden" onClick={aoFechar}>
            <ArrowLeft aria-hidden />
          </Button>
          <div className="min-w-0 flex-1 self-center">
            <DialogTitle>{titulo}</DialogTitle>
            {subtitulo && <DialogDescription className="mt-1 text-[13px]">{subtitulo}</DialogDescription>}
          </div>
          <BotaoFechar className="hidden md:inline-grid" onClick={aoFechar} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-7">{children}</div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 pt-3 pb-[calc(12px+var(--area-segura-baixo))] md:px-7 md:py-3">
          {rodape && <div className="mr-auto basis-full text-[13px] md:basis-auto">{rodape}</div>}
          <Button variante="secundario" className="max-md:flex-1" onClick={aoFechar}>
            Voltar
          </Button>
          <Button variante={perigo ? 'perigo' : 'primario'} className="max-md:flex-1" carregando={confirmando} onClick={aoConfirmar}>
            {rotuloConfirmar}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
