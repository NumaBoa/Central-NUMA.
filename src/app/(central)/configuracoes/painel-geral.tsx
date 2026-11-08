'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { Controller, useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Bell, Building2, CircleAlert, CreditCard, Database, Info, Layers, MapPin, Scale, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoErro } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { ResumoErros, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { SecaoLegalDaConfiguracao } from '@/componentes/f1/secao-legal-configuracao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Skeleton } from '@/componentes/ui/skeleton';
import { mensagemDoErro } from '@/dados/erros';
import { FUSOS, ROTULOS_FUSO } from '@/dados/fuso';
import { municipiosDaUf } from '@/dados/referencia/municipios';
import { useConsulta } from '@/dados/use-consulta';
import { carregarTelaGeral, esquemaFormularioGeral, formularioDosValores, lerConfiguracoes, pessoasParaBackup, responsavelDisponivel, salvarFormularioGeral, type DadosDaTelaGeral, type FormularioGeral } from '@/dominio/configuracoes';
import { INFO_FASES, rotuloDaFase } from '@/dominio/fases';
import { LEMBRETE_LINK_DRIVE } from '@/dominio/link-drive';
import { cn } from '@/lib/utils';
import { RegrasFinanceiras, SecaoCambio } from './secao-cambio';
import { SecaoFase } from './secao-fase';

type CampoDoFormulario = keyof FormularioGeral;
type IdDaSecao = 'organizacao' | 'fase' | 'alertas' | 'financeiro' | 'legal' | 'backup';
type SecaoGeral = {
  id: IdDaSecao;
  rotulo: string;
  icone: LucideIcon;
  iconeDoTitulo?: LucideIcon;
  descricao: string;
  /** O que vale para a seção inteira, ao lado das ações. */
  nota: string;
  /** Na ordem da tela: é a ordem do resumo de erros. Fase e câmbio gravam por conta própria, ao confirmar. */
  campos: readonly CampoDoFormulario[];
};

const OBRIGATORIOS = 'Campos com * são obrigatórios.';

const SECAO: Record<IdDaSecao, SecaoGeral> = {
  organizacao: {
    id: 'organizacao',
    rotulo: 'Organização e região',
    icone: MapPin,
    iconeDoTitulo: Building2,
    descricao: 'Defina os dados usados em toda a Central.',
    nota: OBRIGATORIOS,
    campos: ['organizacao_nome', 'organizacao_email', 'organizacao_logo_url', 'fuso', 'moeda_padrao', 'uf_padrao', 'municipio_padrao'],
  },
  fase: { id: 'fase', rotulo: 'Fase da Numa', icone: Layers, descricao: 'Um passo de cada vez, com espaço para crescer.', nota: 'A fase muda ao confirmar, sem usar “Salvar alterações”.', campos: [] },
  alertas: {
    id: 'alertas',
    rotulo: 'Alertas',
    icone: Bell,
    descricao: 'Com quantos dias de antecedência a Central avisa.',
    nota: OBRIGATORIOS,
    campos: ['alerta_vencimento_dias', 'alerta_renovacao_ferramenta_dias', 'alerta_fim_teste_dias', 'alerta_dominio_dias'],
  },
  financeiro: { id: 'financeiro', rotulo: 'Financeiro', icone: CreditCard, descricao: 'Combinados claros. Contas bem cuidadas.', nota: 'O câmbio é gravado ao adicionar ou remover, sem usar “Salvar alterações”.', campos: [] },
  legal: { id: 'legal', rotulo: 'Legal e comercial', icone: Scale, descricao: 'O que a publicação e as propostas precisam saber.', nota: 'Esta seção grava com o próprio botão, sem usar “Salvar alterações”.', campos: [] },
  backup: { id: 'backup', rotulo: 'Backup', icone: Database, descricao: 'Quem cuida da cópia semanal da Central.', nota: OBRIGATORIOS, campos: ['responsavel_backup_id'] },
};

const SECOES: readonly SecaoGeral[] = [SECAO.organizacao, SECAO.fase, SECAO.alertas, SECAO.financeiro, SECAO.legal, SECAO.backup];

const ID_DO_CAMPO: Record<CampoDoFormulario, string> = {
  organizacao_nome: 'nome',
  organizacao_email: 'email',
  organizacao_logo_url: 'logo',
  fuso: 'fuso',
  moeda_padrao: 'moeda',
  uf_padrao: 'uf',
  municipio_padrao: 'municipio',
  alerta_vencimento_dias: 'vencimentos',
  alerta_renovacao_ferramenta_dias: 'renovacao',
  alerta_fim_teste_dias: 'teste',
  alerta_dominio_dias: 'dominios',
  responsavel_backup_id: 'responsavel',
};

const CAMPOS = SECOES.flatMap((secao) => secao.campos);

const POR_EXTENSO = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' });

const GRADE_DA_TELA = 'mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[272px_minmax(0,1fr)]';

/** Com largura, o rótulo vai ao lado do campo, como no protótipo; sem ela, volta para cima (18 §9.2). */
const CAMPO_EM_LINHA = '@min-[620px]:grid @min-[620px]:grid-cols-[190px_minmax(0,1fr)] @min-[620px]:gap-x-4 @min-[620px]:[&>*:not(label)]:col-start-2 @min-[620px]:[&>label]:mb-0 @min-[620px]:[&>label]:pt-[11px]';

const TITULO_DO_GRUPO = 'mb-2.5 text-[15px] md:text-[17px]';

/** Sair de um campo inválido mostra o erro e empurra a barra de ações: sem isto, o clique cairia fora do botão. */
function manterFocoNoCampo(evento: MouseEvent) {
  evento.preventDefault();
}

function secaoDoCampo(campo: CampoDoFormulario): SecaoGeral {
  return SECOES.find((secao) => secao.campos.includes(campo)) ?? SECAO.organizacao;
}

/** Só roda no navegador: o conteúdo aparece depois de os dados serem lidos. */
function secaoDoEndereco(): IdDaSecao {
  const pedida = window.location.hash.slice(1);
  return SECOES.find((secao) => secao.id === pedida)?.id ?? 'organizacao';
}

/** Selo no cabeçalho: não aparece até a fase real ser lida, para nada piscar. */
export function SeloDaFase() {
  const { dados } = useConsulta(lerConfiguracoes);
  if (!dados) return null;
  const fase = dados.fase_ativa;
  return (
    <div className="inline-flex min-h-10 items-center gap-2 rounded-pill border border-line bg-paper px-3.5 text-[13px] font-medium whitespace-nowrap text-ink">
      <Layers className="size-4 shrink-0 text-ink-soft" aria-hidden />
      {rotuloDaFase(fase)} · {INFO_FASES[fase].nome}
    </div>
  );
}

function Esqueleto() {
  return (
    <div role="status" aria-label="Carregando" className={GRADE_DA_TELA}>
      <Skeleton className="h-[108px] lg:h-[520px]" />
      <Skeleton className="h-[520px]" />
    </div>
  );
}

/** T02.01: um só formulário, com uma seção à vista por vez. Protótipo: Imagens/M02/T02.01-organizacao-regiao-v1.png. */
export function PainelGeral() {
  const tela = useConsulta(carregarTelaGeral);
  if (tela.estado === 'carregando') return <Esqueleto />;
  if (tela.estado === 'erro') {
    return <EstadoErro className="mt-7 max-w-[880px]" titulo="Não deu para ler as configurações." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={tela.recarregar} />;
  }
  return <Conteudo dados={tela.dados} />;
}

function ItemDaNavegacao({ secao, erros, alterada, atencao, aoAbrir }: { secao: SecaoGeral; erros: number; alterada: boolean; atencao: boolean; aoAbrir: (id: IdDaSecao) => void }) {
  const { id, rotulo, icone: Icone } = secao;
  return (
    <TabsPrimitive.Trigger
      value={id}
      onMouseDown={(evento) => {
        // O Radix dá o foco por script, e o navegador desenha o contorno como se fosse do teclado: com o mouse, sem contorno.
        if (evento.button !== 0 || evento.ctrlKey) return;
        evento.preventDefault();
        aoAbrir(id);
        evento.currentTarget.focus({ focusVisible: false });
      }}
      className={cn(
        'relative flex min-h-11 flex-auto items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium whitespace-nowrap text-ink-soft transition-colors duration-150 hover:bg-hover hover:text-ink',
        'data-[state=active]:bg-indigo-wash data-[state=active]:font-semibold data-[state=active]:text-ink',
        'lg:w-full lg:flex-none lg:gap-2.5 lg:px-3 lg:whitespace-normal lg:data-[state=active]:before:absolute lg:data-[state=active]:before:inset-y-2 lg:data-[state=active]:before:left-0 lg:data-[state=active]:before:w-[3px] lg:data-[state=active]:before:rounded-full lg:data-[state=active]:before:bg-indigo-dk',
      )}
    >
      <Icone className="size-[18px] shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{rotulo}</span>
      {alterada && (
        <span title="Alterações não salvas" className="size-2 shrink-0 rounded-full bg-warn">
          <span className="sr-only">, alterações não salvas</span>
        </span>
      )}
      {atencao && (
        <span title="Precisa de atenção" className="shrink-0 text-warn">
          <TriangleAlert className="size-4" aria-hidden />
          <span className="sr-only">, precisa de atenção</span>
        </span>
      )}
      {erros > 0 && (
        <span title={erros === 1 ? '1 campo para ajustar' : `${erros} campos para ajustar`} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-err">
          <CircleAlert className="size-3.5" aria-hidden />
          {erros}
          <span className="sr-only">{erros === 1 ? ' campo para ajustar' : ' campos para ajustar'}</span>
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
}

/** Todas as seções ficam montadas: o que foi digitado, e os erros, não dependem de qual está à vista. */
function PainelDaSecao({ secao, children }: { secao: SecaoGeral; children: ReactNode }) {
  const Icone = secao.iconeDoTitulo ?? secao.icone;
  return (
    <TabsPrimitive.Content value={secao.id} forceMount tabIndex={undefined} className="data-[state=inactive]:hidden">
      <section id={secao.id}>
        <header className="mb-4 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-indigo-wash text-indigo-dk">
            <Icone className="size-[22px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2>{secao.rotulo}</h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">{secao.descricao}</p>
          </div>
        </header>
        {children}
      </section>
    </TabsPrimitive.Content>
  );
}

function CampoDias({ id, rotulo, texto, erro, registro }: { id: string; rotulo: string; texto: string; erro?: string; registro: UseFormRegisterReturn }) {
  const idErro = `${id}-erro`;
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line py-[17px] first:border-t-0 first:pt-0 last:pb-0 md:items-center md:gap-[18px] md:py-[15px]">
      <div className="min-w-0">
        <label htmlFor={id} className="block texto-rotulo">
          {rotulo} *
        </label>
        <p className="mt-0.5 text-xs text-ink-soft">{texto}</p>
        {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
      </div>
      <div className="relative w-[85px] shrink-0 md:w-[104px]">
        <Input id={id} inputMode="numeric" autoComplete="off" className="pr-[34px] pl-2 text-right tabular-nums md:pr-10 md:pl-3.5" aria-invalid={erro ? true : undefined} aria-describedby={erro ? idErro : undefined} {...registro} />
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-[9px] -translate-y-1/2 text-xs text-ink-soft md:right-3">
          dias
        </span>
      </div>
    </div>
  );
}

function Conteudo({ dados }: { dados: DadosDaTelaGeral }) {
  const { configuracoes, pessoas, cambios, mudancaDeFase, municipios } = dados;
  const valores = useMemo(() => formularioDosValores(configuracoes, pessoas), [configuracoes, pessoas]);
  const opcoesDePessoa = useMemo(() => pessoasParaBackup(pessoas), [pessoas]);

  const { register, handleSubmit, control, reset, watch, setValue, formState } = useForm<FormularioGeral>({
    resolver: zodResolver(esquemaFormularioGeral),
    // Se outra aba mudar uma configuração, ela aparece aqui, sem apagar o que está sendo digitado.
    values: valores,
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
    shouldFocusError: false,
  });
  const { errors, isDirty, dirtyFields, isSubmitting } = formState;
  useAlteracoesPendentes(isDirty);

  // Decisão de 07/11/2026: tudo o que já foi construído aparece, em qualquer fase. Legal e comercial (F1) inclusive.
  const secoes = SECOES;
  const [secaoAberta, setSecaoAberta] = useState<IdDaSecao>(secaoDoEndereco);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [focoPedido, setFocoPedido] = useState<{ campoId: string } | null>(null);
  const painel = useRef<HTMLFormElement>(null);

  // O "voltar" do navegador passa pelas seções vistas, sem sair da tela.
  useEffect(() => {
    const acompanhar = () => setSecaoAberta(secaoDoEndereco());
    window.addEventListener('hashchange', acompanhar);
    return () => window.removeEventListener('hashchange', acompanhar);
  }, []);

  // Quem desceu numa seção longa começa a próxima pelo começo.
  useEffect(() => {
    const topo = painel.current?.getBoundingClientRect().top ?? 0;
    if (topo < 72) painel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [secaoAberta]);

  // O foco só pode ir para o campo depois de a seção dele aparecer.
  useEffect(() => {
    if (!focoPedido) return;
    const campo = document.getElementById(focoPedido.campoId);
    campo?.focus({ preventScroll: true });
    campo?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [focoPedido]);

  function abrirSecao(id: IdDaSecao) {
    setSecaoAberta(id);
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
  }

  function irParaCampo(campo: CampoDoFormulario) {
    abrirSecao(secaoDoCampo(campo).id);
    setFocoPedido({ campoId: ID_DO_CAMPO[campo] });
  }

  const listaDeErros: ErroDeCampo[] = resumoAberto
    ? secoes.flatMap((secao) =>
        secao.campos.flatMap((campo) => {
          const mensagem = errors[campo]?.message;
          return mensagem ? [{ campoId: ID_DO_CAMPO[campo], mensagem: `${secao.rotulo}: ${mensagem}` }] : [];
        }),
      )
    : [];

  /** Sem "keepDirtyValues": aquela opção vale para quando os dados mudam sozinhos, não para aqui. */
  function limpar(novos: FormularioGeral) {
    reset(novos, { keepDirtyValues: false });
    setResumoAberto(false);
  }

  const salvar = handleSubmit(
    async (formulario) => {
      try {
        const alteradas = await salvarFormularioGeral(formulario);
        limpar(formulario);
        aviso(alteradas ? 'Configurações salvas.' : 'Nenhuma alteração para salvar.');
      } catch (erro) {
        aviso(mensagemDoErro(erro));
      }
    },
    (encontrados) => {
      setResumoAberto(true);
      // Com erro na seção aberta, fica nela; senão, abre a primeira seção que tem erro.
      const campos = CAMPOS.filter((campo) => encontrados[campo]);
      const primeiro = campos.find((campo) => secaoDoCampo(campo).id === secaoAberta) ?? campos[0];
      if (primeiro) irParaCampo(primeiro);
    },
  );

  const descartar = () => {
    limpar(valores);
    aviso('Alterações descartadas.');
  };

  const uf = watch('uf_padrao');
  const municipio = watch('municipio_padrao');
  const linkDoLogo = watch('organizacao_logo_url');
  const responsavelForaDaLista = !responsavelDisponivel(configuracoes.responsavel_backup_id, pessoas);
  const responsavelEscolhido = watch('responsavel_backup_id');
  const faltaResponsavel = responsavelForaDaLista && !responsavelEscolhido;
  const listaDeMunicipios = useMemo(() => {
    const lista = municipiosDaUf(municipios, uf);
    // Um valor antigo, que não esteja na lista oficial, continua visível até alguém trocar.
    return municipio && !lista.includes(municipio) ? [municipio, ...lista] : lista;
  }, [municipios, uf, municipio]);

  const secaoAtual = SECAO[secaoAberta];
  const secoesAlteradas = secoes.filter((secao) => secao.campos.some((campo) => dirtyFields[campo]));
  // Salvar e descartar valem para todas as seções: quando há alteração fora desta, a barra diz onde.
  const alteracaoEmOutraSecao = secoesAlteradas.some((secao) => secao.id !== secaoAberta);
  const estado = alteracaoEmOutraSecao ? `Alterações não salvas em ${POR_EXTENSO.format(secoesAlteradas.map((secao) => secao.rotulo))}` : 'Alterações não salvas';
  // Fase e câmbio gravam ao confirmar: sem nada pendente em outra seção, ali não há o que salvar.
  const mostrarAcoes = secaoAtual.campos.length > 0 || isDirty;

  return (
    <TabsPrimitive.Root value={secaoAberta} onValueChange={(id) => abrirSecao(id as IdDaSecao)} orientation="vertical" className={GRADE_DA_TELA}>
      <div className="rounded-lg border border-line bg-paper p-1.5 lg:p-2.5">
        <TabsPrimitive.List aria-label="Seções das configurações gerais" className="flex flex-wrap gap-1 lg:sticky lg:top-[88px] lg:flex-col">
          {secoes.map((item) => (
            <ItemDaNavegacao key={item.id} secao={item} erros={item.campos.filter((campo) => errors[campo]).length} alterada={item.campos.some((campo) => dirtyFields[campo])} atencao={item.id === 'backup' && faltaResponsavel && !errors.responsavel_backup_id} aoAbrir={abrirSecao} />
          ))}
        </TabsPrimitive.List>
      </div>

      <form ref={painel} noValidate onSubmit={salvar} className="@container flex min-w-0 scroll-mt-[88px] flex-col rounded-lg border border-line bg-paper">
        <div className="flex-1 px-[18px] py-5 md:px-6">
          <ResumoErros
            erros={listaDeErros}
            aoEscolher={(campoId) => {
              const campo = CAMPOS.find((item) => ID_DO_CAMPO[item] === campoId);
              if (campo) irParaCampo(campo);
            }}
          />

          <PainelDaSecao secao={SECAO.organizacao}>
            <h3 className={TITULO_DO_GRUPO}>Organização</h3>
            <div className="grid grid-cols-1 gap-3">
              <Campo id={ID_DO_CAMPO.organizacao_nome} rotulo="Nome da organização" obrigatorio erro={errors.organizacao_nome?.message} className={CAMPO_EM_LINHA}>
                {(controle) => <Input autoComplete="off" {...controle} {...register('organizacao_nome')} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.organizacao_email} rotulo="E-mail institucional" erro={errors.organizacao_email?.message} ajuda="Conta Gmail da Numa." className={CAMPO_EM_LINHA}>
                {(controle) => <Input type="email" inputMode="email" placeholder="Não informado" autoComplete="off" spellCheck={false} {...controle} {...register('organizacao_email')} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.organizacao_logo_url} rotulo="Link do logotipo no Drive" erro={errors.organizacao_logo_url?.message} ajuda={`Usado em e-mails e documentos. ${LEMBRETE_LINK_DRIVE}`} className={CAMPO_EM_LINHA}>
                {(controle) => <EntradaLinkDrive link={linkDoLogo ?? ''} placeholder="Não informado" {...controle} {...register('organizacao_logo_url')} />}
              </Campo>
            </div>

            <h3 className={cn(TITULO_DO_GRUPO, 'mt-4 border-t border-line pt-4')}>Região e calendário</h3>
            <div className="grid grid-cols-1 gap-3 @min-[480px]:grid-cols-2 @min-[480px]:gap-x-[18px]">
              <Controller
                control={control}
                name="fuso"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.fuso} rotulo="Fuso horário" obrigatorio erro={errors.fuso?.message}>
                    {(controle) => (
                      <Selecao {...controle} {...field}>
                        {FUSOS.map((fuso) => (
                          <option key={fuso} value={fuso}>
                            {ROTULOS_FUSO[fuso]}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Controller
                control={control}
                name="moeda_padrao"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.moeda_padrao} rotulo="Moeda padrão" obrigatorio erro={errors.moeda_padrao?.message}>
                    {(controle) => <SelecaoMoeda {...controle} {...field} />}
                  </Campo>
                )}
              />
              <Controller
                control={control}
                name="uf_padrao"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.uf_padrao} rotulo="UF" erro={errors.uf_padrao?.message}>
                    {(controle) => (
                      <Selecao
                        {...controle}
                        {...field}
                        onChange={(evento) => {
                          field.onChange(evento);
                          setValue('municipio_padrao', '', { shouldDirty: true });
                        }}
                      >
                        <option value="">Não informado</option>
                        {municipios.ufs.map((estado) => (
                          <option key={estado.sigla} value={estado.sigla}>
                            {estado.nome} · {estado.sigla}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
              <Controller
                control={control}
                name="municipio_padrao"
                render={({ field }) => (
                  <Campo id={ID_DO_CAMPO.municipio_padrao} rotulo="Município" erro={errors.municipio_padrao?.message} ajuda={uf ? undefined : 'Escolha a UF para ver os municípios.'}>
                    {(controle) => (
                      <Selecao {...controle} {...field} disabled={!uf}>
                        <option value="">Não informado</option>
                        {listaDeMunicipios.map((nome) => (
                          <option key={nome} value={nome}>
                            {nome}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                )}
              />
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-normal text-ink-soft">
              <Info className="mt-px size-4 shrink-0" aria-hidden />
              <span>O calendário considera os feriados nacionais, estaduais e municipais desta região. Alterar a região não modifica registros anteriores.</span>
            </p>
          </PainelDaSecao>

          <PainelDaSecao secao={SECAO.fase}>
            <SecaoFase fase={configuracoes.fase_ativa} ultimaMudanca={mudancaDeFase} />
          </PainelDaSecao>

          <PainelDaSecao secao={SECAO.alertas}>
            <div className="max-w-[640px]">
              <CampoDias id={ID_DO_CAMPO.alerta_vencimento_dias} rotulo="Vencimentos financeiros" texto="Antes de uma conta vencer." erro={errors.alerta_vencimento_dias?.message} registro={register('alerta_vencimento_dias')} />
              <CampoDias id={ID_DO_CAMPO.alerta_renovacao_ferramenta_dias} rotulo="Renovação de ferramentas" texto="Tempo para revisar uma assinatura." erro={errors.alerta_renovacao_ferramenta_dias?.message} registro={register('alerta_renovacao_ferramenta_dias')} />
              <CampoDias id={ID_DO_CAMPO.alerta_fim_teste_dias} rotulo="Fim de períodos de teste" texto="Para decidir antes da cobrança." erro={errors.alerta_fim_teste_dias?.message} registro={register('alerta_fim_teste_dias')} />
              <CampoDias id={ID_DO_CAMPO.alerta_dominio_dias} rotulo="Vencimento de domínios" texto="Os endereços dos nossos produtos em dia." erro={errors.alerta_dominio_dias?.message} registro={register('alerta_dominio_dias')} />
            </div>
          </PainelDaSecao>

          <PainelDaSecao secao={SECAO.financeiro}>
            <RegrasFinanceiras />
            <SecaoCambio cambios={cambios} />
          </PainelDaSecao>

          <PainelDaSecao secao={SECAO.legal}>
            <SecaoLegalDaConfiguracao embutida />
          </PainelDaSecao>

          <PainelDaSecao secao={SECAO.backup}>
            {faltaResponsavel && (
              <Faixa tipo="atencao" className="mb-4">
                A pessoa responsável pelo backup não está mais na lista. Escolha outra.
              </Faixa>
            )}
            <Controller
              control={control}
              name="responsavel_backup_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.responsavel_backup_id} rotulo="Responsável pelo backup semanal" obrigatorio erro={errors.responsavel_backup_id?.message} ajuda="Responsável padrão da área de Tecnologia." className={CAMPO_EM_LINHA}>
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
            <Faixa tipo="atencao" className="mt-[18px]">
              Exporte uma cópia toda semana e salve no Drive da Numa, em Backups/Central.
            </Faixa>
            <Button asChild variante="secundario" tamanho="pequeno" className="mt-3">
              <LinkCentral href="/configuracoes/dados">
                <Database aria-hidden />
                Exportar e importar em Dados
              </LinkCentral>
            </Button>
          </PainelDaSecao>

          <p className="mt-5 text-xs text-ink-soft md:hidden">{secaoAtual.nota}</p>
        </div>

        <div
          className={cn(
            'sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 rounded-b-lg border-t border-line bg-paper px-[18px] py-3 max-md:bottom-[calc(74px+var(--area-segura-baixo))] md:px-6',
            !mostrarAcoes && 'max-md:hidden',
          )}
        >
          <p className="mr-auto text-xs text-ink-soft max-md:hidden">{secaoAtual.nota}</p>
          <p role="status" className={cn('flex items-center gap-2 text-xs text-ink-soft max-md:basis-full', !isDirty && 'sr-only')}>
            {isDirty && (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-warn" />
                {estado}
              </>
            )}
          </p>
          {mostrarAcoes && (
            <div className="flex gap-2 max-md:w-full max-md:[&>*]:flex-auto">
              <Button variante="secundario" disabled={!isDirty || isSubmitting} onMouseDown={manterFocoNoCampo} onClick={descartar}>
                <span>
                  Descartar<span className="max-md:hidden"> alterações</span>
                </span>
              </Button>
              <Button type="submit" carregando={isSubmitting} disabled={!isDirty} onMouseDown={manterFocoNoCampo}>
                Salvar alterações
              </Button>
            </div>
          )}
        </div>
      </form>
    </TabsPrimitive.Root>
  );
}
