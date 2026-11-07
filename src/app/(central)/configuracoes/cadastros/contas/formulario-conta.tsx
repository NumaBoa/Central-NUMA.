'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import {
  conferirConta,
  controlaSaldo,
  esquemaFormularioConta,
  exigeMotivoParaEncerrar,
  formularioContaVazio,
  formularioDaConta,
  opcoesDeTitular,
  ROTULOS_SITUACAO_CONTA,
  ROTULOS_TIPO_CONTA,
  salvarConta,
  titularDisponivel,
  type DadosContas,
  type FormularioConta as Formulario,
} from '@/dominio/contas';
import { nomeDaEntidade } from '@/dominio/entidades';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));

type FormularioContaProps = {
  aberto: boolean;
  aoFechar: () => void;
  /** Sem conta, é um cadastro novo. */
  conta: ContaFinanceira | null;
  dados: DadosContas;
};

/** Formulário de T02.08, em painel lateral (P3). */
export function FormularioConta({ aberto, aoFechar, conta, dados }: FormularioContaProps) {
  const { register, handleSubmit, control, reset, watch, setError, setValue, getValues, formState } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormularioConta),
    defaultValues: formularioContaVazio(dados.moedaPadrao),
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const [aConfirmar, setAConfirmar] = useState<{ formulario: Formulario; avisos: readonly string[] } | null>(null);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (aberto) reset(conta ? formularioDaConta(conta, dados) : formularioContaVazio(dados.moedaPadrao));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- os dados mudam quando alguém mexe em outra aba
  }, [aberto, conta?.id, reset]);

  const tipo = watch('tipo');
  const situacao = watch('situacao');
  const saldo = watch('saldo_inicial');
  const pessoal = tipo === 'pessoal_socia';
  const comSaldo = controlaSaldo(tipo);
  const titulares = useMemo(() => opcoesDeTitular(tipo, dados), [tipo, dados]);
  const semTitular = conta && !titularDisponivel(conta, dados);
  const pedeMotivo = exigeMotivoParaEncerrar({ ...getValues(), tipo, situacao, saldo_inicial: saldo }, conta);

  const erros: ErroDeCampo[] = [
    ['conta-nome', errors.nome?.message],
    ['conta-titular', errors.titular?.message],
    ['conta-instituicao', errors.instituicao?.message],
    ['conta-final', errors.final_numero?.message],
    ['conta-moeda', errors.moeda?.message],
    ['conta-saldo', errors.saldo_inicial?.message],
    ['conta-data-saldo', errors.data_saldo_inicial?.message],
    ['conta-motivo', errors.motivo?.message],
  ].flatMap(([campoId, mensagem]) => (mensagem ? [{ campoId: campoId as string, mensagem }] : []));

  async function gravar(formulario: Formulario) {
    try {
      await salvarConta(formulario, conta?.id);
      aviso(conta ? 'Conta atualizada.' : 'Conta criada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    if (exigeMotivoParaEncerrar(formulario, conta) && !formulario.motivo) {
      setError('motivo', { message: 'Informe o motivo para encerrar uma conta com saldo.' }, { shouldFocus: true });
      return;
    }
    const avisos = await conferirConta(formulario, conta?.id);
    if (avisos.length) {
      setAConfirmar({ formulario, avisos });
      return;
    }
    await gravar(formulario);
  });

  return (
    <>
      <JanelaFormulario colunas={2} aberto={aberto} aoFechar={aoFechar} titulo={conta ? 'Editar conta' : 'Nova conta'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={conta ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
        <div className="grid grid-cols-1 gap-[18px]">
          <Campo id="conta-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message} ajuda="Como “Cartão pessoal — Kimberly” ou “Conta PJ Numa”.">
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
          </Campo>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Campo id="conta-tipo" rotulo="Tipo" obrigatorio ajuda={pessoal ? 'Ao pagar por esta conta, o sistema pede o tratamento: aporte ou reembolso (RN-05.06).' : comSaldo ? undefined : 'Cartões e carteiras não têm saldo controlado.'}>
                {(controle) => (
                  <Selecao
                    {...controle}
                    {...field}
                    onChange={(evento) => {
                      field.onChange(evento);
                      // Conta pessoal é de uma sócia: uma entidade escolhida antes não vale mais.
                      if (evento.target.value === 'pessoal_socia' && getValues('titular').startsWith('entidade:')) setValue('titular', '', { shouldDirty: true });
                    }}
                  >
                    {paraOpcoes(ROTULOS_TIPO_CONTA).map(({ valor, rotulo }) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          {semTitular && <Faixa tipo="atencao">O titular desta conta não está mais na lista. Escolha outro.</Faixa>}
          <Controller
            control={control}
            name="titular"
            render={({ field }) => (
              <Campo id="conta-titular" rotulo={pessoal ? 'Sócia' : 'Titular'} obrigatorio erro={errors.titular?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">{pessoal ? 'Escolha a sócia' : 'Escolha o titular'}</option>
                    <optgroup label="Sócias">
                      {titulares.socias.map((pessoa) => (
                        <option key={pessoa.id} value={`pessoa:${pessoa.id}`}>
                          {pessoa.nome_completo}
                        </option>
                      ))}
                    </optgroup>
                    {titulares.entidades.length > 0 && (
                      <optgroup label="Entidades">
                        {titulares.entidades.map((entidade) => (
                          <option key={entidade.id} value={`entidade:${entidade.id}`}>
                            {nomeDaEntidade(entidade)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Campo id="conta-instituicao" rotulo="Instituição" erro={errors.instituicao?.message}>
            {(controle) => <Input autoComplete="off" {...controle} {...register('instituicao')} />}
          </Campo>
          <Controller
            control={control}
            name="final_numero"
            render={({ field }) => (
              <Campo id="conta-final" rotulo="Final do cartão ou da conta" erro={errors.final_numero?.message} ajuda="4 dígitos. Nunca o número completo.">
                {(controle) => <Input inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0000" {...controle} {...field} onChange={(evento) => field.onChange(evento.target.value.replace(/\D/g, ''))} />}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="moeda"
            render={({ field }) => (
              <Campo id="conta-moeda" rotulo="Moeda" obrigatorio erro={errors.moeda?.message}>
                {(controle) => <SelecaoMoeda {...controle} {...field} />}
              </Campo>
            )}
          />
          {comSaldo && (
            <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
              <Campo id="conta-saldo" rotulo="Saldo inicial" obrigatorio erro={errors.saldo_inicial?.message}>
                {(controle) => <Input inputMode="decimal" autoComplete="off" placeholder="0,00" {...controle} {...register('saldo_inicial')} />}
              </Campo>
              <Campo id="conta-data-saldo" rotulo="Data do saldo" obrigatorio erro={errors.data_saldo_inicial?.message}>
                {(controle) => <EntradaData {...controle} {...register('data_saldo_inicial')} />}
              </Campo>
            </div>
          )}
          {conta && (
            <Controller
              control={control}
              name="situacao"
              render={({ field }) => <Pilulas rotulo="Situação" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_SITUACAO_CONTA)} />}
            />
          )}
          {pedeMotivo && (
            <Campo id="conta-motivo" rotulo="Motivo" obrigatorio erro={errors.motivo?.message} ajuda="A conta ainda tem saldo. Fica no histórico.">
              {(controle) => <Textarea {...controle} {...register('motivo')} />}
            </Campo>
          )}
        </div>
      </JanelaFormulario>
      <Confirmacao
        aberto={aConfirmar !== null}
        aoFechar={() => setAConfirmar(null)}
        titulo="Salvar mesmo assim?"
        texto={
          <ul className="grid gap-1.5">
            {aConfirmar?.avisos.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
        }
        rotuloConfirmar="Salvar mesmo assim"
        rotuloCancelar="Voltar e revisar"
        aoConfirmar={() => {
          const pendente = aConfirmar;
          setAConfirmar(null);
          if (pendente) void gravar(pendente.formulario);
        }}
      />
    </>
  );
}
