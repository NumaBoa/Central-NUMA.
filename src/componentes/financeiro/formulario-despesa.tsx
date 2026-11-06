'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { FormularioContraparte } from '@/app/(central)/configuracoes/cadastros/contrapartes/formulario-contraparte';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { SeletorContraparte } from '@/componentes/campos/seletor-contraparte';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Faixa } from '@/componentes/padroes/faixa';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Titulo } from '@/dados/tipos/titulo';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { lerCambio, lerValor, valorParaCampo } from '@/dominio/dinheiro';
import type { DadosDosLancamentos } from '@/dominio/lancamentos';
import { assinaturaSugerida, categoriaDoFornecedor, competenciaDoDia, conferirDespesa, criarDespesa, criarEsquemaDespesa, descricoesAnteriores, formularioDespesaVazio, mesDaCompetencia, rateioEmPartesIguais, ROTULOS_TRATAMENTO, valorEmReais, type FormularioDespesa as Formulario } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { cn } from '@/lib/utils';

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];
const ID_DO_CAMPO: Partial<Record<keyof Formulario, string>> = {
  descricao: 'despesa-descricao',
  valor: 'despesa-valor',
  vencimento: 'despesa-vencimento',
  competencia: 'despesa-competencia',
  categoria_id: 'despesa-categoria',
  contextos: 'despesa-contextos',
  percentuais: 'despesa-rateio',
  data_pagamento: 'despesa-data-pagamento',
  conta_id: 'despesa-conta',
  cambio: 'despesa-cambio',
  iof: 'despesa-iof',
  valor_brl: 'despesa-valor-brl',
  tratamento: 'despesa-tratamento',
  vencimento_reembolso: 'despesa-vencimento-reembolso',
  comprovante_url: 'despesa-comprovante',
  sem_comprovante_motivo: 'despesa-sem-comprovante-motivo',
};
const CAMPOS_COM_ERRO = Object.keys(ID_DO_CAMPO) as (keyof Formulario)[];

type FormularioDeDespesaProps = {
  aberto: boolean;
  aoFechar: () => void;
  dados: DadosDosLancamentos;
  aoCriar?: (titulo: Titulo) => void;
  /** "Duplicar" (T05.03): já começa com os dados de outro título. */
  valoresIniciais?: Formulario;
};

/** T05.02: rápida, em menos de um minuto. "Já foi pago?" abre a parte do pagamento. */
export function FormularioDeDespesa({ aberto, aoFechar, dados, aoCriar, valoresIniciais }: FormularioDeDespesaProps) {
  const { pessoa, contexto } = useCentral();
  const hoje = hojeISO();
  const inicial = useMemo(() => valoresIniciais ?? formularioDespesaVazio(contexto.id, 'BRL', hoje), [valoresIniciais, contexto.id, hoje]);
  const contasAtivas = useMemo(() => dados.contas.filter((conta) => !conta.arquivado_em && conta.situacao === 'ativa'), [dados.contas]);
  const resolvedor = useMemo(() => zodResolver(criarEsquemaDespesa(contasAtivas, hoje)), [contasAtivas, hoje]);
  const { register, handleSubmit, control, reset, watch, setValue, getValues, trigger, setFocus, formState } = useForm<Formulario>({ resolver: resolvedor, defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [avisos, setAvisos] = useState<{ formulario: Formulario; textos: readonly string[] } | null>(null);
  const [cadastrando, setCadastrando] = useState<string | null>(null);
  const lancarOutra = useRef(false);

  const contextosAplicados = useRef(inicial.contextos.join('|'));
  useEffect(() => {
    if (!aberto) return;
    // O rateio de quem veio duplicado fica como está, sem voltar para partes iguais.
    contextosAplicados.current = inicial.contextos.join('|');
    reset(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `inicial` vale no momento de abrir
  }, [aberto, reset]);

  const valores = watch();
  const pago = valores.pago;
  const estrangeira = valores.moeda !== 'BRL';
  const conta = contasAtivas.find((item) => item.id === valores.conta_id);
  const deSocia = conta?.tipo === 'pessoal_socia';
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo');
  const categorias = dados.categorias.filter((categoria) => !categoria.arquivado_em && categoria.situacao === 'ativa' && categoria.tipo === 'despesa' && categoria.pai_id);
  const grupos = dados.categorias.filter((categoria) => !categoria.pai_id && categoria.tipo === 'despesa' && !categoria.arquivado_em);
  const ferramentas = dados.ferramentas.filter((ferramenta) => !ferramenta.arquivado_em && ferramenta.situacao !== 'cancelada');
  const sugestoes = useMemo(() => descricoesAnteriores(dados.titulos), [dados.titulos]);
  const sugerida = valores.assinatura_id ? null : assinaturaSugerida(valores.contraparte_id, valores.categoria_id, dados.ferramentas, dados.assinaturas);

  // Depois de tentar salvar, um campo pode resolver o erro de outro.
  const camposLigados = `${pago}|${valores.moeda}|${valores.conta_id}|${valores.tratamento}|${valores.sem_comprovante}|${valores.contextos.length}`;
  const ligadosConferidos = useRef(camposLigados);
  useEffect(() => {
    if (ligadosConferidos.current === camposLigados) return;
    ligadosConferidos.current = camposLigados;
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  // Rateio: mudou quem participa, volta para partes iguais (editável).
  const contextosComoTexto = valores.contextos.join('|');
  useEffect(() => {
    if (contextosAplicados.current === contextosComoTexto) return;
    contextosAplicados.current = contextosComoTexto;
    setValue('percentuais', Object.fromEntries(rateioEmPartesIguais(contextosComoTexto ? contextosComoTexto.split('|') : []).map(({ contexto: id, percentual }) => [id, percentual])), { shouldDirty: true });
  }, [contextosComoTexto, setValue]);

  // Câmbio e IOF: o valor em reais é calculado, e continua editável para casar com a fatura (RN-05.05).
  const baseDoCalculo = `${valores.valor}|${valores.cambio}|${valores.iof}`;
  const calculoAplicado = useRef(baseDoCalculo);
  useEffect(() => {
    if (calculoAplicado.current === baseDoCalculo) return;
    calculoAplicado.current = baseDoCalculo;
    const valor = lerValor(valores.valor);
    const cambio = lerCambio(valores.cambio);
    if (estrangeira && valor !== null && cambio !== null && cambio > 0) setValue('valor_brl', valorParaCampo(valorEmReais(valor, cambio, lerValor(valores.iof))), { shouldDirty: true, shouldValidate: formState.isSubmitted });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o cálculo só depende destes três campos
  }, [baseDoCalculo]);

  function sugerirCategoria(contraparteId: string) {
    if (getValues('categoria_id')) return;
    const anterior = categoriaDoFornecedor(contraparteId, dados.titulos);
    const assinatura = assinaturaSugerida(contraparteId, '', dados.ferramentas, dados.assinaturas)?.assinatura.categoria_financeira_id;
    const sugestao = anterior ?? assinatura;
    if (sugestao && categorias.some((categoria) => categoria.id === sugestao)) setValue('categoria_id', sugestao, { shouldDirty: true });
  }

  // Competência: o mês do vencimento, ou do pagamento, até alguém mudar.
  function acompanharCompetencia(dia: string) {
    if (dia && !formState.dirtyFields.competencia) setValue('competencia', mesDaCompetencia(competenciaDoDia(dia)));
  }

  const erroDaDescricao = valores.descricao || formState.isSubmitted ? errors.descricao?.message : undefined;
  const erros: ErroDeCampo[] = CAMPOS_COM_ERRO.flatMap((campo) => {
    const erro = errors[campo] as { message?: string } | undefined;
    const mensagem = campo === 'descricao' ? erroDaDescricao : erro?.message;
    const campoId = ID_DO_CAMPO[campo];
    return typeof mensagem === 'string' && campoId ? [{ campoId, mensagem }] : [];
  });

  async function gravar(formulario: Formulario) {
    try {
      const titulo = await criarDespesa(formulario, pessoa.id, hoje);
      if (lancarOutra.current) {
        lancarOutra.current = false;
        aviso('Despesa lançada.');
        reset(inicial);
        window.setTimeout(() => setFocus('descricao'), 60);
        return;
      }
      if (aoCriar) aoCriar(titulo);
      else aviso('Despesa lançada.');
      aoFechar();
    } catch (erro) {
      lancarOutra.current = false;
      aviso(mensagemDoErro(erro));
    }
  }

  const enviar = handleSubmit(
    async (formulario) => {
      const { avisos: textos } = conferirDespesa(formulario, dados.titulos);
      if (textos.length) {
        setAvisos({ formulario, textos });
        return;
      }
      await gravar(formulario);
    },
    () => {
      lancarOutra.current = false;
    },
  );

  return (
    <>
      <PainelFormulario
        aberto={aberto}
        aoFechar={aoFechar}
        titulo="Nova despesa"
        alterado={isDirty}
        aoEnviar={enviar}
        rotuloSalvar="Salvar"
        aoSalvarEOutro={() => {
          lancarOutra.current = true;
          void enviar();
        }}
        rotuloSalvarEOutro="Salvar e lançar outra"
        salvando={isSubmitting}
        erros={erros}
      >
        <div className="grid gap-[18px]">
          <Campo id={ID_DO_CAMPO.descricao} rotulo="Descrição" obrigatorio erro={erroDaDescricao}>
            {(controle) => <Input autoComplete="off" list="despesa-sugestoes" {...controle} {...register('descricao')} />}
          </Campo>
          <datalist id="despesa-sugestoes">
            {sugestoes.map((sugestao) => (
              <option key={sugestao} value={sugestao} />
            ))}
          </datalist>
          <Controller
            control={control}
            name="contraparte_id"
            render={({ field }) => (
              <Campo id="despesa-fornecedor" rotulo="Fornecedor">
                {(controle) => (
                  <SeletorContraparte
                    {...controle}
                    valor={field.value}
                    aoMudar={(id) => {
                      field.onChange(id);
                      if (id) sugerirCategoria(id);
                    }}
                    contrapartes={dados.contrapartes}
                    papel="fornecedor"
                    aoCriar={setCadastrando}
                  />
                )}
              </Campo>
            )}
          />
          {sugerida && (
            <Faixa tipo="info">
              <span className="block">Parece ser da assinatura de {sugerida.ferramenta.nome}.</span>
              <Button
                variante="secundario"
                tamanho="pequeno"
                className="mt-2"
                onClick={() => {
                  setValue('ferramenta_id', sugerida.ferramenta.id, { shouldDirty: true });
                  setValue('assinatura_id', (sugerida.assinatura as { id: string }).id, { shouldDirty: true });
                  const categoria = sugerida.assinatura.categoria_financeira_id;
                  if (categoria && !getValues('categoria_id')) setValue('categoria_id', categoria, { shouldDirty: true });
                }}
              >
                Vincular à assinatura
              </Button>
            </Faixa>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Campo id={ID_DO_CAMPO.valor} rotulo="Valor" obrigatorio erro={errors.valor?.message}>
              {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor')} />}
            </Campo>
            <Controller control={control} name="moeda" render={({ field }) => <Campo id="despesa-moeda" rotulo="Moeda">{(controle) => <SelecaoMoeda {...controle} {...field} />}</Campo>} />
          </div>
          <Controller
            control={control}
            name="pago"
            render={({ field }) => (
              <Pilulas
                rotulo="Já foi pago?"
                obrigatorio
                valor={field.value ? 'sim' : 'nao'}
                aoMudar={(valor) => field.onChange(valor === 'sim')}
                opcoes={SIM_NAO}
              />
            )}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Campo id={ID_DO_CAMPO.vencimento} rotulo="Vencimento" obrigatorio={!pago} erro={errors.vencimento?.message} ajuda={pago ? 'Vazio: a data do pagamento.' : undefined}>
              {(controle) => <EntradaData {...controle} {...register('vencimento', { onChange: (evento) => acompanharCompetencia(evento.target.value) })} />}
            </Campo>
            <Campo id={ID_DO_CAMPO.competencia} rotulo="Competência" obrigatorio erro={errors.competencia?.message}>
              {(controle) => <Input type="month" {...controle} {...register('competencia')} />}
            </Campo>
          </div>
          <Controller
            control={control}
            name="categoria_id"
            render={({ field }) => (
              <Campo id={ID_DO_CAMPO.categoria_id} rotulo="Categoria" obrigatorio erro={errors.categoria_id?.message}>
                {(controle) => (
                  <Selecao {...controle} {...field}>
                    <option value="">Escolha uma categoria</option>
                    {grupos.map((grupo) => (
                      <optgroup key={grupo.id} label={grupo.nome}>
                        {categorias
                          .filter((categoria) => categoria.pai_id === grupo.id)
                          .map((categoria) => (
                            <option key={categoria.id} value={categoria.id}>
                              {categoria.nome}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />
          <div id={ID_DO_CAMPO.contextos} tabIndex={-1}>
            <Controller control={control} name="contextos" render={({ field }) => <PilulasMultiplas rotulo="Contexto" obrigatorio valores={field.value} aoMudar={field.onChange} opcoes={[{ valor: ID_INSTITUCIONAL, rotulo: 'Numa' }, ...produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome }))]} />} />
            {errors.contextos?.message && <MensagemErro>{errors.contextos.message}</MensagemErro>}
          </div>
          {valores.contextos.length > 1 && (
            <div id={ID_DO_CAMPO.percentuais} tabIndex={-1} className="grid gap-2 rounded-md border border-line bg-paper p-3">
              <p className="text-[13px] font-semibold">Rateio</p>
              {valores.contextos.map((id) => {
                const nome = id === ID_INSTITUCIONAL ? 'Numa' : (produtos.find((produto) => produto.id === id)?.nome ?? 'Produto');
                return (
                  <label key={id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 break-words">{nome}</span>
                    <span className="flex items-center gap-1.5">
                      <Input aria-label={`Percentual de ${nome}`} inputMode="decimal" autoComplete="off" className="w-24 text-right" value={valores.percentuais[id] ?? ''} onChange={(evento) => setValue('percentuais', { ...getValues('percentuais'), [id]: evento.target.value }, { shouldDirty: true, shouldValidate: formState.isSubmitted })} />
                      %
                    </span>
                  </label>
                );
              })}
              {(errors.percentuais as { message?: string } | undefined)?.message && <MensagemErro>{(errors.percentuais as { message?: string }).message as string}</MensagemErro>}
            </div>
          )}
          <Controller
            control={control}
            name="ferramenta_id"
            render={({ field }) => (
              <Campo id="despesa-ferramenta" rotulo="Ferramenta vinculada">
                {(controle) => (
                  <Selecao
                    {...controle}
                    {...field}
                    onChange={(evento) => {
                      field.onChange(evento.target.value);
                      setValue('assinatura_id', dados.assinaturas.find((assinatura) => assinatura.ferramenta_id === evento.target.value)?.id ?? '', { shouldDirty: true });
                    }}
                  >
                    <option value="">Nenhuma</option>
                    {ferramentas.map((ferramenta) => (
                      <option key={ferramenta.id} value={ferramenta.id}>
                        {ferramenta.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            )}
          />

          {pago && (
            <section aria-label="Pagamento" className={cn('grid gap-[18px] border-t border-line pt-[18px]')}>
              <h3 className="text-[15px]">Pagamento</h3>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <Campo id={ID_DO_CAMPO.data_pagamento} rotulo="Data do pagamento" obrigatorio erro={errors.data_pagamento?.message}>
                  {(controle) => <EntradaData max={hoje} {...controle} {...register('data_pagamento', { onChange: (evento) => !getValues('vencimento') && acompanharCompetencia(evento.target.value) })} />}
                </Campo>
                <Controller
                  control={control}
                  name="conta_id"
                  render={({ field }) => (
                    <Campo id={ID_DO_CAMPO.conta_id} rotulo="Conta usada" obrigatorio erro={errors.conta_id?.message}>
                      {(controle) => (
                        <Selecao {...controle} {...field}>
                          <option value="">Escolha</option>
                          {contasAtivas.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nome}
                            </option>
                          ))}
                        </Selecao>
                      )}
                    </Campo>
                  )}
                />
              </div>
              {estrangeira && (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                    <Campo id={ID_DO_CAMPO.cambio} rotulo="Câmbio" obrigatorio erro={errors.cambio?.message}>
                      {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('cambio')} />}
                    </Campo>
                    <Campo id={ID_DO_CAMPO.iof} rotulo="IOF em reais" erro={errors.iof?.message}>
                      {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('iof')} />}
                    </Campo>
                  </div>
                  <Campo id={ID_DO_CAMPO.valor_brl} rotulo="Valor efetivo em reais" obrigatorio erro={errors.valor_brl?.message} ajuda="Calculado. Pode ajustar para casar com a fatura.">
                    {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor_brl')} />}
                  </Campo>
                </>
              )}
              {deSocia && (
                <div id={ID_DO_CAMPO.tratamento} tabIndex={-1} className="grid gap-[18px]">
                  <div>
                    <Controller control={control} name="tratamento" render={({ field }) => <Pilulas rotulo="Conta de sócia: como tratar?" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={Object.entries(ROTULOS_TRATAMENTO).map(([valor, rotulo]) => ({ valor, rotulo }))} />} />
                    {errors.tratamento?.message && <MensagemErro>{errors.tratamento.message}</MensagemErro>}
                    <p className="mt-1.5 text-xs text-ink-soft">{valores.tratamento === 'reembolso' ? 'A Numa fica devendo esse valor à sócia.' : valores.tratamento === 'aporte' ? 'O valor conta como investimento da sócia na Numa.' : 'Aporte: investimento da sócia. Reembolso: a Numa devolve depois.'}</p>
                  </div>
                  {valores.tratamento === 'reembolso' && (
                    <Campo id={ID_DO_CAMPO.vencimento_reembolso} rotulo="Vencimento do reembolso" obrigatorio erro={errors.vencimento_reembolso?.message}>
                      {(controle) => <EntradaData {...controle} {...register('vencimento_reembolso')} />}
                    </Campo>
                  )}
                </div>
              )}
              {!valores.sem_comprovante && (
                <Controller
                  control={control}
                  name="comprovante_url"
                  render={({ field }) => (
                    <Campo id={ID_DO_CAMPO.comprovante_url} rotulo="Comprovante" obrigatorio erro={errors.comprovante_url?.message}>
                      {(controle) => <EntradaLinkDrive link={field.value} {...controle} {...field} />}
                    </Campo>
                  )}
                />
              )}
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] md:min-h-0">
                <input type="checkbox" className="size-[18px] accent-[var(--ok)]" {...register('sem_comprovante')} />
                Não tenho comprovante
              </label>
              {valores.sem_comprovante && (
                <Campo id={ID_DO_CAMPO.sem_comprovante_motivo} rotulo="Por que não tem?" obrigatorio erro={errors.sem_comprovante_motivo?.message}>
                  {(controle) => <Input autoComplete="off" {...controle} {...register('sem_comprovante_motivo')} />}
                </Campo>
              )}
            </section>
          )}
          <Campo id="despesa-observacao" rotulo="Observação">
            {(controle) => <Textarea {...controle} {...register('observacao')} />}
          </Campo>
        </div>
      </PainelFormulario>
      <Confirmacao
        aberto={avisos !== null}
        aoFechar={() => {
          lancarOutra.current = false;
          setAvisos(null);
        }}
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
      <FormularioContraparte
        aberto={cadastrando !== null}
        aoFechar={() => setCadastrando(null)}
        pessoas={dados.pessoas}
        nomeInicial={cadastrando ?? ''}
        papeisIniciais={['fornecedor']}
        aoCadastrar={(contraparte) => {
          setValue('contraparte_id', contraparte.id, { shouldDirty: true });
          aviso('Contraparte cadastrada.');
        }}
      />
    </>
  );
}
