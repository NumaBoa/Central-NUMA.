'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { CANAIS_DE_CONTEUDO, FORMATOS_DE_CONTEUDO, SITUACOES_DE_PECA, type PecaConteudo, type SituacaoDaPeca } from '@/dados/tipos/marketing';
import { avisosDaPeca, criarPeca, esquemaFormularioPeca, formularioDaPeca, formularioPecaVazio, responsavelDeMarketing, ROTULOS_CANAL, ROTULOS_FORMATO, ROTULOS_SITUACAO_PECA, salvarPeca, type DadosDoConteudo, type FormularioPeca } from '@/dominio/conteudo';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { AbasDoFormulario, focarCampo, opcoesDeContexto } from './apoio';
import { SeletorDeArquivos } from './seletor-arquivos';

type Aba = 'geral' | 'texto' | 'publicacao';
type CampoComErro = [keyof FormularioPeca, { id: string; aba: Aba }];

const CAMPOS: readonly CampoComErro[] = [
  ['titulo', { id: 'peca-titulo', aba: 'geral' }],
  ['contexto', { id: 'peca-contexto', aba: 'geral' }],
  ['data_prevista', { id: 'peca-prevista', aba: 'geral' }],
  ['responsavel_id', { id: 'peca-responsavel', aba: 'geral' }],
  ['publicado_em', { id: 'peca-realizada', aba: 'publicacao' }],
  ['link_publicacao', { id: 'peca-link', aba: 'publicacao' }],
  ['alcance', { id: 'peca-alcance', aba: 'publicacao' }],
  ['interacoes', { id: 'peca-interacoes', aba: 'publicacao' }],
  ['cliques', { id: 'peca-cliques', aba: 'publicacao' }],
  ['inscritos', { id: 'peca-inscritos', aba: 'publicacao' }],
  ['medido_em', { id: 'peca-medido', aba: 'publicacao' }],
];

type Props = { dados: DadosDoConteudo; peca?: PecaConteudo | null; diaInicial?: string; situacaoInicial?: SituacaoDaPeca; aoFechar: () => void };

/** T08.05, formulário da peça. A Central registra a publicação; quem publica é a pessoa, na rede. */
export function FormularioDePeca({ dados, peca, diaInicial, situacaoInicial, aoFechar }: Props) {
  const { pessoa, contexto } = useCentral();
  const inicial = useMemo<FormularioPeca>(() => {
    const base = peca ? formularioDaPeca(peca, dados.vinculos.filter((vinculo) => vinculo.registro_id === peca.id && !vinculo.arquivado_em).map((vinculo) => vinculo.arquivo_id)) : formularioPecaVazio(responsavelDeMarketing(dados.areas) ?? pessoa.id, contexto.id, diaInicial);
    return situacaoInicial ? { ...base, situacao: situacaoInicial } : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vale no momento de abrir
  }, [peca?.id, diaInicial, situacaoInicial]);
  const { register, handleSubmit, control, reset, watch, formState } = useForm<FormularioPeca>({ resolver: zodResolver(esquemaFormularioPeca), defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [aba, setAba] = useState<Aba>(situacaoInicial === 'publicado' ? 'publicacao' : 'geral');
  const [avisos, setAvisos] = useState<{ formulario: FormularioPeca; textos: readonly string[] } | null>(null);

  useEffect(() => reset(inicial), [inicial, reset]);

  const situacao = watch('situacao');
  const internas = pessoasDoSeletor(dados.pessoas);
  const responsavelAtual = watch('responsavel_id');
  const responsaveis = responsavelAtual && !internas.some((item) => item.id === responsavelAtual) ? [...internas, ...dados.pessoas.filter((item) => item.id === responsavelAtual)] : internas;
  const campanhas = dados.campanhas.filter((campanha) => !campanha.arquivado_em || campanha.id === watch('campanha_id'));
  const publicada = situacao === 'publicado';

  const erros: ErroDeCampo[] = CAMPOS.flatMap(([campo, { id }]) => {
    const mensagem = errors[campo]?.message;
    return typeof mensagem === 'string' ? [{ campoId: id, mensagem }] : [];
  });
  const errosDaAba = (qual: Aba) => CAMPOS.filter(([campo, { aba: daAba }]) => daAba === qual && errors[campo]).length;

  function irParaOErro(campoId: string) {
    const destino = CAMPOS.find(([, { id }]) => id === campoId)?.[1].aba;
    if (destino) setAba(destino);
    focarCampo(campoId);
  }

  function aoFalhar(falhas: FieldErrors<FormularioPeca>) {
    const primeiro = CAMPOS.find(([campo]) => falhas[campo]);
    if (primeiro) irParaOErro(primeiro[1].id);
  }

  async function gravar(formulario: FormularioPeca) {
    try {
      if (peca) await salvarPeca(peca.id, formulario);
      else await criarPeca(formulario);
      aviso(peca ? 'Peça atualizada.' : 'Peça criada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(async (formulario) => {
    const textos = avisosDaPeca(formulario);
    if (textos.length) {
      setAvisos({ formulario, textos });
      return;
    }
    await gravar(formulario);
  }, aoFalhar);

  return (
    <>
      <JanelaFormulario larga aberto aoFechar={aoFechar} titulo={peca ? peca.titulo : 'Nova peça de conteúdo'} alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar={peca ? 'Salvar' : 'Salvar peça'} salvando={isSubmitting} erros={erros} aoEscolherErro={irParaOErro}>
        <AbasDoFormulario
          rotulo="Seções da peça"
          ativa={aba}
          aoMudar={setAba}
          abas={[
            {
              id: 'geral',
              rotulo: 'Geral',
              erros: errosDaAba('geral'),
              conteudo: (
                <div className="grid gap-[18px] md:grid-cols-2">
                  <Campo id="peca-titulo" rotulo="Título ou tema" obrigatorio erro={errors.titulo?.message}>
                    {(controle) => <Input autoComplete="off" {...controle} {...register('titulo')} />}
                  </Campo>
                  <Controller
                    control={control}
                    name="contexto"
                    render={({ field }) => (
                      <Campo id="peca-contexto" rotulo="Marca ou produto" obrigatorio erro={errors.contexto?.message}>
                        {(controle) => (
                          <Selecao {...controle} {...field}>
                            <option value="">Escolha</option>
                            {opcoesDeContexto(dados.produtos).map((opcao) => (
                              <option key={opcao.valor} value={opcao.valor}>
                                {opcao.rotulo}
                              </option>
                            ))}
                          </Selecao>
                        )}
                      </Campo>
                    )}
                  />
                  <Controller
                    control={control}
                    name="canal"
                    render={({ field }) => (
                      <Campo id="peca-canal" rotulo="Canal" obrigatorio>
                        {(controle) => (
                          <Selecao {...controle} {...field}>
                            {CANAIS_DE_CONTEUDO.map((valor) => (
                              <option key={valor} value={valor}>
                                {ROTULOS_CANAL[valor]}
                              </option>
                            ))}
                          </Selecao>
                        )}
                      </Campo>
                    )}
                  />
                  <Controller
                    control={control}
                    name="formato"
                    render={({ field }) => (
                      <Campo id="peca-formato" rotulo="Formato">
                        {(controle) => (
                          <Selecao {...controle} {...field}>
                            <option value="">Não definido</option>
                            {FORMATOS_DE_CONTEUDO.map((valor) => (
                              <option key={valor} value={valor}>
                                {ROTULOS_FORMATO[valor]}
                              </option>
                            ))}
                          </Selecao>
                        )}
                      </Campo>
                    )}
                  />
                  <Campo id="peca-prevista" rotulo="Publicação prevista" obrigatorio erro={errors.data_prevista?.message} ajuda="O Meu dia lembra a responsável na véspera. A Central não publica nas redes.">
                    {(controle) => <EntradaData {...controle} {...register('data_prevista')} />}
                  </Campo>
                  <Controller
                    control={control}
                    name="situacao"
                    render={({ field }) => (
                      <Campo id="peca-situacao" rotulo="Situação" obrigatorio ajuda={field.value === 'publicado' ? 'Publicado pede a data realizada e o link, na aba Publicação e resultados.' : undefined}>
                        {(controle) => (
                          <Selecao {...controle} {...field}>
                            {SITUACOES_DE_PECA.map((valor) => (
                              <option key={valor} value={valor}>
                                {ROTULOS_SITUACAO_PECA[valor]}
                              </option>
                            ))}
                          </Selecao>
                        )}
                      </Campo>
                    )}
                  />
                  <Controller
                    control={control}
                    name="responsavel_id"
                    render={({ field }) => (
                      <Campo id="peca-responsavel" rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
                        {(controle) => (
                          <Selecao {...controle} {...field}>
                            <option value="">Escolha uma pessoa</option>
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
                  <Controller
                    control={control}
                    name="campanha_id"
                    render={({ field }) => (
                      <Campo id="peca-campanha" rotulo="Campanha">
                        {(controle) => (
                          <Selecao {...controle} {...field}>
                            <option value="">Nenhuma</option>
                            {campanhas.map((campanha) => (
                              <option key={campanha.id} value={campanha.id}>
                                {campanha.nome}
                              </option>
                            ))}
                          </Selecao>
                        )}
                      </Campo>
                    )}
                  />
                  {situacao === 'cancelado' && (
                    <Campo id="peca-motivo" rotulo="Motivo do cancelamento" className="md:col-span-2">
                      {(controle) => <Input autoComplete="off" {...controle} {...register('cancelado_motivo')} />}
                    </Campo>
                  )}
                </div>
              ),
            },
            {
              id: 'texto',
              rotulo: 'Texto e arquivos',
              conteudo: (
                <>
                  <Campo id="peca-texto" rotulo="Texto ou legenda">
                    {(controle) => <Textarea {...controle} rows={5} {...register('texto')} />}
                  </Campo>
                  <Controller control={control} name="arquivos" render={({ field }) => <SeletorDeArquivos arquivos={dados.arquivos} valores={field.value ?? []} aoMudar={field.onChange} />} />
                </>
              ),
            },
            {
              id: 'publicacao',
              rotulo: 'Publicação e resultados',
              erros: errosDaAba('publicacao'),
              conteudo: (
                <>
                  {!publicada && <Faixa>Estes campos valem quando a situação for Publicado. Enquanto a peça não foi ao ar, vale a data prevista.</Faixa>}
                  <div className="grid gap-[18px] md:grid-cols-2">
                    <Campo id="peca-realizada" rotulo="Data realizada" obrigatorio={publicada} erro={errors.publicado_em?.message}>
                      {(controle) => <EntradaData disabled={!publicada} {...controle} {...register('publicado_em')} />}
                    </Campo>
                    <Campo id="peca-link" rotulo="Link da publicação" obrigatorio={publicada} erro={errors.link_publicacao?.message}>
                      {(controle) => <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} disabled={!publicada} {...controle} {...register('link_publicacao')} />}
                    </Campo>
                  </div>
                  <fieldset disabled={!publicada} className="grid gap-[18px]">
                    <legend className="mb-1 texto-rotulo">Resultados, informados à mão</legend>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Campo id="peca-alcance" rotulo="Alcance" erro={errors.alcance?.message}>
                        {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('alcance')} />}
                      </Campo>
                      <Campo id="peca-interacoes" rotulo="Interações" erro={errors.interacoes?.message}>
                        {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('interacoes')} />}
                      </Campo>
                      <Campo id="peca-cliques" rotulo="Cliques" erro={errors.cliques?.message}>
                        {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('cliques')} />}
                      </Campo>
                      <Campo id="peca-inscritos" rotulo="Novos inscritos" erro={errors.inscritos?.message}>
                        {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('inscritos')} />}
                      </Campo>
                    </div>
                    <Campo id="peca-medido" rotulo="Data da medição" erro={errors.medido_em?.message} ajuda="O que ficar vazio aparece como não informado, nunca como zero.">
                      {(controle) => <EntradaData {...controle} {...register('medido_em')} />}
                    </Campo>
                  </fieldset>
                </>
              ),
            },
          ]}
        />
      </JanelaFormulario>
      <Confirmacao
        aberto={avisos !== null}
        aoFechar={() => setAvisos(null)}
        titulo="Salvar mesmo assim?"
        texto={avisos?.textos.join(' ')}
        rotuloConfirmar="Salvar mesmo assim"
        rotuloCancelar="Voltar e revisar"
        aoConfirmar={() => {
          const atual = avisos;
          setAvisos(null);
          if (atual) void gravar(atual.formulario);
        }}
      />
    </>
  );
}
