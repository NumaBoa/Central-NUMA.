'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Bell, Building2, CircleCheck, CircleDot, Coins, DatabaseBackup, Flag, Globe, Save } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { Logo } from '@/componentes/marca/logo';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoErro } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { NestaPagina, type ItemNestaPagina } from '@/componentes/padroes/nesta-pagina';
import { ResumoErros, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { SecaoLegalDaConfiguracao } from '@/componentes/f1/secao-legal-configuracao';
import { Secao } from '@/componentes/padroes/secao';
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
import { RegrasFinanceiras, SecaoCambio } from './secao-cambio';
import { SecaoFase } from './secao-fase';

const ITENS_DA_PAGINA: readonly ItemNestaPagina[] = [
  { id: 'organizacao', rotulo: 'Organização', icone: Building2 },
  { id: 'regiao', rotulo: 'Região e calendário', icone: Globe },
  { id: 'fase', rotulo: 'Fase da Numa', icone: Flag },
  { id: 'alertas', rotulo: 'Alertas e lembretes', icone: Bell },
  { id: 'financeiro', rotulo: 'Financeiro', icone: Coins },
  { id: 'backup', rotulo: 'Backup', icone: DatabaseBackup },
];

/** Na ordem da tela: é a ordem do resumo de erros. */
const ID_DO_CAMPO: Record<keyof FormularioGeral, string> = {
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

const CAMPOS_EM_ORDEM = Object.keys(ID_DO_CAMPO) as (keyof FormularioGeral)[];

/** Selo no cabeçalho: não aparece até a fase real ser lida, para nada piscar. */
export function SeloDaFase() {
  const { dados } = useConsulta(lerConfiguracoes);
  if (!dados) return null;
  const fase = dados.fase_ativa;
  return (
    <div className="flex items-center gap-2 text-xs whitespace-nowrap text-ink-soft">
      <EtiquetaSituacao tipo="info" icone={CircleDot}>
        {rotuloDaFase(fase)}
      </EtiquetaSituacao>
      <span>{INFO_FASES[fase].nome}</span>
    </div>
  );
}

function Esqueleto() {
  return (
    <div role="status" aria-label="Carregando" className="mt-7 grid max-w-[880px] grid-cols-1 gap-4 md:gap-[22px]">
      <Skeleton className="h-[300px]" />
      <Skeleton className="h-[260px]" />
      <Skeleton className="h-[260px]" />
    </div>
  );
}

/** T02.01: formulário em seções, conforme a referência visual aprovada. */
export function PainelGeral() {
  const tela = useConsulta(carregarTelaGeral);
  if (tela.estado === 'carregando') return <Esqueleto />;
  if (tela.estado === 'erro') {
    return <EstadoErro className="mt-7 max-w-[880px]" titulo="Não deu para ler as configurações." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={tela.recarregar} />;
  }
  return <Conteudo dados={tela.dados} />;
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

function Grade({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 md:gap-x-[18px] md:gap-y-5">{children}</div>;
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
  const { errors, isDirty, isSubmitting, submitCount } = formState;
  useAlteracoesPendentes(isDirty);

  // O resumo aparece depois de uma tentativa de salvar com erro (P3). O envio só conta depois de
  // validar: é nessa hora que o resumo já está na tela e pode receber o foco.
  const resumoDeErros = useRef<HTMLDivElement>(null);
  const [resumoAberto, setResumoAberto] = useState(false);
  useEffect(() => {
    if (!resumoAberto) return;
    resumoDeErros.current?.focus();
    resumoDeErros.current?.scrollIntoView({ block: 'center' });
  }, [resumoAberto, submitCount]);

  const listaDeErros: ErroDeCampo[] = resumoAberto
    ? CAMPOS_EM_ORDEM.flatMap((campo) => {
        const mensagem = errors[campo]?.message;
        return mensagem ? [{ campoId: ID_DO_CAMPO[campo], mensagem }] : [];
      })
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
    () => setResumoAberto(true),
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
  const listaDeMunicipios = useMemo(() => {
    const lista = municipiosDaUf(municipios, uf);
    // Um valor antigo, que não esteja na lista oficial, continua visível até alguém trocar.
    return municipio && !lista.includes(municipio) ? [municipio, ...lista] : lista;
  }, [municipios, uf, municipio]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-8 md:mt-7 lg:grid-cols-[minmax(0,880px)_220px] xl:grid-cols-[minmax(0,880px)_240px] xl:gap-9">
      <form noValidate onSubmit={salvar} className="min-w-0">
        <ResumoErros ref={resumoDeErros} erros={listaDeErros} />
        <div className="grid grid-cols-1 gap-4 md:gap-[22px]">
          <Secao id="organizacao" icone={Building2} titulo="Organização" descricao="Quem somos, em todos os lugares.">
            <div className="mb-5 flex items-center gap-3 rounded-md border border-dashed border-line bg-linen p-[13px] md:gap-4 md:p-4">
              <div className="grid h-[50px] w-[84px] shrink-0 place-items-center rounded-campo border border-line bg-paper md:h-[58px] md:w-24">
                <Logo className="text-[20px] md:text-[23px]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-body text-[13px] leading-[18px] tracking-normal">A nossa assinatura</h3>
                <p className="mt-[3px] text-xs text-ink-soft">O logotipo institucional aparece em e-mails e documentos.</p>
              </div>
            </div>
            <Grade>
              <Campo id={ID_DO_CAMPO.organizacao_nome} rotulo="Nome da organização" obrigatorio erro={errors.organizacao_nome?.message} className="md:col-span-2">
                {(controle) => <Input autoComplete="off" {...controle} {...register('organizacao_nome')} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.organizacao_email} rotulo="E-mail institucional" erro={errors.organizacao_email?.message} ajuda="Conta Gmail da Numa.">
                {(controle) => <Input type="email" inputMode="email" placeholder="Ainda não informado" autoComplete="off" spellCheck={false} {...controle} {...register('organizacao_email')} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.organizacao_logo_url} rotulo="Link do logotipo no Drive" erro={errors.organizacao_logo_url?.message} ajuda={LEMBRETE_LINK_DRIVE}>
                {(controle) => <EntradaLinkDrive link={linkDoLogo ?? ''} placeholder="Cole o link do Drive" {...controle} {...register('organizacao_logo_url')} />}
              </Campo>
            </Grade>
          </Secao>

          <Secao id="regiao" icone={Globe} titulo="Região e calendário" descricao="Datas, valores e rotina no mesmo ritmo.">
            <Grade>
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
                  <Campo id={ID_DO_CAMPO.uf_padrao} rotulo="Estado dos feriados">
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
                  <Campo id={ID_DO_CAMPO.municipio_padrao} rotulo="Município dos feriados">
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
            </Grade>
            <Faixa className="mt-5">O calendário considera feriados nacionais, estaduais e municipais da região escolhida.</Faixa>
          </Secao>

          <SecaoFase fase={configuracoes.fase_ativa} ultimaMudanca={mudancaDeFase} />

          <Secao id="alertas" icone={Bell} titulo="Alertas e lembretes" descricao="A gente lembra antes, para você cuidar com calma.">
            <div>
              <CampoDias id={ID_DO_CAMPO.alerta_vencimento_dias} rotulo="Vencimentos financeiros" texto="Antes de uma conta vencer." erro={errors.alerta_vencimento_dias?.message} registro={register('alerta_vencimento_dias')} />
              <CampoDias id={ID_DO_CAMPO.alerta_renovacao_ferramenta_dias} rotulo="Renovação de ferramentas" texto="Tempo para revisar uma assinatura." erro={errors.alerta_renovacao_ferramenta_dias?.message} registro={register('alerta_renovacao_ferramenta_dias')} />
              <CampoDias id={ID_DO_CAMPO.alerta_fim_teste_dias} rotulo="Fim de períodos de teste" texto="Para decidir antes da cobrança." erro={errors.alerta_fim_teste_dias?.message} registro={register('alerta_fim_teste_dias')} />
              <CampoDias id={ID_DO_CAMPO.alerta_dominio_dias} rotulo="Vencimento de domínios" texto="Os endereços dos nossos produtos em dia." erro={errors.alerta_dominio_dias?.message} registro={register('alerta_dominio_dias')} />
            </div>
          </Secao>

          <Secao id="financeiro" icone={Coins} titulo="Financeiro" descricao="Combinados claros. Contas bem cuidadas.">
            <RegrasFinanceiras />
            <SecaoCambio cambios={cambios} />
          </Secao>

          <SecaoLegalDaConfiguracao />

          <Secao id="backup" icone={DatabaseBackup} titulo="Backup" descricao="Uma cópia guardada. Uma preocupação a menos.">
            {responsavelForaDaLista && !responsavelEscolhido && (
              <Faixa tipo="atencao" className="mb-4">
                A pessoa responsável pelo backup não está mais na lista. Escolha outra.
              </Faixa>
            )}
            <Controller
              control={control}
              name="responsavel_backup_id"
              render={({ field }) => (
                <Campo id={ID_DO_CAMPO.responsavel_backup_id} rotulo="Responsável pelo backup semanal" obrigatorio erro={errors.responsavel_backup_id?.message} ajuda="Responsável padrão da área de Tecnologia.">
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
          </Secao>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 max-md:sticky max-md:bottom-[calc(74px+var(--area-segura-baixo))] max-md:z-20 max-md:rounded-lg max-md:border max-md:border-line max-md:bg-glass max-md:p-2.5 max-md:backdrop-blur-[14px]">
          <p className="hidden items-center gap-1.5 text-xs text-ink-soft md:flex" aria-live="polite">
            {isDirty ? (
              'Há alterações sem salvar.'
            ) : (
              <>
                <CircleCheck className="size-3.5 shrink-0" aria-hidden />
                Tudo em ordem por aqui.
              </>
            )}
          </p>
          <div className="flex gap-2 max-md:flex-1 max-md:[&>*]:flex-1">
            <Button variante="secundario" disabled={!isDirty || isSubmitting} onClick={descartar}>
              Descartar
            </Button>
            <Button type="submit" carregando={isSubmitting}>
              <Save aria-hidden />
              Salvar alterações
            </Button>
          </div>
        </div>
      </form>

      <NestaPagina itens={ITENS_DA_PAGINA} />
    </div>
  );
}
