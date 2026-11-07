'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckSquare, LayoutGrid, ListOrdered, Package, Plus, Search, SlidersHorizontal, Table2, User } from 'lucide-react';
import { FormularioProduto } from '@/app/(central)/configuracoes/cadastros/marcas/formulario-produto';
import { ChipDaMarca, SituacaoDoProduto } from '@/app/(central)/configuracoes/cadastros/marcas/aparencia';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { EtiquetasDosFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { AbasProdutos, AvisoDeFase, EtiquetaEstagio } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { ESTAGIOS_DO_PRODUTO } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import { textoDoPrazo } from '@/dominio/atividades';
import { CAMINHO_DA_ATIVIDADE } from '@/dominio/atividades-painel';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from '@/dominio/contextos';
import { DEFINICAO_PENDENTE } from '@/dominio/kpis';
import { carregarPortfolio, filtrarPortfolio, FILTROS_PORTFOLIO_INICIAIS, produtosDaFila, SEM_RESPONSAVEL, textoDoCusto, type DadosDoPortfolio, type FiltrosPortfolio, type LinhaDoPortfolio } from '@/dominio/portfolio';
import { pessoasParaProduto, ROTULOS_ESTAGIO, ROTULOS_SITUACAO_PRODUTO } from '@/dominio/produtos';
import { rotuloDaCompetencia } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro, formatarNumero } from '@/lib/formatacao';
import { useEhCelular } from '@/lib/use-eh-celular';
import { FilaDeProdutos } from './fila-produtos';

type Visao = 'cartoes' | 'tabela' | 'fila';

const OPCOES_VISAO = [
  { valor: 'cartoes', rotulo: 'Cartões', icone: LayoutGrid },
  { valor: 'tabela', rotulo: 'Tabela', icone: Table2 },
  { valor: 'fila', rotulo: 'Fila', icone: ListOrdered },
];

const dinheiro = (valor: number) => formatarDinheiro(valor, 'BRL');

function textoDasOfertas(linha: Pick<LinhaDoPortfolio, 'ofertasAprovadas' | 'ofertasEmEstudo'>): string {
  if (!linha.ofertasAprovadas && !linha.ofertasEmEstudo) return 'Nenhuma oferta';
  return `${linha.ofertasAprovadas} aprovada${linha.ofertasAprovadas === 1 ? '' : 's'} · ${linha.ofertasEmEstudo} em estudo`;
}

function textoDosUsuarios(linha: Pick<LinhaDoPortfolio, 'usuariosAtivos' | 'definicao_usuario_ativo'>): string {
  if (linha.usuariosAtivos) return `${formatarNumero(linha.usuariosAtivos.valor)} em ${rotuloDaCompetencia(linha.usuariosAtivos.competencia)}${linha.definicao_usuario_ativo ? '' : ` · ${DEFINICAO_PENDENTE}`}`;
  return linha.definicao_usuario_ativo ? 'Não informado' : DEFINICAO_PENDENTE;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-[13px]">
      <dt className="text-ink-soft">{rotulo}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** T07.01: os dados de cada área vêm da fonte dela. O que ainda não existe aparece como tal, e nunca como zero. */
function CartaoDoProduto({ linha, hoje }: { linha: LinhaDoPortfolio; hoje: string }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-paper p-4 md:p-5">
      <header className="flex items-start gap-3">
        {linha.marca && <ChipDaMarca marca={linha.marca} className="size-11 [&_svg]:size-[22px]" />}
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-6 break-words">
            <LinkCentral href={`/produtos/${linha.id}`} className="inline-flex min-h-11 min-w-11 items-center underline-offset-2 hover:underline md:min-h-0">
              {linha.nome}
            </LinkCentral>
          </h2>
          {linha.marca && linha.marca.nome !== linha.nome && <p className="text-xs text-ink-soft">{linha.marca.nome}</p>}
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-soft">
            <User aria-hidden className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{linha.responsavel ?? 'A definir'}</span>
          </p>
        </div>
      </header>
      <div className="flex flex-wrap gap-1.5">
        <EtiquetaEstagio produto={linha} />
        {linha.situacao !== 'ativo' && <SituacaoDoProduto situacao={linha.situacao} />}
        {linha.marca?.provisorio && <EtiquetaLivre>Nome provisório</EtiquetaLivre>}
      </div>
      <dl className="grid gap-1.5">
        <Linha rotulo="Custo médio">{textoDoCusto(linha.custo, dinheiro)}</Linha>
        <Linha rotulo="Orçamento">Sem orçamento: chega com a T05.08</Linha>
        <Linha rotulo="Ofertas">{textoDasOfertas(linha)}</Linha>
        <Linha rotulo="Usuários ativos">{textoDosUsuarios(linha)}</Linha>
        <Linha rotulo="Legal">Sem dados: chega com o M09</Linha>
      </dl>
      <div className="mt-auto border-t border-line pt-3">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
          <CheckSquare aria-hidden className="size-3.5" />
          Próximas atividades
        </h3>
        {linha.proximasAtividades.length ? (
          <ul className="grid gap-1">
            {linha.proximasAtividades.map((atividade) => {
              const prazo = textoDoPrazo(atividade, hoje);
              return (
                <li key={atividade.id} className="flex items-baseline justify-between gap-2 text-[13px]">
                  <LinkCentral href={CAMINHO_DA_ATIVIDADE(atividade.id)} className="inline-flex min-h-11 min-w-0 items-center break-words underline-offset-2 hover:underline md:min-h-0">
                    {atividade.titulo}
                  </LinkCentral>
                  <span className={`shrink-0 text-xs ${prazo.atrasada ? 'font-semibold text-err' : 'text-ink-soft'}`}>{prazo.texto}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-soft">Nenhuma atividade aberta.</p>
        )}
      </div>
    </article>
  );
}

function CamposDoFiltro({ filtros, mudar, dados, extras }: { filtros: FiltrosPortfolio; mudar: (parcial: Partial<FiltrosPortfolio>) => void; dados: DadosDoPortfolio; extras: 'principais' | 'mais' | 'todos' }) {
  const pessoas = pessoasParaProduto(dados.pessoas);
  return (
    <>
      {extras !== 'mais' && (
        <>
          <Campo id="filtro-estagio" rotulo="Estágio">
            {(controle) => (
              <Selecao {...controle} value={filtros.estagio} onChange={(evento) => mudar({ estagio: evento.target.value })}>
                <option value="">Todos</option>
                {ESTAGIOS_DO_PRODUTO.map((estagio) => (
                  <option key={estagio} value={estagio}>
                    {ROTULOS_ESTAGIO[estagio]}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="filtro-responsavel" rotulo="Responsável">
            {(controle) => (
              <Selecao {...controle} value={filtros.responsavel} onChange={(evento) => mudar({ responsavel: evento.target.value })}>
                <option value="">Todas</option>
                <option value={SEM_RESPONSAVEL}>A definir</option>
                {pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome_completo}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="filtro-situacao" rotulo="Situação">
            {(controle) => (
              <Selecao {...controle} value={filtros.situacao} onChange={(evento) => mudar({ situacao: evento.target.value })}>
                <option value="">Todas</option>
                {Object.entries(ROTULOS_SITUACAO_PRODUTO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </>
      )}
      {extras !== 'principais' && (
        <Campo id="filtro-marca" rotulo="Marca">
          {(controle) => (
            <Selecao {...controle} value={filtros.marca} onChange={(evento) => mudar({ marca: evento.target.value })}>
              <option value="">Todas</option>
              {dados.marcas
                .filter((marca) => !marca.arquivado_em && !marca.institucional)
                .map((marca) => (
                  <option key={marca.id} value={marca.id}>
                    {marca.nome}
                  </option>
                ))}
            </Selecao>
          )}
        </Campo>
      )}
    </>
  );
}

/** T07.01: Cartões, Tabela e Fila sobre os mesmos filtros. A Fila restringe a Ideia e Validação, e diz isso. */
export function TelaPortfolio() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const celular = useEhCelular();
  const { contexto } = useCentral();
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarPortfolio(hoje), [hoje]);
  const inicial = parametros.get('visao');
  const [visao, setVisao] = useState<Visao>(inicial === 'tabela' || inicial === 'fila' ? inicial : 'cartoes');
  const [filtros, setFiltros] = useState<FiltrosPortfolio>(FILTROS_PORTFOLIO_INICIAIS);
  const [cadastrando, setCadastrando] = useState(false);
  const dados = consulta.dados;

  const linhas = useMemo(() => (dados ? filtrarPortfolio(dados.linhas, filtros, contexto.id) : []), [dados, filtros, contexto.id]);
  const colunas = useMemo<readonly Coluna<LinhaDoPortfolio>[]>(
    () => [
      {
        id: 'nome',
        titulo: 'Produto',
        essencial: true,
        ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
        celula: (linha) => (
          <span className="flex min-w-40 items-center gap-2.5">
            {linha.marca && <ChipDaMarca marca={linha.marca} className="size-8 [&_svg]:size-4" />}
            <span className="grid">
              <span className="font-medium">{linha.nome}</span>
              {linha.marca?.provisorio && <span className="text-xs text-ink-soft">Nome provisório</span>}
            </span>
          </span>
        ),
      },
      { id: 'estagio', titulo: 'Estágio', essencial: true, celula: (linha) => <EtiquetaEstagio produto={linha} /> },
      { id: 'responsavel', titulo: 'Responsável', essencial: true, ordenar: (a, b) => (a.responsavel ?? 'zzz').localeCompare(b.responsavel ?? 'zzz', 'pt-BR'), celula: (linha) => linha.responsavel ?? <span className="text-ink-soft">A definir</span> },
      { id: 'custo', titulo: 'Custo médio', celula: (linha) => <span className="whitespace-nowrap tabular-nums">{textoDoCusto(linha.custo, dinheiro)}</span> },
      { id: 'ofertas', titulo: 'Ofertas', essencial: true, celula: (linha) => <span className="whitespace-nowrap">{textoDasOfertas(linha)}</span> },
      { id: 'usuarios', titulo: 'Usuários ativos', celula: (linha) => textoDosUsuarios(linha) },
    ],
    [],
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Portfólio de produtos</h1>
        <EstadoErro titulo="Não deu para ler os produtos." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const mudar = (parcial: Partial<FiltrosPortfolio>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros(FILTROS_PORTFOLIO_INICIAIS);
  const nomeDaPessoa = (id: string) => (id === SEM_RESPONSAVEL ? 'A definir' : (dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida'));
  const ativos: FiltroAtivo[] = [
    ...(filtros.busca.trim() ? [{ id: 'busca', rotulo: `Busca: ${filtros.busca.trim()}` }] : []),
    ...(filtros.estagio ? [{ id: 'estagio', rotulo: `Estágio: ${ROTULOS_ESTAGIO[filtros.estagio as keyof typeof ROTULOS_ESTAGIO]}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomeDaPessoa(filtros.responsavel)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_PRODUTO[filtros.situacao as keyof typeof ROTULOS_SITUACAO_PRODUTO]}` }] : []),
    ...(filtros.marca ? [{ id: 'marca', rotulo: `Marca: ${dados.marcas.find((marca) => marca.id === filtros.marca)?.nome ?? ''}` }] : []),
  ];
  const fila = produtosDaFila(linhas);
  const quantos = visao === 'fila' ? fila.length : linhas.length;
  const naFila = produtosDaFila(dados.linhas).length;
  const emUso = dados.linhas.filter((linha) => linha.estagio === 'em_uso').length;
  const recorte = contexto.id !== ID_CONSOLIDADA;
  const trocarVisao = (nova: string) => {
    setVisao(nova as Visao);
    roteador.replace(nova === 'cartoes' ? '/produtos' : `/produtos?visao=${nova}`, { scroll: false });
  };
  const semMaisFiltros = dados.marcas.filter((marca) => !marca.arquivado_em && !marca.institucional).length < 2;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Produtos"
        titulo="Portfólio de produtos"
        resumo={`${formatarNumero(dados.linhas.length)} produtos · ${emUso} em uso · ${naFila} na fila`}
        acoes={
          <Button onClick={() => setCadastrando(true)}>
            <Plus aria-hidden />
            Novo produto
          </Button>
        }
      />
      <AbasProdutos ativa="portfolio" />
      <AvisoDeFase />

      <section aria-label="Filtros do portfólio" className="space-y-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-0 flex-1 md:max-w-xs">
            <label htmlFor="busca-produtos" className="mb-[7px] block texto-rotulo">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input id="busca-produtos" type="search" placeholder="Nome, marca ou código" value={filtros.busca} onChange={(evento) => mudar({ busca: evento.target.value })} className="rounded-pill bg-paper pl-10" />
            </div>
          </div>
          {celular ? (
            <MenuSobreposto
              titulo="Filtros"
              gatilho={
                <Button variante="secundario" className="shrink-0">
                  <SlidersHorizontal aria-hidden />
                  {ativos.filter((ativo) => ativo.id !== 'busca').length ? `Filtros (${ativos.filter((ativo) => ativo.id !== 'busca').length})` : 'Filtros'}
                </Button>
              }
            >
              <div className="grid gap-4 pb-2">
                <CamposDoFiltro filtros={filtros} mudar={mudar} dados={dados} extras="todos" />
              </div>
            </MenuSobreposto>
          ) : (
            <>
              <div className="grid w-full flex-[2] grid-cols-3 gap-2.5 md:w-auto">
                <CamposDoFiltro filtros={filtros} mudar={mudar} dados={dados} extras="principais" />
              </div>
              {!semMaisFiltros && (
                <MenuSobreposto
                  titulo="Mais filtros"
                  alinhar="end"
                  gatilho={
                    <Button variante="secundario" className="shrink-0">
                      <SlidersHorizontal aria-hidden />
                      {filtros.marca ? 'Mais filtros (1)' : 'Mais filtros'}
                    </Button>
                  }
                >
                  <div className="grid gap-4 px-3 pb-2">
                    <CamposDoFiltro filtros={filtros} mudar={mudar} dados={dados} extras="mais" />
                  </div>
                </MenuSobreposto>
              )}
            </>
          )}
        </div>
        <EtiquetasDosFiltros ativos={ativos} aoRemoverAtivo={(id) => mudar({ [id]: '' })} aoLimpar={limpar} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm font-semibold">
            {quantos === 1 ? '1 produto' : `${formatarNumero(quantos)} produtos`}
            {recorte && <span className="font-normal text-ink-soft"> · contexto: {contexto.nome}</span>}
          </p>
          <Pilulas rotulo="Ver como" rotuloOculto valor={visao} aoMudar={trocarVisao} opcoes={OPCOES_VISAO} />
        </div>
      </section>

      {contexto.id === ID_INSTITUCIONAL ? (
        <EstadoVazio icone={Package} titulo="A Numa institucional não tem produtos." texto="Escolha “Numa consolidada” ou um produto no seletor do topo." />
      ) : visao === 'fila' ? (
        <FilaDeProdutos todos={dados.linhas} visiveis={fila} filtrando={ativos.length > 0 || recorte} aoLimparFiltros={limpar} />
      ) : !linhas.length ? (
        ativos.length ? <EstadoVazioFiltro aoLimpar={limpar} /> : <EstadoVazio icone={Package} titulo="Nenhum produto ainda." texto="Que tal cadastrar o primeiro?" acao={<Button onClick={() => setCadastrando(true)}>Novo produto</Button>} />
      ) : visao === 'cartoes' ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {linhas.map((linha) => (
            <li key={linha.id} className="grid">
              <CartaoDoProduto linha={linha} hoje={hoje} />
            </li>
          ))}
        </ul>
      ) : (
        <Lista
          rotulo="Produtos"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          aoAbrir={(linha) => roteador.push(`/produtos/${linha.id}`)}
          filtrando={ativos.length > 0}
          aoLimparFiltros={limpar}
          vazio={null}
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <span className="font-semibold">{linha.nome}</span>
              <span className="flex flex-wrap gap-1.5">
                <EtiquetaEstagio produto={linha} />
                {linha.marca?.provisorio && <EtiquetaLivre>Nome provisório</EtiquetaLivre>}
              </span>
              <span className="text-[13px] text-ink-soft">Responsável: {linha.responsavel ?? 'A definir'}</span>
              <span className="text-[13px] text-ink-soft">Custo médio: {textoDoCusto(linha.custo, dinheiro)}</span>
              <span className="text-[13px] text-ink-soft">Ofertas: {textoDasOfertas(linha)}</span>
              <span className="text-[13px] text-ink-soft">Usuários ativos: {textoDosUsuarios(linha)}</span>
            </span>
          )}
        />
      )}

      <FormularioProduto aberto={cadastrando} aoFechar={() => setCadastrando(false)} produto={null} marcas={dados.marcas} pessoas={dados.pessoas} entidades={dados.entidades} />
    </div>
  );
}
