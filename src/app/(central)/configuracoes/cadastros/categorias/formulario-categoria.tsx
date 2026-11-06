'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import {
  conferirCategoria,
  entraNoResultado,
  esquemaFormularioCategoria,
  formularioCategoriaVazio,
  formularioDaCategoria,
  gruposParaEscolher,
  ROTULOS_NATUREZA,
  ROTULOS_SITUACAO_CATEGORIA,
  ROTULOS_TIPO_CATEGORIA,
  salvarCategoria,
  type FormularioCategoria as Formulario,
} from '@/dominio/categorias';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));

type FormularioCategoriaProps = {
  aberto: boolean;
  aoFechar: () => void;
  /** Sem categoria, é um cadastro novo. */
  categoria: CategoriaFinanceira | null;
  /** Ao criar a partir de um grupo da árvore. */
  grupoInicial: CategoriaFinanceira | null;
  categorias: readonly CategoriaFinanceira[];
};

/** Formulário de T02.07, em painel lateral (P3). Sem grupo, a linha é um grupo. */
export function FormularioCategoria({ aberto, aoFechar, categoria, grupoInicial, categorias }: FormularioCategoriaProps) {
  const { register, handleSubmit, control, reset, watch, setError, setValue, formState } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormularioCategoria),
    defaultValues: formularioCategoriaVazio(),
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const [aConfirmar, setAConfirmar] = useState<{ formulario: Formulario; avisos: readonly string[] } | null>(null);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (aberto) reset(categoria ? formularioDaCategoria(categoria) : formularioCategoriaVazio(grupoInicial));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a categoria muda quando os dados mudam em outra aba
  }, [aberto, categoria?.id, grupoInicial?.id, reset]);

  const tipo = watch('tipo');
  const grupoEscolhido = watch('pai_id');
  const situacao = watch('situacao');
  const filhas = useMemo(() => (categoria ? categorias.filter((item) => item.pai_id === categoria.id && !item.arquivado_em) : []), [categorias, categoria]);
  const grupos = useMemo(() => gruposParaEscolher(categorias, { idAtual: categoria?.id, grupoAtual: categoria?.pai_id ?? undefined }), [categorias, categoria]);
  const temFilhas = categorias.some((item) => categoria && item.pai_id === categoria.id);

  const erros: ErroDeCampo[] = [
    ['categoria-grupo', errors.pai_id?.message],
    ['categoria-nome', errors.nome?.message],
    ['categoria-natureza', errors.natureza_custo?.message],
  ].flatMap(([campoId, mensagem]) => (mensagem ? [{ campoId: campoId as string, mensagem }] : []));

  async function gravar(formulario: Formulario) {
    try {
      await salvarCategoria(formulario, categoria?.id);
      aviso(categoria ? 'Categoria atualizada.' : 'Categoria criada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    const { erroNome, erroGrupo, avisos } = await conferirCategoria(formulario, categoria?.id);
    if (erroNome) setError('nome', { message: erroNome }, { shouldFocus: true });
    if (erroGrupo) setError('pai_id', { message: erroGrupo }, { shouldFocus: !erroNome });
    if (erroNome || erroGrupo) return;
    if (avisos.length) {
      setAConfirmar({ formulario, avisos });
      return;
    }
    await gravar(formulario);
  });

  const ehGrupoExistente = categoria && !categoria.pai_id;
  const titulo = !categoria ? 'Nova categoria' : ehGrupoExistente ? 'Editar grupo' : 'Editar categoria';

  return (
    <>
      <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo={titulo} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={categoria ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
        <div className="grid grid-cols-1 gap-[18px]">
          <Campo id="categoria-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
          </Campo>
          {temFilhas ? (
            <Faixa>Este é um grupo{filhas.length ? ` com ${filhas.length} ${filhas.length === 1 ? 'categoria' : 'categorias'}` : ''}. A árvore só tem 2 níveis: ele não pode ficar dentro de outro.</Faixa>
          ) : (
            <Controller
              control={control}
              name="pai_id"
              render={({ field }) => (
                <Campo id="categoria-grupo" rotulo="Grupo" erro={errors.pai_id?.message} ajuda={field.value ? undefined : 'Sem grupo, esta linha vira um novo grupo.'}>
                  {(controle) => (
                    <Selecao
                      {...controle}
                      {...field}
                      onChange={(evento) => {
                        field.onChange(evento);
                        const grupo = categorias.find((item) => item.id === evento.target.value);
                        if (grupo) setValue('tipo', grupo.tipo, { shouldDirty: true });
                      }}
                    >
                      <option value="">Nenhum: é um grupo</option>
                      {grupos.map((grupo) => (
                        <option key={grupo.id} value={grupo.id}>
                          {grupo.nome}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
          )}
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Campo rotulo="Tipo" obrigatorio ajuda={entraNoResultado(tipo) ? undefined : 'Movimento societário e Transferência não entram no resultado.'}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {paraOpcoes(ROTULOS_TIPO_CATEGORIA).map(({ valor, rotulo }) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          {tipo === 'despesa' && (
            <Controller
              control={control}
              name="natureza_custo"
              render={({ field }) => (
                <Campo id="categoria-natureza" rotulo="Natureza do custo" obrigatorio={Boolean(grupoEscolhido)} erro={errors.natureza_custo?.message} ajuda="Orienta rateio e relatórios.">
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      <option value="">{grupoEscolhido ? 'Escolha a natureza' : 'A definir'}</option>
                      {paraOpcoes(ROTULOS_NATUREZA).map(({ valor, rotulo }) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
          )}
          <Controller
            control={control}
            name="situacao"
            render={({ field }) => <Pilulas rotulo="Situação" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_SITUACAO_CATEGORIA)} />}
          />
          {situacao === 'inativa' && <Faixa tipo="atencao">{filhas.length ? 'As categorias deste grupo também deixam de ser oferecidas em novos registros.' : 'Deixa de ser oferecida em novos registros, mas continua nos antigos.'}</Faixa>}
        </div>
      </PainelFormulario>
      <Confirmacao
        aberto={aConfirmar !== null}
        aoFechar={() => setAConfirmar(null)}
        titulo="Salvar mesmo assim?"
        texto={aConfirmar?.avisos.join(' ') ?? ''}
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
