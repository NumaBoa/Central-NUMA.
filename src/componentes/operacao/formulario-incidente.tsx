'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { errosDoFormulario, paraOpcoes } from '@/componentes/f1/apoio';
import { useAvisoDeCredencial } from '@/componentes/produtos/aviso-credencial-m07';
import { aviso } from '@/componentes/padroes/aviso';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Produto } from '@/dados/tipos/marca';
import type { IncidenteDisponibilidade } from '@/dados/tipos/operacao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { esquemaFormularioIncidente, formularioDoIncidente, formularioIncidenteVazio, PENDENCIA_SEGURANCA, ROTULOS_IMPACTO, salvarIncidente, type FormularioIncidente } from '@/dominio/incidentes';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { cn } from '@/lib/utils';

const IDS = { produto_id: 'inc-produto', titulo: 'inc-titulo', inicio_dia: 'inc-inicio-dia', inicio_hora: 'inc-inicio-hora', fim_dia: 'inc-fim-dia', fim_hora: 'inc-fim-hora', impacto: 'inc-impacto', comunicado_dia: 'inc-comunicado-dia', canal: 'inc-canal', envolve_dados_pessoais: 'inc-dados', responsavel_id: 'inc-responsavel' } as const;

/** RN-12.10: produto, início, fim, impacto, causa, ações, comunicação e a pergunta sobre dados pessoais. */
export function JanelaIncidente({ incidente, produtos, pessoas, responsavelInicial, aoFechar, aoSalvar }: { incidente?: IncidenteDisponibilidade; produtos: readonly Produto[]; pessoas: readonly Pessoa[]; responsavelInicial: string; aoFechar: () => void; aoSalvar: (id: string) => void }) {
  const credencial = useAvisoDeCredencial();
  const formulario = useForm<FormularioIncidente>({ resolver: zodResolver(esquemaFormularioIncidente), defaultValues: incidente ? formularioDoIncidente(incidente) : formularioIncidenteVazio(responsavelInicial), mode: 'onTouched' });
  const { register, control, handleSubmit, formState, watch } = formulario;
  const { errors } = formState;
  const comunicado = watch('comunicado');
  const dados = watch('envolve_dados_pessoais');
  const internas = useMemo(() => pessoasDoSeletor(pessoas), [pessoas]);
  const hoje = hojeISO();
  const enviar = handleSubmit(async (valores) => {
    if (!credencial.conferir([valores.titulo, valores.causa, valores.acoes])) return;
    try {
      const salvo = await salvarIncidente(valores, incidente?.id);
      aviso(incidente ? 'Incidente atualizado.' : `Incidente ${salvo.codigo} registrado${salvo.fim ? '' : ', em andamento'}.`);
      aoSalvar(salvo.id);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  const pilulas = (campo: 'impacto' | 'envolve_dados_pessoais', opcoes: readonly { valor: string; rotulo: string }[], rotulo: string, ajuda?: string) => (
    <Controller
      control={control}
      name={campo}
      render={({ field }) => (
        <fieldset id={IDS[campo]} tabIndex={-1}>
          <legend className="mb-[7px] texto-rotulo">{rotulo} *</legend>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {opcoes.map((opcao) => (
              <label key={opcao.valor} className={cn('inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-3.5 text-[13px] font-semibold md:min-h-9', field.value === opcao.valor ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper')}>
                <input type="radio" className="sr-only" name={campo} checked={field.value === opcao.valor} onChange={() => field.onChange(opcao.valor)} />
                {opcao.rotulo}
              </label>
            ))}
          </div>
          {errors[campo]?.message && <p className="mt-1.5 text-xs text-err">{errors[campo]?.message}</p>}
          {ajuda && <p className="mt-1.5 text-xs text-ink-soft">{ajuda}</p>}
        </fieldset>
      )}
    />
  );
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={incidente ? `Editar ${incidente.codigo}` : 'Novo incidente de disponibilidade'} descricao="Datas e horas no fuso de Configurações. Sem fim, fica em andamento." alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} rotuloSalvar={incidente ? 'Salvar alterações' : 'Registrar incidente'} erros={errosDoFormulario(errors, IDS)}>
      <div className="grid grid-cols-1 gap-[18px]">
        {credencial.faixa}
        <Campo id={IDS.produto_id} rotulo="Produto" obrigatorio erro={errors.produto_id?.message}>
          {(controle) => (
            <Selecao {...controle} {...register('produto_id')}>
              <option value="">Escolha</option>
              {produtos.filter((linha) => !linha.arquivado_em).map((linha) => <option key={linha.id} value={linha.id}>{linha.nome}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id={IDS.titulo} rotulo="Título" obrigatorio erro={errors.titulo?.message}>
          {(controle) => <Input {...controle} autoComplete="off" placeholder="Login fora do ar" {...register('titulo')} />}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo id={IDS.inicio_dia} rotulo="Início" obrigatorio erro={errors.inicio_dia?.message}>
            {(controle) => <EntradaData {...controle} max={hoje} {...register('inicio_dia')} />}
          </Campo>
          <Campo id={IDS.inicio_hora} rotulo="Hora" obrigatorio erro={errors.inicio_hora?.message}>
            {(controle) => <input {...controle} type="time" className="campo" {...register('inicio_hora')} />}
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo id={IDS.fim_dia} rotulo="Fim" erro={errors.fim_dia?.message} ajuda="Vazio: em andamento.">
            {(controle) => <EntradaData {...controle} max={hoje} {...register('fim_dia')} />}
          </Campo>
          <Campo id={IDS.fim_hora} rotulo="Hora" erro={errors.fim_hora?.message}>
            {(controle) => <input {...controle} type="time" className="campo" {...register('fim_hora')} />}
          </Campo>
        </div>
        {pilulas('impacto', paraOpcoes(ROTULOS_IMPACTO), 'Impacto', 'Total conta inteiro na disponibilidade; parcial, pela metade; degradado não conta.')}
        <Controller control={control} name="responsavel_id" render={({ field }) => (
          <Campo id={IDS.responsavel_id} rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
            {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={internas} vazio="Escolha" />}
          </Campo>
        )} />
        <Campo id="inc-causa" rotulo="Causa">
          {(controle) => <Textarea {...controle} rows={2} {...register('causa')} />}
        </Campo>
        <Campo id="inc-acoes" rotulo="Ações">
          {(controle) => <Textarea {...controle} rows={2} {...register('acoes')} />}
        </Campo>
        <label className="flex min-h-11 items-center gap-2.5 text-[13px] font-semibold md:min-h-8">
          <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" {...register('comunicado')} />
          Os clientes foram comunicados
        </label>
        {comunicado && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo id={IDS.comunicado_dia} rotulo="Comunicado em" obrigatorio erro={errors.comunicado_dia?.message}>
                {(controle) => <EntradaData {...controle} max={hoje} {...register('comunicado_dia')} />}
              </Campo>
              <Campo id="inc-comunicado-hora" rotulo="Hora" obrigatorio>
                {(controle) => <input {...controle} type="time" className="campo" {...register('comunicado_hora')} />}
              </Campo>
            </div>
            <Campo id={IDS.canal} rotulo="Canal" obrigatorio erro={errors.canal?.message}>
              {(controle) => <Input {...controle} autoComplete="off" placeholder="E-mail, WhatsApp, status no site" {...register('canal')} />}
            </Campo>
          </>
        )}
        {pilulas('envolve_dados_pessoais', [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }], 'Envolve dados pessoais?')}
        {dados === 'sim' && <Faixa tipo="atencao">{PENDENCIA_SEGURANCA}</Faixa>}
      </div>
    </JanelaFormulario>
  );
}
