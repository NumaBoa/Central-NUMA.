'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { EntradaCor } from '@/componentes/campos/cor';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { aviso } from '@/componentes/padroes/aviso';
import { EtiquetaContexto } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { ErroDeRegra, mensagemDoErro } from '@/dados/erros';
import type { Marca } from '@/dados/tipos/marca';
import { corVisivel, tintaDaCor } from '@/dominio/cores';
import { LEMBRETE_LINK_DRIVE } from '@/dominio/link-drive';
import { esquemaFormularioMarca, formularioDaMarca, FORMULARIO_MARCA_VAZIO, MENSAGEM_MARCA_REPETIDA, ROTULOS_SITUACAO_MARCA, salvarMarca, type FormularioMarca as Formulario } from '@/dominio/marcas';

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];
const SITUACOES = Object.entries(ROTULOS_SITUACAO_MARCA).map(([valor, rotulo]) => ({ valor, rotulo }));

export function FormularioMarca({ aberto, aoFechar, marca, aoCriar }: { aberto: boolean; aoFechar: () => void; marca: Marca | null; aoCriar?: (marca: Marca) => void }) {
  const { register, handleSubmit, control, reset, watch, setError, formState } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormularioMarca),
    defaultValues: FORMULARIO_MARCA_VAZIO,
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (aberto) reset(marca ? formularioDaMarca(marca) : FORMULARIO_MARCA_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a marca muda quando os dados mudam em outra aba
  }, [aberto, marca?.id, reset]);

  const nome = watch('nome');
  const cor = watch('cor_hex');
  const logo = watch('logo_url');
  const institucional = Boolean(marca?.institucional);
  const corBoa = /^#[0-9A-Fa-f]{6}$/.test(cor ?? '') && corVisivel(cor);

  const erros: ErroDeCampo[] = [
    ...(errors.nome?.message ? [{ campoId: 'marca-nome', mensagem: errors.nome.message }] : []),
    ...(errors.cor_hex?.message ? [{ campoId: 'marca-cor', mensagem: errors.cor_hex.message }] : []),
    ...(errors.logo_url?.message ? [{ campoId: 'marca-logo', mensagem: errors.logo_url.message }] : []),
  ];

  const enviar = handleSubmit(async (formulario) => {
    try {
      const salva = await salvarMarca(formulario, marca?.id);
      aviso(marca ? 'Marca atualizada.' : 'Marca criada.');
      if (!marca) aoCriar?.(salva);
      aoFechar();
    } catch (erro) {
      if (erro instanceof ErroDeRegra && erro.message === MENSAGEM_MARCA_REPETIDA) {
        setError('nome', { message: MENSAGEM_MARCA_REPETIDA }, { shouldFocus: true });
        return;
      }
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <JanelaFormulario aberto={aberto} aoFechar={aoFechar} titulo={marca ? 'Editar marca' : 'Nova marca'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={marca ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
      <div className="grid grid-cols-1 gap-[18px]">
        {institucional && <Faixa>Esta é a marca institucional: fica sempre ativa e não é provisória.</Faixa>}
        <Campo id="marca-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Controller
          control={control}
          name="cor_hex"
          render={({ field }) => (
            <Campo id="marca-cor" rotulo="Cor principal" obrigatorio erro={errors.cor_hex?.message} ajuda="Aparece no ponto das etiquetas de contexto.">
              {(controle) => <EntradaCor valor={field.value} aoMudar={field.onChange} onBlur={field.onBlur} ref={field.ref} {...controle} />}
            </Campo>
          )}
        />
        {corBoa && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            Como aparece:
            <EtiquetaContexto contexto={{ id: 'previa', nome: nome?.trim() || 'Nome da marca', cor, tinta: tintaDaCor(cor) }} />
          </div>
        )}
        {!institucional && (
          <Controller
            control={control}
            name="provisorio"
            render={({ field }) => <Pilulas rotulo="Nome provisório" obrigatorio valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />}
          />
        )}
        <Campo id="marca-logo" rotulo="Link do logotipo no Drive" erro={errors.logo_url?.message} ajuda={LEMBRETE_LINK_DRIVE}>
          {(controle) => <EntradaLinkDrive link={logo ?? ''} placeholder="Cole o link do Drive" {...controle} {...register('logo_url')} />}
        </Campo>
        {!institucional && (
          <Controller
            control={control}
            name="situacao"
            render={({ field }) => <Pilulas rotulo="Situação" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={SITUACOES} />}
          />
        )}
      </div>
    </JanelaFormulario>
  );
}
