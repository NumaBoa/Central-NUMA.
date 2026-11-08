'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { CircleAlert, Folder } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { CampoEtiquetas } from '@/componentes/campos/etiquetas';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { CLASSES_DE_INFORMACAO, FINALIDADES_DE_APRESENTACAO, TIPOS_DE_ARQUIVO, type Arquivo, type TipoDeArquivo } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { acharDuplicado, avisosDoArquivo, classePadraoDoTipo, contextosDoArquivo, criarArquivo, edicaoDoArquivo, esquemaFormularioArquivo, formularioArquivoVazio, idDoDrive, mensagemDoDuplicado, pastaSugerida, problemaDoLink, ROTULOS_FINALIDADE, ROTULOS_TIPO_ARQUIVO, salvarArquivo, tipoJuridico, type DadosDaBiblioteca, type FormularioArquivo } from '@/dominio/biblioteca';
import { AVISO_CLASSE_DRIVE, classeRestrita, DESCRICOES_CLASSE, ROTULOS_CLASSE } from '@/dominio/classes';
import { LEMBRETE_LINK_DRIVE } from '@/dominio/link-drive';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { carregarRegistrosVinculaveis } from '@/dominio/vinculos-arquivo';
import { AbasDoFormulario, focarCampo, opcoesDeContexto, SeletorDeRegistro } from './apoio';

type Aba = 'dados' | 'detalhes' | 'apresentacao';
type CampoComErro = [keyof FormularioArquivo, { id: string; aba: Aba }];

/** O campo, o id dele na tela e a aba onde está. */
const CAMPOS: readonly CampoComErro[] = [
  ['link', { id: 'arquivo-link', aba: 'dados' }],
  ['titulo', { id: 'arquivo-titulo', aba: 'dados' }],
  ['classe', { id: 'arquivo-classe', aba: 'dados' }],
  ['contextos', { id: 'arquivo-contextos', aba: 'dados' }],
  ['pasta_restrita_confirmada', { id: 'arquivo-pasta', aba: 'dados' }],
  ['responsavel_id', { id: 'arquivo-responsavel', aba: 'dados' }],
  ['precos_data', { id: 'arquivo-precos-data', aba: 'apresentacao' }],
];

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  dados: DadosDaBiblioteca;
  /** Sem arquivo, é um novo. O link de quem existe só muda por "Nova versão" (RN-08.04). */
  arquivo?: Arquivo | null;
  tipoInicial?: TipoDeArquivo;
  aoCriar?: (arquivo: Arquivo) => void;
  /** T08.03: "Adicionar vários links". */
  aoPedirLote?: () => void;
};

/** T08.03 e edição de T08.02. Registra o link e os metadados: o arquivo continua no Drive. */
export function FormularioDeArquivo({ aberto, aoFechar, dados, arquivo, tipoInicial, aoCriar, aoPedirLote }: Props) {
  const { pessoa, contexto } = useCentral();
  const inicial = useMemo<FormularioArquivo>(() => {
    if (arquivo) return { ...edicaoDoArquivo(arquivo, dados.contextos, dados.etiquetasDosArquivos.get(arquivo.id) ?? []), link: arquivo.url_atual, vinculo: '' };
    return formularioArquivoVazio(pessoa.id, contexto.id, tipoInicial);
  }, [arquivo, tipoInicial, pessoa.id, contexto.id, dados.contextos, dados.etiquetasDosArquivos]);
  const { register, handleSubmit, control, reset, watch, setValue, setError, formState } = useForm<FormularioArquivo>({ resolver: zodResolver(esquemaFormularioArquivo), defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [aba, setAba] = useState<Aba>('dados');
  const [avisos, setAvisos] = useState<{ formulario: FormularioArquivo; outro: boolean; textos: readonly string[] } | null>(null);
  const [classeTocada, setClasseTocada] = useState(false);
  const registros = useConsulta(carregarRegistrosVinculaveis, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    reset(inicial);
    setAba('dados');
    setClasseTocada(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `inicial` vale no momento de abrir
  }, [aberto, arquivo?.id, tipoInicial, reset]);

  const valores = watch();
  const internas = pessoasDoSeletor(dados.pessoas);
  const responsaveis = valores.responsavel_id && !internas.some((item) => item.id === valores.responsavel_id) ? [...internas, ...dados.pessoas.filter((item) => item.id === valores.responsavel_id)] : internas;
  const duplicado = !arquivo ? acharDuplicado(idDoDrive(valores.link ?? ''), dados.arquivos, dados.versoes) : null;
  const pasta = pastaSugerida(valores.tipo, valores.contextos ?? [], dados.produtos);
  const usados = arquivo ? contextosDoArquivo(arquivo.id, dados.contextos) : [];
  const opcoes = opcoesDeContexto(dados.produtos);
  const opcoesComAtuais = [...opcoes, ...usados.filter((id) => !opcoes.some((opcao) => opcao.valor === id)).map((id) => ({ valor: id, rotulo: dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido' }))];

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

  function aoFalhar(falhas: FieldErrors<FormularioArquivo>) {
    const primeiro = CAMPOS.find(([campo]) => falhas[campo]);
    if (primeiro) irParaOErro(primeiro[1].id);
  }

  async function gravar(formulario: FormularioArquivo, outro: boolean) {
    try {
      if (arquivo) {
        await salvarArquivo(arquivo.id, formulario);
        aviso('Arquivo atualizado.');
        aoFechar();
        return;
      }
      const criado = await criarArquivo(formulario);
      if (outro) {
        // Mantém o que costuma se repetir; link, título e descrição são de cada arquivo.
        reset({ ...formulario, link: '', titulo: '', descricao: '', vinculo: '' });
        setAba('dados');
        aviso(`${criado.titulo} entrou na biblioteca.`);
        focarCampo('arquivo-link');
        return;
      }
      if (aoCriar) aoCriar(criado);
      else aviso('Arquivo adicionado à biblioteca.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = (outro: boolean) =>
    handleSubmit(async (formulario) => {
      if (duplicado) {
        setError('link', { message: mensagemDoDuplicado(duplicado) });
        irParaOErro('arquivo-link');
        return;
      }
      const textos = avisosDoArquivo(formulario);
      if (textos.length) {
        setAvisos({ formulario, outro, textos });
        return;
      }
      await gravar(formulario, outro);
    }, aoFalhar);

  const problemaAoDigitar = !arquivo && valores.link?.trim() ? problemaDoLink(valores.link) : null;

  return (
    <>
      <JanelaFormulario
        larga
        aberto={aberto}
        aoFechar={aoFechar}
        titulo={arquivo ? 'Editar arquivo' : 'Adicionar arquivo'}
        descricao={arquivo ? undefined : 'Cadastre o link e organize o material. O arquivo continua no Drive.'}
        alterado={isDirty}
        aoEnviar={(evento) => void enviar(false)(evento)}
        rotuloSalvar={arquivo ? 'Salvar' : 'Adicionar arquivo'}
        aoSalvarEOutro={arquivo ? undefined : () => void enviar(true)()}
        salvando={isSubmitting}
        erros={erros}
        aoEscolherErro={irParaOErro}
      >
        <AbasDoFormulario
          rotulo="Seções do arquivo"
          ativa={aba}
          aoMudar={setAba}
          abas={[
            {
              id: 'dados',
              rotulo: 'Dados do arquivo',
              erros: errosDaAba('dados'),
              conteudo: (
                <>
                  {arquivo ? (
                    <p className="text-[13px] text-ink-soft">O link só muda com “Nova versão”, na ficha: a versão anterior fica guardada.</p>
                  ) : (
                    <>
                      <Campo id="arquivo-link" rotulo="Link do Drive" obrigatorio erro={errors.link?.message ?? problemaAoDigitar ?? undefined} ajuda={LEMBRETE_LINK_DRIVE}>
                        {(controle) => <EntradaLinkDrive link={valores.link ?? ''} {...controle} {...register('link')} />}
                      </Campo>
                      {duplicado && (
                        <Faixa
                          tipo="atencao"
                          acao={
                            <LinkCentral href={`/marketing/arquivos/${duplicado.arquivoId}`} className="inline-flex min-h-11 items-center font-semibold underline md:min-h-0">
                              Abrir o existente
                            </LinkCentral>
                          }
                        >
                          {mensagemDoDuplicado(duplicado)}
                        </Faixa>
                      )}
                    </>
                  )}
                  <div className="grid gap-[18px] md:grid-cols-2">
                  <Campo id="arquivo-titulo" rotulo="Título" obrigatorio erro={errors.titulo?.message} ajuda="A Central não lê o nome no Drive: digite.">
                    {(controle) => <Input autoComplete="off" {...controle} {...register('titulo')} />}
                  </Campo>
                  <Controller
                    control={control}
                    name="responsavel_id"
                    render={({ field }) => (
                      <Campo id="arquivo-responsavel" rotulo="Responsável" obrigatorio erro={errors.responsavel_id?.message}>
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
                  </div>
                  <div className="grid gap-[18px] md:grid-cols-2">
                    <Controller
                      control={control}
                      name="tipo"
                      render={({ field }) => (
                        <Campo id="arquivo-tipo" rotulo="Tipo" obrigatorio>
                          {(controle) => (
                            <Selecao
                              {...controle}
                              {...field}
                              onChange={(evento) => {
                                const novo = evento.target.value as TipoDeArquivo;
                                field.onChange(novo);
                                // O padrão por tipo só vale até a pessoa escolher a classe (T08.03).
                                if (!arquivo && !classeTocada) setValue('classe', classePadraoDoTipo(novo), { shouldDirty: true });
                              }}
                            >
                              {TIPOS_DE_ARQUIVO.map((valor) => (
                                <option key={valor} value={valor}>
                                  {ROTULOS_TIPO_ARQUIVO[valor]}
                                </option>
                              ))}
                            </Selecao>
                          )}
                        </Campo>
                      )}
                    />
                    <Controller
                      control={control}
                      name="classe"
                      render={({ field }) => (
                        <Campo id="arquivo-classe" rotulo="Classe" obrigatorio erro={errors.classe?.message} ajuda={DESCRICOES_CLASSE[field.value]}>
                          {(controle) => (
                            <Selecao
                              {...controle}
                              {...field}
                              onChange={(evento) => {
                                setClasseTocada(true);
                                field.onChange(evento.target.value);
                              }}
                            >
                              {CLASSES_DE_INFORMACAO.map((valor) => (
                                <option key={valor} value={valor}>
                                  {ROTULOS_CLASSE[valor]}
                                </option>
                              ))}
                            </Selecao>
                          )}
                        </Campo>
                      )}
                    />
                  </div>
                  <Controller
                    control={control}
                    name="contextos"
                    render={({ field }) => (
                      <div id="arquivo-contextos" tabIndex={-1}>
                        <PilulasMultiplas rotulo="Contexto" obrigatorio valores={field.value ?? []} aoMudar={field.onChange} opcoes={opcoesComAtuais} />
                        {errors.contextos?.message && <MensagemErro className="mt-1.5">{errors.contextos.message}</MensagemErro>}
                      </div>
                    )}
                  />
                  {classeRestrita(valores.classe) && (
                    <div>
                      <label className="flex min-h-11 items-start gap-2.5 text-[13px] font-semibold">
                        <input id="arquivo-pasta" type="checkbox" className="mt-0.5 size-[18px]" {...register('pasta_restrita_confirmada')} />
                        Confirmei que a pasta no Drive está restrita
                      </label>
                      {errors.pasta_restrita_confirmada?.message && <MensagemErro className="mt-1">{errors.pasta_restrita_confirmada.message}</MensagemErro>}
                    </div>
                  )}
                  <Faixa tipo="info">{AVISO_CLASSE_DRIVE}</Faixa>
                  {pasta && (
                    <p className="flex items-start gap-2 rounded-campo border border-line px-3.5 py-2.5 text-[13px]">
                      <Folder className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
                      <span>
                        <span className="block font-semibold break-words">{pasta}</span>
                        <span className="text-xs text-ink-soft">Pasta sugerida. A Central não cria pastas no Drive.</span>
                      </span>
                    </p>
                  )}
                  {tipoJuridico(valores.tipo) && (
                    <p className="text-[13px] text-ink-soft">
                      Aqui fica o arquivo. Cláusulas e modelos editáveis ficam em{' '}
                      <LinkCentral href="/legal/modelos" className="inline-flex min-h-11 items-center underline md:min-h-0">
                        Legal e privacidade
                      </LinkCentral>
                      .
                    </p>
                  )}
                  {!arquivo && aoPedirLote && (
                    <button type="button" className="inline-flex min-h-11 items-center justify-self-start text-[13px] font-semibold text-indigo-dk underline md:min-h-0" onClick={aoPedirLote}>
                      Adicionar vários links, com prévia antes de criar
                    </button>
                  )}
                </>
              ),
            },
            {
              id: 'detalhes',
              rotulo: arquivo ? 'Detalhes' : 'Detalhes e vínculos',
              conteudo: (
                <>
                  <Controller control={control} name="etiquetas" render={({ field }) => <CampoEtiquetas etiquetas={dados.etiquetas} modulo="biblioteca" valores={field.value ?? []} aoMudar={field.onChange} />} />
                  <Campo id="arquivo-descricao" rotulo="Descrição">
                    {(controle) => <Textarea {...controle} {...register('descricao')} />}
                  </Campo>
                  <Campo id="arquivo-origem" rotulo="Origem ou autor">
                    {(controle) => <Input autoComplete="off" {...controle} {...register('origem_autor')} />}
                  </Campo>
                  <div className="grid gap-[18px] md:grid-cols-2">
                    <Campo id="arquivo-direitos" rotulo="Direitos de uso" ajuda="Ex.: próprios, licença de banco de imagens.">
                      {(controle) => <Input autoComplete="off" {...controle} {...register('direitos_uso')} />}
                    </Campo>
                    <Campo id="arquivo-validade" rotulo="Validade dos direitos" ajuda="Avisa no Meu dia 30 dias antes do fim.">
                      {(controle) => <EntradaData {...controle} {...register('direitos_validade')} />}
                    </Campo>
                  </div>
                  {!arquivo && <Controller control={control} name="vinculo" render={({ field }) => <SeletorDeRegistro id="arquivo-vinculo" registros={registros.dados ?? []} valor={field.value ?? ''} aoMudar={field.onChange} />} />}
                </>
              ),
            },
            ...(valores.tipo === 'apresentacao'
              ? [
                  {
                    id: 'apresentacao' as const,
                    rotulo: 'Apresentação',
                    erros: errosDaAba('apresentacao'),
                    conteudo: (
                      <>
                        <div className="grid gap-[18px] md:grid-cols-2">
                          <Controller
                            control={control}
                            name="finalidade"
                            render={({ field }) => (
                              <Campo id="arquivo-finalidade" rotulo="Finalidade">
                                {(controle) => (
                                  <Selecao {...controle} {...field}>
                                    <option value="">Não informada</option>
                                    {FINALIDADES_DE_APRESENTACAO.map((valor) => (
                                      <option key={valor} value={valor}>
                                        {ROTULOS_FINALIDADE[valor]}
                                      </option>
                                    ))}
                                  </Selecao>
                                )}
                              </Campo>
                            )}
                          />
                          <Campo id="arquivo-publico" rotulo="Público">
                            {(controle) => <Input autoComplete="off" {...controle} {...register('publico')} />}
                          </Campo>
                        </div>
                        <Campo id="arquivo-data-uso" rotulo="Data de uso">
                          {(controle) => <EntradaData {...controle} {...register('data_uso')} />}
                        </Campo>
                        <Controller
                          control={control}
                          name="contem_precos"
                          render={({ field }) => (
                            <Pilulas
                              rotulo="Contém preços"
                              valor={field.value}
                              aoMudar={field.onChange}
                              opcoes={[
                                { valor: 'nao', rotulo: 'Não' },
                                { valor: 'sim', rotulo: 'Sim' },
                              ]}
                            />
                          )}
                        />
                        {valores.contem_precos === 'sim' && (
                          <Campo id="arquivo-precos-data" rotulo="Data dos preços" obrigatorio erro={errors.precos_data?.message} ajuda="Para saber se os preços da apresentação ainda valem.">
                            {(controle) => <EntradaData {...controle} {...register('precos_data')} />}
                          </Campo>
                        )}
                        <div>
                          <label className="flex min-h-11 items-center gap-2.5 text-[13px] font-semibold">
                            <input type="checkbox" className="size-[18px]" {...register('contem_fin')} />
                            Contém dados financeiros (FIN)
                          </label>
                          {valores.contem_fin && valores.classe === 'pub' && (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-err">
                              <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                              Com dados financeiros, a classe não pode ser PUB. Mude a classe em Dados do arquivo.
                            </p>
                          )}
                        </div>
                      </>
                    ),
                  },
                ]
              : []),
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
          if (atual) void gravar(atual.formulario, atual.outro);
        }}
      />
    </>
  );
}
