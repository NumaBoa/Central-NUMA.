'use client';

import { useRef, useState, type FormEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Coins, Lock, Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { CambioReferencia } from '@/dados/tipos/cambio-referencia';
import { adicionarCambio, CAMPOS_NOVO_CAMBIO, esquemaNovoCambio, MENSAGEM_CAMBIO_REPETIDO, removerCambio, type NovoCambio } from '@/dominio/cambio';
import { hojeISO } from '@/lib/datas';
import { formatarCotacao, formatarDiaISO } from '@/lib/formatacao';

const REGRAS = [
  { titulo: 'Rateio sempre fecha em 100%', texto: 'Cada custo distribuído, sem duplicar valores.' },
  { titulo: 'Comprovante obrigatório em todos os pagamentos', texto: 'Exceções exigem uma justificativa na baixa.' },
];

/** Regras fixas (T02.01 e D17): aparecem, mas não se alteram. */
export function RegrasFinanceiras() {
  return (
    <>
      {REGRAS.map(({ titulo, texto }) => (
        <div key={titulo} className="flex items-start justify-between gap-4 border-b border-line py-3 text-[13px] first:pt-0 md:items-center">
          <div className="min-w-0">
            <strong className="block leading-[18px] font-semibold">{titulo}</strong>
            <p className="mt-1 text-xs text-ink-soft">{texto}</p>
          </div>
          <EtiquetaSituacao tipo="neutro" icone={Lock}>
            Regra fixa
          </EtiquetaSituacao>
        </div>
      ))}
    </>
  );
}

function descricaoDoCambio(cambio: CambioReferencia): string {
  return `${cambio.moeda} de ${formatarDiaISO(cambio.data_referencia)}`;
}

const COLUNAS: readonly Coluna<CambioReferencia>[] = [
  { id: 'moeda', titulo: 'Moeda', essencial: true, celula: (cambio) => cambio.moeda },
  { id: 'cotacao', titulo: 'Cotação', essencial: true, numerica: true, celula: (cambio) => formatarCotacao(cambio.valor_brl) },
  { id: 'data', titulo: 'Data', essencial: true, celula: (cambio) => formatarDiaISO(cambio.data_referencia) },
  { id: 'fonte', titulo: 'Fonte', essencial: true, celula: (cambio) => cambio.fonte ?? 'Não informada' },
];

/** Câmbio de referência: cada linha grava ao confirmar, sem depender de "Salvar alterações". */
export function SecaoCambio({ cambios }: { cambios: readonly CambioReferencia[] }) {
  const [adicionando, setAdicionando] = useState(false);
  const [removendo, setRemovendo] = useState<CambioReferencia | null>(null);
  const botaoAdicionar = useRef<HTMLButtonElement>(null);

  const { register, handleSubmit, control, reset, setError, setFocus, setValue, formState } = useForm<NovoCambio>({
    resolver: zodResolver(esquemaNovoCambio),
    defaultValues: CAMPOS_NOVO_CAMBIO,
    mode: 'onTouched',
  });
  const { errors, isSubmitting } = formState;

  function abrir() {
    reset(CAMPOS_NOVO_CAMBIO);
    setAdicionando(true);
  }

  const enviar = handleSubmit(async (dados) => {
    try {
      const resultado = await adicionarCambio(dados);
      if (!resultado.ok) {
        setError('data_referencia', { message: MENSAGEM_CAMBIO_REPETIDO });
        setFocus('data_referencia');
        return;
      }
      setAdicionando(false);
      aviso(`Câmbio de ${dados.moeda} adicionado.`);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  /** O diálogo é outro formulário: o envio dele não pode chegar ao "Salvar alterações" da página. */
  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.stopPropagation();
    void enviar(evento);
  }

  const confirmarRemocao = () => {
    if (!removendo) return;
    const cambio = removendo;
    setRemovendo(null);
    removerCambio(cambio.id).then(
      () => {
        aviso(`Câmbio de ${descricaoDoCambio(cambio)} removido.`);
        // o botão que abriu a confirmação saiu da tela junto com a linha (RT-19)
        botaoAdicionar.current?.focus();
      },
      (erro: unknown) => aviso(mensagemDoErro(erro)),
    );
  };

  const botaoRemover = (cambio: CambioReferencia) => (
    <Button variante="icone" tamanho="icone" aria-label={`Remover ${descricaoDoCambio(cambio)}`} onClick={() => setRemovendo(cambio)}>
      <Trash2 aria-hidden />
    </Button>
  );

  return (
    <>
      <div className="mt-[22px] mb-3.5 flex items-start justify-between gap-3 md:items-center">
        <h3 className="text-[15px] md:text-[17px]">Câmbio de referência</h3>
        <Button ref={botaoAdicionar} variante="secundario" tamanho="pequeno" onClick={abrir}>
          <Plus aria-hidden />
          Adicionar
        </Button>
      </div>
      <p className="mb-3.5 text-xs leading-normal text-ink-soft">Usado só em estimativas. O pagamento registra o câmbio efetivo.</p>

      <Lista
        rotulo="Câmbio de referência"
        linhas={cambios}
        colunas={COLUNAS}
        chave={(cambio) => cambio.id}
        acoesDaLinha={botaoRemover}
        cartao={(cambio) => (
          <div className="flex items-start justify-between gap-2">
            <dl className="grid grid-cols-[72px_1fr] gap-y-1 text-sm">
              <dt className="text-[13px] text-ink-soft">Moeda</dt>
              <dd className="font-semibold">{cambio.moeda}</dd>
              <dt className="text-[13px] text-ink-soft">Cotação</dt>
              <dd className="tabular-nums">{formatarCotacao(cambio.valor_brl)}</dd>
              <dt className="text-[13px] text-ink-soft">Data</dt>
              <dd>{formatarDiaISO(cambio.data_referencia)}</dd>
              <dt className="text-[13px] text-ink-soft">Fonte</dt>
              <dd className="break-words">{cambio.fonte ?? 'Não informada'}</dd>
            </dl>
            {botaoRemover(cambio)}
          </div>
        )}
        vazio={
          <div className="rounded-md border border-dashed border-line bg-linen px-[15px] py-[25px] text-center">
            <Coins className="mx-auto mb-2 size-[22px] text-ink-soft" aria-hidden />
            <p className="text-[13px] font-semibold">Nenhum câmbio informado.</p>
            <p className="mt-[5px] text-xs text-ink-soft">Adicione a moeda, a cotação, a data e a fonte quando precisar.</p>
          </div>
        }
      />

      <Dialog open={adicionando} onOpenChange={setAdicionando}>
        <DialogContent comDescricao>
          <DialogTitle className="pr-12">Câmbio de referência</DialogTitle>
          <DialogDescription className="mt-3">Uma cotação de referência para estimar custos em outras moedas.</DialogDescription>
          <form noValidate onSubmit={aoEnviar} className="mt-5">
            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
              <Controller
                control={control}
                name="moeda"
                render={({ field }) => (
                  <Campo rotulo="Moeda" obrigatorio erro={errors.moeda?.message}>
                    {(controle) => <SelecaoMoeda semReal {...controle} {...field} />}
                  </Campo>
                )}
              />
              <Campo rotulo="Cotação em R$" obrigatorio erro={errors.cotacao?.message}>
                {(controle) => <Input inputMode="decimal" placeholder="Não informado" autoComplete="off" {...controle} {...register('cotacao')} />}
              </Campo>
              <Campo rotulo="Data de referência" obrigatorio erro={errors.data_referencia?.message}>
                {(controle) => (
                  <div>
                    <Input type="date" {...controle} {...register('data_referencia')} />
                    <Button variante="terciario" tamanho="pequeno" className="mt-1.5" onClick={() => setValue('data_referencia', hojeISO(), { shouldValidate: true, shouldDirty: true })}>
                      Hoje
                    </Button>
                  </div>
                )}
              </Campo>
              <Campo rotulo="Fonte">{(controle) => <Input placeholder="Onde consultou a cotação" autoComplete="off" {...controle} {...register('fonte')} />}</Campo>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">
              <Button variante="secundario" onClick={() => setAdicionando(false)}>
                Voltar
              </Button>
              <Button type="submit" carregando={isSubmitting}>
                Adicionar câmbio
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Confirmacao
        aberto={removendo !== null}
        aoFechar={() => setRemovendo(null)}
        titulo="Remover este câmbio?"
        texto={removendo ? `${descricaoDoCambio(removendo)} sai da lista e deixa de ser usado nas estimativas. O registro continua no histórico.` : ''}
        rotuloConfirmar="Remover câmbio"
        perigo
        aoConfirmar={confirmarRemocao}
      />
    </>
  );
}
