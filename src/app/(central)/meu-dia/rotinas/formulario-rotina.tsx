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
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Button } from '@/componentes/ui/button';
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

const TIPOS = [
  { valor: 'tarefa', rotulo: 'Tarefa' },
  { valor: 'demanda', rotulo: 'Demanda' },
  { valor: 'lembrete', rotulo: 'Lembrete' },
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
    setMaisOpcoes(Boolean(rotina));
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
      <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo={rotina ? 'Editar rotina' : 'Nova rotina'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={rotina ? 'Salvar' : 'Criar rotina'} salvando={isSubmitting} erros={erros}>
        <div className="grid grid-cols-1 gap-[18px]">
          <Controller control={control} name="tipo" render={({ field }) => <Pilulas rotulo="Tipo" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={TIPOS} />} />
          <Campo id={ID_DO_CAMPO.titulo} rotulo="Título" obrigatorio erro={erroDoTitulo} ajuda={titulo.length > MAXIMO_NO_TITULO - 20 ? `${titulo.length} de ${MAXIMO_NO_TITULO} caracteres.` : undefined}>
            {(controle) => <Input autoComplete="off" {...controle} {...register('titulo')} />}
          </Campo>
          <Controller
            control={control}
            name="responsavel_id"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.responsavel_id} rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    {!field.value && <option value="">Escolha uma pessoa</option>}
                    {responsaveis.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome_completo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <Controller control={control} name="repeticao" render={({ field }) => <CampoRepeticao id={ID_DA_REPETICAO} valor={field.value} aoMudar={field.onChange} lembrete={lembrete} hoje={hoje} erros={Object.fromEntries(Object.entries(errosDaRepeticao ?? {}).map(([campo, erro]) => [campo, erro?.message]))} />} />
          {rotina && (mudouAgenda ? <Faixa tipo="atencao">Ao salvar, esta regra termina e outra começa a partir de hoje. As ocorrências que ninguém mexeu são refeitas; as passadas não mudam.</Faixa> : <p className="-mt-2 text-xs text-ink-soft">O que mudar aqui vale para as próximas ocorrências que ninguém editou à parte. As passadas não mudam.</p>)}

          <div>
            <Button variante="terciario" tamanho="pequeno" aria-expanded={maisOpcoes} onClick={() => setMaisOpcoes((atual) => erroEscondido || !atual)}>
              <ChevronDown aria-hidden className={maisOpcoes ? 'rotate-180' : undefined} />
              Mais opções
            </Button>
          </div>

          {maisOpcoes && (
            <>
              {demanda && (
                <>
                  <Controller
                    control={control}
                    name="solicitante"
                    render={({ field }) => (
                      <Campo id={ID_DO_CAMPO.solicitante} rotulo="Solicitante" obrigatorio erro={errors.solicitante?.message}>
                        {(controle) => (
                          <Selecao {...controle} {...field}>
                            {dados.pessoas
                              .filter((item) => !item.arquivado_em)
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.nome_completo}
                                </option>
                              ))}
                            <option value={SOLICITANTE_OUTRA_ROTINA}>Outra: escrever o nome</option>
                          </Selecao>
                        )}
                      </Campo>
                    )}
                  />
                  {solicitante === SOLICITANTE_OUTRA_ROTINA && (
                    <Campo id={ID_DO_CAMPO.solicitante_texto} rotulo="Quem pediu" obrigatorio erro={errors.solicitante_texto?.message}>
                      {(controle) => <Input autoComplete="off" {...controle} {...register('solicitante_texto')} />}
                    </Campo>
                  )}
                  <Campo rotulo="Resultado esperado">{(controle) => <Textarea {...controle} {...register('resultado_esperado')} />}</Campo>
                </>
              )}
              <Campo rotulo="Descrição">{(controle) => <Textarea {...controle} {...register('descricao')} />}</Campo>
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
              <Controller control={control} name="contextos" render={({ field }) => <PilulasMultiplas rotulo="Contexto" valores={field.value} aoMudar={field.onChange} opcoes={produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome }))} />} />
              <p className="-mt-3 text-xs text-ink-soft">Sem produto marcado, é da Numa.</p>
              <Controller control={control} name="participantes" render={({ field }) => <PilulasMultiplas rotulo="Participantes" valores={field.value} aoMudar={field.onChange} opcoes={participantes.map((item) => ({ valor: item.id, rotulo: item.nome_completo }))} />} />
              <Controller control={control} name="prioridade" render={({ field }) => <Pilulas rotulo="Prioridade" valor={field.value} aoMudar={field.onChange} opcoes={OPCOES_PRIORIDADE} />} />
              {!lembrete && (
                <Campo id="rotina-checklist" rotulo="Checklist" ajuda="Um item por linha. Cada ocorrência nasce com ele desmarcado.">
                  {(controle) => <Textarea {...controle} {...register('checklist')} />}
                </Campo>
              )}
              <Controller
                control={control}
                name="arquivo"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.arquivo} rotulo="Arquivo (link do Drive)" erro={errors.arquivo?.message} ajuda={LEMBRETE_LINK_DRIVE}>
                    {(controle) => <EntradaLinkDrive link={arquivo} {...controle} {...field} value={field.value} />}
                  </Campo>
                )}
              />
            </>
          )}
          {errors.root?.message && <MensagemErro>{errors.root.message}</MensagemErro>}
        </div>
      </PainelFormulario>
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
