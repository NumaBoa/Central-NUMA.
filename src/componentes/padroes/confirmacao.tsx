'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { MensagemErro } from '@/componentes/campos/campo';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Textarea } from '@/componentes/ui/textarea';
import { AVISO_CREDENCIAL, pareceCredencial } from '@/dominio/segredos';
import { Faixa } from './faixa';

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
  mensagemSemMotivo?: string;
  /** Só informa: um botão, sem ação a confirmar. */
  soInforma?: boolean;
  aoConfirmar: (motivo: string) => void;
};

/** Diálogo de confirmação (P5): centralizado no computador e folha inferior no celular. */
export function Confirmacao({ aberto, aoFechar, titulo, texto, rotuloConfirmar, rotuloCancelar = 'Voltar', perigo = false, pedirMotivo = false, mensagemSemMotivo = 'Informe o motivo.', soInforma = false, aoConfirmar }: ConfirmacaoProps) {
  const idMotivo = useId();
  const campoMotivo = useRef<HTMLTextAreaElement>(null);
  const [motivo, setMotivo] = useState('');
  const [semMotivo, setSemMotivo] = useState(false);
  const [motivoAvisado, setMotivoAvisado] = useState<string | null>(null);

  function aoMudarAberto(proximo: boolean) {
    if (proximo) return;
    setMotivo('');
    setSemMotivo(false);
    setMotivoAvisado(null);
    aoFechar();
  }

  function confirmar() {
    const limpo = motivo.trim();
    if (pedirMotivo && !limpo) {
      setSemMotivo(true);
      campoMotivo.current?.focus();
      return;
    }
    // RT-14: texto livre que parece segredo avisa; confirmar de novo, com o mesmo texto, segue em frente.
    if (pedirMotivo && pareceCredencial(limpo) && motivoAvisado !== limpo) {
      setMotivoAvisado(limpo);
      campoMotivo.current?.focus();
      return;
    }
    setMotivo('');
    setSemMotivo(false);
    setMotivoAvisado(null);
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
              ref={campoMotivo}
              id={idMotivo}
              value={motivo}
              onChange={(evento) => {
                setMotivo(evento.target.value);
                if (evento.target.value.trim()) setSemMotivo(false);
              }}
              aria-invalid={semMotivo || undefined}
              aria-describedby={semMotivo ? `${idMotivo}-erro` : undefined}
            />
            {semMotivo && <MensagemErro id={`${idMotivo}-erro`}>{mensagemSemMotivo}</MensagemErro>}
            {motivoAvisado !== null && motivoAvisado === motivo.trim() && (
              <Faixa tipo="atencao" className="mt-3">
                {AVISO_CREDENCIAL}
              </Faixa>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">
          {!soInforma && (
            <Button variante="secundario" onClick={() => aoMudarAberto(false)}>
              {rotuloCancelar}
            </Button>
          )}
          <Button variante={perigo ? 'perigo' : 'primario'} onClick={soInforma ? () => aoMudarAberto(false) : confirmar}>
            {rotuloConfirmar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
