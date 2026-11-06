'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { CampoRepeticao, idDoCampoDaRepeticao } from '@/componentes/atividades/campo-repeticao';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Button } from '@/componentes/ui/button';
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
import { hojeISO } from '@/lib/datas';

const TIPOS = [
  { valor: 'tarefa', rotulo: 'Tarefa' },
  { valor: 'demanda', rotulo: 'Demanda' },
  { valor: 'lembrete', rotulo: 'Lembrete' },
];
const OPCOES_PRIORIDADE = Object.entries(ROTULOS_PRIORIDADE_ATIVIDADE).map(([valor, rotulo]) => ({ valor, rotulo }));
const OPCOES_PRAZO = [
  { valor: 'sem', rotulo: 'Sem prazo' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'amanha', rotulo: 'Amanhã' },
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: 'escolher', rotulo: 'Escolher' },
];

/** Com muitas pessoas, as pílulas viram lista (18 §9.2: pílulas para poucas opções). */
const MAXIMO_DE_PILULAS = 5;

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

/** T03.03: painel rápido; no celular, folha inferior com "Mais opções" (18 §10.6). */
export function FormularioAtividade({ aberto, aoFechar, tipoInicial, pessoaId, contextoGlobalId, aoCriar }: FormularioAtividadeProps) {
  const consulta = useConsulta(carregarFormularioAtividade);
  const { register, handleSubmit, control, reset, watch, setValue, setFocus, trigger, formState } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormularioAtividade),
    defaultValues: formularioAtividadeVazio(tipoInicial, pessoaId, contextoGlobalId),
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const [opcaoPrazo, setOpcaoPrazo] = useState('sem');
  const [proximo, setProximo] = useState(0);
  const [aConfirmar, setAConfirmar] = useState<{ formulario: Formulario; outro: boolean; avisos: readonly string[] } | null>(null);

  // O formulário começa do padrão a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (!aberto) return;
    reset(formularioAtividadeVazio(tipoInicial, pessoaId, contextoGlobalId));
    setMaisOpcoes(false);
    setOpcaoPrazo('sem');
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
  const lembrete = tipo === 'lembrete';
  const demanda = tipo === 'demanda';
  const compartilhada = dados ? areaCompartilhada(areaId, dados.areas) : false;
  const repetir = watch('repetir');
  const repeticao = watch('repeticao');
  const errosDaRepeticao = errors.repeticao as Partial<Record<keyof FormularioRepeticao, { message?: string }>> | undefined;

  // Erro em campo escondido não pode passar despercebido. O aviso só fica lá fora no lembrete.
  const erroEscondido = CAMPOS_DE_MAIS_OPCOES.some((campo) => errors[campo]) || (!lembrete && Boolean(errors.aviso_dia || errors.aviso_hora)) || Boolean(errosDaRepeticao);
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

  function escolherPrazo(opcao: string) {
    setOpcaoPrazo(opcao);
    if (opcao === 'escolher') return;
    setValue('prazo', opcao === 'sem' ? '' : dataDoPrazoRapido(opcao as PrazoRapido, hojeISO()), { shouldDirty: true, shouldValidate: formState.isSubmitted });
    setValue('prazo_hora', '', { shouldDirty: true });
  }

  /** RN-03.02: a área sugere a responsável; em área compartilhada, a escolha é de quem preenche. */
  function escolherArea(id: string, aoMudar: (valor: string) => void) {
    aoMudar(id);
    if (!dados || !id) return;
    const sugerida = responsavelDaArea(id, dados.areas, dados.pessoas);
    if (sugerida) setValue('responsavel_id', sugerida, { shouldDirty: true });
    else if (areaCompartilhada(id, dados.areas)) setValue('responsavel_id', '', { shouldDirty: true });
  }

  async function gravar(formulario: Formulario, outro: boolean) {
    try {
      const criada = await criarAtividade(formulario);
      aoCriar(criada.id, formulario.tipo);
      if (outro) {
        reset(formularioDoProximo(formulario, pessoaId));
        setMaisOpcoes(false);
        setOpcaoPrazo('sem');
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

  return (
    <>
      <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo="Adicionar" folhaNoCelular alterado={isDirty} aoEnviar={enviar(false)} rotuloSalvar="Salvar" aoSalvarEOutro={() => void enviar(true)()} rotuloSalvarEOutro="Salvar e adicionar outro" salvando={isSubmitting} erros={erros}>
        <div className="grid grid-cols-1 gap-[18px]">
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => <Pilulas rotulo="Tipo" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={TIPOS} />}
          />
          <Campo id={ID_DO_CAMPO.titulo} rotulo="Título" obrigatorio erro={erroDoTitulo} ajuda={titulo.length > MAXIMO_NO_TITULO - 20 ? `${titulo.length} de ${MAXIMO_NO_TITULO} caracteres.` : undefined}>
            {(controle) => <Input autoComplete="off" {...controle} {...register('titulo')} />}
          </Campo>

          {internas.length > 0 && internas.length <= MAXIMO_DE_PILULAS ? (
            <div id={ID_DO_CAMPO.responsavel_id} tabIndex={-1}>
              <Controller
                control={control}
                name="responsavel_id"
                render={({ field }) => <Pilulas rotulo="Responsável" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={internas.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} />}
              />
              {compartilhada && !responsavel && <p className="mt-1.5 text-xs text-ink-soft">Esta área é compartilhada: escolha a responsável.</p>}
              {errors.responsavel_id?.message && <MensagemErro>{errors.responsavel_id.message}</MensagemErro>}
            </div>
          ) : (
            <Controller
              control={control}
              name="responsavel_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.responsavel_id} rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      {!field.value && <option value="">Escolha uma pessoa</option>}
                      {internas.map((pessoa) => (
                        <option key={pessoa.id} value={pessoa.id}>
                          {pessoa.nome_completo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
          )}

          {repetir ? null : lembrete ? (
            <div className="grid grid-cols-2 gap-3">
              <Campo id={ID_DO_CAMPO.aviso_dia} rotulo="Data do aviso" obrigatorio erro={errors.aviso_dia?.message}>
                {(controle) => <Input type="date" {...controle} {...register('aviso_dia')} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.aviso_hora} rotulo="Hora do aviso" obrigatorio erro={errors.aviso_hora?.message}>
                {(controle) => <Input type="time" {...controle} {...register('aviso_hora')} />}
              </Campo>
            </div>
          ) : (
            <div className="grid gap-3">
              <Pilulas rotulo="Prazo" valor={opcaoPrazo} aoMudar={escolherPrazo} opcoes={OPCOES_PRAZO} />
              {opcaoPrazo === 'escolher' && (
                <div className="grid grid-cols-2 gap-3">
                  <Campo id={ID_DO_CAMPO.prazo} rotulo="Dia" erro={errors.prazo?.message}>
                    {(controle) => <Input type="date" {...controle} {...register('prazo')} />}
                  </Campo>
                  <Campo id="atividade-prazo-hora" rotulo="Hora (opcional)">
                    {(controle) => <Input type="time" {...controle} {...register('prazo_hora')} />}
                  </Campo>
                </div>
              )}
            </div>
          )}

          {demanda && (
            <>
              <Controller
                control={control}
                name="solicitante"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.solicitante} rotulo="Solicitante" obrigatorio erro={errors.solicitante?.message}>
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        {(dados?.pessoas ?? []).map((pessoa) => (
                          <option key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome_completo}
                          </option>
                        ))}
                        <option value={SOLICITANTE_OUTRA}>Outra: escrever o nome</option>
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              {solicitante === SOLICITANTE_OUTRA && (
                <Campo id={ID_DO_CAMPO.solicitante_texto} rotulo="Quem pediu" obrigatorio erro={errors.solicitante_texto?.message}>
                  {(controle) => <Input autoComplete="off" {...controle} {...register('solicitante_texto')} />}
                </Campo>
              )}
              <Campo rotulo="Resultado esperado">{(controle) => <Textarea {...controle} {...register('resultado_esperado')} />}</Campo>
            </>
          )}

          <Controller
            control={control}
            name="contextos"
            render={({ field }) => <PilulasMultiplas rotulo="Contexto" valores={field.value} aoMudar={field.onChange} opcoes={(dados?.produtos ?? []).map((produto) => ({ valor: produto.id, rotulo: produto.nome }))} />}
          />
          <p className="-mt-3 text-xs text-ink-soft">Sem produto marcado, é da Numa.</p>

          <div>
            <Button variante="terciario" tamanho="pequeno" aria-expanded={maisOpcoes} onClick={() => setMaisOpcoes((atual) => erroEscondido || !atual)}>
              <ChevronDown aria-hidden className={maisOpcoes ? 'rotate-180' : undefined} />
              Mais opções
            </Button>
          </div>

          {maisOpcoes && (
            <>
              <Campo rotulo="Descrição">{(controle) => <Textarea {...controle} {...register('descricao')} />}</Campo>
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
              <Controller
                control={control}
                name="participantes"
                render={({ field }) => <PilulasMultiplas rotulo="Participantes" valores={field.value} aoMudar={field.onChange} opcoes={(dados?.pessoas ?? []).filter((pessoa) => pessoa.situacao === 'ativa' && pessoa.id !== responsavel).map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} />}
              />
              <Controller
                control={control}
                name="prioridade"
                render={({ field }) => <Pilulas rotulo="Prioridade" valor={field.value} aoMudar={field.onChange} opcoes={OPCOES_PRIORIDADE} />}
              />
              <Pilulas
                rotulo="Repetição"
                valor={repetir ? 'sim' : 'nao'}
                aoMudar={(valor) => {
                  const liga = valor === 'sim';
                  setValue('repetir', liga, { shouldDirty: true });
                  // Parte do prazo já escolhido, para não perguntar duas vezes.
                  if (liga) setValue('repeticao', { ...repeticaoPadrao(watch('prazo') > hojeISO() ? watch('prazo') : hojeISO()), hora: watch('prazo_hora') || watch('aviso_hora') }, { shouldDirty: true });
                }}
                opcoes={[
                  { valor: 'nao', rotulo: 'Não repete' },
                  { valor: 'sim', rotulo: 'Repete' },
                ]}
              />
              {repetir && (
                <Controller control={control} name="repeticao" render={({ field }) => <CampoRepeticao id={ID_DA_REPETICAO} valor={field.value} aoMudar={field.onChange} lembrete={lembrete} hoje={hojeISO()} erros={Object.fromEntries(Object.entries(errosDaRepeticao ?? {}).map(([campo, erro]) => [campo, erro?.message]))} />} />
              )}
              {!lembrete && (
                <>
                  {!repetir && (
                    <>
                      <Campo id={ID_DO_CAMPO.inicio} rotulo="Início" erro={errors.inicio?.message}>
                        {(controle) => <Input type="date" {...controle} {...register('inicio')} />}
                      </Campo>
                      <div className="grid grid-cols-2 gap-3">
                        <Campo id={ID_DO_CAMPO.aviso_dia} rotulo="Avisar no dia" erro={errors.aviso_dia?.message}>
                          {(controle) => <Input type="date" {...controle} {...register('aviso_dia')} />}
                        </Campo>
                        <Campo id={ID_DO_CAMPO.aviso_hora} rotulo="Às" erro={errors.aviso_hora?.message}>
                          {(controle) => <Input type="time" {...controle} {...register('aviso_hora')} />}
                        </Campo>
                      </div>
                    </>
                  )}
                  <Campo id="atividade-checklist" rotulo="Checklist" ajuda="Um item por linha.">
                    {(controle) => <Textarea {...controle} {...register('checklist')} />}
                  </Campo>
                </>
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
          {consulta.estado === 'erro' && <Faixa tipo="erro">Não deu para ler as pessoas e os produtos. Importe um backup ou restaure os exemplos em Configurações › Dados.</Faixa>}
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
          if (pendente) void gravar(pendente.formulario, pendente.outro);
        }}
      />
    </>
  );
}
