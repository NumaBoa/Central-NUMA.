'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, Repeat } from 'lucide-react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { errosDoFormulario } from '@/componentes/f1/apoio';
import { aviso } from '@/componentes/padroes/aviso';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { contextoSugerido, erroDoContexto, esquemaFormularioHoras, formularioHorasVazio, opcoesDeVinculo, repetirApontamento, ROTULOS_REGISTRO_HORAS, salvarApontamento, ultimoApontamento, type DadosDosVinculos, type FormularioHoras, type OpcaoDeVinculo, type RegistroDasHoras } from '@/dominio/horas';
import { hojeISO } from '@/lib/datas';

const IDS = { data: 'horas-data', horas: 'horas-horas', contexto: 'horas-contexto', vinculo: 'horas-vinculo', descricao: 'horas-descricao' } as const;

function Campos({ formulario, dados, opcoes, prefixo, compacto = false }: { formulario: UseFormReturn<FormularioHoras>; dados: DadosDosVinculos; opcoes: readonly OpcaoDeVinculo[]; prefixo: string; compacto?: boolean }) {
  const { register, formState, setValue, watch, clearErrors } = formulario;
  const { errors } = formState;
  const hoje = hojeISO();
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em);
  const grupos = (Object.keys(ROTULOS_REGISTRO_HORAS) as RegistroDasHoras[]).map((tipo) => ({ tipo, opcoes: opcoes.filter((opcao) => opcao.tipo === tipo) })).filter((grupo) => grupo.opcoes.length);
  const vinculo = watch('vinculo');
  const escolhido = opcoes.find((opcao) => opcao.valor === vinculo);
  const id = (campo: keyof typeof IDS) => `${prefixo}-${IDS[campo]}`;
  return (
    <div className={compacto ? 'grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[150px_120px_minmax(0,1fr)_minmax(0,1.2fr)]' : 'grid gap-[18px] md:grid-cols-2'}>
      <Campo id={id('data')} rotulo="Data" obrigatorio erro={errors.data?.message}>
        {(controle) => <EntradaData {...controle} max={hoje} {...register('data')} />}
      </Campo>
      <Campo id={id('horas')} rotulo="Horas" obrigatorio erro={errors.horas?.message} ajuda={compacto ? undefined : 'Como 1,5 ou 1:30. De 15 em 15 minutos.'}>
        {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" placeholder="1,5" {...register('horas')} />}
      </Campo>
      <Campo id={id('vinculo')} rotulo="Vínculo" ajuda={compacto ? undefined : 'Opcional: implantação, contrato, solicitação ou atividade.'}>
        {(controle) => (
          <Selecao
            {...controle}
            {...register('vinculo', {
              onChange: (evento) => {
                const sugerido = contextoSugerido(opcoes.find((opcao) => opcao.valor === evento.target.value));
                if (sugerido) setValue('contexto', sugerido, { shouldDirty: true });
                clearErrors('contexto');
              },
            })}
          >
            <option value="">Sem vínculo</option>
            {grupos.map((grupo) => (
              <optgroup key={grupo.tipo} label={ROTULOS_REGISTRO_HORAS[grupo.tipo]}>
                {grupo.opcoes.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </optgroup>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo id={id('contexto')} rotulo="Contexto" obrigatorio erro={errors.contexto?.message} ajuda={!compacto && escolhido?.produtos.length ? 'Acompanha o produto do vínculo.' : undefined}>
        {(controle) => (
          <Selecao {...controle} {...register('contexto')}>
            <option value="">Escolha</option>
            <option value={ID_INSTITUCIONAL}>Numa institucional</option>
            {produtos.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo id={id('descricao')} rotulo="Descrição" erro={errors.descricao?.message} className={compacto ? 'sm:col-span-2 lg:col-span-4' : 'md:col-span-2'}>
        {(controle) => <Input {...controle} autoComplete="off" placeholder="O que foi feito" {...register('descricao')} />}
      </Campo>
    </div>
  );
}

function useFormularioHoras(inicial: FormularioHoras) {
  return useForm<FormularioHoras>({ resolver: zodResolver(esquemaFormularioHoras), defaultValues: inicial, mode: 'onTouched' });
}

/** Confere o contexto contra o vínculo antes de gravar: o erro aparece no próprio campo. */
function contextoConfere(formulario: UseFormReturn<FormularioHoras>, valores: FormularioHoras, opcoes: readonly OpcaoDeVinculo[], dados: DadosDosVinculos): boolean {
  const erro = erroDoContexto(opcoes.find((opcao) => opcao.valor === valores.vinculo), valores.contexto, dados.produtos);
  if (erro) formulario.setError('contexto', { message: erro }, { shouldFocus: true });
  return !erro;
}

/** Lançamento rápido (T12.06): à vista no topo da tela, também no celular, com "Repetir último". */
export function LancamentoRapido({ dados, pessoaId, aoSalvar }: { dados: DadosDosVinculos; pessoaId: string; aoSalvar: () => void }) {
  const hoje = hojeISO();
  const formulario = useFormularioHoras(formularioHorasVazio(hoje));
  const opcoes = useMemo(() => opcoesDeVinculo(dados, hoje), [dados, hoje]);
  const [repetindo, setRepetindo] = useState(false);
  const enviar = formulario.handleSubmit(async (valores) => {
    if (!contextoConfere(formulario, valores, opcoes, dados)) return;
    try {
      await salvarApontamento(valores, pessoaId);
      aviso('Horas apontadas.');
      // O contexto e o vínculo ficam, para apontar outra parte do mesmo trabalho.
      formulario.reset({ ...valores, horas: '', descricao: '' });
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  const repetir = async () => {
    setRepetindo(true);
    try {
      const ultimo = await ultimoApontamento(pessoaId);
      if (!ultimo) aviso('Você ainda não apontou horas.');
      else {
        const repetido = repetirApontamento(ultimo, hoje);
        // Vínculo que não está mais disponível não volta.
        formulario.reset({ ...repetido, vinculo: opcoes.some((opcao) => opcao.valor === repetido.vinculo) ? repetido.vinculo : '' });
        aviso('Preenchido com o último apontamento, na data de hoje.');
      }
    } finally {
      setRepetindo(false);
    }
  };
  return (
    <form noValidate onSubmit={enviar} aria-label="Lançamento rápido de horas" className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] leading-6">Lançamento rápido</h2>
        <p className="text-xs text-ink-soft">De 15 em 15 minutos, como 1,5 ou 1:30.</p>
      </div>
      <Campos formulario={formulario} dados={dados} opcoes={opcoes} prefixo="rapido" compacto />
      <div className="mt-3.5 flex flex-wrap justify-end gap-2 max-sm:[&>*]:flex-1">
        <Button variante="secundario" carregando={repetindo} onClick={repetir}>
          <Repeat aria-hidden />
          Repetir último
        </Button>
        <Button type="submit" carregando={formulario.formState.isSubmitting}>
          <Clock aria-hidden />
          Apontar horas
        </Button>
      </div>
    </form>
  );
}

/** Editar um apontamento, ou apontar a partir de uma ficha (implantação, solicitação), já com o vínculo. */
export function JanelaHoras({ dados, pessoaId, inicial, apontamentoId, titulo, aoFechar, aoSalvar }: { dados: DadosDosVinculos; pessoaId: string; inicial: FormularioHoras; apontamentoId?: string; titulo: string; aoFechar: () => void; aoSalvar: () => void }) {
  const hoje = hojeISO();
  const formulario = useFormularioHoras(inicial);
  const opcoes = useMemo(() => opcoesDeVinculo(dados, hoje, inicial.vinculo || undefined), [dados, hoje, inicial.vinculo]);
  const enviar = formulario.handleSubmit(async (valores) => {
    if (!contextoConfere(formulario, valores, opcoes, dados)) return;
    try {
      await salvarApontamento(valores, pessoaId, apontamentoId);
      aviso(apontamentoId ? 'Apontamento atualizado.' : 'Horas apontadas.');
      aoSalvar();
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={titulo} alterado={formulario.formState.isDirty} aoEnviar={enviar} salvando={formulario.formState.isSubmitting} rotuloSalvar={apontamentoId ? 'Salvar alterações' : 'Apontar horas'} erros={errosDoFormulario(formulario.formState.errors, Object.fromEntries(Object.entries(IDS).map(([campo, id]) => [campo, `janela-${id}`])) as Record<keyof FormularioHoras, string>)}>
      <Campos formulario={formulario} dados={dados} opcoes={opcoes} prefixo="janela" />
    </JanelaFormulario>
  );
}
