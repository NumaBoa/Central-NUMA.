'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { CamposEndereco } from '@/componentes/campos/endereco';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Contraparte } from '@/dados/tipos/contraparte';
import type { Pessoa } from '@/dados/tipos/pessoa';
import {
  conferirContraparte,
  esquemaFormularioContraparte,
  formatarDocumento,
  formularioContraparteVazio,
  formularioDaContraparte,
  nomeDaContraparte,
  ORIGENS_DO_FORMULARIO,
  pessoasParaContraparte,
  responsavelDaContraparteDisponivel,
  ROTULOS_ORIGEM,
  ROTULOS_PAPEL_CONTRAPARTE,
  ROTULOS_TIPO_PESSOA,
  salvarContraparte,
  type FormularioContraparte as Formulario,
} from '@/dominio/contrapartes';
import { listarPaises, PAIS_BRASIL } from '@/dominio/paises';
import { formatarTelefone } from '@/dominio/pessoas';
import { AVISO_CREDENCIAL, pareceCredencial } from '@/dominio/segredos';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));

const ROTULO_DO_DOCUMENTO = { pf: 'CPF', pj: 'CNPJ', estrangeira: 'ID estrangeiro' } as const;
const MODELO_DO_DOCUMENTO = { pf: '000.000.000-00', pj: '00.000.000/0000-00', estrangeira: 'Número de registro no país' } as const;

type FormularioContraparteProps = {
  aberto: boolean;
  aoFechar: () => void;
  contraparte?: Contraparte | null;
  pessoas: readonly Pessoa[];
  aoCadastrar?: (contraparte: Contraparte) => void;
  /** Criação rápida de outro formulário (02 §6): já vem com o nome digitado e o papel. */
  nomeInicial?: string;
  papeisIniciais?: Formulario['papeis'];
};

/** Formulário de T02.06, em painel lateral (P3). A classe de informação fica no padrão (03 §0). */
export function FormularioContraparte({ aberto, aoFechar, contraparte, pessoas, aoCadastrar, nomeInicial = '', papeisIniciais }: FormularioContraparteProps) {
  const { pessoa: pessoaAtual } = useCentral();
  const { register, handleSubmit, control, reset, watch, setError, setValue, formState } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormularioContraparte),
    defaultValues: formularioContraparteVazio(pessoaAtual.id),
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const [documentoRepetido, setDocumentoRepetido] = useState<Contraparte | null>(null);
  const [aConfirmar, setAConfirmar] = useState<{ formulario: Formulario; avisos: readonly string[] } | null>(null);
  const opcoesDePessoa = useMemo(() => pessoasParaContraparte(pessoas), [pessoas]);
  const paises = useMemo(() => listarPaises(), []);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (!aberto) return;
    // A responsável sugerida em novos registros é a pessoa atual (02 §0.4).
    reset(contraparte ? formularioDaContraparte(contraparte, pessoas) : { ...formularioContraparteVazio(pessoaAtual.id), nome: nomeInicial, ...(papeisIniciais ? { papeis: papeisIniciais } : {}) });
    setDocumentoRepetido(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as pessoas mudam quando os dados mudam em outra aba
  }, [aberto, contraparte?.id, reset]);

  const tipo = watch('tipo_pessoa');
  const pais = watch('pais');
  const observacoes = watch('observacoes');
  const brasil = pais === PAIS_BRASIL;
  const semResponsavel = contraparte && !responsavelDaContraparteDisponivel(contraparte, pessoas);

  const erros: ErroDeCampo[] = [
    ['contraparte-nome', errors.nome?.message],
    ['contraparte-documento', errors.documento?.message],
    ['contraparte-papeis', errors.papeis?.message],
    ['contraparte-site', errors.site?.message],
    ['contraparte-email', errors.email?.message],
    ['contraparte-telefone', errors.telefone?.message],
    ['contraparte-endereco-cep', errors.endereco?.cep?.message],
    ['contraparte-responsavel', errors.responsavel_id?.message],
  ].flatMap(([campoId, mensagem]) => (mensagem ? [{ campoId: campoId as string, mensagem }] : []));

  async function gravar(formulario: Formulario) {
    try {
      const salva = await salvarContraparte(formulario, contraparte?.id);
      if (contraparte) aviso('Contraparte atualizada.');
      else aoCadastrar?.(salva);
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    const { documentoRepetido: repetida, avisos } = await conferirContraparte(formulario, contraparte?.id);
    setDocumentoRepetido(repetida);
    if (repetida) {
      setError('documento', { message: `Já existe: ${nomeDaContraparte(repetida)}.` }, { shouldFocus: true });
      return;
    }
    if (avisos.length) {
      setAConfirmar({ formulario, avisos });
      return;
    }
    await gravar(formulario);
  });

  return (
    <>
      <JanelaFormulario colunas={2} aberto={aberto} aoFechar={aoFechar} titulo={contraparte ? 'Editar contraparte' : 'Nova contraparte'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={contraparte ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
        <div className="grid grid-cols-1 gap-[18px]">
          <Controller
            control={control}
            name="tipo_pessoa"
            render={({ field }) => <Pilulas rotulo="Tipo de pessoa" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_TIPO_PESSOA)} />}
          />
          <Campo id="contraparte-nome" rotulo="Nome ou razão social" obrigatorio erro={errors.nome?.message}>
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
          </Campo>
          <Campo rotulo="Nome fantasia" ajuda="Aparece nas listas quando existir.">
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome_fantasia')} />}
          </Campo>
          <Controller
            control={control}
            name="documento"
            render={({ field }) => (
              <Campo
                id="contraparte-documento"
                rotulo={ROTULO_DO_DOCUMENTO[tipo]}
                erro={errors.documento?.message}
                ajuda={
                  documentoRepetido && errors.documento ? (
                    <a href={`/configuracoes/cadastros/contrapartes/${documentoRepetido.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-dk underline">
                      Abrir a ficha de {nomeDaContraparte(documentoRepetido)}
                    </a>
                  ) : tipo === 'estrangeira' ? (
                    'Empresa de fora do Brasil não precisa de CPF nem CNPJ.'
                  ) : undefined
                }
              >
                {(controle) => <Input autoComplete="off" spellCheck={false} placeholder={MODELO_DO_DOCUMENTO[tipo]} {...controle} {...field} onChange={(evento) => field.onChange(formatarDocumento(tipo, evento.target.value))} />}
              </Campo>
            )}
          />
          <div id="contraparte-papeis" tabIndex={-1}>
            <Controller
              control={control}
              name="papeis"
              render={({ field }) => <PilulasMultiplas rotulo="Papéis" obrigatorio valores={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_PAPEL_CONTRAPARTE)} />}
            />
            {errors.papeis?.message && <MensagemErro>{errors.papeis.message}</MensagemErro>}
          </div>
          <Campo id="contraparte-site" rotulo="Site" erro={errors.site?.message}>
            {(controle) => <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://" {...controle} {...register('site')} />}
          </Campo>
          <Campo id="contraparte-email" rotulo="E-mail geral" erro={errors.email?.message}>
            {(controle) => <Input type="email" inputMode="email" autoComplete="off" spellCheck={false} {...controle} {...register('email')} />}
          </Campo>
          <Controller
            control={control}
            name="pais"
            render={({ field }) => (
              <Campo rotulo="País" obrigatorio erro={errors.pais?.message}>
                {(controle) => (
                  <Selecao
                    {...controle}
                    {...field}
                    onChange={(evento) => {
                      // No Brasil o estado é uma lista; fora dele, texto livre: o valor de um não serve no outro.
                      if ((field.value === PAIS_BRASIL) !== (evento.target.value === PAIS_BRASIL)) setValue('endereco.uf', '', { shouldDirty: true });
                      field.onChange(evento);
                    }}
                  >
                    {paises.map((opcao) => (
                      <option key={opcao.codigo} value={opcao.codigo}>
                        {opcao.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="telefone"
            render={({ field }) => (
              <Campo id="contraparte-telefone" rotulo="Telefone" erro={errors.telefone?.message}>
                {(controle) => <Input type="tel" inputMode="tel" autoComplete="off" placeholder={brasil ? '(00) 00000-0000' : undefined} {...controle} {...field} onChange={(evento) => field.onChange(brasil ? formatarTelefone(evento.target.value) : evento.target.value)} />}
              </Campo>
            )}
          />
          <CamposEndereco idBase="contraparte-endereco" brasil={brasil} registrar={(campo) => register(`endereco.${campo}`)} erros={errors.endereco} />
          <Controller
            control={control}
            name="origem"
            render={({ field }) => (
              <Campo rotulo="Origem" ajuda="Usada no comercial.">
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">Não informada</option>
                    {ORIGENS_DO_FORMULARIO.map((origem) => (
                      <option key={origem} value={origem}>
                        {ROTULOS_ORIGEM[origem]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          {semResponsavel && <Faixa tipo="atencao">A pessoa responsável não está mais na lista. Escolha outra.</Faixa>}
          <Controller
            control={control}
            name="responsavel_id"
            render={({ field }) => (
              <Campo id="contraparte-responsavel" rotulo="Responsável interno" obrigatorio erro={errors.responsavel_id?.message}>
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
          <Campo rotulo="Observações">{(controle) => <Textarea {...controle} {...register('observacoes')} />}</Campo>
          {pareceCredencial(observacoes ?? '') && <Faixa tipo="atencao">{AVISO_CREDENCIAL}</Faixa>}
          <Controller
            control={control}
            name="situacao"
            render={({ field }) => (
              <Pilulas
                rotulo="Situação"
                obrigatorio
                valor={field.value}
                aoMudar={field.onChange}
                opcoes={[
                  { valor: 'ativa', rotulo: 'Ativa' },
                  { valor: 'inativa', rotulo: 'Inativa' },
                ]}
              />
            )}
          />
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
