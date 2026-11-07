'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Pessoa } from '@/dados/tipos/pessoa';
import {
  areasDaPessoa,
  conferirPessoa,
  esquemaFormularioPessoa,
  formatarCpf,
  formatarTelefone,
  formularioDaPessoa,
  FORMULARIO_PESSOA_VAZIO,
  ROTULOS_PAPEL,
  ROTULOS_SITUACAO,
  ROTULOS_TIPO,
  salvarPessoa,
  type DadosPessoas,
  type FormularioPessoa as Formulario,
  type PapelContato,
} from '@/dominio/pessoas';
import { AVISO_CREDENCIAL, pareceCredencial } from '@/dominio/segredos';

const ID_DO_CAMPO: Partial<Record<keyof Formulario, string>> = {
  nome_completo: 'pessoa-nome',
  email: 'pessoa-email',
  telefone: 'pessoa-telefone',
  cpf: 'pessoa-cpf',
};

const CAMPOS_COM_ERRO = Object.keys(ID_DO_CAMPO) as (keyof Formulario)[];

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];

type FormularioPessoaProps = {
  aberto: boolean;
  aoFechar: () => void;
  /** Sem pessoa, é um cadastro novo. */
  pessoa?: Pessoa | null;
  dados: DadosPessoas;
  aoCadastrar?: (pessoa: Pessoa) => void;
  /** Ao cadastrar um contato a partir da ficha da contraparte. */
  contraparteInicial?: string;
};

/** Formulário de T02.02, em painel lateral (P3). Interna e Externa mostram campos diferentes. */
export function FormularioPessoa({ aberto, aoFechar, pessoa, dados, aoCadastrar, contraparteInicial }: FormularioPessoaProps) {
  const { register, handleSubmit, control, reset, watch, setError, setFocus, formState } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormularioPessoa),
    defaultValues: FORMULARIO_PESSOA_VAZIO,
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const [cpfRepetido, setCpfRepetido] = useState<Pessoa | null>(null);
  const [aConfirmar, setAConfirmar] = useState<{ formulario: Formulario; avisos: readonly string[]; outra: boolean } | null>(null);
  const [proximaPessoa, setProximaPessoa] = useState(0);

  const vazio = useMemo<Formulario>(() => (contraparteInicial ? { ...FORMULARIO_PESSOA_VAZIO, tipo: 'externa', contraparte_id: contraparteInicial } : FORMULARIO_PESSOA_VAZIO), [contraparteInicial]);
  const valoresIniciais = useMemo(() => (pessoa ? formularioDaPessoa(pessoa, areasDaPessoa(pessoa.id, dados).map((area) => area.id)) : vazio), [pessoa, dados, vazio]);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (!aberto) return;
    reset(valoresIniciais);
    setCpfRepetido(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valoresIniciais muda quando os dados mudam em outra aba
  }, [aberto, pessoa?.id, reset]);

  // O reset limpa o registro dos campos: o foco volta para o nome só depois da nova renderização.
  useEffect(() => {
    if (proximaPessoa) setFocus('nome_completo');
  }, [proximaPessoa, setFocus]);

  const tipo = watch('tipo');
  const observacoes = watch('observacoes');
  const interna = tipo === 'interna';

  const listaDeErros: ErroDeCampo[] = CAMPOS_COM_ERRO.flatMap((campo) => {
    const mensagem = errors[campo]?.message;
    const campoId = ID_DO_CAMPO[campo];
    return mensagem && campoId ? [{ campoId, mensagem }] : [];
  });

  async function gravar(formulario: Formulario, outra: boolean) {
    try {
      const salva = await salvarPessoa(formulario, pessoa?.id);
      if (pessoa) {
        aviso('Pessoa atualizada.');
        aoFechar();
      } else {
        aoCadastrar?.(salva);
        if (outra) {
          reset(vazio);
          setProximaPessoa((atual) => atual + 1);
        } else {
          aoFechar();
        }
      }
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = (outra: boolean) =>
    handleSubmit(async (formulario) => {
      const { cpfRepetido: repetido, avisos } = await conferirPessoa(formulario, pessoa?.id);
      setCpfRepetido(repetido);
      if (repetido) {
        setError('cpf', { message: `Já existe: ${repetido.nome_completo}.` }, { shouldFocus: true });
        return;
      }
      if (avisos.length) {
        setAConfirmar({ formulario, avisos, outra });
        return;
      }
      await gravar(formulario, outra);
    });

  return (
    <>
      <JanelaFormulario
        colunas={2}
        aberto={aberto}
        aoFechar={aoFechar}
        titulo={pessoa ? 'Editar pessoa' : 'Nova pessoa'}
        alterado={isDirty}
        aoEnviar={enviar(false)}
        rotuloSalvar={pessoa ? 'Salvar alterações' : 'Salvar'}
        aoSalvarEOutro={pessoa ? undefined : () => void enviar(true)()}
        rotuloSalvarEOutro="Salvar e adicionar outra"
        salvando={isSubmitting}
        erros={listaDeErros}
      >
        <div className="grid grid-cols-1 gap-[18px]">
          <Campo id={ID_DO_CAMPO.nome_completo} rotulo="Nome completo" obrigatorio erro={errors.nome_completo?.message} ajuda="Aparece sempre por extenso nas atribuições.">
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome_completo')} />}
          </Campo>
          <Campo rotulo="Nome de exibição" ajuda="Se ficar vazio: primeiro nome e sobrenome.">
            {(controle) => <Input autoComplete="off" {...controle} {...register('nome_exibicao')} />}
          </Campo>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => <Pilulas rotulo="Tipo" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_TIPO)} />}
          />
          {interna ? (
            <>
              <Controller
                control={control}
                name="eh_socia"
                render={({ field }) => <Pilulas rotulo="É sócia" valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />}
              />
              <Controller
                control={control}
                name="areas"
                render={({ field }) => <PilulasMultiplas rotulo="Áreas em que atua" valores={field.value} aoMudar={field.onChange} opcoes={dados.areas.map((area) => ({ valor: area.id, rotulo: area.nome }))} />}
              />
            </>
          ) : (
            <>
              <Controller
                control={control}
                name="contraparte_id"
                render={({ field }) => (
                  <Campo rotulo="Contraparte" ajuda="A empresa a que o contato pertence. Opcional para quem é autônomo.">
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        <option value="">Nenhuma</option>
                        {dados.contrapartes
                          .filter((contraparte) => !contraparte.arquivado_em && (contraparte.situacao === 'ativa' || contraparte.id === field.value))
                          .map((contraparte) => (
                            <option key={contraparte.id} value={contraparte.id}>
                              {contraparte.nome_fantasia || contraparte.nome}
                            </option>
                          ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Controller
                control={control}
                name="papeis_contato"
                render={({ field }) => <PilulasMultiplas rotulo="Papel do contato" valores={field.value} aoMudar={(valores) => field.onChange(valores as PapelContato[])} opcoes={paraOpcoes(ROTULOS_PAPEL)} />}
              />
            </>
          )}
          <Campo rotulo="Função / cargo">{(controle) => <Input autoComplete="off" {...controle} {...register('funcao')} />}</Campo>
          <Campo id={ID_DO_CAMPO.email} rotulo="E-mail" erro={errors.email?.message}>
            {(controle) => <Input type="email" inputMode="email" autoComplete="off" spellCheck={false} {...controle} {...register('email')} />}
          </Campo>
          <Controller
            control={control}
            name="telefone"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.telefone} rotulo="Telefone / WhatsApp" erro={errors.telefone?.message}>
                {(controle) => <Input type="tel" inputMode="tel" autoComplete="off" placeholder="(00) 00000-0000" {...controle} {...field} onChange={(evento) => field.onChange(formatarTelefone(evento.target.value))} />}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="cpf"
            render={({ field }) => (
              <Campo
                id={ID_DO_CAMPO.cpf}
                rotulo="CPF"
                erro={errors.cpf?.message}
                ajuda={
                  cpfRepetido && errors.cpf ? (
                    <a href={`/configuracoes/cadastros/pessoas/${cpfRepetido.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-dk underline">
                      Abrir a ficha de {cpfRepetido.nome_completo}
                    </a>
                  ) : undefined
                }
              >
                {(controle) => <Input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" {...controle} {...field} onChange={(evento) => field.onChange(formatarCpf(evento.target.value))} />}
              </Campo>
            )}
          />
          <Campo rotulo="Observações">{(controle) => <Textarea {...controle} {...register('observacoes')} />}</Campo>
          {pareceCredencial(observacoes ?? '') && <Faixa tipo="atencao">{AVISO_CREDENCIAL}</Faixa>}
          <Controller
            control={control}
            name="situacao"
            render={({ field }) => <Pilulas rotulo="Situação" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_SITUACAO)} />}
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
          if (pendente) void gravar(pendente.formulario, pendente.outra);
        }}
      />
    </>
  );
}
