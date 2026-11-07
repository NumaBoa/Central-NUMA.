'use client';

import { CampoParticipantes } from '@/componentes/campos/campo-participantes';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { SeletorContextos } from '@/componentes/campos/seletor-contextos';
import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, ChevronRight, CircleCheck, Layers, Plus, PlusCircle } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { CampoRepeticao, idDoCampoDaRepeticao } from '@/componentes/atividades/campo-repeticao';
import { Campo } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { MAXIMO_NO_TITULO, ROTULOS_PRIORIDADE_ATIVIDADE } from '@/dominio/atividades';
import {
  areaCompartilhada,
  avisosDaAtividade,
  carregarFormularioAtividade,
  criarAtividade,
  dataDoPrazoRapido,
  esquemaFormularioAtividade,
  formularioAtividadeVazio,
  formularioDoProximo,
  responsavelDaArea,
  SOLICITANTE_OUTRA,
  type FormularioAtividade as Formulario,
  type PrazoRapido,
  type TipoNovo,
} from '@/dominio/atividades-formulario';
import { LEMBRETE_LINK_DRIVE } from '@/dominio/link-drive';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { repeticaoPadrao, type FormularioRepeticao } from '@/dominio/repeticao';
import { hojeISO, rotuloDoFuso } from '@/lib/datas';
import { cn } from '@/lib/utils';

const TIPOS = [
  { valor: 'tarefa', rotulo: 'Tarefa', icone: CircleCheck },
  { valor: 'demanda', rotulo: 'Demanda', icone: Layers },
  { valor: 'lembrete', rotulo: 'Lembrete', icone: Bell },
];
const OPCOES_PRIORIDADE = Object.entries(ROTULOS_PRIORIDADE_ATIVIDADE).map(([valor, rotulo]) => ({ valor, rotulo }));
const ATALHOS_DE_PRAZO: readonly { valor: PrazoRapido; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'amanha', rotulo: 'Amanhã' },
  { valor: 'semana', rotulo: 'Esta semana' },
];

const SUBTITULO: Readonly<Record<TipoNovo, string>> = { tarefa: 'Registre o próximo passo.', demanda: 'Registre um pedido e o resultado esperado.', lembrete: 'Escolha quando você quer receber o aviso.' };
const ROTULO_DE_SALVAR: Readonly<Record<TipoNovo, string>> = { tarefa: 'Salvar tarefa', demanda: 'Salvar demanda', lembrete: 'Salvar lembrete' };
const RESUMO_DE_MAIS_OPCOES: Readonly<Record<TipoNovo, string>> = { tarefa: 'Área, participantes, agendamento, checklist e vínculos', demanda: 'Área, participantes, agendamento, checklist e vínculos', lembrete: 'Área, participantes, prioridade, vínculos e arquivos' };

const ID_DO_CAMPO: Partial<Record<keyof Formulario, string>> = {
  titulo: 'atividade-titulo',
  responsavel_id: 'atividade-responsavel',
  aviso_dia: 'atividade-aviso-dia',
  aviso_hora: 'atividade-aviso-hora',
  prazo: 'atividade-prazo',
  inicio: 'atividade-inicio',
  solicitante: 'atividade-solicitante',
  solicitante_texto: 'atividade-solicitante-texto',
  arquivo: 'atividade-arquivo',
};
const CAMPOS_COM_ERRO = Object.keys(ID_DO_CAMPO) as (keyof Formulario)[];
const ID_DA_REPETICAO = 'atividade-repeticao';
/** Errar dentro de "Mais opções" abre a seção, para o erro não ficar escondido. */
const CAMPOS_DE_MAIS_OPCOES: readonly (keyof Formulario)[] = ['inicio', 'arquivo'];

type FormularioAtividadeProps = {
  aberto: boolean;
  aoFechar: () => void;
  tipoInicial: TipoNovo;
  pessoaId: string;
  contextoGlobalId: string;
  aoCriar: (id: string, tipo: TipoNovo) => void;
};

/** T03.03: janela central, com os obrigatórios de cada tipo à vista e o resto em "Mais opções". No celular, tela inteira. */
export function FormularioAtividade({ aberto, aoFechar, tipoInicial, pessoaId, contextoGlobalId, aoCriar }: FormularioAtividadeProps) {
  const consulta = useConsulta(carregarFormularioAtividade);
  const { register, handleSubmit, control, reset, watch, setValue, setFocus, trigger, formState } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormularioAtividade),
    defaultValues: formularioAtividadeVazio(tipoInicial, pessoaId, contextoGlobalId),
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const [proximo, setProximo] = useState(0);
  const [aConfirmar, setAConfirmar] = useState<{ formulario: Formulario; outro: boolean; avisos: readonly string[] } | null>(null);

  // O formulário começa do padrão a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (!aberto) return;
    reset(formularioAtividadeVazio(tipoInicial, pessoaId, contextoGlobalId));
    setMaisOpcoes(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a pessoa e o contexto valem no momento de abrir
  }, [aberto, tipoInicial, reset]);

  // O reset limpa o registro dos campos: o foco volta para o título só depois da nova renderização.
  useEffect(() => {
    if (proximo) setFocus('titulo');
  }, [proximo, setFocus]);

  const dados = consulta.dados;
  const internas = useMemo(() => (dados ? pessoasDoSeletor(dados.pessoas) : []), [dados]);
  const tipo = watch('tipo');
  const areaId = watch('area_id');
  const responsavel = watch('responsavel_id');
  const solicitante = watch('solicitante');
  const titulo = watch('titulo') ?? '';
  const arquivo = watch('arquivo') ?? '';
  const prazo = watch('prazo');
  const lembrete = tipo === 'lembrete';
  const demanda = tipo === 'demanda';
  const compartilhada = dados ? areaCompartilhada(areaId, dados.areas) : false;
  const repetir = watch('repetir');
  const errosDaRepeticao = errors.repeticao as Partial<Record<keyof FormularioRepeticao, { message?: string }>> | undefined;

  // Erro em campo escondido não pode passar despercebido. O aviso só fica lá fora no lembrete.
  const erroEscondido = CAMPOS_DE_MAIS_OPCOES.some((campo) => errors[campo]) || (!lembrete && Boolean(errors.aviso_dia || errors.aviso_hora)) || (!lembrete && Boolean(errosDaRepeticao));
  useEffect(() => {
    if (erroEscondido) setMaisOpcoes(true);
  }, [erroEscondido]);

  // Depois de tentar salvar, um campo pode resolver o erro de outro: o tipo, o prazo e o início, o dia e a hora do aviso.
  const camposLigados = JSON.stringify(watch(['tipo', 'solicitante', 'prazo', 'prazo_hora', 'inicio', 'aviso_dia', 'aviso_hora', 'repetir', 'repeticao']));
  useEffect(() => {
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  // O título abre com o foco: escolher o tipo antes de escrever não é erro. Em branco, só acusa ao salvar.
  const erroDoTitulo = titulo || formState.isSubmitted ? errors.titulo?.message : undefined;

  const erros: ErroDeCampo[] = [
    ...CAMPOS_COM_ERRO.flatMap((campo) => {
      const mensagem = campo === 'titulo' ? erroDoTitulo : errors[campo]?.message;
      const campoId = ID_DO_CAMPO[campo];
      return typeof mensagem === 'string' && campoId ? [{ campoId, mensagem }] : [];
    }),
    ...Object.entries(errosDaRepeticao ?? {}).flatMap(([campo, erro]) => (erro?.message ? [{ campoId: idDoCampoDaRepeticao(ID_DA_REPETICAO, campo as keyof FormularioRepeticao), mensagem: erro.message }] : [])),
  ];

  /** Clicar no atalho que já está marcado tira o prazo: sem data, fica sem prazo. */
  function escolherPrazo(dia: string) {
    setValue('prazo', prazo === dia ? '' : dia, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    if (prazo === dia) setValue('prazo_hora', '', { shouldDirty: true });
  }

  /** RN-03.02: a área sugere a responsável; em área compartilhada, a escolha é de quem preenche. */
  function escolherArea(id: string, aoMudar: (valor: string) => void) {
    aoMudar(id);
    if (!dados || !id) return;
    const sugerida = responsavelDaArea(id, dados.areas, dados.pessoas);
    if (sugerida) setValue('responsavel_id', sugerida, { shouldDirty: true });
    else if (areaCompartilhada(id, dados.areas)) setValue('responsavel_id', '', { shouldDirty: true });
  }

  function mudarRepeticao(valor: string) {
    const liga = valor === 'sim';
    setValue('repetir', liga, { shouldDirty: true });
    // Parte do prazo já escolhido, para não perguntar duas vezes.
    if (liga) setValue('repeticao', { ...repeticaoPadrao(watch('prazo') > hojeISO() ? watch('prazo') : hojeISO()), hora: watch('prazo_hora') || watch('aviso_hora') }, { shouldDirty: true });
  }

  async function gravar(formulario: Formulario, outro: boolean) {
    try {
      const criada = await criarAtividade(formulario);
      aoCriar(criada.id, formulario.tipo);
      if (outro) {
        reset(formularioDoProximo(formulario, pessoaId));
        setMaisOpcoes(false);
        setProximo((atual) => atual + 1);
      } else {
        aoFechar();
      }
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = (outro: boolean) =>
    handleSubmit(async (formulario) => {
      const avisos = avisosDaAtividade(formulario);
      if (avisos.length) {
        setAConfirmar({ formulario, outro, avisos });
        return;
      }
      await gravar(formulario, outro);
    });

  const campoResponsavel = (
    <Controller
      control={control}
      name="responsavel_id"
      render={({ field }) => (
        <Campo id={ID_DO_CAMPO.responsavel_id} rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message} ajuda={compartilhada && !responsavel ? 'Esta área é compartilhada: escolha a responsável.' : undefined}>
          {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={internas} vazio="Escolha uma pessoa" />}
        </Campo>
      )}
    />
  );
  const campoContexto = (
    <Controller
      control={control}
      name="contextos"
      render={({ field }) => (
        <Campo id="atividade-contexto" rotulo="Contexto">
          {(controle) => <SeletorContextos id={controle.id} valores={field.value} aoMudar={field.onChange} produtos={dados?.produtos ?? []} todosOsProdutos={dados?.produtos ?? []} marcas={dados?.marcas ?? []} />}
        </Campo>
      )}
    />
  );
  const campoPrioridade = (
    <Controller
      control={control}
      name="prioridade"
      render={({ field }) => (
        <Campo id="atividade-prioridade" rotulo="Prioridade">
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
  );
  const campoDescricao = (
    <Campo rotulo="Descrição" className="md:col-span-2">
      {(controle) => <Textarea {...controle} {...register('descricao')} placeholder={lembrete ? 'Adicione um contexto para este lembrete.' : 'O que precisa ser feito?'} rows={1} className="min-h-14 md:min-h-11" />}
    </Campo>
  );
  const campoRepeticao = (
    <div className={cn('grid gap-3', (repetir || !lembrete) && 'md:col-span-2')}>
      <Campo id="atividade-repete" rotulo="Repetição">
        {(controle) => (
          <Selecao {...controle} value={repetir ? 'sim' : 'nao'} onChange={(evento) => mudarRepeticao(evento.target.value)}>
            <option value="nao">Não se repete</option>
            <option value="sim">Repete</option>
          </Selecao>
        )}
      </Campo>
      {repetir && <Controller control={control} name="repeticao" render={({ field }) => <CampoRepeticao id={ID_DA_REPETICAO} valor={field.value} aoMudar={field.onChange} lembrete={lembrete} hoje={hojeISO()} erros={Object.fromEntries(Object.entries(errosDaRepeticao ?? {}).map(([campo, erro]) => [campo, erro?.message]))} />} />}
    </div>
  );
  const hoje = hojeISO();
  const campoPrazo = (
    <div>
      <Campo id={ID_DO_CAMPO.prazo} rotulo="Prazo" erro={errors.prazo?.message}>
        {(controle) => <Input type="date" {...controle} {...register('prazo')} />}
      </Campo>
      <div role="group" aria-label="Atalhos de prazo" className="mt-1.5 flex flex-wrap gap-1.5 md:gap-1">
        {ATALHOS_DE_PRAZO.map(({ valor, rotulo }) => {
          const dia = dataDoPrazoRapido(valor, hoje);
          return (
            <button key={valor} type="button" aria-pressed={prazo === dia} onClick={() => escolherPrazo(dia)} className={cn('inline-flex min-h-11 items-center rounded-pill border px-3 text-xs font-semibold transition-colors duration-150 md:min-h-7 md:px-2.5', prazo === dia ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper text-ink-soft hover:border-ink-soft hover:text-ink')}>
              {rotulo}
            </button>
          );
        })}
        <button type="button" onClick={() => setFocus('prazo')} className="inline-flex min-h-11 items-center rounded-pill border border-line bg-paper px-3 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:border-ink-soft hover:text-ink md:min-h-7 md:px-2.5">
          Escolher…
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Opcional. Sem data, {demanda ? 'a demanda' : 'a tarefa'} fica sem prazo.</p>
    </div>
  );

  return (
    <>
      <JanelaFormulario larga tituloGrande aberto={aberto} aoFechar={aoFechar} titulo="Nova atividade" descricao={SUBTITULO[tipo]} alterado={isDirty} aoEnviar={enviar(false)} rotuloSalvar={ROTULO_DE_SALVAR[tipo]} iconeSalvar={lembrete ? <Bell aria-hidden /> : <Plus aria-hidden />} aoSalvarEOutro={() => void enviar(true)()} rotuloSalvarEOutro="Salvar e adicionar outro" salvando={isSubmitting} erros={erros}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
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

          {demanda && (
            <div className="grid gap-4">
              <Controller
                control={control}
                name="solicitante"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.solicitante} rotulo="Solicitante" obrigatorio erro={errors.solicitante?.message}>
                    {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={dados?.pessoas ?? []} extra={<option value={SOLICITANTE_OUTRA}>Outra: escrever o nome</option>} />}
                  </Campo>
                )}
              />
              {solicitante === SOLICITANTE_OUTRA && (
                <Campo id={ID_DO_CAMPO.solicitante_texto} rotulo="Quem pediu" obrigatorio erro={errors.solicitante_texto?.message}>
                  {(controle) => <Input autoComplete="off" {...controle} {...register('solicitante_texto')} />}
                </Campo>
              )}
            </div>
          )}
          {campoResponsavel}
          {campoContexto}
          {demanda && campoPrioridade}

          {lembrete && !repetir && (
            <>
              <Campo id={ID_DO_CAMPO.aviso_dia} rotulo="Data do aviso" obrigatorio erro={errors.aviso_dia?.message}>
                {(controle) => <EntradaData {...controle} {...register('aviso_dia')} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.aviso_hora} rotulo="Hora do aviso" obrigatorio erro={errors.aviso_hora?.message} ajuda={rotuloDoFuso()}>
                {(controle) => <Input type="time" {...controle} {...register('aviso_hora')} />}
              </Campo>
            </>
          )}
          {lembrete && campoRepeticao}
          {lembrete && !repetir && (
            <p className="flex items-center gap-2 text-[13px] text-ink-soft md:pt-6 [&_svg]:size-4 [&_svg]:shrink-0">
              <Bell aria-hidden />O aviso aparece na Central no dia e horário escolhidos.
            </p>
          )}
          {!lembrete && !repetir && campoPrazo}
          {tipo === 'tarefa' && campoPrioridade}
          {demanda && (
            <Campo rotulo="Resultado esperado" className={repetir ? 'md:col-span-2' : undefined}>
              {(controle) => <Textarea {...controle} {...register('resultado_esperado')} placeholder="Como vai ficar quando estiver pronto?" className="md:min-h-[72px]" />}
            </Campo>
          )}
          {campoDescricao}

          <button
            type="button"
            aria-expanded={maisOpcoes}
            onClick={() => setMaisOpcoes((atual) => erroEscondido || !atual)}
            className="flex min-h-12 items-center gap-3 rounded-md bg-mist px-4 py-2 text-left transition-colors duration-150 hover:bg-oat md:col-span-2 [&_svg]:size-[18px] [&_svg]:shrink-0"
          >
            <PlusCircle aria-hidden className="text-ink-soft" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Mais opções</span>
              <span className="block text-xs text-ink-soft">{RESUMO_DE_MAIS_OPCOES[tipo]}</span>
            </span>
            <ChevronRight aria-hidden className={cn('text-ink-soft transition-transform duration-150', maisOpcoes && 'rotate-90')} />
          </button>

          {maisOpcoes && (
            <>
              <Controller
                control={control}
                name="area_id"
                render={({ field }) => (
                  <Campo id="atividade-area" rotulo="Área" ajuda="Sugere a responsável padrão da área.">
                    {(controle) => (
                      <Selecao {...controle} {...field} onChange={(evento) => escolherArea(evento.target.value, field.onChange)}>
                        <option value="">Nenhuma</option>
                        {(dados?.areas ?? []).map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.nome}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Controller control={control} name="participantes" render={({ field }) => <CampoParticipantes pessoas={(dados?.pessoas ?? []).filter((pessoa) => pessoa.situacao === 'ativa' && pessoa.id !== responsavel)} todas={dados?.pessoas ?? []} valores={field.value} aoMudar={field.onChange} />} />
              {lembrete && campoPrioridade}
              {!lembrete && !repetir && (
                <>
                  <Campo id={ID_DO_CAMPO.inicio} rotulo="Início" erro={errors.inicio?.message}>
                    {(controle) => <EntradaData {...controle} {...register('inicio')} />}
                  </Campo>
                  <Campo id="atividade-prazo-hora" rotulo="Hora do prazo (opcional)">
                    {(controle) => <Input type="time" {...controle} {...register('prazo_hora')} />}
                  </Campo>
                  <Campo id={ID_DO_CAMPO.aviso_dia} rotulo="Avisar no dia" erro={errors.aviso_dia?.message}>
                    {(controle) => <EntradaData {...controle} {...register('aviso_dia')} />}
                  </Campo>
                  <Campo id={ID_DO_CAMPO.aviso_hora} rotulo="Às" erro={errors.aviso_hora?.message}>
                    {(controle) => <Input type="time" {...controle} {...register('aviso_hora')} />}
                  </Campo>
                </>
              )}
              {!lembrete && campoRepeticao}
              {!lembrete && (
                <Campo id="atividade-checklist" rotulo="Checklist" ajuda="Um item por linha." className="md:col-span-2">
                  {(controle) => <Textarea {...controle} {...register('checklist')} className="md:min-h-[72px]" />}
                </Campo>
              )}
              <Controller
                control={control}
                name="vinculo"
                render={({ field }) => (
                  <Campo id="atividade-vinculo" rotulo="Vínculo">
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        <option value="">Nenhum</option>
                        <optgroup label="Contrapartes">
                          {(dados?.contrapartes ?? []).map((contraparte) => (
                            <option key={contraparte.id} value={`contraparte:${contraparte.id}`}>
                              {contraparte.nome_fantasia || contraparte.nome}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Produtos">
                          {(dados?.produtos ?? []).map((produto) => (
                            <option key={produto.id} value={`produto:${produto.id}`}>
                              {produto.nome}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Ferramentas">
                          {(dados?.ferramentas ?? []).map((ferramenta) => (
                            <option key={ferramenta.id} value={`ferramenta:${ferramenta.id}`}>
                              {ferramenta.nome}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Lançamentos">
                          {(dados?.titulos ?? []).map((lancamento) => (
                            <option key={lancamento.id} value={`titulo:${lancamento.id}`}>
                              {lancamento.codigo} · {lancamento.descricao}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Ativos digitais">
                          {(dados?.ativos ?? []).map((ativo) => (
                            <option key={ativo.id} value={`ativo_digital:${ativo.id}`}>
                              {ativo.identificador}
                            </option>
                          ))}
                        </optgroup>
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Campo id={ID_DO_CAMPO.arquivo} rotulo="Arquivo (link do Drive)" erro={errors.arquivo?.message} ajuda={LEMBRETE_LINK_DRIVE}>
                {(controle) => <EntradaLinkDrive link={arquivo} {...controle} {...register('arquivo')} />}
              </Campo>
            </>
          )}
          {consulta.estado === 'erro' && <Faixa tipo="erro" className="md:col-span-2">Não deu para ler as pessoas e os produtos. Importe um backup ou restaure os exemplos em Configurações › Dados.</Faixa>}
        </div>
      </JanelaFormulario>
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
          if (pendente) void gravar(pendente.formulario, pendente.outro);
        }}
      />
    </>
  );
}
