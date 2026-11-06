'use client';

import { useMemo, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ChartLine, CreditCard, Database, GitBranch, Globe, HardDrive, Mail, MessageCircle, Palette, Plus, Scale, Server, Share2, Sparkles, Store, Wrench } from 'lucide-react';
import { FormularioDeFerramenta } from '@/componentes/ferramentas/formulario-ferramenta';
import { CAMINHO_DE_FERRAMENTAS } from '@/componentes/ferramentas/nova-ferramenta';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Indicador } from '@/componentes/padroes/indicador';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { BotaoExportarCsv, MenuColunas, MenuVisoes, usePreferenciasDaLista } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/componentes/ui/dialog';
import { mensagemDoErro } from '@/dados/erros';
import type { Ferramenta } from '@/dados/tipos/ferramenta';
import { useConsulta } from '@/dados/use-consulta';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { tintaDaCor } from '@/dominio/cores';
import { carregarFerramentas, filtrarFerramentas, FILTROS_FERRAMENTAS_INICIAIS, indicadoresDeFerramentas, mudarResponsavelTecnica, ROTULOS_MODALIDADE, ROTULOS_PERIODICIDADE, ROTULOS_RENOVACAO, ROTULOS_SITUACAO_FERRAMENTA, ROTULOS_TITULAR, vincularFerramentasAProduto, type DadosDasFerramentas, type FiltrosFerramentas, type LinhaDaFerramenta } from '@/dominio/ferramentas';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { salvarColunas } from '@/dominio/preferencias-lista';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';

const LISTA = 'ferramentas';
/** O que cabe em 1440 sem rolagem. A modalidade já aparece no valor ("Gratuita", "depois do teste"). */
const COLUNAS_PADRAO = ['nome', 'contexto', 'situacao', 'valor', 'proxima', 'responsavel'];

const TIPOS_DA_SITUACAO: Readonly<Record<Ferramenta['situacao'], TipoSituacao>> = { avaliacao: 'info', teste: 'atencao', teste_expirado: 'erro', ativa: 'sucesso', cancelada: 'neutro' };
const ICONES_DA_CATEGORIA: Readonly<Record<string, ComponentType<{ 'aria-hidden'?: boolean; className?: string }>>> = {
  'Hospedagem e nuvem': Server,
  'Banco de dados': Database,
  'Domínio e DNS': Globe,
  'E-mail e produtividade': Mail,
  'Armazenamento (Drive)': HardDrive,
  'Repositório e CI': GitBranch,
  'Lojas de aplicativos': Store,
  Design: Palette,
  IA: Sparkles,
  Comunicação: MessageCircle,
  'Redes sociais': Share2,
  Analytics: ChartLine,
  Pagamentos: CreditCard,
  'Jurídico/contábil': Scale,
};

export function EtiquetaCritica() {
  return <span className="inline-flex min-h-6 items-center rounded-pill bg-err-wash px-2.5 text-xs font-semibold text-err">Crítica</span>;
}

export function SituacaoDaFerramenta({ situacao }: { situacao: Ferramenta['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO[situacao]}>{ROTULOS_SITUACAO_FERRAMENTA[situacao]}</EtiquetaSituacao>;
}

export function contextosDaFerramenta(ferramenta: Pick<LinhaDaFerramenta, 'contextos'>, dados: Pick<DadosDasFerramentas, 'produtos' | 'marcas'>) {
  return ferramenta.contextos.flatMap((ligacao) => {
    if (!ligacao.produto_id) {
      const institucional = dados.marcas.find((marca) => marca.institucional);
      return institucional ? [{ id: ID_INSTITUCIONAL, nome: 'Numa', cor: institucional.cor_hex, tinta: tintaDaCor(institucional.cor_hex) }] : [];
    }
    const produto = dados.produtos.find((item) => item.id === ligacao.produto_id);
    const marca = dados.marcas.find((item) => item.id === produto?.marca_id);
    return produto && marca ? [{ id: produto.id, nome: produto.nome, cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }] : [];
  });
}

function partesDoValor({ assinatura }: Pick<LinhaDaFerramenta, 'assinatura'>): { valor: string; detalhe?: string } {
  if (!assinatura) return { valor: 'A definir' };
  if (assinatura.modalidade === 'gratuita') return { valor: 'Gratuita' };
  if (assinatura.modalidade === 'teste') return assinatura.valor_apos_teste !== null ? { valor: formatarDinheiro(assinatura.valor_apos_teste, assinatura.moeda), detalhe: 'depois do teste' } : { valor: 'Em teste' };
  return { valor: assinatura.valor === null ? 'A confirmar' : formatarDinheiro(assinatura.valor, assinatura.moeda), detalhe: assinatura.periodicidade ? ROTULOS_PERIODICIDADE[assinatura.periodicidade] : undefined };
}

export function textoDoValor(ferramenta: Pick<LinhaDaFerramenta, 'assinatura'>): string {
  const { valor, detalhe } = partesDoValor(ferramenta);
  return detalhe ? `${valor} · ${detalhe}` : valor;
}

function ValorDaFerramenta({ ferramenta }: { ferramenta: Pick<LinhaDaFerramenta, 'assinatura'> }) {
  const { valor, detalhe } = partesDoValor(ferramenta);
  return (
    <span className="grid whitespace-nowrap tabular-nums">
      <span>{valor}</span>
      {detalhe && <span className="text-xs text-ink-soft">{detalhe}</span>}
    </span>
  );
}

export const textoDoTitular = (ferramenta: Pick<Ferramenta, 'titular_atual_tipo' | 'titular_atual_pessoa_id' | 'titular_atual_texto'>, pessoas: DadosDasFerramentas['pessoas']) => {
  if (ferramenta.titular_atual_tipo === 'pessoa_fisica') return `Pessoa física — ${pessoas.find((pessoa) => pessoa.id === ferramenta.titular_atual_pessoa_id)?.nome_completo ?? 'pessoa removida'}`;
  if (ferramenta.titular_atual_tipo === 'terceiro') return `Terceiro — ${ferramenta.titular_atual_texto ?? ''}`;
  return ROTULOS_TITULAR.numa;
};

function Indicadores({ ferramentas, hoje, contextoId }: { ferramentas: readonly LinhaDaFerramenta[]; hoje: string; contextoId: string }) {
  const valores = indicadoresDeFerramentas(ferramentas, hoje, contextoId);
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5" aria-label="Resumo das ferramentas">
      <Indicador titulo="Ativas" valor={formatarNumero(valores.ativas)} />
      <Indicador titulo="Pagas" valor={formatarNumero(valores.pagas)} />
      <Indicador titulo="Em teste" valor={formatarNumero(valores.emTeste)} />
      {/* No celular, o custo fica por último, na linha inteira: é o único com texto embaixo. */}
      <Indicador titulo="Custo mensal estimado" valor={formatarDinheiro(valores.custoMensal, 'BRL')} contexto={valores.naoIncluidas ? `${valores.naoIncluidas === 1 ? '1 não incluída' : `${valores.naoIncluidas} não incluídas`} no total` : 'Em reais, pelo câmbio de referência'} className="max-md:order-last max-md:col-span-2" />
      <Indicador titulo="Renovações em 30 dias" valor={formatarNumero(valores.renovacoes30)} />
    </section>
  );
}

/** Ações em lote (T04.01): vincular a produto e mudar a responsável técnica. */
function DialogoDeLote({ acao, ids, dados, aoFechar }: { acao: 'produto' | 'responsavel'; ids: readonly string[]; dados: DadosDasFerramentas; aoFechar: (feito: boolean) => void }) {
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo');
  const pessoas = pessoasDoSeletor(dados.pessoas);
  const quantas = ids.length === 1 ? '1 ferramenta' : `${ids.length} ferramentas`;

  async function confirmar() {
    if (!valor) return setErro(acao === 'produto' ? 'Escolha o produto.' : 'Escolha a pessoa.');
    try {
      if (acao === 'produto') await vincularFerramentasAProduto(ids, valor);
      else await mudarResponsavelTecnica(ids, valor);
      aviso(acao === 'produto' ? `${quantas} vinculada${ids.length === 1 ? '' : 's'}.` : `${quantas} com nova responsável.`);
      aoFechar(true);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent semFechar>
        <DialogTitle>{acao === 'produto' ? `Vincular ${quantas} a um produto` : `Mudar a responsável de ${quantas}`}</DialogTitle>
        <div className="mt-4">
          <Campo id="lote-valor" rotulo={acao === 'produto' ? 'Produto' : 'Responsável técnica'} obrigatorio erro={erro ?? undefined}>
            {(controle) => (
              <Selecao {...controle} value={valor} onChange={(evento) => setValor(evento.target.value)}>
                <option value="">Escolha</option>
                {acao === 'produto' && <option value={ID_INSTITUCIONAL}>Numa</option>}
                {(acao === 'produto' ? produtos.map((item) => ({ id: item.id, nome: item.nome })) : pessoas.map((item) => ({ id: item.id, nome: item.nome_completo }))).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        {acao === 'produto' && <p className="mt-2 text-xs text-ink-soft">Quem tinha rateio volta a ficar sem percentuais, porque a soma muda (RN-04.05).</p>}
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={() => aoFechar(false)}>
            Voltar
          </Button>
          <Button onClick={() => void confirmar()}>{acao === 'produto' ? 'Vincular' : 'Mudar responsável'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** T04.01 (P1): o que a Numa usa, quanto custa e em nome de quem está. */
export function TelaFerramentas() {
  const roteador = useRouter();
  const { pessoa, contexto } = useCentral();
  const consulta = useConsulta(carregarFerramentas);
  const [filtros, setFiltros] = useState<FiltrosFerramentas>(FILTROS_FERRAMENTAS_INICIAIS);
  const [cadastrando, setCadastrando] = useState(false);
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(new Set());
  const [lote, setLote] = useState<'produto' | 'responsavel' | null>(null);
  const { colunasVisiveis, visoes } = usePreferenciasDaLista(pessoa.id, LISTA, COLUNAS_PADRAO);
  const dados = consulta.dados;
  const hoje = hojeISO();

  const nomeDaCategoria = (id: string) => dados?.categorias.find((categoria) => categoria.id === id)?.nome ?? 'Categoria removida';
  const nomeDaPessoa = (id: string) => dados?.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
  const linhas = useMemo(() => (dados ? filtrarFerramentas(dados.ferramentas, filtros, { contextoGlobalId: contexto.id, hoje, nomeDaCategoria }) : []), [dados, filtros, contexto.id, hoje]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaCategoria só depende de dados

  const colunas = useMemo<readonly Coluna<LinhaDaFerramenta>[]>(() => {
    if (!dados) return [];
    return [
      {
        id: 'nome',
        titulo: 'Ferramenta',
        fixa: true,
        essencial: true,
        ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
        texto: (ferramenta) => ferramenta.nome,
        celula: (ferramenta) => {
          const Icone = ICONES_DA_CATEGORIA[nomeDaCategoria(ferramenta.categoria_id)] ?? Wrench;
          return (
            <span className="flex min-w-44 items-start gap-2">
              <Icone aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-soft" />
              <span className="grid gap-0.5">
                <span className="font-medium break-words">
                  {ferramenta.nome}
                  {ferramenta.critica && (
                    <span title="Crítica" className="ml-1.5 inline-block size-2 rounded-full bg-err align-middle">
                      <span className="sr-only">Crítica</span>
                    </span>
                  )}
                </span>
                <span className="text-xs text-ink-soft tabular-nums">{ferramenta.codigo}</span>
              </span>
            </span>
          );
        },
      },
      { id: 'categoria', titulo: 'Categoria', ordenar: (a, b) => nomeDaCategoria(a.categoria_id).localeCompare(nomeDaCategoria(b.categoria_id), 'pt-BR'), texto: (ferramenta) => nomeDaCategoria(ferramenta.categoria_id), celula: (ferramenta) => nomeDaCategoria(ferramenta.categoria_id) },
      {
        id: 'contexto',
        titulo: 'Produtos',
        texto: (ferramenta) => contextosDaFerramenta(ferramenta, dados).map((item) => item.nome).join(', '),
        celula: (ferramenta) => (
          <span className="flex flex-wrap gap-1">
            {contextosDaFerramenta(ferramenta, dados).map((item) => (
              <EtiquetaContexto key={item.id} contexto={item} />
            ))}
          </span>
        ),
      },
      { id: 'situacao', titulo: 'Situação', essencial: true, texto: (ferramenta) => ROTULOS_SITUACAO_FERRAMENTA[ferramenta.situacao], celula: (ferramenta) => <SituacaoDaFerramenta situacao={ferramenta.situacao} /> },
      {
        id: 'critica',
        titulo: 'Crítica',
        texto: (ferramenta) => (ferramenta.critica ? 'Sim' : 'Não'),
        celula: (ferramenta) => (ferramenta.critica ? <span aria-label="Sim" role="img" className="inline-block size-2 rounded-full bg-err" /> : <span className="sr-only">Não</span>),
      },
      { id: 'modalidade', titulo: 'Modalidade', texto: (ferramenta) => (ferramenta.assinatura ? ROTULOS_MODALIDADE[ferramenta.assinatura.modalidade] : 'A definir'), celula: (ferramenta) => (ferramenta.assinatura ? ROTULOS_MODALIDADE[ferramenta.assinatura.modalidade] : 'A definir') },
      { id: 'valor', titulo: 'Valor', texto: textoDoValor, celula: (ferramenta) => <ValorDaFerramenta ferramenta={ferramenta} /> },
      {
        id: 'equivalente',
        titulo: 'Mensal em reais (estimado)',
        numerica: true,
        ordenar: (a, b) => (a.equivalenteMensal ?? -1) - (b.equivalenteMensal ?? -1),
        texto: (ferramenta) => (ferramenta.equivalenteMensal === null ? '' : formatarDinheiro(ferramenta.equivalenteMensal, 'BRL')),
        celula: (ferramenta) => (ferramenta.equivalenteMensal === null ? '—' : formatarDinheiro(ferramenta.equivalenteMensal, 'BRL')),
      },
      {
        id: 'proxima',
        titulo: 'Próxima cobrança',
        essencial: true,
        ordenar: (a, b) => (a.assinatura?.proxima_cobranca ?? '9999').localeCompare(b.assinatura?.proxima_cobranca ?? '9999'),
        texto: (ferramenta) => (ferramenta.assinatura?.proxima_cobranca ? formatarDiaISO(ferramenta.assinatura.proxima_cobranca) : ''),
        celula: (ferramenta) => <span className="whitespace-nowrap tabular-nums">{ferramenta.assinatura?.proxima_cobranca ? formatarDiaISO(ferramenta.assinatura.proxima_cobranca) : '—'}</span>,
      },
      { id: 'renovacao', titulo: 'Renovação', texto: (ferramenta) => (ferramenta.assinatura?.renovacao ? ROTULOS_RENOVACAO[ferramenta.assinatura.renovacao] : ''), celula: (ferramenta) => (ferramenta.assinatura?.renovacao ? ROTULOS_RENOVACAO[ferramenta.assinatura.renovacao] : '—') },
      { id: 'titular', titulo: 'Titular atual', texto: (ferramenta) => textoDoTitular(ferramenta, dados.pessoas), celula: (ferramenta) => <span className="block max-w-52 break-words">{textoDoTitular(ferramenta, dados.pessoas)}</span> },
      { id: 'responsavel', titulo: 'Responsável técnica', ordenar: (a, b) => nomeDaPessoa(a.responsavel_tecnico_id).localeCompare(nomeDaPessoa(b.responsavel_tecnico_id), 'pt-BR'), texto: (ferramenta) => nomeDaPessoa(ferramenta.responsavel_tecnico_id), celula: (ferramenta) => <NomeDaPessoa nome={nomeDaPessoa(ferramenta.responsavel_tecnico_id)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
    ];
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps -- os nomes só dependem de dados

  const visiveis = useMemo(() => colunas.filter((coluna) => coluna.fixa || colunasVisiveis.includes(coluna.id)), [colunas, colunasVisiveis]);

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Ferramentas</h1>
        <EstadoErro titulo="Não deu para ler as ferramentas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  // Os indicadores seguem o contexto escolhido no topo, e não os filtros da tela.
  const doContexto = filtrarFerramentas(dados.ferramentas, FILTROS_FERRAMENTAS_INICIAIS, { contextoGlobalId: contexto.id, hoje, nomeDaCategoria });
  const arquivadas = dados.ferramentas.filter((ferramenta) => ferramenta.arquivado_em).length;
  const mudar = (parcial: Partial<FiltrosFerramentas>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_FERRAMENTAS_INICIAIS, arquivadas: atuais.arquivadas }));
  const nomeDoContexto = (id: string) => (id === ID_INSTITUCIONAL ? 'Numa' : (dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));
  const ativos: FiltroAtivo[] = [
    ...(filtros.categoria ? [{ id: 'categoria', rotulo: `Categoria: ${nomeDaCategoria(filtros.categoria)}` }] : []),
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${nomeDoContexto(filtros.contexto)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_FERRAMENTA[filtros.situacao as Ferramenta['situacao']]}` }] : []),
    ...(filtros.modalidade ? [{ id: 'modalidade', rotulo: `Modalidade: ${filtros.modalidade === 'a_definir' ? 'A definir' : ROTULOS_MODALIDADE[filtros.modalidade as keyof typeof ROTULOS_MODALIDADE]}` }] : []),
    ...(filtros.critica ? [{ id: 'critica', rotulo: filtros.critica === 'sim' ? 'Críticas' : 'Não críticas' }] : []),
    ...(filtros.titular ? [{ id: 'titular', rotulo: `Titular: ${ROTULOS_TITULAR[filtros.titular as keyof typeof ROTULOS_TITULAR]}` }] : []),
    ...(filtros.dados ? [{ id: 'dados', rotulo: filtros.dados === 'sim' ? 'Trata dados pessoais' : 'Não trata dados pessoais' }] : []),
    ...(filtros.venceEm ? [{ id: 'venceEm', rotulo: `Vence em ${filtros.venceEm} dias` }] : []),
  ];
  const { arquivadas: _semArquivadas, ...filtrosDaVisao } = filtros;
  const selecionadas = linhas.filter((linha) => selecionados.has(linha.id));

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Ferramentas e ativos"
        titulo="Ferramentas"
        resumo={`${formatarNumero(doContexto.length)} ${doContexto.length === 1 ? 'ferramenta' : 'ferramentas'}: o que a Numa usa, quanto custa e em nome de quem está.`}
        acoes={
          <Button onClick={() => setCadastrando(true)}>
            <Plus aria-hidden />
            Nova ferramenta
          </Button>
        }
      />
      <Indicadores ferramentas={doContexto} hoje={hoje} contextoId={contexto.id} />
      <BarraFiltros
        busca={filtros.busca}
        aoBuscar={(busca) => mudar({ busca })}
        rotuloBusca="Buscar por nome, código, finalidade ou categoria"
        ativos={ativos}
        aoRemoverAtivo={(id) => mudar({ [id]: '' })}
        aoLimpar={limpar}
        filtrosDetalhados={
          <div className="grid gap-4 px-1 pb-2 md:px-3">
            <Campo rotulo="Categoria" id="filtro-categoria">
              {(controle) => (
                <Selecao {...controle} value={filtros.categoria} onChange={(evento) => mudar({ categoria: evento.target.value })}>
                  <option value="">Todas</option>
                  {dados.categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Produto ou contexto" id="filtro-contexto">
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
            <Campo rotulo="Situação" id="filtro-situacao">
              {(controle) => (
                <Selecao {...controle} value={filtros.situacao} onChange={(evento) => mudar({ situacao: evento.target.value })}>
                  <option value="">Todas</option>
                  {Object.entries(ROTULOS_SITUACAO_FERRAMENTA).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Modalidade" id="filtro-modalidade">
              {(controle) => (
                <Selecao {...controle} value={filtros.modalidade} onChange={(evento) => mudar({ modalidade: evento.target.value })}>
                  <option value="">Todas</option>
                  {Object.entries(ROTULOS_MODALIDADE).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                  <option value="a_definir">A definir</option>
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Crítica" id="filtro-critica">
              {(controle) => (
                <Selecao {...controle} value={filtros.critica} onChange={(evento) => mudar({ critica: evento.target.value as FiltrosFerramentas['critica'] })}>
                  <option value="">Todas</option>
                  <option value="sim">Críticas</option>
                  <option value="nao">Não críticas</option>
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Titular atual" id="filtro-titular">
              {(controle) => (
                <Selecao {...controle} value={filtros.titular} onChange={(evento) => mudar({ titular: evento.target.value })}>
                  <option value="">Todos</option>
                  {Object.entries(ROTULOS_TITULAR).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Trata dados pessoais" id="filtro-dados">
              {(controle) => (
                <Selecao {...controle} value={filtros.dados} onChange={(evento) => mudar({ dados: evento.target.value as FiltrosFerramentas['dados'] })}>
                  <option value="">Todas</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Vence em" id="filtro-vence">
              {(controle) => (
                <Selecao {...controle} value={filtros.venceEm} onChange={(evento) => mudar({ venceEm: evento.target.value as FiltrosFerramentas['venceEm'] })}>
                  <option value="">Qualquer data</option>
                  {['7', '30', '60', '90'].map((dias) => (
                    <option key={dias} value={dias}>
                      {dias} dias
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
                setFiltros((atuais) => ({ ...FILTROS_FERRAMENTAS_INICIAIS, ...(visao.filtros as Partial<FiltrosFerramentas>), arquivadas: atuais.arquivadas }));
                salvarColunas(pessoa.id, LISTA, visao.colunas);
              }}
            />
            <MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />
            <BotaoExportarCsv nomeDoArquivo="ferramentas" colunas={visiveis} linhas={linhas} />
            {arquivadas > 0 && (
              <Button variante="terciario" aria-pressed={filtros.arquivadas} onClick={() => mudar({ arquivadas: !filtros.arquivadas })}>
                <Archive aria-hidden />
                {filtros.arquivadas ? 'Voltar às ativas' : `Arquivadas (${arquivadas})`}
              </Button>
            )}
          </>
        }
      />
      {selecionadas.length > 0 && (
        <div className="hidden flex-wrap items-center gap-2 rounded-lg border border-line bg-mist px-4 py-2 text-[13px] md:flex" role="region" aria-label="Ações em lote">
          <span className="font-semibold">{selecionadas.length === 1 ? '1 selecionada' : `${selecionadas.length} selecionadas`}</span>
          <Button variante="secundario" tamanho="pequeno" onClick={() => setLote('produto')}>
            Vincular a produto
          </Button>
          <Button variante="secundario" tamanho="pequeno" onClick={() => setLote('responsavel')}>
            Mudar responsável
          </Button>
          <Button variante="terciario" tamanho="pequeno" onClick={() => setSelecionados(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}
      <Lista
        rotulo="Ferramentas"
        linhas={linhas}
        colunas={visiveis}
        chave={(ferramenta) => ferramenta.id}
        aoAbrir={(ferramenta) => roteador.push(`${CAMINHO_DE_FERRAMENTAS}/${ferramenta.id}`)}
        selecao={{ selecionados, aoMudar: setSelecionados, rotuloDaLinha: (ferramenta) => ferramenta.nome }}
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim()) || filtros.arquivadas}
        aoLimparFiltros={limpar}
        vazio={<EstadoVazio icone={Wrench} titulo="Nenhuma ferramenta ainda." texto="Que tal cadastrar a primeira?" acao={<Button onClick={() => setCadastrando(true)}>Nova ferramenta</Button>} />}
        cartao={(ferramenta) => (
          <span className="grid gap-1.5">
            <span className="flex items-center gap-1.5 font-semibold break-words">
              {ferramenta.nome}
              {ferramenta.critica && <EtiquetaCritica />}
            </span>
            <span className="flex flex-wrap gap-1">
              {contextosDaFerramenta(ferramenta, dados).map((item) => (
                <EtiquetaContexto key={item.id} contexto={item} />
              ))}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              <SituacaoDaFerramenta situacao={ferramenta.situacao} />
              <span>{textoDoValor(ferramenta)}</span>
            </span>
            {ferramenta.assinatura?.proxima_cobranca && <span className="text-[13px] text-ink-soft">Próxima cobrança: {formatarDiaISO(ferramenta.assinatura.proxima_cobranca)}</span>}
          </span>
        )}
      />
      <FormularioDeFerramenta aberto={cadastrando} aoFechar={() => setCadastrando(false)} dados={dados} />
      {lote && (
        <DialogoDeLote
          acao={lote}
          ids={selecionadas.map((linha) => linha.id)}
          dados={dados}
          aoFechar={(feito) => {
            setLote(null);
            if (feito) setSelecionados(new Set());
          }}
        />
      )}
    </div>
  );
}
