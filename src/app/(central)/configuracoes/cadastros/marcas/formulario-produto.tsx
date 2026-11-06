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
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import {
  conferirProduto,
  esquemaFormularioProduto,
  exigeMotivo,
  formularioDoProduto,
  formularioProdutoVazio,
  pessoasParaProduto,
  responsavelDisponivel,
  ROTULOS_ESTAGIO,
  ROTULOS_SITUACAO_PRODUTO,
  ROTULOS_TIPO_PRODUTO,
  salvarProduto,
  usaFila,
  type FormularioProduto as Formulario,
  type FormularioProdutoValidado,
} from '@/dominio/produtos';
import { entidadesParaVincular } from '@/dominio/entidades';

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];
const SITUACOES = Object.entries(ROTULOS_SITUACAO_PRODUTO).map(([valor, rotulo]) => ({ valor, rotulo }));

const ID_DO_CAMPO: Partial<Record<keyof Formulario, string>> = {
  marca_id: 'produto-marca',
  nome: 'produto-nome',
  codigo_curto: 'produto-codigo',
  descricao_curta: 'produto-descricao',
  ordem_fila: 'produto-fila',
  responsavel_id: 'produto-responsavel',
  motivo: 'produto-motivo',
};
const CAMPOS_COM_ERRO = Object.keys(ID_DO_CAMPO) as (keyof Formulario)[];

type FormularioProdutoProps = {
  aberto: boolean;
  aoFechar: () => void;
  produto: Produto | null;
  /** A marca já escolhida, ao criar a partir da lista. */
  marcaId?: string;
  marcas: readonly Marca[];
  pessoas: readonly Pessoa[];
  entidades: readonly Entidade[];
};

/** Cadastro básico de T02.04, em painel lateral (P3). */
export function FormularioProduto({ aberto, aoFechar, produto, marcaId, marcas, pessoas, entidades }: FormularioProdutoProps) {
  const { register, handleSubmit, control, reset, watch, setError, formState } = useForm<Formulario, unknown, FormularioProdutoValidado>({
    resolver: zodResolver(esquemaFormularioProduto),
    defaultValues: formularioProdutoVazio(marcaId ?? ''),
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const [aConfirmar, setAConfirmar] = useState<{ formulario: FormularioProdutoValidado; avisos: readonly string[] } | null>(null);
  const opcoesDePessoa = useMemo(() => pessoasParaProduto(pessoas), [pessoas]);
  const opcoesDeMarca = useMemo(() => marcas.filter((marca) => !marca.arquivado_em), [marcas]);
  const opcoesDeEntidade = useMemo(() => entidadesParaVincular(entidades), [entidades]);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (aberto) reset(produto ? formularioDoProduto(produto, pessoas) : formularioProdutoVazio(marcaId ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as pessoas mudam quando os dados mudam em outra aba
  }, [aberto, produto?.id, marcaId, reset]);

  const estagio = watch('estagio');
  const situacao = watch('situacao');
  const descricao = watch('descricao_curta') ?? '';
  const pedeMotivo = exigeMotivo(situacao, produto?.situacao);
  const semResponsavel = produto && !responsavelDisponivel(produto, pessoas);

  const erros: ErroDeCampo[] = CAMPOS_COM_ERRO.flatMap((campo) => {
    const mensagem = errors[campo]?.message;
    const campoId = ID_DO_CAMPO[campo];
    return mensagem && campoId ? [{ campoId, mensagem }] : [];
  });

  async function gravar(formulario: FormularioProdutoValidado) {
    try {
      await salvarProduto(formulario, produto?.id);
      aviso(produto ? 'Produto atualizado.' : 'Produto criado.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    if (pedeMotivo && !formulario.motivo) {
      setError('motivo', { message: 'Informe o motivo para descontinuar.' }, { shouldFocus: true });
      return;
    }
    const { erroNome, erroCodigo, avisos } = await conferirProduto(formulario, produto?.id);
    if (erroNome) setError('nome', { message: erroNome }, { shouldFocus: true });
    if (erroCodigo) setError('codigo_curto', { message: erroCodigo }, { shouldFocus: !erroNome });
    if (erroNome || erroCodigo) return;
    if (avisos.length) {
      setAConfirmar({ formulario, avisos });
      return;
    }
    await gravar(formulario);
  });

  return (
    <>
      <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo={produto ? 'Editar produto' : 'Novo produto'} descricao="O cadastro básico. A ficha completa chega com a fase 0b." alterado={isDirty} aoEnviar={enviar} rotuloSalvar={produto ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
        <div className="grid grid-cols-1 gap-[18px]">
          <Controller
            control={control}
            name="marca_id"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.marca_id} rotulo="Marca" obrigatorio erro={errors.marca_id?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {!field.value && <option value="">Escolha uma marca</option>}
                    {opcoesDeMarca.map((marca) => (
                      <option key={marca.id} value={marca.id}>
                        {marca.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Campo id={ID_DO_CAMPO.nome} rotulo="Nome" obrigatorio erro={errors.nome?.message}>
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
          </Campo>
          <Controller
            control={control}
            name="codigo_curto"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.codigo_curto} rotulo="Código curto" obrigatorio erro={errors.codigo_curto?.message} ajuda="De 3 a 6 letras, como KIPI.">
                {(controle) => <Input autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6} {...controle} {...field} onChange={(evento) => field.onChange(evento.target.value.toUpperCase())} />}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Campo rotulo="Tipo" obrigatorio>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {Object.entries(ROTULOS_TIPO_PRODUTO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Campo id={ID_DO_CAMPO.descricao_curta} rotulo="Descrição curta" erro={errors.descricao_curta?.message} ajuda={`${descricao.length} de 200 caracteres.`}>
            {(controle) => <Textarea {...controle} {...register('descricao_curta')} />}
          </Campo>
          <Controller
            control={control}
            name="estagio"
            render={({ field }) => (
              <Campo rotulo="Estágio" obrigatorio>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {Object.entries(ROTULOS_ESTAGIO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          {usaFila(estagio) && (
            <Campo id={ID_DO_CAMPO.ordem_fila} rotulo="Ordem na fila" erro={errors.ordem_fila?.message} ajuda="Para produtos em Ideia ou Validação.">
              {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('ordem_fila')} />}
            </Campo>
          )}
          {semResponsavel && <Faixa tipo="atencao">Este produto está sem uma responsável na lista. Escolha uma pessoa.</Faixa>}
          <Controller
            control={control}
            name="responsavel_id"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.responsavel_id} rotulo="Responsável pelo produto" obrigatorio erro={errors.responsavel_id?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {!field.value && <option value="">Escolha uma pessoa</option>}
                    {opcoesDePessoa.map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome_completo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="entidade_id"
            render={({ field }) => (
              <Campo rotulo="Entidade responsável" ajuda="Pode ficar a definir (RN-02.06).">
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">A definir</option>
                    {opcoesDeEntidade.map((entidade) => (
                      <option key={entidade.id} value={entidade.id}>
                        {entidade.nome_fantasia || entidade.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="tem_usuarios_reais"
            render={({ field }) => <Pilulas rotulo="Tem usuários reais" obrigatorio valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />}
          />
          <Campo rotulo="Data de início">{(controle) => <Input type="date" {...controle} {...register('data_inicio')} />}</Campo>
          <Controller
            control={control}
            name="situacao"
            render={({ field }) => <Pilulas rotulo="Situação" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={SITUACOES} />}
          />
          {pedeMotivo && (
            <Campo id={ID_DO_CAMPO.motivo} rotulo="Motivo" obrigatorio erro={errors.motivo?.message} ajuda="Fica no histórico do produto.">
              {(controle) => <Textarea {...controle} {...register('motivo')} />}
            </Campo>
          )}
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
