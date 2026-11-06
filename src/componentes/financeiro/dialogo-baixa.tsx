'use client';

import { useEffect, useMemo, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import { criarEsquemaBaixa, formularioBaixaVazio, pagamentosEstornaveis, registrarBaixa, sugestaoEmReais, type FormularioBaixa as Formulario } from '@/dominio/baixas';
import type { LinhaDoTitulo } from '@/dominio/lancamentos';
import { ROTULOS_TIPO_BAIXA, ROTULOS_TRATAMENTO } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

/** T05.04: o saldo já vem preenchido. Conta de sócia pede o tratamento (RN-05.06). */
export function DialogoDeBaixa({ titulo, contas, aoFechar, tipoInicial = 'pagamento' }: { titulo: LinhaDoTitulo; contas: readonly ContaFinanceira[]; aoFechar: () => void; tipoInicial?: Formulario['tipo'] }) {
  const hoje = hojeISO();
  const contasAtivas = useMemo(() => contas.filter((conta) => !conta.arquivado_em && conta.situacao === 'ativa'), [contas]);
  const resolvedor = useMemo(() => zodResolver(criarEsquemaBaixa(titulo, titulo.saldo, contasAtivas, hoje)), [titulo, contasAtivas, hoje]);
  const { register, handleSubmit, control, watch, setValue, trigger, formState } = useForm<Formulario>({ resolver: resolvedor, defaultValues: { ...formularioBaixaVazio(titulo, titulo.saldo, hoje), tipo: tipoInicial }, mode: 'onTouched' });
  const { errors, isSubmitting } = formState;
  const valores = watch();
  const estrangeira = titulo.moeda !== 'BRL';
  const conta = contasAtivas.find((item) => item.id === valores.conta_id);
  const deSocia = conta?.tipo === 'pessoal_socia' && titulo.origem !== 'reembolso';
  const estornaveis = pagamentosEstornaveis(titulo.baixas);
  const valorDigitado = Number(valores.valor.replaceAll('.', '').replace(',', '.'));
  const passaDoSaldo = valores.tipo === 'pagamento' && Number.isFinite(valorDigitado) && valorDigitado > titulo.saldo;

  const camposLigados = `${valores.tipo}|${valores.conta_id}|${valores.tratamento}|${valores.sem_comprovante}|${valores.pago_a_mais}`;
  const ligadosConferidos = useRef(camposLigados);
  useEffect(() => {
    if (ligadosConferidos.current === camposLigados) return;
    ligadosConferidos.current = camposLigados;
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  // Valor em reais: calculado, e editável para casar com a fatura (RN-05.05).
  const base = `${valores.valor}|${valores.cambio}|${valores.iof}`;
  const calculoAplicado = useRef(base);
  useEffect(() => {
    if (calculoAplicado.current === base) return;
    calculoAplicado.current = base;
    if (!estrangeira) return;
    const sugestao = sugestaoEmReais(valores);
    if (sugestao) setValue('valor_brl', sugestao, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o cálculo só depende destes três campos
  }, [base]);

  const enviar = handleSubmit(async (formulario) => {
    try {
      await registrarBaixa(titulo, formulario, hoje);
      aviso(formulario.tipo === 'estorno' ? 'Pagamento estornado.' : formulario.tipo === 'ajuste' ? 'Ajuste registrado.' : 'Baixa registrada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  const opcoesDeTipo = (['pagamento', 'estorno', 'ajuste'] as const).filter((tipo) => tipo !== 'estorno' || estornaveis.length > 0).map((valor) => ({ valor, rotulo: ROTULOS_TIPO_BAIXA[valor] }));

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <form onSubmit={(evento) => void enviar(evento)} noValidate>
          <DialogTitle>Registrar baixa</DialogTitle>
          <DialogDescription className="mt-3 leading-[1.6]">
            {titulo.codigo} · {titulo.descricao}. Saldo: <strong className="tabular-nums">{formatarDinheiro(titulo.saldo, titulo.moeda)}</strong>.
          </DialogDescription>
          <div className="mt-4 grid gap-4">
            <Controller control={control} name="tipo" render={({ field }) => <Pilulas rotulo="Tipo" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={opcoesDeTipo} />} />
            {valores.tipo === 'estorno' ? (
              <>
                <Controller
                  control={control}
                  name="baixa_original_id"
                  render={({ field }) => (
                    <Campo id="baixa-original" rotulo="Pagamento a estornar" obrigatorio erro={errors.baixa_original_id?.message}>
                      {(controle) => (
                        <Selecao {...controle} {...field}>
                          <option value="">Escolha</option>
                          {estornaveis.map((baixa) => (
                            <option key={baixa.id} value={baixa.id}>
                              {formatarDiaISO(baixa.data)} · {formatarDinheiro(baixa.valor_moeda, titulo.moeda)}
                            </option>
                          ))}
                        </Selecao>
                      )}
                    </Campo>
                  )}
                />
                <Campo id="baixa-motivo" rotulo="Motivo" obrigatorio erro={errors.motivo?.message} ajuda="O pagamento original fica no histórico. Aporte ou reembolso que nasceu dele é desfeito.">
                  {(controle) => <Input autoComplete="off" {...controle} {...register('motivo')} />}
                </Campo>
              </>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <Campo id="baixa-data" rotulo="Data" obrigatorio erro={errors.data?.message}>
                    {(controle) => <Input type="date" max={hoje} {...controle} {...register('data')} />}
                  </Campo>
                  <Campo id="baixa-valor" rotulo={`Valor em ${titulo.moeda}`} obrigatorio erro={errors.valor?.message}>
                    {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor')} />}
                  </Campo>
                </div>
                {passaDoSaldo && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] md:min-h-0">
                    <input type="checkbox" className="size-[18px] accent-[var(--ok)]" {...register('pago_a_mais')} />
                    Valor pago maior (a diferença entra em Juros e multas)
                  </label>
                )}
                <Controller
                  control={control}
                  name="conta_id"
                  render={({ field }) => (
                    <Campo id="baixa-conta" rotulo="Conta" obrigatorio erro={errors.conta_id?.message}>
                      {(controle) => (
                        <Selecao {...controle} {...field}>
                          <option value="">Escolha</option>
                          {contasAtivas.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nome}
                            </option>
                          ))}
                        </Selecao>
                      )}
                    </Campo>
                  )}
                />
                {estrangeira && (
                  <>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <Campo id="baixa-cambio" rotulo="Câmbio" obrigatorio erro={errors.cambio?.message}>
                        {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('cambio')} />}
                      </Campo>
                      <Campo id="baixa-iof" rotulo="IOF em reais" erro={errors.iof?.message}>
                        {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('iof')} />}
                      </Campo>
                    </div>
                    <Campo id="baixa-valor-brl" rotulo="Valor efetivo em reais" obrigatorio erro={errors.valor_brl?.message} ajuda="Calculado. Pode ajustar para casar com a fatura.">
                      {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor_brl')} />}
                    </Campo>
                  </>
                )}
                {deSocia && valores.tipo === 'pagamento' && (
                  <div id="baixa-tratamento" tabIndex={-1} className="grid gap-4">
                    <div>
                      <Controller control={control} name="tratamento" render={({ field }) => <Pilulas rotulo="Conta de sócia: como tratar?" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={Object.entries(ROTULOS_TRATAMENTO).map(([valor, rotulo]) => ({ valor, rotulo }))} />} />
                      {errors.tratamento?.message && <MensagemErro>{errors.tratamento.message}</MensagemErro>}
                    </div>
                    {valores.tratamento === 'reembolso' && (
                      <Campo id="baixa-vencimento-reembolso" rotulo="Vencimento do reembolso" obrigatorio erro={errors.vencimento_reembolso?.message}>
                        {(controle) => <Input type="date" {...controle} {...register('vencimento_reembolso')} />}
                      </Campo>
                    )}
                  </div>
                )}
                {!valores.sem_comprovante && (
                  <Controller
                    control={control}
                    name="comprovante_url"
                    render={({ field }) => (
                      <Campo id="baixa-comprovante" rotulo="Comprovante" obrigatorio erro={errors.comprovante_url?.message}>
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
                  <Campo id="baixa-sem-comprovante-motivo" rotulo="Por que não tem?" obrigatorio erro={errors.sem_comprovante_motivo?.message}>
                    {(controle) => <Input autoComplete="off" {...controle} {...register('sem_comprovante_motivo')} />}
                  </Campo>
                )}
                {valores.tipo === 'ajuste' && (
                  <Campo id="baixa-motivo" rotulo="Motivo" obrigatorio erro={errors.motivo?.message} ajuda="Juros, multa, tarifa. Sai do caixa e não mexe no saldo.">
                    {(controle) => <Input autoComplete="off" {...controle} {...register('motivo')} />}
                  </Campo>
                )}
              </>
            )}
          </div>
          <div className="acoes-dialogo">
            <Button variante="secundario" onClick={aoFechar}>
              Voltar
            </Button>
            <Button type="submit" carregando={isSubmitting}>
              {valores.tipo === 'estorno' ? 'Estornar' : 'Registrar baixa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
