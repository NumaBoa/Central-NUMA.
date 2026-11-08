'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, Box, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { useConsulta } from '@/dados/use-consulta';
import { arquivarMarca, carregarMarcas, restaurarMarca } from '@/dominio/marcas';
import { responsavelDisponivel, restaurarProduto, ROTULOS_ESTAGIO, ROTULOS_TIPO_PRODUTO } from '@/dominio/produtos';
import { formatarNumero } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { AbasProdutos } from '@/componentes/produtos/aparencia';
import { ChipDaMarca, SituacaoDaMarca, SituacaoDoProduto } from './aparencia';
import { FormularioMarca } from './formulario-marca';
import { FormularioProduto } from './formulario-produto';

/** O cadastro básico do produto fica dentro do módulo Produtos (decisão de Kimberly em 07/11/2026). */
export const caminhoDoCadastroDoProduto = (id: string) => `/produtos/${id}/cadastro`;

function plural(quantidade: number, singular: string, varios: string): string {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : varios}`;
}

/** T02.04: marcas à esquerda, produtos da marca à direita; no celular, as marcas viram pílulas. */
export function TelaMarcas() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const consulta = useConsulta(carregarMarcas);
  const [marcaEscolhida, setMarcaEscolhida] = useState(parametros.get('marca'));
  const [painelMarca, setPainelMarca] = useState<{ aberto: boolean; marca: Marca | null }>({ aberto: false, marca: null });
  const [painelProduto, setPainelProduto] = useState(false);
  const [arquivando, setArquivando] = useState<Marca | null>(null);
  const [verArquivados, setVerArquivados] = useState(false);

  const dados = consulta.dados;
  const marcas = useMemo(() => (dados?.marcas ?? []).filter((marca) => !marca.arquivado_em), [dados]);
  const produtos = useMemo(() => (dados?.produtos ?? []).filter((produto) => !produto.arquivado_em), [dados]);
  const marcasArquivadas = useMemo(() => (dados?.marcas ?? []).filter((marca) => marca.arquivado_em), [dados]);
  const produtosArquivados = useMemo(() => (dados?.produtos ?? []).filter((produto) => produto.arquivado_em), [dados]);

  const atual = marcas.find((marca) => marca.id === marcaEscolhida) ?? marcas.find((marca) => produtos.some((produto) => produto.marca_id === marca.id)) ?? marcas[0];
  const produtosDaMarca = useMemo(() => produtos.filter((produto) => produto.marca_id === atual?.id), [produtos, atual]);
  const semResponsavel = dados ? produtos.filter((produto) => !responsavelDisponivel(produto, dados.pessoas)) : [];
  const produtosDaArquivada = arquivando ? produtos.filter((produto) => produto.marca_id === arquivando.id) : [];

  function escolherMarca(id: string) {
    setMarcaEscolhida(id);
    window.history.replaceState(null, '', `?marca=${id}`);
  }

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const nomeDaPessoa = (id: string | null) => dados?.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo;

  function ResponsavelDoProduto({ produto }: { produto: Produto }) {
    const nome = nomeDaPessoa(produto.responsavel_id);
    if (dados && responsavelDisponivel(produto, dados.pessoas) && nome) return <NomeDaPessoa nome={nome} />;
    return (
      <span className="flex flex-wrap items-center gap-2">
        {nome && <NomeDaPessoa nome={nome} />}
        <EtiquetaSituacao tipo="atencao" icone={TriangleAlert}>
          {nome ? 'Escolha outra pessoa' : 'A definir'}
        </EtiquetaSituacao>
      </span>
    );
  }

  const colunas: readonly Coluna<Produto>[] = [
    {
      id: 'nome',
      titulo: 'Produto',
      essencial: true,
      celula: (produto) => (
        <span className="grid">
          <span className="font-medium">{produto.nome}</span>
          <span className="text-xs text-ink-soft tabular-nums">{produto.codigo_curto}</span>
        </span>
      ),
    },
    { id: 'tipo', titulo: 'Tipo', celula: (produto) => ROTULOS_TIPO_PRODUTO[produto.tipo] },
    { id: 'estagio', titulo: 'Estágio', essencial: true, celula: (produto) => ROTULOS_ESTAGIO[produto.estagio] },
    { id: 'fila', titulo: 'Fila', numerica: true, celula: (produto) => produto.ordem_fila ?? '—' },
    { id: 'responsavel', titulo: 'Responsável', essencial: true, celula: (produto) => <ResponsavelDoProduto produto={produto} /> },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (produto) => <SituacaoDoProduto situacao={produto.situacao} /> },
  ];

  const abrirProduto = (produto: Produto) => roteador.push(caminhoDoCadastroDoProduto(produto.id));
  const quantosArquivados = marcasArquivadas.length + produtosArquivados.length;

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Produtos', 'Marcas']}
        kicker="Produtos"
        titulo="Marcas e produtos"
        resumo={dados ? `${plural(marcas.length, 'marca', 'marcas')} · ${plural(produtos.length, 'produto', 'produtos')}` : undefined}
        acoes={
          <Button onClick={() => setPainelMarca({ aberto: true, marca: null })} disabled={!dados}>
            <Plus aria-hidden />
            Nova marca
          </Button>
        }
      />
      <AbasProdutos ativa="marcas" className="" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as marcas e os produtos." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && dados && (
          <>
            {semResponsavel.length > 0 && !verArquivados && (
              <Faixa tipo="atencao">
                {semResponsavel.length === 1 ? 'Um produto está' : `${formatarNumero(semResponsavel.length)} produtos estão`} sem responsável: {semResponsavel.map((produto) => produto.nome).join(', ')}. Abra o produto e escolha uma pessoa.
              </Faixa>
            )}
            <div className="flex justify-end">
              <Button variante="terciario" tamanho="pequeno" aria-pressed={verArquivados} onClick={() => setVerArquivados((atual) => !atual)}>
                <Archive aria-hidden />
                {verArquivados ? 'Voltar às marcas e produtos' : `Arquivados (${formatarNumero(quantosArquivados)})`}
              </Button>
            </div>

            {verArquivados ? (
              <div className="space-y-5">
                <section aria-label="Marcas arquivadas">
                  <h2 className="mb-3 text-[17px] leading-6">Marcas</h2>
                  <Lista
                    rotulo="Marcas arquivadas"
                    linhas={marcasArquivadas}
                    colunas={[{ id: 'nome', titulo: 'Marca', essencial: true, celula: (marca) => <span className="font-medium">{marca.nome}</span> }]}
                    chave={(marca) => marca.id}
                    acoesDaLinha={(marca) => (
                      <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${marca.nome}`} onClick={() => void executar(() => restaurarMarca(marca.id), 'Marca restaurada.')}>
                        <ArchiveRestore aria-hidden />
                      </Button>
                    )}
                    cartao={(marca) => (
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{marca.nome}</span>
                        <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${marca.nome}`} onClick={() => void executar(() => restaurarMarca(marca.id), 'Marca restaurada.')}>
                          <ArchiveRestore aria-hidden />
                        </Button>
                      </div>
                    )}
                    vazio={<p className="text-sm text-ink-soft">Nenhuma marca arquivada.</p>}
                  />
                </section>
                <section aria-label="Produtos arquivados">
                  <h2 className="mb-3 text-[17px] leading-6">Produtos</h2>
                  <Lista
                    rotulo="Produtos arquivados"
                    linhas={produtosArquivados}
                    colunas={[{ id: 'nome', titulo: 'Produto', essencial: true, celula: (produto) => <span className="font-medium">{produto.nome}</span> }]}
                    chave={(produto) => produto.id}
                    aoAbrir={abrirProduto}
                    acoesDaLinha={(produto) => (
                      <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${produto.nome}`} onClick={() => void executar(() => restaurarProduto(produto.id), 'Produto restaurado.')}>
                        <ArchiveRestore aria-hidden />
                      </Button>
                    )}
                    cartao={(produto) => <span className="font-semibold">{produto.nome}</span>}
                    vazio={<p className="text-sm text-ink-soft">Nenhum produto arquivado.</p>}
                  />
                </section>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <nav aria-label="Marcas">
                  <ul className="faixa-rolagem flex gap-1.5 md:grid md:gap-1">
                    {marcas.map((marca) => {
                      const ativa = marca.id === atual?.id;
                      const quantos = produtos.filter((produto) => produto.marca_id === marca.id).length;
                      return (
                        <li key={marca.id} className="shrink-0">
                          <button
                            type="button"
                            aria-current={ativa ? 'true' : undefined}
                            onClick={() => escolherMarca(marca.id)}
                            style={{ '--ponto': marca.cor_hex } as CSSProperties}
                            className={cn('flex min-h-11 w-full items-center gap-2.5 rounded-pill border border-line px-3.5 text-left text-[13px] font-medium md:rounded-md md:border-transparent md:py-2.5', ativa ? 'bg-active font-semibold' : 'bg-paper hover:bg-hover md:bg-transparent')}
                          >
                            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--ponto)]" />
                            <span className="min-w-0 flex-1 whitespace-nowrap md:whitespace-normal">
                              {marca.nome}
                              {marca.provisorio && <span className="text-xs font-medium text-ink-soft"> · provisório</span>}
                            </span>
                            <span className="hidden text-xs text-ink-soft tabular-nums md:inline">{quantos}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                {atual && (
                  <section aria-label={`Produtos de ${atual.nome}`} className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <ChipDaMarca marca={atual} />
                        <div className="min-w-0">
                          <h2 className="text-[17px] leading-6 tracking-[-.01em]">{atual.nome}</h2>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <SituacaoDaMarca situacao={atual.situacao} />
                            {atual.provisorio && <EtiquetaLivre>provisório</EtiquetaLivre>}
                            {atual.institucional && <EtiquetaLivre>Institucional</EtiquetaLivre>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button variante="icone" tamanho="icone" aria-label={`Editar ${atual.nome}`} onClick={() => setPainelMarca({ aberto: true, marca: atual })}>
                          <Pencil aria-hidden />
                        </Button>
                        {!atual.institucional && (
                          <Button variante="icone" tamanho="icone" aria-label={`Arquivar ${atual.nome}`} onClick={() => setArquivando(atual)}>
                            <Archive aria-hidden />
                          </Button>
                        )}
                        <Button variante="secundario" tamanho="pequeno" onClick={() => setPainelProduto(true)}>
                          <Plus aria-hidden />
                          Novo produto
                        </Button>
                      </div>
                    </div>
                    <Lista
                      rotulo={`Produtos de ${atual.nome}`}
                      linhas={produtosDaMarca}
                      colunas={colunas}
                      chave={(produto) => produto.id}
                      aoAbrir={abrirProduto}
                      cartao={(produto) => (
                        <div className="grid gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold">{produto.nome}</p>
                              <p className="text-xs text-ink-soft tabular-nums">{produto.codigo_curto}</p>
                            </div>
                            <SituacaoDoProduto situacao={produto.situacao} />
                          </div>
                          <p className="text-[13px] text-ink-soft">
                            {ROTULOS_TIPO_PRODUTO[produto.tipo]} · {ROTULOS_ESTAGIO[produto.estagio]}
                            {produto.ordem_fila !== null ? ` · fila ${produto.ordem_fila}` : ''}
                          </p>
                          <ResponsavelDoProduto produto={produto} />
                        </div>
                      )}
                      vazio={
                        <EstadoVazio
                          icone={Box}
                          titulo="Esta marca ainda não tem produtos."
                          texto={atual.institucional ? 'O que é da Numa, sem produto, fica em “Numa institucional”.' : 'Que tal cadastrar o primeiro?'}
                          acao={atual.institucional ? undefined : <Button onClick={() => setPainelProduto(true)}>Novo produto</Button>}
                        />
                      }
                    />
                  </section>
                )}
              </div>
            )}

            <FormularioMarca aberto={painelMarca.aberto} aoFechar={() => setPainelMarca((atualNoPainel) => ({ ...atualNoPainel, aberto: false }))} marca={painelMarca.marca} aoCriar={(marca) => escolherMarca(marca.id)} />
            <FormularioProduto aberto={painelProduto} aoFechar={() => setPainelProduto(false)} produto={null} marcaId={atual?.id} marcas={dados.marcas} pessoas={dados.pessoas} entidades={dados.entidades} />
          </>
        )}
      </div>

      {produtosDaArquivada.length ? (
        <Confirmacao
          aberto={arquivando !== null}
          aoFechar={() => setArquivando(null)}
          titulo={`Não dá para arquivar ${arquivando?.nome ?? ''}`}
          texto={`Esta marca tem ${produtosDaArquivada.length === 1 ? 'um produto' : 'produtos'}: ${produtosDaArquivada.map((produto) => produto.nome).join(', ')}. Arquive antes.`}
          rotuloConfirmar="Entendi"
          soInforma
          aoConfirmar={() => setArquivando(null)}
        />
      ) : (
        <Confirmacao
          aberto={arquivando !== null}
          aoFechar={() => setArquivando(null)}
          titulo={`Arquivar ${arquivando?.nome ?? ''}?`}
          texto="Ela sai das listas e dos seletores. Dá para restaurar quando precisar, em Arquivados."
          rotuloConfirmar="Arquivar marca"
          perigo
          aoConfirmar={() => {
            const marca = arquivando;
            setArquivando(null);
            if (marca) void executar(() => arquivarMarca(marca.id), 'Marca arquivada.');
          }}
        />
      )}
    </>
  );
}
