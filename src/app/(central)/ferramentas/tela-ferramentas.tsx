'use client';

import { EtiquetasDoRegistro } from '@/componentes/campos/etiquetas';
import { useMemo, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { ChartLine, CreditCard, Database, GitBranch, Globe, HardDrive, Mail, MessageCircle, Palette, Plus, Scale, Server, Share2, Sparkles, Store, Wrench } from 'lucide-react';
import { AbasFerramentas } from '@/componentes/ferramentas/abas-ferramentas';
import { EtiquetaCritica } from '@/componentes/ferramentas/etiquetas-ferramentas';
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
import { carregarFerramentas, filtrarFerramentas, FILTROS_FERRAMENTAS_INICIAIS, indicadoresDeFerramentas, mudarResponsavelTecnica, ROTULOS_MODALIDADE, ROTULOS_PERIODICIDADE, ROTULOS_RENOVACAO, ROTULOS_SITUACAO_FERRAMENTA, vincularFerramentasAProduto, type DadosDasFerramentas, type FiltrosFerramentas, type LinhaDaFerramenta } from '@/dominio/ferramentas';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { textoDoTitular } from '@/dominio/titularidade';
import { salvarColunas } from '@/dominio/preferencias-lista';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';
import { BarraDeFerramentas } from './filtros-ferramentas';

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

function Indicadores({ ferramentas, hoje, contextoId }: { ferramentas: readonly LinhaDaFerramenta[]; hoje: string; contextoId: string }) {
  const valores = indicadoresDeFerramentas(ferramentas, hoje, contextoId);
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5" aria-label="Resumo das ferramentas">
      <Indicador titulo="Ativas" valor={formatarNumero(valores.ativas)} />
      <Indicador titulo="Pagas" valor={formatarNumero(valores.pagas)} />
      <Indicador titulo="Em teste" valor={formatarNumero(valores.emTeste)} />
      {/* No celular, o custo fica por último, na linha inteira: é o único com texto embaixo. */}
      <Indicador titulo="Custo mensal estimado" valor={formatarDinheiro(valores.custoMensal, 'BRL')} contexto={valores.naoIncluidas ? `${valores.naoIncluidas === 1 ? '1 não incluída' : `${valores.naoIncluidas} não incluídas`} no total` : 'Em reais, pelo câmbio de referência'} className="max-md:order-last max-md:col-span-2" />
      {/* Conta próximas cobranças, e não alertas de renovação: a mensal automática não tem alerta de renovação (06-M04 §6). */}
      <Indicador titulo="Cobranças nos próximos 30 dias" valor={formatarNumero(valores.renovacoes30)} />
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
      {
        id: 'etiquetas',
        titulo: 'Etiquetas',
        texto: (ferramenta) => dados.etiquetas.filter((etiqueta) => ferramenta.etiquetas.includes(etiqueta.id)).map((etiqueta) => etiqueta.nome).join(', '),
        celula: (ferramenta) => (ferramenta.etiquetas.length ? <EtiquetasDoRegistro ids={ferramenta.etiquetas} etiquetas={dados.etiquetas} /> : '—'),
      },
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
  const mudar = (parcial: Partial<FiltrosFerramentas>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros({ ...FILTROS_FERRAMENTAS_INICIAIS });
  const { arquivadas: _semArquivadas, ...filtrosDaVisao } = filtros;
  const selecionadas = linhas.filter((linha) => selecionados.has(linha.id));

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        comoUsar="/ajuda/ferramentas"
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
      <AbasFerramentas ativa="ferramentas" />
      <Indicadores ferramentas={doContexto} hoje={hoje} contextoId={contexto.id} />
      <BarraDeFerramentas filtros={filtros} aoMudar={mudar} dados={dados} />
      {/* Utilidades da lista, separadas da criação (P1): visões, colunas e exportar, com a contagem do que está à vista. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Utilidades da lista">
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
        {/* Em cartões, no celular, colunas não fazem sentido. */}
        <div className="hidden md:block">
          <MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />
        </div>
        <BotaoExportarCsv nomeDoArquivo="ferramentas" colunas={visiveis} linhas={linhas} />
        <p className="ml-auto text-[13px] text-ink-soft tabular-nums" aria-live="polite" data-quantas-ferramentas>
          {linhas.length === 1 ? '1 ferramenta' : `${formatarNumero(linhas.length)} ferramentas`}
          {filtros.arquivadas ? ' arquivadas' : ''}
        </p>
      </div>
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
        filtrando={JSON.stringify(filtros) !== JSON.stringify(FILTROS_FERRAMENTAS_INICIAIS)}
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
