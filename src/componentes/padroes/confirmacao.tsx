'use client';

import { useId, useState, type ReactNode } from 'react';
import { MensagemErro } from '@/componentes/campos/campo';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Textarea } from '@/componentes/ui/textarea';

type ConfirmacaoProps = {
  aberto: boolean;
  aoFechar: () => void;
  /** Título com o verbo da ação. */
  titulo: string;
  /** As consequências, em frases curtas. */
  texto: ReactNode;
  /** Botão com o verbo ("Cancelar ferramenta"), nunca "OK". */
  rotuloConfirmar: string;
  rotuloCancelar?: string;
  perigo?: boolean;
  /** Motivo obrigatório quando a regra exigir (RT-16). */
  pedirMotivo?: boolean;
  aoConfirmar: (motivo: string) => void;
};

/** Diálogo de confirmação (P5): centralizado no computador e folha inferior no celular. */
export function Confirmacao({ aberto, aoFechar, titulo, texto, rotuloConfirmar, rotuloCancelar = 'Voltar', perigo = false, pedirMotivo = false, aoConfirmar }: ConfirmacaoProps) {
  const idMotivo = useId();
  const [motivo, setMotivo] = useState('');
  const [semMotivo, setSemMotivo] = useState(false);

  function aoMudarAberto(proximo: boolean) {
    if (proximo) return;
    setMotivo('');
    setSemMotivo(false);
    aoFechar();
  }

  function confirmar() {
    const limpo = motivo.trim();
    if (pedirMotivo && !limpo) {
      setSemMotivo(true);
      return;
    }
    setMotivo('');
    setSemMotivo(false);
    aoConfirmar(limpo);
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-3 text-sm leading-[1.6] text-ink-soft">{texto}</div>
        </DialogDescription>
        {pedirMotivo && (
          <div className="mt-4">
            <label htmlFor={idMotivo} className="mb-[7px] block texto-rotulo">
              Motivo *
            </label>
            <Textarea
              id={idMotivo}
              value={motivo}
              onChange={(evento) => {
                setMotivo(evento.target.value);
                if (evento.target.value.trim()) setSemMotivo(false);
              }}
              aria-invalid={semMotivo || undefined}
              aria-describedby={semMotivo ? `${idMotivo}-erro` : undefined}
            />
            {semMotivo && <MensagemErro id={`${idMotivo}-erro`}>Informe o motivo.</MensagemErro>}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">
          <Button variante="secundario" onClick={() => aoMudarAberto(false)}>
            {rotuloCancelar}
          </Button>
          <Button variante={perigo ? 'perigo' : 'primario'} onClick={confirmar}>
            {rotuloConfirmar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
