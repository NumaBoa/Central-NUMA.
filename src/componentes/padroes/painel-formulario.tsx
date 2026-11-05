'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Confirmacao } from './confirmacao';

export type ErroDeCampo = { campoId: string; mensagem: string };

/** Resumo no topo, com links para cada erro (P3). */
export function ResumoErros({ erros }: { erros: readonly ErroDeCampo[] }) {
  if (!erros.length) return null;
  return (
    <div role="alert" className="mb-5 rounded-md bg-err-wash p-4 text-[13px] text-err">
      <strong className="block font-semibold">{erros.length === 1 ? 'Falta ajustar 1 campo.' : `Faltam ajustar ${erros.length} campos.`}</strong>
      {erros.map((erro) => (
        <a
          key={erro.campoId}
          href={`#${erro.campoId}`}
          className="mt-1.5 block underline"
          onClick={(evento) => {
            evento.preventDefault();
            document.getElementById(erro.campoId)?.focus();
          }}
        >
          {erro.mensagem}
        </a>
      ))}
    </div>
  );
}

type PainelFormularioProps = {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  /** Fechar com alterações pendentes pede confirmação (P3). */
  alterado?: boolean;
  aoEnviar: (evento: FormEvent<HTMLFormElement>) => void;
  rotuloSalvar?: string;
  /** "Salvar e adicionar outro", quando fizer sentido. */
  aoSalvarEOutro?: () => void;
  rotuloSalvarEOutro?: string;
  salvando?: boolean;
  erros?: readonly ErroDeCampo[];
  children: ReactNode;
};

/** Formulário em painel lateral (P3 e 18 §9.9): 480/420px; no celular, tela inteira com ações fixas. */
export function PainelFormulario({
  aberto,
  aoFechar,
  titulo,
  descricao,
  alterado = false,
  aoEnviar,
  rotuloSalvar = 'Salvar',
  aoSalvarEOutro,
  rotuloSalvarEOutro = 'Salvar e adicionar outro',
  salvando = false,
  erros = [],
  children,
}: PainelFormularioProps) {
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  function pedirFechar() {
    if (alterado) setConfirmandoSaida(true);
    else aoFechar();
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={(proximo) => !proximo && pedirFechar()}>
        <DialogContent
          variante="painel"
          semFechar
          comDescricao={Boolean(descricao)}
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            (evento.currentTarget as HTMLElement).querySelector<HTMLElement>('input:not([type="radio"]), textarea, select')?.focus();
          }}
        >
          <form noValidate onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
            <header className="flex items-start gap-3 border-b border-line px-4 py-3 md:px-6 md:py-5">
              <Button variante="icone" tamanho="icone" aria-label="Voltar" className="md:hidden" onClick={pedirFechar}>
                <ArrowLeft aria-hidden />
              </Button>
              <div className="min-w-0 flex-1 self-center">
                <DialogTitle>{titulo}</DialogTitle>
                {descricao && <DialogDescription className="mt-1 text-[13px]">{descricao}</DialogDescription>}
              </div>
              <BotaoFechar className="hidden md:inline-grid" onClick={pedirFechar} />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <ResumoErros erros={erros} />
              {children}
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 pt-3 pb-[calc(12px+var(--area-segura-baixo))] md:px-6 md:py-4 max-md:[&>*]:flex-1">
              <Button variante="secundario" onClick={pedirFechar}>
                Cancelar
              </Button>
              {aoSalvarEOutro && (
                <Button variante="secundario" disabled={salvando} onClick={aoSalvarEOutro}>
                  {rotuloSalvarEOutro}
                </Button>
              )}
              <Button type="submit" carregando={salvando}>
                {rotuloSalvar}
              </Button>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
      <Confirmacao
        aberto={confirmandoSaida}
        aoFechar={() => setConfirmandoSaida(false)}
        titulo="Descartar as alterações?"
        texto="O que você preencheu neste formulário não será salvo."
        rotuloConfirmar="Descartar alterações"
        rotuloCancelar="Continuar editando"
        perigo
        aoConfirmar={() => {
          setConfirmandoSaida(false);
          aoFechar();
        }}
      />
    </>
  );
}
