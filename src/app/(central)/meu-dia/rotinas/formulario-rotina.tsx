'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, ChevronRight, CircleCheck, Layers, PlusCircle } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { CampoRepeticao, idDoCampoDaRepeticao } from '@/componentes/atividades/campo-repeticao';
import { CampoParticipantes } from '@/componentes/campos/campo-participantes';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { SeletorContextos } from '@/componentes/campos/seletor-contextos';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Recorrencia } from '@/dados/tipos/recorrencia';
import { MAXIMO_NO_TITULO, ROTULOS_PRIORIDADE_ATIVIDADE } from '@/dominio/atividades';
import { LEMBRETE_LINK_DRIVE } from '@/dominio/link-drive';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { avisosDaRotina, criarRotina, dadosDoFormularioRotina, editarRotina, esquemaDoFormularioRotina, formularioDaRotina, formularioRotinaVazio, SOLICITANTE_OUTRA_ROTINA, type DadosDasRotinas, type FormularioRotina } from '@/dominio/recorrencias';
import { mesmaAgenda, regraDoFormulario, type FormularioRepeticao } from '@/dominio/repeticao';
import { hojeISO } from '@/lib/datas';
import { cn } from '@/lib/utils';

const TIPOS = [
  { valor: 'tarefa', rotulo: 'Tarefa', icone: CircleCheck },
  { valor: 'demanda', rotulo: 'Demanda', icone: Layers },
  { valor: 'lembrete', rotulo: 'Lembrete', icone: Bell },
];
const OPCOES_PRIORIDADE = Object.entries(ROTULOS_PRIORIDADE_ATIVIDADE).map(([valor, rotulo]) => ({ valor, rotulo }));
const ID_DA_REPETICAO = 'rotina-repeticao';
const ID_DO_CAMPO: Partial<Record<keyof FormularioRotina, string>> = { titulo: 'rotina-titulo', responsavel_id: 'rotina-responsavel', solicitante: 'rotina-solicitante', solicitante_texto: 'rotina-solicitante-texto', arquivo: 'rotina-arquivo' };
const CAMPOS_COM_ERRO = Object.keys(ID_DO_CAMPO) as (keyof FormularioRotina)[];

type FormularioDeRotinaProps = {
  aberto: boolean;
  aoFechar: () => void;
  /** Sem rotina, é uma nova. */
  rotina: Recorrencia | null;
  dados: DadosDasRotinas;
};



/** T03.05: criar e editar. Mudar a agenda encerra a regra e começa outra (RN-03.17). */
export function FormularioDeRotina({ aberto, aoFechar, rotina, dados }: FormularioDeRotinaProps) {
  const { pessoa, contexto } = useCentral();
  // Encerrada não volta: abre só para consulta (protótipo de T03.05).
  const soLeitura = rotina?.situacao === 'encerrada';
  const hoje = hojeISO();
  const inicial = useMemo(() => (rotina ? formularioDaRotina(rotina) : formularioRotinaVazio(pessoa.id, contexto.id, hoje)), [rotina, pessoa.id, contexto.id, hoje]);
  const resolver = useMemo(() => zodResolver(esquemaDoFormularioRotina(rotina ? undefined : hoje)), [rotina, hoje]);
  const { register, handleSubmit, control, reset, watch, trigger, formState } = useForm<FormularioRotina>({ resolver, defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const [aConfirmar, setAConfirmar] = useState<{ formulario: FormularioRotina; avisos: readonly string[] } | null>(null);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (!aberto) return;
    reset(inicial);
    // Encerrada não deixa mexer em nada, nem no botão: abre com tudo à vista.
    setMaisOpcoes(rotina?.situacao === 'encerrada');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `inicial` vale no momento de abrir
  }, [aberto, rotina?.id, reset]);

  const tipo = watch('tipo');
  const solicitante = watch('solicitante');
  const titulo = watch('titulo') ?? '';
  const arquivo = watch('arquivo') ?? '';
  const repeticao = watch('repeticao');
  const lembrete = tipo === 'lembrete';
  const demanda = tipo === 'demanda';
  const internas = pessoasDoSeletor(dados.pessoas);
  const responsaveis = rotina && !internas.some((item) => item.id === rotina.responsavel_id) ? [...internas, ...dados.pessoas.filter((item) => item.id === rotina.responsavel_id)] : internas;
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo');
  const areas = dados.areas.filter((area) => !area.arquivado_em);
  const participantes = dados.pessoas.filter((item) => !item.arquivado_em && item.situacao === 'ativa' && item.id !== watch('responsavel_id'));
  const mudouAgenda = Boolean(rotina) && !mesmaAgenda(rotina as Recorrencia, regraDoFormulario(repeticao));

  // Depois de tentar salvar, um campo pode resolver o erro de outro: o tipo pede a hora, por exemplo.
  const camposLigados = JSON.stringify([tipo, solicitante, repeticao]);
  useEffect(() => {
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  const errosDaRepeticao = errors.repeticao as Partial<Record<keyof FormularioRepeticao, { message?: string }>> | undefined;
  const erroDoTitulo = titulo || formState.isSubmitted ? errors.titulo?.message : undefined;
  const erros: ErroDeCampo[] = [
    ...CAMPOS_COM_ERRO.flatMap((campo) => {
      const mensagem = campo === 'titulo' ? erroDoTitulo : errors[campo]?.message;
      const campoId = ID_DO_CAMPO[campo];
      return mensagem && campoId ? [{ campoId, mensagem: String(mensagem) }] : [];
    }),
    ...Object.entries(errosDaRepeticao ?? {}).flatMap(([campo, erro]) => (erro?.message ? [{ campoId: idDoCampoDaRepeticao(ID_DA_REPETICAO, campo as keyof FormularioRepeticao), mensagem: erro.message }] : [])),
  ];

  // Erro em campo escondido não pode passar despercebido.
  const erroEscondido = Boolean(errors.arquivo || errors.solicitante || errors.solicitante_texto);
  useEffect(() => {
    if (erroEscondido) setMaisOpcoes(true);
  }, [erroEscondido]);

  async function gravar(formulario: FormularioRotina) {
    try {
      const dadosDaRotina = dadosDoFormularioRotina(formulario, rotina);
      if (rotina) {
        await editarRotina(rotina.id, dadosDaRotina);
        aviso('Rotina atualizada.');
      } else {
        await criarRotina(dadosDaRotina);
        aviso('Rotina criada.');
      }
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    const avisos = avisosDaRotina(formulario);
    if (avisos.length) {
      setAConfirmar({ formulario, avisos });
      return;
    }
    await gravar(formulario);
  });

  return (
    <>
      <JanelaFormulario larga aberto={aberto} aoFechar={aoFechar} titulo={soLeitura ? (rotina?.titulo ?? 'Rotina') : rotina ? 'Editar rotina' : 'Nova rotina'} descricao={soLeitura ? 'Esta rotina está encerrada: só para consulta.' : undefined} alterado={isDirty && !soLeitura} aoEnviar={enviar} rotuloSalvar={rotina ? 'Salvar alterações' : 'Criar rotina'} salvando={isSubmitting} erros={erros} soLeitura={soLeitura}>
        <fieldset disabled={soLeitura} className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          <div className="border-b border-line pb-3 md:col-span-2">
            <Controller control={control} name="tipo" render={({ field }) => <Pilulas rotulo="Tipo" rotuloOculto obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={TIPOS} />} />
          </div>
          <Campo id={ID_DO_CAMPO.titulo} rotulo="Título" obrigatorio erro={erroDoTitulo} className="relative md:col-span-2">
            {(controle) => (
              <>
                <span className="absolute top-0.5 right-0 text-xs text-ink-soft tabular-nums">
                  {titulo.length}/{MAXIMO_NO_TITULO}
                </span>
                <Input autoComplete="off" {...controle} {...register('titulo')} />
              </>
            )}
          </Campo>
          <Controller
            control={control}
            name="responsavel_id"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.responsavel_id} rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
                {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={responsaveis} vazio="Escolha uma pessoa" />}
              </Campo>
            )}
          />
          <Controller
            control={control}
            name="contextos"
            render={({ field }) => (
              <Campo id="rotina-contexto" rotulo="Contexto">
                {(controle) => <SeletorContextos id={controle.id} desativado={soLeitura} valores={field.value} aoMudar={field.onChange} produtos={produtos} todosOsProdutos={dados.produtos} marcas={dados.marcas} />}
              </Campo>
            )}
          />
          <div className="md:col-span-2">
            <Controller control={control} name="repeticao" render={({ field }) => <CampoRepeticao id={ID_DA_REPETICAO} valor={field.value} aoMudar={field.onChange} lembrete={lembrete} hoje={hoje} erros={Object.fromEntries(Object.entries(errosDaRepeticao ?? {}).map(([campo, erro]) => [campo, erro?.message]))} />} />
          </div>
          {rotina && !soLeitura && <div className="md:col-span-2">{mudouAgenda ? <Faixa tipo="atencao">Ao salvar, esta regra termina e outra começa a partir de hoje. As ocorrências que ninguém mexeu são refeitas; as passadas não mudam.</Faixa> : <p className="text-xs text-ink-soft">O que mudar aqui vale para as próximas ocorrências que ninguém editou à parte. As passadas não mudam.</p>}</div>}

          <button
            type="button"
            aria-expanded={maisOpcoes}
            onClick={() => setMaisOpcoes((atual) => erroEscondido || !atual)}
            className="flex min-h-12 items-center gap-3 rounded-md bg-mist px-4 py-2 text-left transition-colors duration-150 hover:bg-oat md:col-span-2 [&_svg]:size-[18px] [&_svg]:shrink-0"
          >
            <PlusCircle aria-hidden className="text-ink-soft" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Mais opções</span>
              <span className="block text-xs text-ink-soft">{demanda ? 'Solicitante, área, participantes, prioridade, checklist e arquivo' : lembrete ? 'Área, participantes, prioridade e arquivo' : 'Área, participantes, prioridade, checklist e arquivo'}</span>
            </span>
            <ChevronRight aria-hidden className={cn('text-ink-soft transition-transform duration-150', maisOpcoes && 'rotate-90')} />
          </button>

          {maisOpcoes && (
            <>
              {demanda && (
                <>
                  <div className="grid gap-3">
                    <Controller
                      control={control}
                      name="solicitante"
                      render={({ field }) => (
                        <Campo id={ID_DO_CAMPO.solicitante} rotulo="Solicitante" obrigatorio erro={errors.solicitante?.message}>
                          {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={dados.pessoas.filter((item) => !item.arquivado_em)} extra={<option value={SOLICITANTE_OUTRA_ROTINA}>Outra: escrever o nome</option>} />}
                        </Campo>
                      )}
                    />
                    {solicitante === SOLICITANTE_OUTRA_ROTINA && (
                      <Campo id={ID_DO_CAMPO.solicitante_texto} rotulo="Quem pediu" obrigatorio erro={errors.solicitante_texto?.message}>
                        {(controle) => <Input autoComplete="off" {...controle} {...register('solicitante_texto')} />}
                      </Campo>
                    )}
                  </div>
                  <Campo rotulo="Resultado esperado">{(controle) => <Textarea {...controle} {...register('resultado_esperado')} className="md:min-h-[72px]" />}</Campo>
                </>
              )}
              <Controller
                control={control}
                name="area_id"
                render={({ field }) => (
                  <Campo id="rotina-area" rotulo="Área">
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        <option value="">Nenhuma</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.nome}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Controller
                control={control}
                name="prioridade"
                render={({ field }) => (
                  <Campo id="rotina-prioridade" rotulo="Prioridade">
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        {OPCOES_PRIORIDADE.map(({ valor, rotulo }) => (
                          <option key={valor} value={valor}>
                            {rotulo}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Controller control={control} name="participantes" render={({ field }) => <CampoParticipantes desativado={soLeitura} pessoas={participantes} todas={dados.pessoas} valores={field.value} aoMudar={field.onChange} />} />
              <Controller
                control={control}
                name="arquivo"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.arquivo} rotulo="Arquivo (link do Drive)" erro={errors.arquivo?.message} ajuda={LEMBRETE_LINK_DRIVE}>
                    {(controle) => <EntradaLinkDrive link={arquivo} {...controle} {...field} value={field.value} />}
                  </Campo>
                )}
              />
              <Campo rotulo="Descrição" className="md:col-span-2">
                {(controle) => <Textarea {...controle} {...register('descricao')} className="md:min-h-[72px]" />}
              </Campo>
              {!lembrete && (
                <Campo id="rotina-checklist" rotulo="Checklist" ajuda="Um item por linha. Cada ocorrência nasce com ele desmarcado." className="md:col-span-2">
                  {(controle) => <Textarea {...controle} {...register('checklist')} className="md:min-h-[72px]" />}
                </Campo>
              )}
            </>
          )}
          {errors.root?.message && <MensagemErro className="md:col-span-2">{errors.root.message}</MensagemErro>}
        </fieldset>
      </JanelaFormulario>
      <Confirmacao
        aberto={Boolean(aConfirmar)}
        aoFechar={() => setAConfirmar(null)}
        titulo="Salvar mesmo assim?"
        texto={aConfirmar?.avisos.join(' ')}
        rotuloConfirmar="Salvar mesmo assim"
        rotuloCancelar="Voltar e revisar"
        aoConfirmar={() => {
          const alvo = aConfirmar;
          setAConfirmar(null);
          if (alvo) void gravar(alvo.formulario);
        }}
      />
    </>
  );
}
