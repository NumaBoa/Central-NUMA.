'use client';

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
import type { Pessoa } from '@/dados/tipos/pessoa';
import { contasParaAporte, criarEsquemaAporte, formularioAporteVazio, novoAporteEmDinheiro, type FormularioAporte } from '@/dominio/socias';
import { hojeISO } from '@/lib/datas';

/** T05.05: dinheiro que uma sócia põe na conta da Numa. Não é receita (RN-05.11). */
export function DialogoDeAporte({ socias, contas, aoFechar }: { socias: readonly Pessoa[]; contas: readonly ContaFinanceira[]; aoFechar: () => void }) {
  const hoje = hojeISO();
  const disponiveis = useMemo(() => contasParaAporte(contas), [contas]);
  const resolvedor = useMemo(() => zodResolver(criarEsquemaAporte(hoje)), [hoje]);
  const { register, handleSubmit, control, watch, trigger, formState } = useForm<FormularioAporte>({ resolver: resolvedor, defaultValues: formularioAporteVazio(hoje), mode: 'onTouched' });
  const { errors, isSubmitting } = formState;
  const valores = watch();
  const credencial = useAvisoDeCredencial([valores.observacao, valores.sem_comprovante_motivo]);

  const camposLigados = String(valores.sem_comprovante);
  const ligadosConferidos = useRef(camposLigados);
  useEffect(() => {
    if (ligadosConferidos.current === camposLigados) return;
    ligadosConferidos.current = camposLigados;
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  const enviar = handleSubmit(async (formulario) => {
    if (!credencial.podeGravar()) return;
    try {
      await novoAporteEmDinheiro(formulario, hoje);
      aviso('Aporte registrado.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <form onSubmit={(evento) => void enviar(evento)} noValidate>
          <DialogTitle>Novo aporte em dinheiro</DialogTitle>
          <DialogDescription className="mt-3 leading-[1.6]">Dinheiro de uma sócia que entrou numa conta da Numa. Não conta como receita.</DialogDescription>
          <div className="mt-4 grid gap-4">
            {disponiveis.length === 0 && (
              <Faixa tipo="atencao">
                Ainda não há conta da Numa em reais.{' '}
                <LinkCentral href="/configuracoes/cadastros/contas" className="inline-flex min-h-11 items-center underline md:min-h-0">
                  Cadastrar a conta
                </LinkCentral>
              </Faixa>
            )}
            <Controller
              control={control}
              name="socia_id"
              render={({ field }) => (
                <Campo id="aporte-socia" rotulo="Sócia" obrigatorio erro={errors.socia_id?.message}>
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      <option value="">Escolha</option>
                      {socias.map((socia) => (
                        <option key={socia.id} value={socia.id}>
                          {socia.nome_completo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <Campo id="aporte-data" rotulo="Data" obrigatorio erro={errors.data?.message}>
                {(controle) => <Input type="date" max={hoje} {...controle} {...register('data')} />}
              </Campo>
              <Campo id="aporte-valor" rotulo="Valor em BRL" obrigatorio erro={errors.valor?.message}>
                {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor')} />}
              </Campo>
            </div>
            <Controller
              control={control}
              name="conta_id"
              render={({ field }) => (
                <Campo id="aporte-conta" rotulo="Conta da Numa que recebeu" obrigatorio erro={errors.conta_id?.message}>
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      <option value="">Escolha</option>
                      {disponiveis.map((conta) => (
                        <option key={conta.id} value={conta.id}>
                          {conta.nome}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
            {!valores.sem_comprovante && (
              <Controller
                control={control}
                name="comprovante_url"
                render={({ field }) => (
                  <Campo id="aporte-comprovante" rotulo="Comprovante" obrigatorio erro={errors.comprovante_url?.message}>
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
              <Campo id="aporte-sem-comprovante-motivo" rotulo="Por que não tem?" obrigatorio erro={errors.sem_comprovante_motivo?.message}>
                {(controle) => <Input autoComplete="off" {...controle} {...register('sem_comprovante_motivo')} />}
              </Campo>
            )}
            <Campo id="aporte-observacao" rotulo="Observação" erro={errors.observacao?.message}>
              {(controle) => <Input autoComplete="off" {...controle} {...register('observacao')} />}
            </Campo>
            {credencial.aviso}
          </div>
          <div className="acoes-dialogo">
            <Button variante="secundario" onClick={aoFechar}>
              Voltar
            </Button>
            <Button type="submit" carregando={isSubmitting}>
              Registrar aporte
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
