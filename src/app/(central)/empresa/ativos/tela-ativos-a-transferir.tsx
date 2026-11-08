'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, CircleSlash, ExternalLink, ListPlus, RotateCcw, Search, Waypoints } from 'lucide-react';
import { DialogoDeTransferencia } from '@/app/(central)/ferramentas/ativos/[id]/ficha-ativo';
import { Selecao } from '@/componentes/campos/selecao';
import { MolduraDaEmpresa } from '@/componentes/empresa/aparencia';
import { MenuDeAcoes } from '@/componentes/empresa/menu-de-acoes';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { EtiquetasDosFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { sincronizarAlertasDeTransferencia } from '@/dominio/alertas-m06';
import { CAMINHO_DA_ATIVIDADE, ROTULOS_SITUACAO_ATIVIDADE } from '@/dominio/atividades';
import { carregarAtivos, marcarTransferenciaImpedida, retomarTransferencia, ROTULOS_TIPO_ATIVO } from '@/dominio/ativos';
import { carregarAtivosATransferir, criticosPendentes, filtrarItensATransferir, FILTROS_A_TRANSFERIR_INICIAIS, nomesDosProdutos, ROTULOS_SITUACAO_A_TRANSFERIR, type ItemComAtividade, type SituacaoATransferir } from '@/dominio/ativos-a-transferir';
import { entidadePrincipal } from '@/dominio/constituicao';
import { ROTULOS_SITUACAO_ENTIDADE } from '@/dominio/entidades';
import { nomeDaPessoa } from '@/dominio/sociedade';

const TIPOS_DA_SITUACAO: Readonly<Record<SituacaoATransferir, TipoSituacao>> = { pendente: 'atencao', em_andamento: 'info', impedida: 'erro' };

async function carregar() {
  const [transferir, ativos, entidades] = await Promise.all([carregarAtivosATransferir(), carregarAtivos(), repositorios.entidade.listar()]);
  return { ...transferir, dadosDosAtivos: ativos, entidades, entidade: entidadePrincipal(entidades) ?? null };
}

const rotuloDoTipo = (item: Pick<ItemComAtividade, 'tipoAtivo'>) => (item.tipoAtivo ? ROTULOS_TIPO_ATIVO[item.tipoAtivo] : 'Ferramenta');

function AtividadeDoItem({ item }: { item: ItemComAtividade }) {
  if (!item.atividade) return <span className="text-ink-soft">Nenhuma</span>;
  return (
    <LinkCentral href={CAMINHO_DA_ATIVIDADE(item.atividade.id)} className="inline-flex min-h-11 items-center gap-1 underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
      {ROTULOS_SITUACAO_ATIVIDADE[item.atividade.situacao]}
      <ExternalLink aria-hidden />
    </LinkCentral>
  );
}

function SituacaoDoItem({ item }: { item: ItemComAtividade }) {
  return (
    <span className="grid justify-items-start gap-1">
      <EtiquetaSituacao tipo={TIPOS_DA_SITUACAO[item.situacao]}>{ROTULOS_SITUACAO_A_TRANSFERIR[item.situacao]}</EtiquetaSituacao>
      {item.impedimento && <span className="text-xs text-ink-soft">{item.impedimento}</span>}
    </span>
  );
}

/** T06.04: visão derivada de Ferramentas e ativos (RN-06.07). A transferência é registrada pelo fluxo do M04. */
export function TelaAtivosATransferir() {
  const roteador = useRouter();
  const consulta = useConsulta(carregar);
  const [filtros, setFiltros] = useState(FILTROS_A_TRANSFERIR_INICIAIS);
  const [transferindo, setTransferindo] = useState<string | null>(null);
  const [impedindo, setImpedindo] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const dados = consulta.dados;
  const nomeDoResponsavel = useMemo(() => (id: string) => nomeDaPessoa(dados?.pessoas ?? [], id), [dados?.pessoas]);
  const linhas = useMemo(() => (dados ? filtrarItensATransferir(dados.itens, filtros, (item) => `${nomeDoResponsavel(item.responsavelId)} ${nomesDosProdutos(item, dados.produtos, dados.marcas)}`) : []), [dados, filtros, nomeDoResponsavel]);

  async function gerar() {
    setGerando(true);
    try {
      const novos = await sincronizarAlertasDeTransferencia({ gerar: true });
      aviso(novos ? `${novos === 1 ? '1 atividade criada' : `${novos} atividades criadas`} no Meu dia.` : 'Nada novo: os pendentes já têm atividade.');
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setGerando(false);
    }
  }

  const moldura = (conteudo: React.ReactNode) => (
    <MolduraDaEmpresa
      ativa="ativos"
      titulo="Ativos a transferir"
      resumo="Ativos e ferramentas com titular diferente do desejado, com a situação e a atividade de cada um."
      acoes={
        <Button onClick={() => void gerar()} carregando={gerando} disabled={!dados?.itens.length}>
          <ListPlus aria-hidden />
          Gerar atividades pendentes
        </Button>
      }
    >
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro' || !dados) return moldura(<EstadoErro titulo="Não deu para ler os ativos." aoTentarDeNovo={consulta.recarregar} />);

  const criticos = criticosPendentes(dados.itens);
  const produtosDosItens = [...new Set(dados.itens.flatMap((item) => item.produtos))];
  const temNuma = dados.itens.some((item) => !item.produtos.length);
  const emTransferencia = transferindo ? dados.dadosDosAtivos.ativos.find((ativo) => ativo.id === transferindo) : undefined;

  const ativos: FiltroAtivo[] = [
    ...(filtros.busca.trim() ? [{ id: 'busca', rotulo: `Busca: ${filtros.busca.trim()}` }] : []),
    ...(filtros.produto ? [{ id: 'produto', rotulo: `Produto: ${filtros.produto === 'numa' ? 'Numa' : (dados.produtos.find((produto) => produto.id === filtros.produto)?.nome ?? '')}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_A_TRANSFERIR[filtros.situacao as SituacaoATransferir]}` }] : []),
    ...(filtros.critico ? [{ id: 'critico', rotulo: filtros.critico === 'sim' ? 'Só críticos' : 'Só não críticos' }] : []),
  ];

  const colunas: readonly Coluna<ItemComAtividade>[] = [
    {
      id: 'ativo',
      titulo: 'Ativo ou ferramenta',
      essencial: true,
      ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
      celula: (item) => (
        <span className="grid">
          <span className="font-semibold break-words">{item.nome}</span>
          <span className="text-xs text-ink-soft">{rotuloDoTipo(item)}</span>
        </span>
      ),
    },
    { id: 'produto', titulo: 'Produto', celula: (item) => nomesDosProdutos(item, dados.produtos, dados.marcas) },
    { id: 'atual', titulo: 'Titular atual', celula: (item) => item.titularAtual },
    { id: 'desejado', titulo: 'Titular desejado', celula: (item) => item.titularDesejado },
    { id: 'requisito', titulo: 'Requisito', celula: (item) => item.requisito ?? <span className="text-ink-soft">Não informado</span> },
    { id: 'critico', titulo: 'Crítico', essencial: true, celula: (item) => (item.critico ? <EtiquetaSituacao tipo="erro">Crítico</EtiquetaSituacao> : <span className="text-ink-soft">Não</span>) },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (item) => <SituacaoDoItem item={item} /> },
    { id: 'responsavel', titulo: 'Responsável', celula: (item) => nomeDoResponsavel(item.responsavelId) },
    { id: 'atividade', titulo: 'Atividade', celula: (item) => <AtividadeDoItem item={item} /> },
  ];

  const acoesDaLinha = (item: ItemComAtividade) => (
    <span className="flex items-center gap-1">
      {item.origem === 'ativo' ? (
        <Button variante="secundario" tamanho="pequeno" onClick={() => setTransferindo(item.id)}>
          <ArrowRightLeft aria-hidden />
          Transferir
        </Button>
      ) : (
        <Button variante="secundario" tamanho="pequeno" onClick={() => roteador.push(`/ferramentas/${item.id}`)}>
          Abrir
        </Button>
      )}
      {item.origem === 'ativo' && (
        <MenuDeAcoes
          rotulo={`Mais ações de ${item.nome}`}
          acoes={[
            item.situacao === 'impedida'
              ? { rotulo: 'Retomar a transferência', icone: RotateCcw, aoClicar: () => void retomarTransferencia(item.id).then(() => aviso('Transferência retomada.'), (erro: unknown) => aviso(mensagemDoErro(erro))) }
              : { rotulo: 'Marcar impedida', icone: CircleSlash, aoClicar: () => setImpedindo(item.id) },
            { rotulo: 'Abrir o ativo', icone: ExternalLink, aoClicar: () => roteador.push(`/ferramentas/ativos/${item.id}`) },
          ]}
        />
      )}
    </span>
  );

  return moldura(
    <>
      <Faixa tipo="info">
        Entidade: <strong className="font-semibold">{dados.entidade ? ROTULOS_SITUACAO_ENTIDADE[dados.entidade.situacao] : 'nenhuma'}</strong>. Confira o requisito de cada ativo antes de registrar a transferência: ele vem do cadastro do ativo e varia de um para outro.
      </Faixa>

      <section aria-label="Filtros dos ativos a transferir" className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_170px_170px_150px]">
          <div>
            <label htmlFor="busca-transferir" className="mb-[7px] block texto-rotulo">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input id="busca-transferir" type="search" placeholder="Ativo, produto ou responsável" value={filtros.busca} onChange={(evento) => setFiltros({ ...filtros, busca: evento.target.value })} className="rounded-pill bg-paper pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="filtro-transferir-produto" className="mb-[7px] block texto-rotulo">
              Produto
            </label>
            <Selecao id="filtro-transferir-produto" value={filtros.produto} onChange={(evento) => setFiltros({ ...filtros, produto: evento.target.value })}>
              <option value="">Todos</option>
              {temNuma && <option value="numa">Numa</option>}
              {produtosDosItens.map((id) => (
                <option key={id} value={id}>
                  {dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <label htmlFor="filtro-transferir-situacao" className="mb-[7px] block texto-rotulo">
              Situação
            </label>
            <Selecao id="filtro-transferir-situacao" value={filtros.situacao} onChange={(evento) => setFiltros({ ...filtros, situacao: evento.target.value })}>
              <option value="">Todas</option>
              {Object.entries(ROTULOS_SITUACAO_A_TRANSFERIR).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <label htmlFor="filtro-transferir-critico" className="mb-[7px] block texto-rotulo">
              Crítico
            </label>
            <Selecao id="filtro-transferir-critico" value={filtros.critico} onChange={(evento) => setFiltros({ ...filtros, critico: evento.target.value })}>
              <option value="">Todos</option>
              <option value="sim">Críticos</option>
              <option value="nao">Não críticos</option>
            </Selecao>
          </div>
        </div>
        <EtiquetasDosFiltros ativos={ativos} aoRemoverAtivo={(id) => setFiltros({ ...filtros, [id]: '' })} aoLimpar={() => setFiltros(FILTROS_A_TRANSFERIR_INICIAIS)} />
        <p role="status" className="text-sm font-semibold">
          {linhas.length === 1 ? '1 item' : `${linhas.length} itens`}
          <span className={criticos ? 'font-semibold text-err' : 'font-normal text-ink-soft'}> · {criticos === 1 ? '1 crítico pendente' : `${criticos} críticos pendentes`}</span>
        </p>
      </section>

      <Lista
        rotulo="Ativos a transferir"
        linhas={linhas}
        colunas={colunas}
        chave={(item) => `${item.origem}-${item.id}`}
        acoesDaLinha={acoesDaLinha}
        filtrando={ativos.length > 0}
        aoLimparFiltros={() => setFiltros(FILTROS_A_TRANSFERIR_INICIAIS)}
        vazio={<EstadoVazio icone={Waypoints} titulo="Nada a transferir." texto="Todos os ativos e ferramentas estão com o titular desejado." />}
        cartaoInterativo
        cartao={(item) => (
          <span className="grid gap-1.5">
            <span className="font-semibold break-words">{item.nome}</span>
            <span className="text-[13px] text-ink-soft">
              {rotuloDoTipo(item)} · {nomesDosProdutos(item, dados.produtos, dados.marcas)}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {item.critico && <EtiquetaSituacao tipo="erro">Crítico</EtiquetaSituacao>}
              <SituacaoDoItem item={item} />
            </span>
            <span className="text-[13px] text-ink-soft">Titular atual: {item.titularAtual}</span>
            <span className="text-[13px] text-ink-soft">Titular desejado: {item.titularDesejado}</span>
            <span className="text-[13px] text-ink-soft">Requisito: {item.requisito ?? 'Não informado'}</span>
            <span className="text-[13px] text-ink-soft">Responsável: {nomeDoResponsavel(item.responsavelId)}</span>
            <span className="text-[13px] text-ink-soft">
              Atividade: <AtividadeDoItem item={item} />
            </span>
            {acoesDaLinha(item)}
          </span>
        )}
      />

      <Faixa tipo="info">Lista derivada de Ferramentas e ativos. Atividades existentes são reaproveitadas, sem duplicação, e também nascem quando a entidade PJ fica Ativa.</Faixa>

      {emTransferencia && <DialogoDeTransferencia ativo={emTransferencia} dados={dados.dadosDosAtivos} entidades={dados.entidades} aoFechar={() => setTransferindo(null)} />}
      <Confirmacao
        aberto={Boolean(impedindo)}
        aoFechar={() => setImpedindo(null)}
        titulo="Marcar como impedida?"
        texto="O motivo aparece na lista e fica no histórico do ativo."
        rotuloConfirmar="Marcar impedida"
        pedirMotivo
        mensagemSemMotivo="Diga o que impede a transferência."
        aoConfirmar={(motivo) => {
          const id = impedindo as string;
          setImpedindo(null);
          void marcarTransferenciaImpedida(id, motivo).then(() => aviso('Transferência marcada como impedida.'), (erro: unknown) => aviso(mensagemDoErro(erro)));
        }}
      />
    </>,
  );
}
