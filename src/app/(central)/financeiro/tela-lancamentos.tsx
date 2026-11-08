'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CalendarClock, CheckCircle2, Circle, CircleAlert, CircleCheck, Contrast, Ellipsis, FileText, FileX2, Info, Paperclip, Plus, Receipt, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { DialogoDeBaixa } from '@/componentes/financeiro/dialogo-baixa';
import { DialogoDeBaixaEmLote } from '@/componentes/financeiro/dialogo-baixa-lote';
import { FormularioDeDespesa } from '@/componentes/financeiro/formulario-despesa';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Indicador } from '@/componentes/padroes/indicador';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { BotaoExportarCsv, MenuColunas, MenuVisoes, usePreferenciasDaLista } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import type { Titulo } from '@/dados/tipos/titulo';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from '@/dominio/contextos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { tintaDaCor } from '@/dominio/cores';
import { carregarLancamentos, comprovanteDoTitulo, filtrarTitulos, FILTROS_LANCAMENTOS_INICIAIS, pagoDoTitulo, periodoDosTotais, ROTULO_ORDEM_PADRAO, rotuloDoMes, totaisDosLancamentos, type DadosDosLancamentos, type FiltrosLancamentos, type LinhaDoTitulo, type ValorPorMoeda } from '@/dominio/lancamentos';
import { salvarColunas } from '@/dominio/preferencias-lista';
import { ROTULOS_ORIGEM_TITULO, ROTULOS_SITUACAO_TITULO, rotuloDaCompetencia } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';
import { BarraDeLancamentos, rotuloDaCompetenciaDoFiltro } from './filtros-lancamentos';

const LISTA = 'lancamentos';
const COLUNAS_PADRAO = ['descricao', 'contexto', 'vencimento', 'valor', 'saldo', 'situacao', 'comprovante'];
const POR_PAGINA = 8;
/** Abaixo de 1440, a seta de ordenar só aparece na coluna ordenada: é o que faz a tabela caber. */
const SEM_SETA_PARADA = 'max-xl:[&_button_svg.opacity-50]:hidden';
/** O título quebra em duas linhas quando falta largura. */
const NUMERICA_ESTREITA = `${SEM_SETA_PARADA} max-xl:whitespace-normal`;

const SITUACOES: Readonly<Record<Titulo['situacao'], { tipo: TipoSituacao; icone: LucideIcon }>> = {
  previsto: { tipo: 'info', icone: CalendarClock },
  aberto: { tipo: 'neutro', icone: Circle },
  parcial: { tipo: 'atencao', icone: Contrast },
  quitado: { tipo: 'sucesso', icone: CheckCircle2 },
  cancelado: { tipo: 'neutro', icone: Ban },
};

/** "Vencido" é uma condição, não uma situação: o parcial vencido mostra as duas coisas (M05 §2). */
export function SituacaoDoTitulo({ titulo }: { titulo: Pick<LinhaDoTitulo, 'situacao' | 'vencido'> }) {
  const situacao = SITUACOES[titulo.situacao];
  if (!titulo.vencido) {
    return (
      <EtiquetaSituacao tipo={situacao.tipo} icone={situacao.icone}>
        {ROTULOS_SITUACAO_TITULO[titulo.situacao]}
      </EtiquetaSituacao>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-start gap-1">
      {titulo.situacao === 'parcial' && (
        <EtiquetaSituacao tipo={situacao.tipo} icone={situacao.icone}>
          Parcial
        </EtiquetaSituacao>
      )}
      <EtiquetaSituacao tipo="erro" icone={CircleAlert}>
        Vencido
      </EtiquetaSituacao>
    </span>
  );
}

export function contextosDoTitulo(titulo: Pick<LinhaDoTitulo, 'rateio'>, dados: Pick<DadosDosLancamentos, 'produtos' | 'marcas'>) {
  return titulo.rateio.flatMap((linha) => {
    const produto = dados.produtos.find((item) => item.id === linha.produto_id);
    const marca = produto ? dados.marcas.find((item) => item.id === produto.marca_id) : dados.marcas.find((item) => item.institucional);
    return marca ? [{ id: linha.produto_id ?? ID_INSTITUCIONAL, nome: produto?.nome ?? 'Numa', cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }] : [];
  });
}

/** Quem recebe: a contraparte, ou a sócia do reembolso. */
export function nomeDoFavorecido(titulo: Pick<Titulo, 'contraparte_id' | 'beneficiario_pessoa_id'>, dados: Pick<DadosDosLancamentos, 'contrapartes' | 'pessoas'>): string {
  const contraparte = dados.contrapartes.find((item) => item.id === titulo.contraparte_id);
  if (contraparte) return nomeDaContraparte(contraparte);
  return dados.pessoas.find((item) => item.id === titulo.beneficiario_pessoa_id)?.nome_completo ?? '';
}

function somarPorMoeda(valores: readonly ValorPorMoeda[]): ValorPorMoeda[] {
  return valores.reduce<ValorPorMoeda[]>((lista, { moeda, valor }) => {
    const item = lista.find((atual) => atual.moeda === moeda);
    if (item) item.valor = Math.round((item.valor + valor) * 100) / 100;
    else lista.push({ moeda, valor });
    return lista;
  }, []);
}

const textoDosValores = (valores: readonly ValorPorMoeda[]) => valores.map(({ valor, moeda }) => formatarDinheiro(valor, moeda)).join(' + ');

function textoDoPeriodoDoPago({ de, ate }: { de: string; ate: string }): string {
  const inicio = de === '0000-01-01' ? '' : formatarDiaISO(de);
  const fim = ate === '9999-12-31' ? '' : formatarDiaISO(ate);
  if (inicio && fim) return `de ${inicio} a ${fim}`;
  return inicio ? `a partir de ${inicio}` : `até ${fim}`;
}

/** D17: anexado, exceção com motivo, ou falta. Sem pagamento de pé, ainda não há o que comprovar. */
function ComprovanteDoTitulo({ titulo }: { titulo: Pick<LinhaDoTitulo, 'baixas'> }) {
  const { estado, motivo } = comprovanteDoTitulo(titulo);
  if (estado === 'anexado') {
    return (
      <EtiquetaSituacao tipo="sucesso" icone={Paperclip}>
        Anexado
      </EtiquetaSituacao>
    );
  }
  if (estado === 'excecao') {
    return (
      <span title={motivo} aria-label={`Sem comprovante, exceção justificada: ${motivo}`}>
        <EtiquetaSituacao tipo="neutro" icone={FileX2}>
          Exceção
        </EtiquetaSituacao>
      </span>
    );
  }
  if (estado === 'pendente') {
    return (
      <EtiquetaSituacao tipo="erro" icone={TriangleAlert}>
        Pendente
      </EtiquetaSituacao>
    );
  }
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">Sem pagamento</span>
    </>
  );
}

function textoDoComprovante(titulo: Pick<LinhaDoTitulo, 'baixas'>): string {
  const { estado, motivo } = comprovanteDoTitulo(titulo);
  if (estado === 'anexado') return 'Anexado';
  if (estado === 'excecao') return `Exceção: ${motivo}`;
  return estado === 'pendente' ? 'Pendente' : '';
}

function ContextoDoTitulo({ titulo, dados }: { titulo: LinhaDoTitulo; dados: DadosDosLancamentos }) {
  const itens = contextosDoTitulo(titulo, dados);
  if (itens.length > 1) {
    const nomes = itens.map((item) => item.nome).join(', ');
    return (
      <span title={nomes} aria-label={`Rateado entre ${nomes}`} className="inline-flex items-center gap-1.5 rounded-pill bg-mist px-2.5 py-1 text-xs leading-4 font-semibold whitespace-nowrap text-ink [&_svg]:size-[13px]">
        <Users aria-hidden />
        Rateado: {itens.length}
      </span>
    );
  }
  return itens[0] ? <EtiquetaContexto contexto={itens[0]} /> : <>—</>;
}

const podeBaixar = (titulo: LinhaDoTitulo) => titulo.situacao !== 'cancelado' && titulo.saldo > 0 && !titulo.arquivado_em;

/** As ações sempre à mão no "…" (18 §9.6), sem depender de hover. */
function AcoesDoTitulo({ titulo, aoRegistrarBaixa }: { titulo: LinhaDoTitulo; aoRegistrarBaixa: () => void }) {
  return (
    <MenuSobreposto
      titulo="Ações"
      largura={240}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" className="shrink-0" aria-label={`Ações de ${titulo.descricao}`}>
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <ul className="grid gap-0.5">
          <li>
            <LinkCentral href={`/financeiro/${titulo.id}`} className={`${CLASSE_LINHA_MENU} hover:bg-hover`}>
              <FileText aria-hidden />
              Abrir ficha
            </LinkCentral>
          </li>
          {podeBaixar(titulo) && (
            <li>
              <button
                type="button"
                className={`${CLASSE_LINHA_MENU} hover:bg-hover`}
                onClick={() => {
                  fechar();
                  aoRegistrarBaixa();
                }}
              >
                <Receipt aria-hidden />
                Registrar baixa
              </button>
            </li>
          )}
        </ul>
      )}
    </MenuSobreposto>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] leading-[18px] text-ink-soft [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0">
      <Info aria-hidden />
      <span>{children}</span>
    </p>
  );
}

type Totais = ReturnType<typeof totaisDosLancamentos>;

function CartoesDeTotais({ totais, periodo, competencia }: { totais: Totais; periodo: ReturnType<typeof periodoDosTotais>; competencia: string }) {
  const foraDosReais = (valores: readonly ValorPorMoeda[]) => (valores.length ? <span className="block">+ {textoDosValores(valores)} sem conversão</span> : null);
  return (
    <section className="grid grid-cols-2 gap-2 min-[1200px]:grid-cols-4" aria-label="Totais dos lançamentos">
      <Indicador
        titulo="Em aberto a pagar"
        valor={formatarDinheiro(totais.emAbertoPagar, 'BRL')}
        icone={FileText}
        tom="indigo"
        contexto={
          <>
            {totais.estimados.length ? <span className="block">Inclui {textoDosValores(totais.estimados)}: estimado</span> : null}
            {foraDosReais(totais.semConversao)}
            <span className="block">Sem os previstos</span>
          </>
        }
      />
      <Indicador
        titulo="Vencidos"
        valor={formatarDinheiro(totais.vencido, 'BRL')}
        icone={TriangleAlert}
        tom="erro"
        contexto={
          <>
            <span className="block">Incluídos no em aberto</span>
            {foraDosReais(totais.vencidoSemConversao)}
          </>
        }
      />
      <Indicador
        titulo={periodo.doMes ? `Pago em ${rotuloDoMes(periodo.de.slice(0, 7)).toLowerCase()}` : 'Pago no período'}
        valor={formatarDinheiro(totais.pagoNoPeriodo, 'BRL')}
        icone={CircleCheck}
        tom="sucesso"
        contexto={
          <>
            <span className="block">{periodo.doMes ? 'Pela data da baixa' : `Pela data da baixa, ${textoDoPeriodoDoPago(periodo)}`}</span>
            {competencia && (
              <span className="block" data-pago-da-competencia>
                Títulos de {rotuloDoMes(competencia).toLowerCase()}: {formatarDinheiro(totais.pagoDosTitulos, 'BRL')} pagos, em qualquer data
              </span>
            )}
            {totais.reembolsosNoPeriodo !== 0 && <span className="block">Reembolsos às sócias, à parte: {formatarDinheiro(totais.reembolsosNoPeriodo, 'BRL')}</span>}
          </>
        }
      />
      <Indicador
        titulo="Previstos"
        valor={formatarDinheiro(totais.previsto, 'BRL')}
        icone={CalendarClock}
        contexto={
          <>
            <span className="block">À parte do em aberto, ainda sem confirmação</span>
            {totais.previstoEstimados.length ? <span className="block">Inclui {textoDosValores(totais.previstoEstimados)}: estimado</span> : null}
            {foraDosReais(totais.previstoSemConversao)}
          </>
        }
      />
    </section>
  );
}

function CartaoDoTitulo({ titulo, dados, aoRegistrarBaixa }: { titulo: LinhaDoTitulo; dados: DadosDosLancamentos; aoRegistrarBaixa: () => void }) {
  const favorecido = nomeDoFavorecido(titulo, dados);
  const pago = pagoDoTitulo(titulo);
  const encerrado = titulo.situacao === 'cancelado';
  return (
    <div className="grid gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <LinkCentral href={`/financeiro/${titulo.id}`} className="grid min-h-11 min-w-0 content-center gap-0.5">
          <span className="font-semibold break-words">{titulo.descricao}</span>
          <span className="text-[13px] break-words text-ink-soft tabular-nums">
            {titulo.codigo}
            {favorecido ? ` · ${favorecido}` : ''}
          </span>
        </LinkCentral>
        <AcoesDoTitulo titulo={titulo} aoRegistrarBaixa={aoRegistrarBaixa} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <SituacaoDoTitulo titulo={titulo} />
        <ContextoDoTitulo titulo={titulo} dados={dados} />
      </div>
      <p className="text-[13px] text-ink-soft tabular-nums">Vence em {formatarDiaISO(titulo.vencimento)}</p>
      <dl className={`grid gap-x-3 text-[13px] ${pago !== 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div>
          <dt className="text-ink-soft">Valor original</dt>
          <dd className="font-medium tabular-nums">{formatarDinheiro(titulo.valor, titulo.moeda)}</dd>
        </div>
        {pago !== 0 && (
          <div>
            <dt className="text-ink-soft">Pagamentos</dt>
            <dd className="font-medium tabular-nums">{formatarDinheiro(pago, titulo.moeda)}</dd>
          </div>
        )}
        <div>
          <dt className="text-ink-soft">Saldo a pagar</dt>
          <dd className="font-semibold tabular-nums">{encerrado ? '—' : formatarDinheiro(titulo.saldo, titulo.moeda)}</dd>
        </div>
      </dl>
      {comprovanteDoTitulo(titulo).estado !== 'nao_se_aplica' && (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-soft">
          Comprovante: <ComprovanteDoTitulo titulo={titulo} />
        </div>
      )}
    </div>
  );
}

/** T05.01 (P1): o que vence, o que foi pago e o que ainda está em aberto. */
export function TelaLancamentos() {
  const roteador = useRouter();
  const { pessoa, contexto } = useCentral();
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarLancamentos(hoje), [hoje]);
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(new Set());
  const [emLote, setEmLote] = useState(false);
  const [baixando, setBaixando] = useState<LinhaDoTitulo | null>(null);
  const [filtros, setFiltros] = useState<FiltrosLancamentos>(FILTROS_LANCAMENTOS_INICIAIS);
  const [cadastrando, setCadastrando] = useState(false);
  const { colunasVisiveis, visoes } = usePreferenciasDaLista(pessoa.id, LISTA, COLUNAS_PADRAO);
  const dados = consulta.dados;

  const opcoes = useMemo(
    () => ({
      contextoGlobalId: contexto.id,
      hoje,
      nomeDaContraparte: (titulo: Titulo) => (dados ? nomeDoFavorecido(titulo, dados) : ''),
    }),
    [contexto.id, hoje, dados],
  );
  const linhas = useMemo(() => (dados ? filtrarTitulos(dados.titulos, filtros, opcoes) : []), [dados, filtros, opcoes]);

  const colunas = useMemo<readonly Coluna<LinhaDoTitulo>[]>(() => {
    if (!dados) return [];
    const nomeDaCategoria = (id: string) => dados.categorias.find((categoria) => categoria.id === id)?.nome ?? 'Categoria removida';
    const nomeDaPessoa = (id: string) => dados.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
    return [
      {
        id: 'descricao',
        titulo: 'Descrição / fornecedor',
        fixa: true,
        essencial: true,
        classe: SEM_SETA_PARADA,
        ordenar: (a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'),
        texto: (titulo) => [titulo.codigo, titulo.descricao, nomeDoFavorecido(titulo, dados)].filter(Boolean).join(' · '),
        celula: (titulo) => (
          <span className="grid min-w-36 gap-0.5 xl:min-w-52">
            <span className="font-semibold break-words">{titulo.descricao}</span>
            <span className="text-xs text-ink-soft tabular-nums">
              {titulo.codigo}
              {nomeDoFavorecido(titulo, dados) ? ` · ${nomeDoFavorecido(titulo, dados)}` : ''}
            </span>
            {/* Sem largura para a coluna Contexto, ele fica aqui: a informação não some. */}
            <span className="mt-0.5 @min-[750px]:hidden">
              <ContextoDoTitulo titulo={titulo} dados={dados} />
            </span>
          </span>
        ),
      },
      { id: 'contraparte', titulo: 'Contraparte', texto: (titulo) => nomeDoFavorecido(titulo, dados), celula: (titulo) => nomeDoFavorecido(titulo, dados) || '—' },
      { id: 'categoria', titulo: 'Categoria', ordenar: (a, b) => nomeDaCategoria(a.categoria_id).localeCompare(nomeDaCategoria(b.categoria_id), 'pt-BR'), texto: (titulo) => nomeDaCategoria(titulo.categoria_id), celula: (titulo) => nomeDaCategoria(titulo.categoria_id) },
      {
        id: 'contexto',
        titulo: 'Contexto',
        classe: 'hidden @min-[750px]:table-cell',
        essencial: true,
        texto: (titulo) => contextosDoTitulo(titulo, dados).map((item) => item.nome).join(', '),
        celula: (titulo) => <ContextoDoTitulo titulo={titulo} dados={dados} />,
      },
      { id: 'competencia', titulo: 'Competência', ordenar: (a, b) => a.competencia.localeCompare(b.competencia), texto: (titulo) => rotuloDaCompetencia(titulo.competencia), celula: (titulo) => <span className="whitespace-nowrap">{rotuloDaCompetencia(titulo.competencia)}</span> },
      { id: 'vencimento', titulo: 'Vencimento', essencial: true, classe: SEM_SETA_PARADA, ordenar: (a, b) => a.vencimento.localeCompare(b.vencimento), texto: (titulo) => formatarDiaISO(titulo.vencimento), celula: (titulo) => <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(titulo.vencimento)}</span> },
      { id: 'valor', titulo: 'Valor original', numerica: true, essencial: true, classe: NUMERICA_ESTREITA, ordenar: (a, b) => a.valor - b.valor, texto: (titulo) => formatarDinheiro(titulo.valor, titulo.moeda), celula: (titulo) => <span className="whitespace-nowrap">{formatarDinheiro(titulo.valor, titulo.moeda)}</span> },
      { id: 'pagamentos', titulo: 'Pagamentos', numerica: true, ordenar: (a, b) => pagoDoTitulo(a) - pagoDoTitulo(b), texto: (titulo) => formatarDinheiro(pagoDoTitulo(titulo), titulo.moeda), celula: (titulo) => <span className="whitespace-nowrap">{formatarDinheiro(pagoDoTitulo(titulo), titulo.moeda)}</span> },
      { id: 'saldo', titulo: 'Saldo a pagar', numerica: true, essencial: true, classe: NUMERICA_ESTREITA, ordenar: (a, b) => a.saldo - b.saldo, texto: (titulo) => (titulo.situacao === 'cancelado' ? '' : formatarDinheiro(titulo.saldo, titulo.moeda)), celula: (titulo) => <span className="whitespace-nowrap">{titulo.situacao === 'cancelado' ? '—' : formatarDinheiro(titulo.saldo, titulo.moeda)}</span> },
      { id: 'situacao', titulo: 'Situação', essencial: true, texto: (titulo) => (titulo.vencido ? (titulo.situacao === 'parcial' ? 'Parcial, vencido' : 'Vencido') : ROTULOS_SITUACAO_TITULO[titulo.situacao]), celula: (titulo) => <SituacaoDoTitulo titulo={titulo} /> },
      { id: 'origem', titulo: 'Origem', texto: (titulo) => ROTULOS_ORIGEM_TITULO[titulo.origem], celula: (titulo) => ROTULOS_ORIGEM_TITULO[titulo.origem] },
      { id: 'comprovante', titulo: 'Comprovante', classe: 'hidden @min-[870px]:table-cell', essencial: true, texto: textoDoComprovante, celula: (titulo) => <ComprovanteDoTitulo titulo={titulo} /> },
      { id: 'responsavel', titulo: 'Responsável', ordenar: (a, b) => nomeDaPessoa(a.responsavel_id).localeCompare(nomeDaPessoa(b.responsavel_id), 'pt-BR'), texto: (titulo) => nomeDaPessoa(titulo.responsavel_id), celula: (titulo) => <NomeDaPessoa nome={nomeDaPessoa(titulo.responsavel_id)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
    ];
  }, [dados]);

  const visiveis = useMemo(() => colunas.filter((coluna) => coluna.fixa || colunasVisiveis.includes(coluna.id)), [colunas, colunasVisiveis]);

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Financeiro</h1>
        <EstadoErro titulo="Não deu para ler os lançamentos." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const mudar = (parcial: Partial<FiltrosLancamentos>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const { arquivados: _semArquivados, ...filtrosDaVisao } = filtros;
  const selecionadas = linhas.filter((linha) => selecionados.has(linha.id));
  const periodo = periodoDosTotais(filtros, hoje);
  const totais = totaisDosLancamentos(linhas, dados.cambios, periodo, contexto.id);
  // Em aberto e previstos somados por moeda: as notas dizem tudo o que ficou fora dos reais ou entrou por estimativa.
  const foraDosTotais = somarPorMoeda([...totais.semConversao, ...totais.previstoSemConversao]);
  const estimadosNosTotais = somarPorMoeda([...totais.estimados, ...totais.previstoEstimados]);
  const nomeDaCompetencia = rotuloDaCompetenciaDoFiltro(filtros.competencia);
  const abrirBaixa = (titulo: LinhaDoTitulo) => () => setBaixando(titulo);
  const filtrando = JSON.stringify(filtros) !== JSON.stringify(FILTROS_LANCAMENTOS_INICIAIS);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        comoUsar="/ajuda/financeiro"
        kicker="Financeiro"
        titulo="Lançamentos"
        resumo="O que vence, o que foi pago e o que ainda está em aberto."
        acoes={
          <>
            <MenuVisoes
              pessoaId={pessoa.id}
              lista={LISTA}
              visoes={visoes}
              filtros={filtrosDaVisao}
              colunas={colunasVisiveis}
              aoAplicar={(visao) => {
                setFiltros((atuais) => ({ ...FILTROS_LANCAMENTOS_INICIAIS, ...(visao.filtros as Partial<FiltrosLancamentos>), arquivados: atuais.arquivados }));
                salvarColunas(pessoa.id, LISTA, visao.colunas);
              }}
            />
            <BotaoExportarCsv nomeDoArquivo="lancamentos" colunas={visiveis} linhas={linhas} />
            <Button onClick={() => setCadastrando(true)}>
              <Plus aria-hidden />
              Nova despesa
            </Button>
          </>
        }
      />
      <AbasFinanceiro ativa="lancamentos" />
      <div className="space-y-2">
        <CartoesDeTotais totais={totais} periodo={periodo} competencia={filtros.competencia} />
        <p className="text-[13px] leading-[18px] text-ink-soft" data-base-dos-totais>
          Base dos totais: {formatarNumero(totais.quantos)} {totais.quantos === 1 ? 'título' : 'títulos'} · {nomeDaCompetencia} · {contexto.nome}. {contexto.id === ID_CONSOLIDADA ? 'Cada título e cada pagamento contam uma vez.' : `Título rateado conta pela parte de ${contexto.nome}.`} Pagamentos em reais, pelo valor efetivo.
        </p>
      </div>
      <BarraDeLancamentos filtros={filtros} aoMudar={mudar} dados={dados} hoje={hoje} colunas={<MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />} />
      {selecionadas.length > 0 && (
        <div className="hidden flex-wrap items-center gap-2 rounded-lg border border-line bg-mist px-4 py-2 text-[13px] md:flex" role="region" aria-label="Ações em lote">
          <span className="font-semibold">{selecionadas.length === 1 ? '1 selecionado' : `${selecionadas.length} selecionados`}</span>
          <Button variante="secundario" tamanho="pequeno" onClick={() => setEmLote(true)}>
            Registrar baixa em lote
          </Button>
          <Button variante="terciario" tamanho="pequeno" onClick={() => setSelecionados(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}
      <Lista
        rotulo="Lançamentos"
        linhas={linhas}
        colunas={visiveis}
        chave={(titulo) => titulo.id}
        aoAbrir={(titulo) => roteador.push(`/financeiro/${titulo.id}`)}
        cartaoInterativo
        compacta
        acoesDaLinha={(titulo) => <AcoesDoTitulo titulo={titulo} aoRegistrarBaixa={abrirBaixa(titulo)} />}
        selecao={{ selecionados, aoMudar: setSelecionados, rotuloDaLinha: (titulo) => titulo.descricao }}
        filtrando={filtrando || Boolean(filtros.busca.trim()) || contexto.id !== 'consolidada'}
        aoLimparFiltros={() => setFiltros(FILTROS_LANCAMENTOS_INICIAIS)}
        vazio={<EstadoVazio icone={Receipt} titulo="Nenhum lançamento ainda." texto="Que tal lançar a primeira despesa?" acao={<Button onClick={() => setCadastrando(true)}>Nova despesa</Button>} />}
        cartao={(titulo) => <CartaoDoTitulo titulo={titulo} dados={dados} aoRegistrarBaixa={abrirBaixa(titulo)} />}
        paginacao={{
          porPagina: POR_PAGINA,
          reiniciarCom: `${JSON.stringify(filtros)}:${contexto.id}`,
          resumo: (ordenada) => `${formatarNumero(linhas.length)} ${linhas.length === 1 ? 'lançamento' : 'lançamentos'} · ${nomeDaCompetencia}${ordenada ? '' : ` · ${ROTULO_ORDEM_PADRAO}`}`,
        }}
      />
      <div className="grid gap-1.5" data-notas-dos-lancamentos>
        {foraDosTotais.length > 0 && (
          <Nota>
            {textoDosValores(foraDosTotais)} {foraDosTotais.length === 1 && foraDosTotais[0]?.valor === 1 ? 'não incluído' : 'não incluídos'} nos totais em reais: câmbio de referência não informado.{' '}
            <LinkCentral href="/configuracoes" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
              Informar câmbio
            </LinkCentral>
          </Nota>
        )}
        {estimadosNosTotais.length > 0 && <Nota>{textoDosValores(estimadosNosTotais)} {estimadosNosTotais.length === 1 ? 'entra' : 'entram'} nos totais pelo câmbio de referência, como estimativa.</Nota>}
      </div>
      <FormularioDeDespesa aberto={cadastrando} aoFechar={() => setCadastrando(false)} dados={dados} />
      {baixando && <DialogoDeBaixa titulo={baixando} contas={dados.contas} aoFechar={() => setBaixando(null)} />}
      {emLote && (
        <DialogoDeBaixaEmLote
          titulos={selecionadas}
          contas={dados.contas}
          aoFechar={(feito) => {
            setEmLote(false);
            if (feito) setSelecionados(new Set());
          }}
        />
      )}
    </div>
  );
}
