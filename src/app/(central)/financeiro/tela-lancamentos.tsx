'use client';

import { useMemo, useState } from 'react';
import { Archive, ArrowDownLeft, ArrowUpRight, Check, Plus, Receipt } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { FormularioDeDespesa } from '@/componentes/financeiro/formulario-despesa';
import { useCentral } from '@/componentes/layout/central-provider';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Indicador } from '@/componentes/padroes/indicador';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { BotaoExportarCsv, MenuColunas, MenuVisoes, usePreferenciasDaLista } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { SITUACOES_DO_TITULO, type Titulo } from '@/dados/tipos/titulo';
import { useConsulta } from '@/dados/use-consulta';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { tintaDaCor } from '@/dominio/cores';
import { ABAS_DE_LANCAMENTOS, carregarLancamentos, contadoresDosLancamentos, filtrarTitulos, FILTROS_LANCAMENTOS_INICIAIS, periodoDosTotais, totaisDosLancamentos, type DadosDosLancamentos, type FiltrosLancamentos, type IdDaAbaDeLancamentos, type LinhaDoTitulo } from '@/dominio/lancamentos';
import { salvarColunas } from '@/dominio/preferencias-lista';
import { ROTULOS_ORIGEM_TITULO, ROTULOS_SITUACAO_TITULO, rotuloDaCompetencia } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';

const LISTA = 'lancamentos';
const COLUNAS_PADRAO = ['descricao', 'contexto', 'vencimento', 'valor', 'saldo', 'situacao'];

const TIPOS_DA_SITUACAO: Readonly<Record<Titulo['situacao'], TipoSituacao>> = { previsto: 'info', aberto: 'atencao', parcial: 'atencao', quitado: 'sucesso', cancelado: 'neutro' };

export function SituacaoDoTitulo({ titulo }: { titulo: Pick<LinhaDoTitulo, 'situacao' | 'vencido'> }) {
  if (titulo.vencido) return <EtiquetaSituacao tipo="erro">Vencido</EtiquetaSituacao>;
  return <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO[titulo.situacao]}>{ROTULOS_SITUACAO_TITULO[titulo.situacao]}</EtiquetaSituacao>;
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

function Totais({ linhas, dados, filtros, hoje }: { linhas: readonly LinhaDoTitulo[]; dados: DadosDosLancamentos; filtros: FiltrosLancamentos; hoje: string }) {
  const periodo = periodoDosTotais(filtros, hoje);
  const totais = totaisDosLancamentos(linhas, dados.cambios, periodo);
  const nota = [totais.estimado ? 'Moeda estrangeira: estimado' : '', totais.naoIncluidos ? `${totais.naoIncluidos === 1 ? '1 sem câmbio, não incluído' : `${totais.naoIncluidos} sem câmbio, não incluídos`}` : ''].filter(Boolean).join(' · ');
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-label="Totais dos lançamentos">
      <Indicador titulo="Em aberto a pagar" valor={formatarDinheiro(totais.emAbertoPagar, 'BRL')} contexto={nota || undefined} className="max-md:col-span-2" />
      <Indicador titulo="Vencido" valor={formatarDinheiro(totais.vencido, 'BRL')} />
      <Indicador titulo={periodo.doMes ? 'Pago no mês' : 'Pago no período'} valor={formatarDinheiro(totais.pagoNoPeriodo, 'BRL')} />
    </section>
  );
}

/** T05.01 (P1): todo dinheiro que sai da Numa, de quem é cada custo, e o que está em aberto. */
export function TelaLancamentos() {
  const { pessoa, contexto } = useCentral();
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarLancamentos(hoje), [hoje]);
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
  const contadores = useMemo(() => (dados ? contadoresDosLancamentos(dados.titulos, filtros, opcoes) : null), [dados, filtros, opcoes]);

  const colunas = useMemo<readonly Coluna<LinhaDoTitulo>[]>(() => {
    if (!dados) return [];
    const nomeDaCategoria = (id: string) => dados.categorias.find((categoria) => categoria.id === id)?.nome ?? 'Categoria removida';
    const nomeDaPessoa = (id: string) => dados.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
    return [
      {
        id: 'descricao',
        titulo: 'Título',
        fixa: true,
        essencial: true,
        ordenar: (a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'),
        texto: (titulo) => `${titulo.codigo} ${titulo.descricao}`,
        celula: (titulo) => (
          <span className="flex min-w-52 items-start gap-2">
            {titulo.natureza === 'pagar' ? <ArrowUpRight aria-label="A pagar" className="mt-0.5 size-4 shrink-0 text-ink-soft" /> : <ArrowDownLeft aria-label="A receber" className="mt-0.5 size-4 shrink-0 text-ink-soft" />}
            <span className="grid gap-0.5">
              <span className="font-medium break-words">{titulo.descricao}</span>
              <span className="text-xs text-ink-soft tabular-nums">
                {titulo.codigo}
                {nomeDoFavorecido(titulo, dados) ? ` · ${nomeDoFavorecido(titulo, dados)}` : ''}
              </span>
            </span>
          </span>
        ),
      },
      { id: 'contraparte', titulo: 'Contraparte', texto: (titulo) => nomeDoFavorecido(titulo, dados), celula: (titulo) => nomeDoFavorecido(titulo, dados) || '—' },
      { id: 'categoria', titulo: 'Categoria', ordenar: (a, b) => nomeDaCategoria(a.categoria_id).localeCompare(nomeDaCategoria(b.categoria_id), 'pt-BR'), texto: (titulo) => nomeDaCategoria(titulo.categoria_id), celula: (titulo) => nomeDaCategoria(titulo.categoria_id) },
      {
        id: 'contexto',
        titulo: 'Contexto',
        texto: (titulo) => contextosDoTitulo(titulo, dados).map((item) => item.nome).join(', '),
        celula: (titulo) => {
          const itens = contextosDoTitulo(titulo, dados);
          if (itens.length > 1) return <span className="whitespace-nowrap text-ink-soft">Rateado: {itens.length}</span>;
          return itens[0] ? <EtiquetaContexto contexto={itens[0]} /> : '—';
        },
      },
      { id: 'competencia', titulo: 'Competência', ordenar: (a, b) => a.competencia.localeCompare(b.competencia), texto: (titulo) => rotuloDaCompetencia(titulo.competencia), celula: (titulo) => <span className="whitespace-nowrap">{rotuloDaCompetencia(titulo.competencia)}</span> },
      { id: 'vencimento', titulo: 'Vencimento', essencial: true, ordenar: (a, b) => a.vencimento.localeCompare(b.vencimento), texto: (titulo) => formatarDiaISO(titulo.vencimento), celula: (titulo) => <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(titulo.vencimento)}</span> },
      { id: 'valor', titulo: 'Valor', numerica: true, essencial: true, ordenar: (a, b) => a.valor - b.valor, texto: (titulo) => formatarDinheiro(titulo.valor, titulo.moeda), celula: (titulo) => <span className="whitespace-nowrap">{formatarDinheiro(titulo.valor, titulo.moeda)}</span> },
      { id: 'saldo', titulo: 'Saldo', numerica: true, essencial: true, ordenar: (a, b) => a.saldo - b.saldo, texto: (titulo) => formatarDinheiro(titulo.saldo, titulo.moeda), celula: (titulo) => <span className="whitespace-nowrap">{titulo.saldo > 0 ? formatarDinheiro(titulo.saldo, titulo.moeda) : '—'}</span> },
      { id: 'situacao', titulo: 'Situação', essencial: true, texto: (titulo) => (titulo.vencido ? 'Vencido' : ROTULOS_SITUACAO_TITULO[titulo.situacao]), celula: (titulo) => <SituacaoDoTitulo titulo={titulo} /> },
      { id: 'origem', titulo: 'Origem', texto: (titulo) => ROTULOS_ORIGEM_TITULO[titulo.origem], celula: (titulo) => ROTULOS_ORIGEM_TITULO[titulo.origem] },
      {
        id: 'comprovante',
        titulo: 'Comprovante',
        texto: (titulo) => (titulo.baixas.some((baixa) => baixa.comprovante_url) ? 'Sim' : ''),
        celula: (titulo) => (titulo.baixas.some((baixa) => baixa.comprovante_url) ? <Check aria-label="Com comprovante" className="size-4 text-ok" /> : '—'),
      },
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

  const arquivados = dados.titulos.filter((titulo) => titulo.arquivado_em).length;
  const mudar = (parcial: Partial<FiltrosLancamentos>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_LANCAMENTOS_INICIAIS, aba: atuais.aba, arquivados: atuais.arquivados }));
  const nomeDoContexto = (id: string) => (id === ID_INSTITUCIONAL ? 'Numa' : (dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));
  const nomeDaCategoria = (id: string) => dados.categorias.find((categoria) => categoria.id === id)?.nome ?? 'Categoria removida';
  const ativos: FiltroAtivo[] = [
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_TITULO[filtros.situacao as Titulo['situacao']]}` }] : []),
    ...(filtros.vencimentoDe ? [{ id: 'vencimentoDe', rotulo: `Vence a partir de ${formatarDiaISO(filtros.vencimentoDe)}` }] : []),
    ...(filtros.vencimentoAte ? [{ id: 'vencimentoAte', rotulo: `Vence até ${formatarDiaISO(filtros.vencimentoAte)}` }] : []),
    ...(filtros.competencia ? [{ id: 'competencia', rotulo: `Competência: ${rotuloDaCompetencia(`${filtros.competencia}-01`)}` }] : []),
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${nomeDoContexto(filtros.contexto)}` }] : []),
    ...(filtros.categoria ? [{ id: 'categoria', rotulo: `Categoria: ${nomeDaCategoria(filtros.categoria)}` }] : []),
    ...(filtros.contraparte ? [{ id: 'contraparte', rotulo: `Contraparte: ${nomeDaContraparte(dados.contrapartes.find((item) => item.id === filtros.contraparte) as (typeof dados.contrapartes)[number])}` }] : []),
    ...(filtros.conta ? [{ id: 'conta', rotulo: `Conta: ${dados.contas.find((conta) => conta.id === filtros.conta)?.nome ?? ''}` }] : []),
    ...(filtros.origem ? [{ id: 'origem', rotulo: `Origem: ${ROTULOS_ORIGEM_TITULO[filtros.origem as Titulo['origem']]}` }] : []),
    ...(filtros.moeda ? [{ id: 'moeda', rotulo: `Moeda: ${filtros.moeda}` }] : []),
  ];
  const { arquivados: _semArquivados, aba: _semAba, ...filtrosDaVisao } = filtros;
  const moedas = [...new Set(dados.titulos.map((titulo) => titulo.moeda))].sort();
  const categorias = dados.categorias.filter((categoria) => categoria.pai_id && categoria.tipo === 'despesa' && !categoria.arquivado_em);
  const contrapartesUsadas = dados.contrapartes.filter((item) => dados.titulos.some((titulo) => titulo.contraparte_id === item.id));

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Financeiro"
        titulo="Lançamentos"
        resumo="Todo dinheiro que sai da Numa: de quem é cada custo, quem pagou e o que ainda está em aberto."
        acoes={
          <Button onClick={() => setCadastrando(true)}>
            <Plus aria-hidden />
            Nova despesa
          </Button>
        }
      />
      <AbasFinanceiro ativa="lancamentos" />
      <Totais linhas={linhas} dados={dados} filtros={filtros} hoje={hoje} />
      <BarraFiltros
        busca={filtros.busca}
        aoBuscar={(busca) => mudar({ busca })}
        rotuloBusca="Buscar por código, descrição ou contraparte"
        rapidos={[...ABAS_DE_LANCAMENTOS.map(({ id, rotulo }) => ({ id, rotulo, contador: contadores?.[id] || undefined })), { id: 'receber', rotulo: 'A receber', emBreve: true }]}
        rapidoAtivo={filtros.aba}
        aoEscolherRapido={(aba) => mudar({ aba: aba as IdDaAbaDeLancamentos })}
        ativos={ativos}
        aoRemoverAtivo={(id) => mudar({ [id]: '' })}
        aoLimpar={limpar}
        filtrosDetalhados={
          <div className="grid gap-4 px-1 pb-2 md:px-3">
            <Campo rotulo="Situação" id="filtro-situacao">
              {(controle) => (
                <Selecao {...controle} value={filtros.situacao} onChange={(evento) => mudar({ situacao: evento.target.value })}>
                  <option value="">Todas</option>
                  {SITUACOES_DO_TITULO.map((valor) => (
                    <option key={valor} value={valor}>
                      {ROTULOS_SITUACAO_TITULO[valor]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Vence de" id="filtro-vencimento-de">
                {(controle) => <Input type="date" {...controle} value={filtros.vencimentoDe} onChange={(evento) => mudar({ vencimentoDe: evento.target.value })} />}
              </Campo>
              <Campo rotulo="até" id="filtro-vencimento-ate">
                {(controle) => <Input type="date" {...controle} value={filtros.vencimentoAte} onChange={(evento) => mudar({ vencimentoAte: evento.target.value })} />}
              </Campo>
            </div>
            <Campo rotulo="Competência" id="filtro-competencia">
              {(controle) => <Input type="month" {...controle} value={filtros.competencia} onChange={(evento) => mudar({ competencia: evento.target.value })} />}
            </Campo>
            <Campo rotulo="Contexto" id="filtro-contexto">
              {(controle) => (
                <Selecao {...controle} value={filtros.contexto} onChange={(evento) => mudar({ contexto: evento.target.value })}>
                  <option value="">Todos</option>
                  <option value={ID_INSTITUCIONAL}>Numa</option>
                  {dados.produtos
                    .filter((produto) => !produto.arquivado_em)
                    .map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome}
                      </option>
                    ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Categoria" id="filtro-categoria">
              {(controle) => (
                <Selecao {...controle} value={filtros.categoria} onChange={(evento) => mudar({ categoria: evento.target.value })}>
                  <option value="">Todas</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Contraparte" id="filtro-contraparte">
              {(controle) => (
                <Selecao {...controle} value={filtros.contraparte} onChange={(evento) => mudar({ contraparte: evento.target.value })}>
                  <option value="">Todas</option>
                  {contrapartesUsadas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {nomeDaContraparte(item)}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Conta da baixa" id="filtro-conta">
              {(controle) => (
                <Selecao {...controle} value={filtros.conta} onChange={(evento) => mudar({ conta: evento.target.value })}>
                  <option value="">Todas</option>
                  {dados.contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Origem" id="filtro-origem">
              {(controle) => (
                <Selecao {...controle} value={filtros.origem} onChange={(evento) => mudar({ origem: evento.target.value })}>
                  <option value="">Todas</option>
                  {(['manual', 'assinatura', 'reembolso'] as const).map((valor) => (
                    <option key={valor} value={valor}>
                      {ROTULOS_ORIGEM_TITULO[valor]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Moeda" id="filtro-moeda">
              {(controle) => (
                <Selecao {...controle} value={filtros.moeda} onChange={(evento) => mudar({ moeda: evento.target.value })}>
                  <option value="">Todas</option>
                  {moedas.map((moeda) => (
                    <option key={moeda} value={moeda}>
                      {moeda}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
        }
        acoes={
          <>
            <MenuVisoes
              pessoaId={pessoa.id}
              lista={LISTA}
              visoes={visoes}
              filtros={filtrosDaVisao}
              colunas={colunasVisiveis}
              aoAplicar={(visao) => {
                setFiltros((atuais) => ({ ...FILTROS_LANCAMENTOS_INICIAIS, ...(visao.filtros as Partial<FiltrosLancamentos>), aba: atuais.aba, arquivados: atuais.arquivados }));
                salvarColunas(pessoa.id, LISTA, visao.colunas);
              }}
            />
            <MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />
            <BotaoExportarCsv nomeDoArquivo="lancamentos" colunas={visiveis} linhas={linhas} />
            {arquivados > 0 && (
              <Button variante="terciario" aria-pressed={filtros.arquivados} onClick={() => mudar({ arquivados: !filtros.arquivados })}>
                <Archive aria-hidden />
                {filtros.arquivados ? 'Voltar aos lançamentos' : `Arquivados (${arquivados})`}
              </Button>
            )}
          </>
        }
      />
      <Lista
        rotulo="Lançamentos"
        linhas={linhas}
        colunas={visiveis}
        chave={(titulo) => titulo.id}
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim()) || filtros.arquivados || filtros.aba !== 'todos' || contexto.id !== 'consolidada'}
        aoLimparFiltros={() => setFiltros((atuais) => ({ ...FILTROS_LANCAMENTOS_INICIAIS, arquivados: atuais.arquivados }))}
        vazio={<EstadoVazio icone={Receipt} titulo="Nenhum lançamento ainda." texto="Que tal lançar a primeira despesa?" acao={<Button onClick={() => setCadastrando(true)}>Nova despesa</Button>} />}
        cartao={(titulo) => {
          const itens = contextosDoTitulo(titulo, dados);
          return (
            <span className="grid gap-1.5">
              <span className="font-semibold break-words">{titulo.descricao}</span>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <SituacaoDoTitulo titulo={titulo} />
                <span className="font-semibold tabular-nums">{formatarDinheiro(titulo.valor, titulo.moeda)}</span>
              </span>
              <span className="text-[13px] text-ink-soft">
                Vence em {formatarDiaISO(titulo.vencimento)}
                {titulo.saldo > 0 && titulo.saldo < titulo.valor ? ` · Saldo ${formatarDinheiro(titulo.saldo, titulo.moeda)}` : ''}
              </span>
              <span className="flex flex-wrap gap-1">
                {itens.length > 1 ? <span className="text-[13px] text-ink-soft">Rateado: {itens.length}</span> : itens[0] ? <EtiquetaContexto contexto={itens[0]} /> : null}
              </span>
            </span>
          );
        }}
      />
      <p className="text-xs text-ink-soft">{formatarNumero(linhas.length)} de {formatarNumero(dados.titulos.filter((titulo) => !titulo.arquivado_em).length)} lançamentos.</p>
      <FormularioDeDespesa aberto={cadastrando} aoFechar={() => setCadastrando(false)} dados={dados} />
    </div>
  );
}
