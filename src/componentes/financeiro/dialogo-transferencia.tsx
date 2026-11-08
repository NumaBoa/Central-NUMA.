'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { useEffect, useMemo, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAvisoDeCredencial } from '@/componentes/campos/aviso-credencial';
import { Campo } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import { contasParaTransferencia, criarEsquemaTransferencia, formularioTransferenciaVazio, registrarTransferencia, sugestaoDoDestino, type FormularioTransferencia } from '@/dominio/saldos';
import { hojeISO } from '@/lib/datas';

/** T05.06: dinheiro que muda de conta. Não é receita nem despesa (RN-05.10). */
export function DialogoDeTransferencia({ contas, aoFechar }: { contas: readonly ContaFinanceira[]; aoFechar: () => void }) {
  const hoje = hojeISO();
  const disponiveis = useMemo(() => contasParaTransferencia(contas), [contas]);
  const resolvedor = useMemo(() => zodResolver(criarEsquemaTransferencia(disponiveis, hoje)), [disponiveis, hoje]);
  const { register, handleSubmit, control, watch, setValue, trigger, formState } = useForm<FormularioTransferencia>({ resolver: resolvedor, defaultValues: formularioTransferenciaVazio(hoje), mode: 'onTouched' });
  const { errors, isSubmitting } = formState;
  const valores = watch();
  const credencial = useAvisoDeCredencial([valores.observacao, valores.sem_comprovante_motivo]);
  const origem = disponiveis.find((conta) => conta.id === valores.conta_origem_id);
  const destino = disponiveis.find((conta) => conta.id === valores.conta_destino_id);
  const moedasDiferentes = Boolean(origem && destino && origem.moeda !== destino.moeda);

  const camposLigados = `${valores.conta_origem_id}|${valores.conta_destino_id}|${valores.sem_comprovante}`;
  const ligadosConferidos = useRef(camposLigados);
  useEffect(() => {
    if (ligadosConferidos.current === camposLigados) return;
    ligadosConferidos.current = camposLigados;
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  // Quanto chegou: calculado pelo câmbio, e editável para casar com o extrato do banco.
  const base = `${valores.valor_origem}|${valores.cambio}|${origem?.moeda}|${destino?.moeda}`;
  const calculoAplicado = useRef(base);
  useEffect(() => {
    if (calculoAplicado.current === base) return;
    calculoAplicado.current = base;
    if (!origem || !destino) return;
    const sugestao = sugestaoDoDestino(origem.moeda, destino.moeda, valores.valor_origem, valores.cambio);
    if (sugestao) setValue('valor_destino', sugestao, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o cálculo só depende destes campos
  }, [base]);

  const enviar = handleSubmit(async (formulario) => {
    if (!credencial.podeGravar()) return;
    try {
      await registrarTransferencia(formulario, hoje);
      aviso('Transferência registrada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  const selecaoDeConta = (nome: 'conta_origem_id' | 'conta_destino_id', id: string, rotulo: string) => (
    <Controller
      control={control}
      name={nome}
      render={({ field }) => (
        <Campo id={id} rotulo={rotulo} obrigatorio erro={errors[nome]?.message}>
          {(controle) => (
            <Selecao {...controle} {...field}>
              <option value="">Escolha</option>
              {disponiveis.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome} ({conta.moeda})
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
      )}
    />
  );

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent telaCheia semFechar comDescricao>
        <form onSubmit={(evento) => void enviar(evento)} noValidate>
          <DialogTitle>Nova transferência</DialogTitle>
          <DialogDescription className="mt-3 leading-[1.6]">Entre contas da Numa. Sai de uma, entra na outra, e não conta como receita nem despesa.</DialogDescription>
          <div className="mt-4 grid gap-4">
            {disponiveis.length < 2 && (
              <Faixa tipo="atencao">
                É preciso ter ao menos duas contas da Numa.{' '}
                <LinkCentral href="/financeiro/contas/cadastro" className="inline-flex min-h-11 items-center underline md:min-h-0">
                  Cadastrar conta
                </LinkCentral>
              </Faixa>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <Campo id="transferencia-data" rotulo="Data" obrigatorio erro={errors.data?.message}>
                {(controle) => <EntradaData max={hoje} {...controle} {...register('data')} />}
              </Campo>
              <Campo id="transferencia-valor" rotulo={`Valor${origem ? ` em ${origem.moeda}` : ''}`} obrigatorio erro={errors.valor_origem?.message}>
                {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor_origem')} />}
              </Campo>
            </div>
            {selecaoDeConta('conta_origem_id', 'transferencia-origem', 'Conta de origem')}
            {selecaoDeConta('conta_destino_id', 'transferencia-destino', 'Conta de destino')}
            {moedasDiferentes && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <Campo id="transferencia-cambio" rotulo="Câmbio" obrigatorio erro={errors.cambio?.message}>
                  {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('cambio')} />}
                </Campo>
                <Campo id="transferencia-chegou" rotulo={`Chegou em ${destino?.moeda}`} obrigatorio erro={errors.valor_destino?.message}>
                  {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor_destino')} />}
                </Campo>
              </div>
            )}
            {!valores.sem_comprovante && (
              <Controller
                control={control}
                name="comprovante_url"
                render={({ field }) => (
                  <Campo id="transferencia-comprovante" rotulo="Comprovante" obrigatorio erro={errors.comprovante_url?.message}>
                    {(controle) => <EntradaLinkDrive link={field.value} {...controle} {...field} />}
                  </Campo>
                )}
              />
            )}
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] md:min-h-0">
              <input type="checkbox" className="size-[18px] accent-[var(--ok)]" {...register('sem_comprovante')} />
              Não tenho comprovante
            </label>
            {valores.sem_comprovante && (
              <Campo id="transferencia-sem-comprovante-motivo" rotulo="Por que não tem?" obrigatorio erro={errors.sem_comprovante_motivo?.message}>
                {(controle) => <Input autoComplete="off" {...controle} {...register('sem_comprovante_motivo')} />}
              </Campo>
            )}
            <Campo id="transferencia-observacao" rotulo="Observação" erro={errors.observacao?.message}>
              {(controle) => <Input autoComplete="off" {...controle} {...register('observacao')} />}
            </Campo>
            {credencial.aviso}
          </div>
          <div className="acoes-dialogo">
            <Button variante="secundario" onClick={aoFechar}>
              Voltar
            </Button>
            <Button type="submit" carregando={isSubmitting}>
              Registrar transferência
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
