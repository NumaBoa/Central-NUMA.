'use client';

import { useEffect, useMemo, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useAvisoDeCredencial } from '@/componentes/campos/aviso-credencial';
import { Campo } from '@/componentes/campos/campo';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import { lerValor } from '@/dominio/dinheiro';
import { conferirSaldo, criarEsquemaConferencia, diferencaDoSaldo, formularioConferenciaVazio, saldoDaConta, type DadosDosSaldos, type FormularioConferencia } from '@/dominio/saldos';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/formatacao';

/** T05.07: o saldo do banco contra o do sistema. Não ajusta sozinho: o ajuste só nasce marcado, com motivo. */
export function DialogoDeConferencia({ conta, dados, aoFechar }: { conta: ContaFinanceira; dados: DadosDosSaldos; aoFechar: () => void }) {
  const hoje = hojeISO();
  const { pessoa } = useCentral();
  const resolvedor = useMemo(() => zodResolver(criarEsquemaConferencia(conta, hoje)), [conta, hoje]);
  const { register, handleSubmit, watch, setValue, trigger, formState } = useForm<FormularioConferencia>({ resolver: resolvedor, defaultValues: formularioConferenciaVazio(hoje), mode: 'onTouched' });
  const { errors, isSubmitting } = formState;
  const valores = watch();
  const credencial = useAvisoDeCredencial([valores.motivo]);
  const informado = lerValor(valores.saldo_informado);
  const noSistema = valores.data ? saldoDaConta(conta, dados, valores.data) : null;
  const diferenca = informado !== null && noSistema !== null ? diferencaDoSaldo(noSistema, informado) : null;
  const temDiferenca = diferenca !== null && diferenca !== 0;

  // Sem diferença, não há o que ajustar: a marca não pode ficar valendo escondida.
  useEffect(() => {
    if (!temDiferenca && valores.ajustar) setValue('ajustar', false);
  }, [temDiferenca, valores.ajustar, setValue]);

  const camposLigados = String(valores.ajustar);
  const ligadosConferidos = useRef(camposLigados);
  useEffect(() => {
    if (ligadosConferidos.current === camposLigados) return;
    ligadosConferidos.current = camposLigados;
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  const enviar = handleSubmit(async (formulario) => {
    if (!credencial.podeGravar()) return;
    try {
      const conferencia = await conferirSaldo(conta.id, { data: formulario.data, saldoInformado: lerValor(formulario.saldo_informado) as number, ajustar: formulario.ajustar, motivo: formulario.motivo }, pessoa.id, hoje);
      aviso(conferencia.ajuste_titulo_id ? 'Conferência registrada, com o ajuste.' : 'Conferência registrada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <form onSubmit={(evento) => void enviar(evento)} noValidate>
          <DialogTitle>Conferir saldo</DialogTitle>
          <DialogDescription className="mt-3 leading-[1.6]">{conta.nome}. Informe o saldo real do banco numa data, e veja a diferença para o sistema.</DialogDescription>
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <Campo id="conferencia-data" rotulo="Data" obrigatorio erro={errors.data?.message}>
                {(controle) => <Input type="date" max={hoje} {...(conta.data_saldo_inicial ? { min: conta.data_saldo_inicial } : {})} {...controle} {...register('data')} />}
              </Campo>
              <Campo id="conferencia-saldo" rotulo={`Saldo do banco em ${conta.moeda}`} obrigatorio erro={errors.saldo_informado?.message}>
                {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('saldo_informado')} />}
              </Campo>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-md bg-mist px-3.5 py-3 text-[13px]" aria-label="Comparação com o sistema">
              <div>
                <dt className="text-xs text-ink-soft">No sistema nesta data</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{noSistema === null ? '—' : formatarDinheiro(noSistema, conta.moeda)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Diferença</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{diferenca === null ? '—' : formatarDinheiro(diferenca, conta.moeda)}</dd>
              </div>
            </dl>
            {temDiferenca && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] md:min-h-0">
                <input type="checkbox" className="size-[18px] accent-[var(--ok)]" {...register('ajustar')} />
                Criar um ajuste para o saldo do sistema ficar igual ao do banco
              </label>
            )}
            {temDiferenca && valores.ajustar && (
              <Campo id="conferencia-motivo" rotulo="Motivo do ajuste" obrigatorio erro={errors.motivo?.message}>
                {(controle) => <Input autoComplete="off" {...controle} {...register('motivo')} />}
              </Campo>
            )}
            {credencial.aviso}
          </div>
          <div className="acoes-dialogo">
            <Button variante="secundario" onClick={aoFechar}>
              Voltar
            </Button>
            <Button type="submit" carregando={isSubmitting}>
              Registrar conferência
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
