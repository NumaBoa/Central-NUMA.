'use client';

import { useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { cn } from '@/lib/utils';
import { Confirmacao } from './confirmacao';

export type ErroDeCampo = { campoId: string; mensagem: string };

/** Resumo no topo, com links para cada erro (P3). */
export function ResumoErros({ erros, ref }: { erros: readonly ErroDeCampo[]; ref?: Ref<HTMLDivElement> }) {
  if (!erros.length) return null;
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="mb-5 rounded-md bg-err-wash p-4 text-[13px] text-err focus:outline-none">
      <strong className="block font-semibold">{erros.length === 1 ? 'Falta ajustar 1 campo.' : `Faltam ajustar ${erros.length} campos.`}</strong>
      {erros.map((erro) => (
        <a
          key={erro.campoId}
          href={`#${erro.campoId}`}
          className="mt-0.5 flex min-h-11 items-center underline md:mt-1.5 md:block md:min-h-0"
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

type JanelaFormularioProps = {
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
  /** Formulário longo: janela larga, em duas colunas no computador, para o essencial caber sem rolar. */
  colunas?: 1 | 2;
  /** Janela larga, com o layout das colunas por conta de quem usa. */
  larga?: boolean;
  /** Título no tamanho de página (T03.03). */
  tituloGrande?: boolean;
  /** Ícone do botão de salvar. */
  iconeSalvar?: ReactNode;
  /** Só para ler: sem salvar, e "Cancelar" vira "Fechar". */
  soLeitura?: boolean;
  children: ReactNode;
};

/** Formulário em janela central (decisão de Kimberly em 06/11/2026); no celular, tela inteira com ações fixas. */
export function JanelaFormulario({
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
  colunas = 1,
  larga = false,
  tituloGrande = false,
  iconeSalvar,
  soLeitura = false,
  children,
}: JanelaFormularioProps) {
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  function pedirFechar() {
    if (alterado) setConfirmandoSaida(true);
    else aoFechar();
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={(proximo) => !proximo && pedirFechar()}>
        <DialogContent
          variante="janela"
          semFechar
          comDescricao={Boolean(descricao)}
          data-largura={larga || colunas === 2 ? 'larga' : undefined}
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
                <DialogTitle className={tituloGrande ? 'md:text-[30px] md:leading-9 md:tracking-[-.03em]' : undefined}>{titulo}</DialogTitle>
                {descricao && <DialogDescription className={tituloGrande ? 'mt-1 text-sm' : 'mt-1 text-[13px]'}>{descricao}</DialogDescription>}
              </div>
              <BotaoFechar className="hidden md:inline-grid" onClick={pedirFechar} />
            </header>
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7', colunas === 2 && 'janela-colunas')}>
              <ResumoErros erros={erros} />
              {children}
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 pt-3 pb-[calc(12px+var(--area-segura-baixo))] md:px-7 md:py-4 max-md:[&>*]:flex-1">
              {/* Com três botões, "Cancelar" fica à parte; no celular, o "Voltar" do topo faz o mesmo e sobra lugar para os outros. */}
              <Button variante={aoSalvarEOutro ? 'terciario' : 'secundario'} className={aoSalvarEOutro ? 'mr-auto max-md:hidden' : undefined} onClick={pedirFechar}>
                {soLeitura ? 'Fechar' : 'Cancelar'}
              </Button>
              {aoSalvarEOutro && !soLeitura && (
                <Button variante="secundario" disabled={salvando} onClick={aoSalvarEOutro}>
                  {rotuloSalvarEOutro}
                </Button>
              )}
              {!soLeitura && (
                <Button type="submit" carregando={salvando}>
                  {iconeSalvar}
                  {rotuloSalvar}
                </Button>
              )}
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
