'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { FormularioContraparte } from '@/app/(central)/configuracoes/cadastros/contrapartes/formulario-contraparte';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { SeletorContraparte } from '@/componentes/campos/seletor-contraparte';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Previa } from '@/componentes/padroes/previa';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { AssinaturaFerramenta, Ferramenta, FerramentaContexto } from '@/dados/tipos/ferramenta';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { lerValor } from '@/dominio/dinheiro';
import { CAMPOS_DA_ETAPA, conferirFerramenta, criarFerramenta, esquemaFormularioFerramenta, ETAPAS_DA_FERRAMENTA, formularioDaFerramenta, formularioFerramentaVazio, responsaveisPadrao, ROTULOS_MFA, ROTULOS_MODALIDADE, ROTULOS_PERIODICIDADE, ROTULOS_RENOVACAO, ROTULOS_TITULAR, salvarFerramenta, situacaoParaModalidade, valorMudou, type DadosDasFerramentas, type FormularioFerramenta as Formulario } from '@/dominio/ferramentas';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { titulosAfetadosPeloReajuste } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { useConsulta } from '@/dados/use-consulta';
import { carregarFinanceiroDaFerramenta, previaDasCobrancas, ROTULOS_ESTADO_COBRANCA, type CobrancaDaPrevia } from '@/dominio/ferramentas-ficha';
import { equivalenteMensalBrl, ultimoCambio } from '@/dominio/ferramentas';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
const SIM_NAO = [
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'sim', rotulo: 'Sim' },
];
const SITUACOES = [
  { valor: 'avaliacao', rotulo: 'Em avaliação' },
  { valor: 'teste', rotulo: 'Teste' },
  { valor: 'ativa', rotulo: 'Ativa' },
];
const ID_DO_CAMPO: Partial<Record<keyof Formulario, string>> = {
  nome: 'ferramenta-nome',
  categoria_id: 'ferramenta-categoria',
  fornecedor_id: 'ferramenta-fornecedor',
  finalidade: 'ferramenta-finalidade',
  contextos: 'ferramenta-contextos',
  situacao: 'ferramenta-situacao',
  url_acesso: 'ferramenta-url-acesso',
  url_admin: 'ferramenta-url-admin',
  titular_atual_pessoa_id: 'ferramenta-titular-pessoa',
  titular_atual_texto: 'ferramenta-titular-texto',
  titular_desejado: 'ferramenta-titular-desejado',
  responsavel_tecnico_id: 'ferramenta-tecnica',
  responsavel_financeiro_id: 'ferramenta-financeira',
  modalidade: 'ferramenta-modalidade',
  plano: 'ferramenta-plano',
  valor: 'ferramenta-valor',
  periodicidade: 'ferramenta-periodicidade',
  proxima_cobranca: 'ferramenta-proxima',
  renovacao: 'ferramenta-renovacao',
  conta_financeira_id: 'ferramenta-conta',
  categoria_financeira_id: 'ferramenta-categoria-financeira',
  aviso_cancelamento_dias: 'ferramenta-aviso',
  fim_teste: 'ferramenta-fim-teste',
  valor_apos_teste: 'ferramenta-valor-apos',
  licencas: 'ferramenta-licencas',
};
const CAMPOS_COM_ERRO = Object.keys(ID_DO_CAMPO) as (keyof Formulario)[];

const etapaDoCampo = (campo: keyof Formulario) => CAMPOS_DA_ETAPA.findIndex((campos) => campos.includes(campo));

type PreviaDosTitulos = { titulo: string; texto: string; colunas: readonly string[]; linhas: ReadonlyArray<readonly string[]>; rotulo: string };
type Fila = { formulario: Formulario; avisos: readonly string[]; motivo: string; previa: PreviaDosTitulos | null };

type FormularioDeFerramentaProps = {
  aberto: boolean;
  aoFechar: () => void;
  dados: DadosDasFerramentas;
  /** Sem ferramenta, é uma nova. */
  ferramenta?: Ferramenta | null;
  contextos?: readonly FerramentaContexto[];
  assinatura?: AssinaturaFerramenta | null;
  /** "Trocar plano" (T04.02): abre direto no custo, e a assinatura atual encerra ao salvar. */
  trocandoPlano?: boolean;
  aoCriar?: (ferramenta: Ferramenta) => void;
};

/** T04.03: três etapas curtas. Dá para salvar em qualquer uma: o que falta fica "a definir". */
export function FormularioDeFerramenta({ aberto, aoFechar, dados, ferramenta, contextos = [], assinatura = null, trocandoPlano = false, aoCriar }: FormularioDeFerramentaProps) {
  const { pessoa, contexto } = useCentral();
  const inicial = useMemo(() => {
    // O titular padrão é quem cadastra, se for sócia: é o caso mais comum enquanto não há PJ (RN-04.14).
    if (!ferramenta) return formularioFerramentaVazio(dados.pessoas.find((item) => item.id === pessoa.id)?.eh_socia ? pessoa.id : '', contexto.id, responsaveisPadrao(dados.areas, dados.pessoas));
    const salvo = formularioDaFerramenta(ferramenta, contextos, assinatura);
    return trocandoPlano ? { ...salvo, plano: '', valor: '', periodicidade: '', proxima_cobranca: '', renovacao: '', licencas: '', aviso_cancelamento_dias: '', modalidade: '' as const } : salvo;
  }, [ferramenta, contextos, assinatura, pessoa.id, contexto.id, dados.areas, dados.pessoas, trocandoPlano]);
  const { register, handleSubmit, control, reset, watch, setValue, getValues, setError, trigger, formState } = useForm<Formulario>({ resolver: zodResolver(esquemaFormularioFerramenta), defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const [etapa, setEtapa] = useState(0);
  const [fila, setFila] = useState<Fila | null>(null);
  const [passo, setPasso] = useState<'avisos' | 'motivo' | 'previa' | null>(null);
  const [cadastrando, setCadastrando] = useState<string | null>(null);
  const lancados = useConsulta(() => (ferramenta ? carregarFinanceiroDaFerramenta(ferramenta.id) : Promise.resolve(null)), [ferramenta?.id]);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (!aberto) return;
    reset(inicial);
    setEtapa(trocandoPlano ? 2 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `inicial` vale no momento de abrir
  }, [aberto, ferramenta?.id, trocandoPlano, reset]);

  const titular = watch('titular_atual_tipo');
  const modalidade = watch('modalidade');
  const nome = watch('nome') ?? '';
  const paga = modalidade === 'paga';
  const teste = modalidade === 'teste';
  const moeda = watch('moeda');
  const porUso = watch('periodicidade') === 'por_uso';
  const internas = pessoasDoSeletor(dados.pessoas);
  // Quem saiu não é oferecido para registros novos, mas continua aparecendo onde já estava escolhida.
  const comEscolhida = (lista: typeof internas, id: string) => (id && !lista.some((item) => item.id === id) ? [...lista, ...dados.pessoas.filter((item) => item.id === id)] : lista);
  const socias = comEscolhida(internas.filter((item) => item.eh_socia), watch('titular_atual_pessoa_id'));
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo');
  const categoriasFinanceirasDisponiveis = dados.categoriasFinanceiras.filter((categoria) => categoria.tipo === 'despesa' && categoria.pai_id && categoria.situacao === 'ativa');
  // O histórico de valores guarda uma moeda só: trocar de moeda é trocar de plano.
  const moedaTravada = Boolean(ferramenta) && !trocandoPlano && assinatura?.modalidade === 'paga' && assinatura.valor !== null;
  const camposLigados = JSON.stringify(watch(['situacao', 'modalidade', 'titular_atual_tipo', 'gerar_titulos', 'proxima_cobranca', 'periodicidade']));

  // Depois de tentar salvar, um campo pode resolver o erro de outro: a modalidade e a situação, por exemplo.
  // Só quando um deles muda: reconferir logo depois de salvar apagaria o erro de nome repetido, que não está no esquema.
  const ligadosConferidos = useRef(camposLigados);
  useEffect(() => {
    if (ligadosConferidos.current === camposLigados) return;
    ligadosConferidos.current = camposLigados;
    if (formState.isSubmitted) void trigger();
  }, [camposLigados, formState.isSubmitted, trigger]);

  // O nome abre com o foco: em branco, só acusa ao salvar (como no Adicionar).
  const erroDoNome = nome || formState.isSubmitted ? errors.nome?.message : undefined;
  const erros: ErroDeCampo[] = CAMPOS_COM_ERRO.flatMap((campo) => {
    const mensagem = campo === 'nome' ? erroDoNome : errors[campo]?.message;
    const campoId = ID_DO_CAMPO[campo];
    return typeof mensagem === 'string' && campoId ? [{ campoId, mensagem }] : [];
  }).filter(({ campoId }) => {
    const campo = CAMPOS_COM_ERRO.find((item) => ID_DO_CAMPO[item] === campoId);
    return campo ? etapaDoCampo(campo) === etapa : true;
  });

  function sugerirPelaCategoria(categoriaId: string) {
    const categoria = dados.categorias.find((item) => item.id === categoriaId);
    if (!categoria) return;
    if (!ferramenta) setValue('critica', categoria.critica_sugerida, { shouldDirty: true });
    // Só sugere o que ainda pode ser escolhido, e não passa por cima do que já foi escolhido.
    const sugerida = categoria.categoria_financeira_id;
    if (sugerida && !getValues('categoria_financeira_id') && categoriasFinanceirasDisponiveis.some((item) => item.id === sugerida)) setValue('categoria_financeira_id', sugerida, { shouldDirty: true });
  }

  async function gravar({ formulario, motivo }: Pick<Fila, 'formulario' | 'motivo'>) {
    try {
      if (ferramenta) {
        await salvarFerramenta(ferramenta.id, formulario, { motivoDoValor: motivo, trocarPlano: trocandoPlano });
        aviso(trocandoPlano ? 'Plano trocado.' : 'Ferramenta atualizada.');
      } else {
        const criada = await criarFerramenta(formulario);
        if (aoCriar) aoCriar(criada);
        else aviso('Ferramenta criada.');
      }
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  /** Avisos, motivo do novo valor e prévia dos títulos, um de cada vez, e só então grava. */
  function seguir(atual: Fila, depoisDe: 'avisos' | 'motivo' | 'previa' | null) {
    if (depoisDe === null && atual.avisos.length) return setPasso('avisos');
    if ((depoisDe === null || depoisDe === 'avisos') && valorMudou(atual.formulario, trocandoPlano ? null : assinatura)) return setPasso('motivo');
    if (depoisDe !== 'previa' && atual.previa) return setPasso('previa');
    setPasso(null);
    setFila(null);
    void gravar(atual);
  }

  const enviar = handleSubmit(
    async (formulario) => {
      if (trocandoPlano && !formulario.modalidade) {
        setError('modalidade', { message: 'Escolha a modalidade do novo plano.' });
        return;
      }
      const { nomeRepetido, avisos } = conferirFerramenta(formulario, dados.ferramentas, ferramenta?.id);
      if (nomeRepetido) {
        setEtapa(0);
        setError('nome', { message: 'Já existe uma ferramenta ativa com esse nome.' });
        return;
      }
      // P6: o que muda nos títulos. Reajuste só mexe nos futuros sem pagamento (RN-04.17); gerar de novo não duplica (RN-04.03).
      const valor = lerValor(formulario.valor);
      let previa: PreviaDosTitulos | null = null;
      if (assinatura && !trocandoPlano && valor !== null && valorMudou(formulario, assinatura)) {
        const titulos = await titulosAfetadosPeloReajuste(assinatura.id);
        if (titulos.length) previa = { titulo: 'Títulos que mudam de valor', texto: 'Só os títulos futuros e sem pagamento mudam. Os já pagos e os ajustados à mão continuam como estão.', colunas: ['Vencimento', 'De', 'Para'], linhas: titulos.map((titulo) => [formatarDiaISO(titulo.vencimento), formatarDinheiro(titulo.valor, titulo.moeda), formatarDinheiro(valor, titulo.moeda)]), rotulo: 'Salvar' };
      } else if (formulario.modalidade === 'paga' && valor !== null && (trocandoPlano || !assinatura?.gerar_titulos)) {
        const cobrancas = previaDoFormulario(formulario, trocandoPlano ? null : (assinatura?.id ?? null));
        if (cobrancas.length) previa = { titulo: 'Confira as cobranças antes de salvar', texto: 'Um lançamento a pagar para cada cobrança prevista, sem pagamento registrado. O que já está no Financeiro é vinculado, e não criado de novo. Esta prévia não contrata nada no fornecedor.', colunas: ['Vencimento', 'Valor', 'Ao salvar'], linhas: cobrancas.map((item) => [formatarDiaISO(item.dia), formatarDinheiro(valor, formulario.moeda), ROTULOS_ESTADO_COBRANCA[item.estado]]), rotulo: ferramenta ? 'Confirmar e salvar' : 'Confirmar cadastro e cobranças' };
      }
      const proxima: Fila = { formulario, avisos, motivo: '', previa };
      setFila(proxima);
      seguir(proxima, null);
    },
    (falhas) => {
      const primeiro = (Object.keys(falhas) as (keyof Formulario)[]).map(etapaDoCampo).filter((indice) => indice >= 0);
      if (primeiro.length) setEtapa(Math.min(...primeiro));
    },
  );

  /** RN-04.03: mensal até 3 meses, as demais só a próxima, contra o que já foi lançado. */
  function previaDoFormulario(valores: Formulario, assinaturaId: string | null): CobrancaDaPrevia[] {
    return previaDasCobrancas({ modalidade: valores.modalidade === 'paga' ? 'paga' : 'gratuita', valor: lerValor(valores.valor), moeda: valores.moeda, periodicidade: (valores.periodicidade || null) as AssinaturaFerramenta['periodicidade'], proxima_cobranca: valores.proxima_cobranca || null, gerar_titulos: valores.gerar_titulos }, assinaturaId ? (lancados.dados?.titulos ?? []) : [], assinaturaId, hojeISO());
  }

  async function proximaEtapa() {
    if (await trigger([...CAMPOS_DA_ETAPA[etapa]!])) setEtapa((atual) => Math.min(atual + 1, ETAPAS_DA_FERRAMENTA.length - 1));
  }

  const titulo = trocandoPlano ? 'Trocar plano' : ferramenta ? 'Editar ferramenta' : 'Nova ferramenta';

  return (
    <>
      <JanelaFormulario colunas={2} aberto={aberto} aoFechar={aoFechar} titulo={titulo} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={ferramenta ? 'Salvar' : 'Salvar ferramenta'} {...(etapa < ETAPAS_DA_FERRAMENTA.length - 1 && !trocandoPlano ? { aoSalvarEOutro: () => void proximaEtapa(), rotuloSalvarEOutro: 'Continuar' } : {})} salvando={isSubmitting} erros={erros}>
        {!trocandoPlano && <p className="mb-2 text-xs font-semibold text-ink-soft" aria-live="polite">Etapa {etapa + 1} de {ETAPAS_DA_FERRAMENTA.length} · dá para salvar em qualquer uma</p>}
        {!trocandoPlano && (
          <ol className="mb-5 grid grid-cols-3 gap-1.5" aria-label="Etapas">
            {ETAPAS_DA_FERRAMENTA.map((nomeDaEtapa, indice) => (
              <li key={nomeDaEtapa}>
                <button type="button" aria-current={indice === etapa ? 'step' : undefined} onClick={() => setEtapa(indice)} className={cn('flex min-h-11 w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs font-semibold md:px-2.5', indice === etapa ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper text-ink-soft hover:border-ink-soft')}>
                  <span className="tabular-nums">{indice + 1}</span>
                  <span className="min-w-0 break-words">{nomeDaEtapa}</span>
                </button>
              </li>
            ))}
          </ol>
        )}

        {etapa === 0 && (
          <div className="grid gap-[18px]">
            <Campo id={ID_DO_CAMPO.nome} rotulo="Nome" obrigatorio erro={erroDoNome}>
              {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
            </Campo>
            <Controller
              control={control}
              name="categoria_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.categoria_id} rotulo="Categoria" obrigatorio erro={errors.categoria_id?.message}>
                  {(controle) => (
                    <Selecao
                      {...controle}
                      {...field}
                      onChange={(evento) => {
                        field.onChange(evento.target.value);
                        sugerirPelaCategoria(evento.target.value);
                      }}
                    >
                      <option value="">Escolha uma categoria</option>
                      {dados.categorias.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
            <Controller
              control={control}
              name="fornecedor_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.fornecedor_id} rotulo="Fornecedor">
                  {(controle) => <SeletorContraparte {...controle} valor={field.value} aoMudar={field.onChange} contrapartes={dados.contrapartes} papel="fornecedor" aoCriar={setCadastrando} />}
                </Campo>
              )}
            />
            <Campo id={ID_DO_CAMPO.finalidade} rotulo="Finalidade" obrigatorio erro={errors.finalidade?.message} ajuda="Para que usamos.">
              {(controle) => <Input autoComplete="off" {...controle} {...register('finalidade')} />}
            </Campo>
            <div id={ID_DO_CAMPO.contextos} tabIndex={-1}>
              <Controller control={control} name="contextos" render={({ field }) => <PilulasMultiplas rotulo="Contexto" obrigatorio valores={field.value} aoMudar={field.onChange} opcoes={[{ valor: ID_INSTITUCIONAL, rotulo: 'Numa' }, ...produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome }))]} />} />
              {errors.contextos?.message && <p className="mt-1.5 text-xs font-medium text-err">{errors.contextos.message}</p>}
            </div>
            <Controller control={control} name="critica" render={({ field }) => <Pilulas rotulo="Crítica" obrigatorio valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />} />
            <p className="-mt-3 text-xs text-ink-soft">Crítica é aquela cuja perda derruba um app ou impede a operação.</p>
            {ferramenta?.situacao === 'teste_expirado' ? (
              <p className="text-[13px] text-ink-soft">Situação: Teste expirado. Decida se assina ou cancela.</p>
            ) : (
              <div id={ID_DO_CAMPO.situacao} tabIndex={-1}>
                <Controller
                  control={control}
                  name="situacao"
                  render={({ field }) => (
                    <Pilulas
                      rotulo="Situação"
                      obrigatorio
                      valor={field.value}
                      aoMudar={(valor) => {
                        field.onChange(valor);
                        if (valor === 'teste') setValue('modalidade', 'teste', { shouldDirty: true });
                      }}
                      opcoes={SITUACOES}
                    />
                  )}
                />
                {errors.situacao?.message && <p className="mt-1.5 text-xs font-medium text-err">{errors.situacao.message}</p>}
              </div>
            )}
            <div className="grid gap-[18px] md:grid-cols-2 md:gap-3">
              <Campo id={ID_DO_CAMPO.url_acesso} rotulo="URL de acesso" erro={errors.url_acesso?.message}>
                {(controle) => <Input type="url" inputMode="url" autoComplete="off" {...controle} {...register('url_acesso')} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.url_admin} rotulo="URL de administração" erro={errors.url_admin?.message}>
                {(controle) => <Input type="url" inputMode="url" autoComplete="off" {...controle} {...register('url_admin')} />}
              </Campo>
            </div>
          </div>
        )}

        {etapa === 1 && (
          <div className="grid gap-[18px]">
            <Campo id="ferramenta-email-login" rotulo="E-mail ou usuário de login" ajuda="Opcional. Só a identificação da conta: senha, token e cartão nunca ficam aqui.">
              {(controle) => <Input autoComplete="off" {...controle} {...register('email_login_conta')} />}
            </Campo>
            <Campo id="ferramenta-ambiente" rotulo="Ambiente, organização ou workspace" ajuda="Opcional.">
              {(controle) => <Input autoComplete="off" {...controle} {...register('ambiente')} />}
            </Campo>
            <Controller control={control} name="titular_atual_tipo" render={({ field }) => <Pilulas rotulo="Titular atual" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_TITULAR)} />} />
            {titular === 'pessoa_fisica' && (
              <Controller
                control={control}
                name="titular_atual_pessoa_id"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.titular_atual_pessoa_id} rotulo="Sócia titular" obrigatorio erro={errors.titular_atual_pessoa_id?.message}>
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        <option value="">Escolha uma pessoa</option>
                        {socias.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nome_completo}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
            )}
            {titular === 'terceiro' && (
              <Campo id={ID_DO_CAMPO.titular_atual_texto} rotulo="Em nome de quem" obrigatorio erro={errors.titular_atual_texto?.message}>
                {(controle) => <Input autoComplete="off" {...controle} {...register('titular_atual_texto')} />}
              </Campo>
            )}
            <Campo id={ID_DO_CAMPO.titular_desejado} rotulo="Titular desejado" obrigatorio erro={errors.titular_desejado?.message} ajuda="Em nome de quem a conta deveria estar. O padrão é a Numa. Escolher o desejado não muda o titular atual: a transferência é feita no fornecedor e depende da entidade da Numa estar ativa.">
              {(controle) => <Input autoComplete="off" {...controle} {...register('titular_desejado')} />}
            </Campo>
            <Controller control={control} name="mfa_conta" render={({ field }) => <Pilulas rotulo="Autenticação em duas etapas" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_MFA)} />} />
            <Controller
              control={control}
              name="responsavel_tecnico_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.responsavel_tecnico_id} rotulo="Responsável técnica" obrigatorio erro={errors.responsavel_tecnico_id?.message}>
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      <option value="">Escolha uma pessoa</option>
                      {comEscolhida(internas, field.value).map((item) => (
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
              name="responsavel_financeiro_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.responsavel_financeiro_id} rotulo="Responsável financeira" obrigatorio={paga} ajuda={paga ? undefined : 'Obrigatória quando a ferramenta é paga.'} erro={errors.responsavel_financeiro_id?.message}>
                  {(controle) => (
                    <Selecao {...controle} {...field}>
                      <option value="">Nenhuma</option>
                      {comEscolhida(internas, field.value).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome_completo}
                        </option>
                      ))}
                    </Selecao>
                  )}
                </Campo>
              )}
            />
            <Campo id="ferramenta-recuperacao" rotulo="Caminho de recuperação" ajuda={watch('critica') ? 'Opcional, mas recomendado: a ferramenta é crítica. Como voltar a entrar se a responsável não estiver disponível. Sem senhas.' : 'Opcional. Como voltar a entrar, se a pessoa responsável não estiver disponível. Sem senhas.'}>
              {(controle) => <Textarea {...controle} {...register('caminho_recuperacao')} />}
            </Campo>
            <details className="group rounded-md border border-line px-3.5" open={Boolean(getValues('referencia_cofre'))}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-[13px] font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">Referência ao cofre (opcional)</summary>
              <div className="pb-3">
                <Campo id="ferramenta-cofre" rotulo="Referência ao cofre" ajuda="Só onde a senha está, nunca a senha. Ex.: Bitwarden › Numa › Hospedagem.">
                  {(controle) => <Input autoComplete="off" {...controle} {...register('referencia_cofre')} />}
                </Campo>
              </div>
            </details>
            <Campo id="ferramenta-observacoes" rotulo="Observações">
              {(controle) => <Textarea {...controle} {...register('observacoes')} />}
            </Campo>
          </div>
        )}

        {etapa === 2 && (
          <div className="grid gap-[18px]">
            <div id={ID_DO_CAMPO.modalidade} tabIndex={-1}>
              <Controller
                control={control}
                name="modalidade"
                render={({ field }) => (
                  <Pilulas
                    rotulo="Modalidade"
                    valor={field.value}
                    aoMudar={(valor) => {
                      field.onChange(valor);
                      setValue('situacao', situacaoParaModalidade(getValues('situacao'), valor as Formulario['modalidade']), { shouldDirty: true });
                    }}
                    opcoes={paraOpcoes(ROTULOS_MODALIDADE)}
                  />
                )}
              />
              {errors.modalidade?.message && <p className="mt-1.5 text-xs font-medium text-err">{errors.modalidade.message}</p>}
              {!modalidade && <p className="mt-1.5 text-xs text-ink-soft">Custo a definir: dá para salvar assim e escolher depois. A definir não é gratuita.</p>}
              {modalidade && !trocandoPlano && !assinatura && (
                <Button variante="terciario" tamanho="pequeno" className="mt-1" onClick={() => setValue('modalidade', '', { shouldDirty: true })}>
                  Definir custo depois
                </Button>
              )}
            </div>
            {modalidade === 'gratuita' && <p className="text-[13px] text-ink-soft">Gratuita não gera lançamento no Financeiro, nem de valor zero (RN-04.02).</p>}
            {(paga || teste) && (
              <Campo id={ID_DO_CAMPO.plano} rotulo="Plano" obrigatorio erro={errors.plano?.message}>
                {(controle) => <Input autoComplete="off" {...controle} {...register('plano')} />}
              </Campo>
            )}
            {paga && (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <Campo id={ID_DO_CAMPO.valor} rotulo="Valor" erro={errors.valor?.message} ajuda="Vazio fica a confirmar, nunca zero.">
                    {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor')} />}
                  </Campo>
                  <Controller control={control} name="moeda" render={({ field }) => <Campo id="ferramenta-moeda" rotulo="Moeda" ajuda={moedaTravada ? 'Para trocar, use Trocar plano.' : undefined}>{(controle) => <SelecaoMoeda {...controle} {...field} disabled={moedaTravada} />}</Campo>} />
                </div>
                {moeda !== 'BRL' && <p className="-mt-3 text-xs text-ink-soft">Fica na moeda original. O equivalente em reais é uma estimativa, pelo câmbio de referência de Configurações.</p>}
                <Controller
                  control={control}
                  name="periodicidade"
                  render={({ field }) => (
                    <Campo id={ID_DO_CAMPO.periodicidade} rotulo="Periodicidade" obrigatorio erro={errors.periodicidade?.message}>
                      {(controle) => (
                        <Selecao {...controle} {...field}>
                          <option value="">Escolha</option>
                          {(['mensal', 'trimestral', 'semestral', 'anual', 'por_uso'] as const).map((valor) => (
                            <option key={valor} value={valor}>
                              {ROTULOS_PERIODICIDADE[valor]}
                            </option>
                          ))}
                        </Selecao>
                      )}
                    </Campo>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Campo id={ID_DO_CAMPO.proxima_cobranca} rotulo="Próxima cobrança" obrigatorio={!porUso} erro={errors.proxima_cobranca?.message}>
                    {(controle) => <EntradaData {...controle} {...register('proxima_cobranca')} />}
                  </Campo>
                  <Campo id="ferramenta-contratacao" rotulo="Data da contratação">
                    {(controle) => <EntradaData {...controle} {...register('data_contratacao')} />}
                  </Campo>
                </div>
                <div id={ID_DO_CAMPO.renovacao} tabIndex={-1}>
                  <Controller control={control} name="renovacao" render={({ field }) => <Pilulas rotulo="Renovação" obrigatorio={!porUso} valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_RENOVACAO)} />} />
                  {errors.renovacao?.message && <p className="mt-1.5 text-xs font-medium text-err">{errors.renovacao.message}</p>}
                </div>
                <Campo id={ID_DO_CAMPO.aviso_cancelamento_dias} rotulo="Prazo para cancelar (dias antes da renovação)" erro={errors.aviso_cancelamento_dias?.message}>
                  {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('aviso_cancelamento_dias')} />}
                </Campo>
                <Controller
                  control={control}
                  name="conta_financeira_id"
                  render={({ field }) => (
                    <Campo id={ID_DO_CAMPO.conta_financeira_id} rotulo="Conta de pagamento" obrigatorio erro={errors.conta_financeira_id?.message} ajuda={dados.contas.some((conta) => conta.situacao === 'ativa') ? undefined : 'Nenhuma conta ativa ainda. Cadastre em Configurações › Contas financeiras, ou deixe o custo para depois.'}>
                      {(controle) => (
                        <Selecao {...controle} {...field}>
                          <option value="">Escolha uma conta</option>
                          {dados.contas
                            .filter((conta) => conta.situacao === 'ativa')
                            .map((conta) => (
                              <option key={conta.id} value={conta.id}>
                                {conta.nome}
                              </option>
                            ))}
                        </Selecao>
                      )}
                    </Campo>
                  )}
                />
                <Controller
                  control={control}
                  name="categoria_financeira_id"
                  render={({ field }) => (
                    <Campo id={ID_DO_CAMPO.categoria_financeira_id} rotulo="Categoria financeira" obrigatorio erro={errors.categoria_financeira_id?.message} ajuda="Vem sugerida pela categoria da ferramenta.">
                      {(controle) => (
                        <Selecao {...controle} {...field}>
                          <option value="">Escolha uma categoria</option>
                          {categoriasFinanceirasDisponiveis.map((categoria) => (
                            <option key={categoria.id} value={categoria.id}>
                              {categoria.nome}
                            </option>
                          ))}
                        </Selecao>
                      )}
                    </Campo>
                  )}
                />
                <Controller control={control} name="gerar_titulos" render={({ field }) => <Pilulas rotulo="Gerar lançamentos a pagar automaticamente" valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />} />
              </>
            )}
            {teste && (
              <>
                <Campo id={ID_DO_CAMPO.fim_teste} rotulo="Fim do teste" obrigatorio erro={errors.fim_teste?.message}>
                  {(controle) => <EntradaData {...controle} {...register('fim_teste')} />}
                </Campo>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <Campo id={ID_DO_CAMPO.valor_apos_teste} rotulo="Valor após o teste" erro={errors.valor_apos_teste?.message}>
                    {(controle) => <Input inputMode="decimal" autoComplete="off" {...controle} {...register('valor_apos_teste')} />}
                  </Campo>
                  <Controller control={control} name="moeda" render={({ field }) => <Campo id="ferramenta-moeda-teste" rotulo="Moeda">{(controle) => <SelecaoMoeda {...controle} {...field} />}</Campo>} />
                </div>
              </>
            )}
            {paga && <PreviaAoVivo cobrancas={previaDoFormulario(watch(), trocandoPlano ? null : (assinatura?.id ?? null))} valores={watch()} dados={dados} />}
            {(paga || teste) && (
              <Campo id={ID_DO_CAMPO.licencas} rotulo="Licenças" erro={errors.licencas?.message}>
                {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} {...register('licencas')} />}
              </Campo>
            )}
          </div>
        )}
      </JanelaFormulario>

      <Confirmacao
        aberto={passo === 'avisos'}
        aoFechar={() => {
          setPasso(null);
          setFila(null);
        }}
        titulo="Salvar mesmo assim?"
        texto={fila?.avisos.join(' ')}
        rotuloConfirmar="Salvar mesmo assim"
        rotuloCancelar="Voltar e revisar"
        aoConfirmar={() => fila && seguir(fila, 'avisos')}
      />
      <Confirmacao
        aberto={passo === 'motivo'}
        aoFechar={() => {
          setPasso(null);
          setFila(null);
        }}
        titulo="Por que o valor mudou?"
        texto="O valor anterior e o motivo ficam no histórico de valores. Só os próximos títulos mudam."
        pedirMotivo
        mensagemSemMotivo="Informe o motivo da mudança de valor."
        rotuloConfirmar="Continuar"
        aoConfirmar={(motivo) => {
          if (!fila) return;
          const proxima = { ...fila, motivo };
          setFila(proxima);
          seguir(proxima, 'motivo');
        }}
      />
      <Previa
        aberto={passo === 'previa'}
        aoFechar={() => {
          setPasso(null);
          setFila(null);
        }}
        titulo={fila?.previa?.titulo ?? ''}
        texto={fila?.previa?.texto ?? ''}
        colunas={fila?.previa?.colunas ?? []}
        linhas={fila?.previa?.linhas ?? []}
        rotuloConfirmar={fila?.previa?.rotulo ?? 'Salvar'}
        aoConfirmar={() => fila && seguir(fila, 'previa')}
      />
      <FormularioContraparte
        aberto={cadastrando !== null}
        aoFechar={() => setCadastrando(null)}
        pessoas={dados.pessoas}
        nomeInicial={cadastrando ?? ''}
        papeisIniciais={['fornecedor']}
        aoCadastrar={(contraparte) => {
          setValue('fornecedor_id', contraparte.id, { shouldDirty: true });
          aviso('Contraparte cadastrada.');
        }}
      />
    </>
  );
}

/** Etapa 3, com Paga: as cobranças que serão lançadas e a referência mensal, enquanto a pessoa preenche. */
function PreviaAoVivo({ cobrancas, valores, dados }: { cobrancas: readonly CobrancaDaPrevia[]; valores: Formulario; dados: DadosDasFerramentas }) {
  const valor = lerValor(valores.valor);
  const periodicidade = (valores.periodicidade || null) as AssinaturaFerramenta['periodicidade'];
  const mensal = equivalenteMensalBrl({ modalidade: 'paga', valor, moeda: valores.moeda, periodicidade }, dados.cambios);
  const cambio = valores.moeda !== 'BRL' ? ultimoCambio(valores.moeda, dados.cambios) : null;
  let referencia = 'Sem estimativa mensal para esta periodicidade.';
  if (mensal !== null) referencia = `Referência: ${formatarDinheiro(mensal, 'BRL')} por mês, estimado${cambio !== null ? ` pelo câmbio de referência (1 ${valores.moeda} = ${formatarDinheiro(cambio, 'BRL')})` : ''}. Não é pagamento${periodicidade && periodicidade !== 'mensal' ? `, e a cobrança continua ${ROTULOS_PERIODICIDADE[periodicidade].toLowerCase()}` : ''}.`;
  else if (valor === null) referencia = 'Sem valor, sem estimativa: fica a confirmar.';
  else if (valores.moeda !== 'BRL') referencia = `Sem estimativa em reais: falta o câmbio de referência de ${valores.moeda} em Configurações.`;
  return (
    <section aria-label="Prévia de cobranças" className="grid gap-2.5 rounded-lg border border-line bg-mist p-3.5">
      <h3 className="text-[15px]">Prévia de cobranças</h3>
      {!valores.gerar_titulos ? (
        <p className="text-[13px] text-ink-soft">Geração desligada: nenhum lançamento será criado. A cobrança pode ser lançada à mão no Financeiro e vinculada depois.</p>
      ) : !cobrancas.length ? (
        <p className="text-[13px] text-ink-soft">{periodicidade === 'por_uso' ? 'Por uso não tem cobrança prevista.' : 'Informe a periodicidade e a próxima cobrança para ver as datas.'}</p>
      ) : (
        <>
          <p className="text-xs text-ink-soft">{periodicidade === 'mensal' ? 'Mensal: até 3 meses à frente.' : 'Só a próxima cobrança.'}</p>
          <ul className="grid gap-1.5">
            {cobrancas.map((item) => (
              <li key={item.dia} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-2 text-[13px]">
                <span className="font-medium tabular-nums">{formatarDiaISO(item.dia)}</span>
                <span className="tabular-nums">{item.valor === null ? 'A confirmar' : formatarDinheiro(item.valor, item.moeda)}</span>
                <EtiquetaSituacao tipo={item.estado === 'a_gerar' ? 'sucesso' : item.estado === 'ja_existe' ? 'neutro' : 'atencao'}>
                  {ROTULOS_ESTADO_COBRANCA[item.estado]}
                  {item.codigo ? ` · ${item.codigo}` : ''}
                </EtiquetaSituacao>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-[13px] leading-5">{referencia}</p>
    </section>
  );
}
