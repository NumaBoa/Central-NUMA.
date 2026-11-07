'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, ListOrdered } from 'lucide-react';
import { ChipDaMarca } from '@/app/(central)/configuracoes/cadastros/marcas/aparencia';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { CampoDecisao } from '@/componentes/produtos/campo-decisao';
import { EtiquetaEstagio } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { errosDaDecisao, novaDecisaoVazia, type EntradaDecisao, type RegrasDaDecisao } from '@/dominio/decisoes';
import { moverNaFila, moverParaPosicao, produtosDaFila, reordenarFila, type LinhaDoPortfolio } from '@/dominio/portfolio';
import { hojeISO } from '@/lib/datas';
import { cn } from '@/lib/utils';

const REGRAS: RegrasDaDecisao = { produto_id: null, assunto: 'fila', qualquerProduto: true };

type Props = { todos: readonly LinhaDoPortfolio[]; visiveis: readonly LinhaDoPortfolio[]; filtrando: boolean; aoLimparFiltros: () => void };

/** T07.01, visão Fila: arrastar ou Subir e Descer. A ordem só vale ao salvar, com a decisão. */
export function FilaDeProdutos({ todos, visiveis, filtrando, aoLimparFiltros }: Props) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const salva = useMemo(() => produtosDaFila(todos).map((produto) => produto.id), [todos]);
  const [ordem, setOrdem] = useState<readonly string[]>(salva);
  const [decisao, setDecisao] = useState<EntradaDecisao>(() => novaDecisaoVazia(hoje, [pessoa.id]));
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const alterada = ordem.join() !== salva.join();
  useAlteracoesPendentes(alterada);

  // A fila salva mudou em outra aba, ou depois de salvar: recomeça dela.
  useEffect(() => {
    setOrdem(salva);
  }, [salva]);

  const porId = new Map(todos.map((produto) => [produto.id, produto]));
  const linhas = ordem.flatMap((id) => {
    const produto = porId.get(id);
    return produto ? [produto] : [];
  });
  const noFiltro = new Set(visiveis.map((produto) => produto.id));
  const mostradas = linhas.filter((produto) => noFiltro.has(produto.id));
  const erros = tentou ? Object.fromEntries(Object.entries(errosDaDecisao(decisao, hoje)).map(([campo, mensagem]) => [`decisao_${campo}`, mensagem])) : {};

  function mudar(nova: readonly string[], nome: string) {
    setOrdem(nova);
    setAnuncio(`${nome} agora é o número ${nova.indexOf(nova.find((id) => porId.get(id)?.nome === nome) ?? '') + 1} da fila.`);
  }

  function cancelar() {
    setOrdem(salva);
    setTentou(false);
    setAnuncio('Ordem desfeita.');
  }

  async function salvar() {
    if (salvando) return;
    setTentou(true);
    const primeiro = Object.keys(errosDaDecisao(decisao, hoje))[0];
    if (primeiro) {
      requestAnimationFrame(() => document.getElementById(`fila-decisao-${primeiro}`)?.focus());
      return;
    }
    setSalvando(true);
    try {
      await reordenarFila(ordem, decisao, hoje);
      aviso('Fila salva, com a decisão registrada.');
      setDecisao(novaDecisaoVazia(hoje, [pessoa.id]));
      setTentou(false);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  if (!salva.length) return <EstadoVazio icone={ListOrdered} titulo="A fila está vazia." texto="A fila mostra só produtos em Ideia e Validação, e nenhum está nesses estágios." />;

  return (
    <div className="space-y-4">
      <Faixa tipo="info">A fila mostra só produtos em Ideia e Validação. Reordenar exige uma decisão registrada.</Faixa>
      {filtrando && (
        <Faixa tipo="atencao" acao={<Button variante="terciario" tamanho="pequeno" onClick={aoLimparFiltros}>Limpar filtros</Button>}>
          Com filtros ou um contexto aplicados, a fila aparece só para consulta. Para reordenar, veja a fila inteira.
        </Faixa>
      )}
      {!mostradas.length ? (
        <EstadoVazioFiltro aoLimpar={aoLimparFiltros} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ol className="grid gap-2.5" aria-label="Fila de produtos">
            {mostradas.map((produto) => {
              const posicao = ordem.indexOf(produto.id);
              return (
                <li
                  key={produto.id}
                  draggable={!filtrando}
                  onDragStart={() => setArrastando(produto.id)}
                  onDragEnd={() => setArrastando(null)}
                  onDragOver={(evento) => {
                    if (arrastando && !filtrando) evento.preventDefault();
                  }}
                  onDrop={(evento) => {
                    evento.preventDefault();
                    if (arrastando && arrastando !== produto.id) mudar(moverParaPosicao(ordem, arrastando, posicao), porId.get(arrastando)?.nome ?? '');
                    setArrastando(null);
                  }}
                  className={cn('flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper p-3 md:flex-nowrap md:p-4', arrastando === produto.id && 'opacity-50')}
                >
                  {!filtrando && <GripVertical aria-hidden className="hidden size-5 shrink-0 cursor-grab text-ink-soft md:block" />}
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mist text-[13px] font-semibold tabular-nums" aria-label={`Posição ${posicao + 1}`}>
                    {posicao + 1}
                  </span>
                  {produto.marca && <ChipDaMarca marca={produto.marca} />}
                  <div className="min-w-0 flex-1 basis-40">
                    <LinkCentral href={`/produtos/${produto.id}`} className="inline-flex min-h-11 items-center font-display text-[17px] font-semibold underline-offset-2 hover:underline md:min-h-0">
                      {produto.nome}
                    </LinkCentral>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <EtiquetaEstagio produto={{ estagio: produto.estagio, ordem_fila: null }} />
                      {produto.marca?.provisorio && <EtiquetaLivre>Nome provisório</EtiquetaLivre>}
                    </div>
                    {produto.descricao_curta && <p className="mt-1 text-[13px] text-ink-soft">{produto.descricao_curta}</p>}
                  </div>
                  {!filtrando && (
                    <div className="flex w-full shrink-0 gap-2 md:w-auto md:flex-col [&>*]:flex-1">
                      <Button variante="secundario" tamanho="pequeno" disabled={posicao === 0} aria-label={`Subir ${produto.nome}`} onClick={() => mudar(moverNaFila(ordem, produto.id, -1), produto.nome)}>
                        <ArrowUp aria-hidden />
                        Subir
                      </Button>
                      <Button variante="secundario" tamanho="pequeno" disabled={posicao === ordem.length - 1} aria-label={`Descer ${produto.nome}`} onClick={() => mudar(moverNaFila(ordem, produto.id, 1), produto.nome)}>
                        <ArrowDown aria-hidden />
                        Descer
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p role="status" className="sr-only">
            {anuncio}
          </p>
          {!filtrando && alterada && (
            <section aria-label="Decisão da nova ordem" className="grid gap-3.5 rounded-lg border border-line bg-paper p-4">
              <h2 className="text-[17px] leading-6">Reordenar com contexto</h2>
              <CampoDecisao valor={decisao} aoMudar={setDecisao} regras={REGRAS} erros={erros} prefixo="fila-decisao" pessoaId={pessoa.id} />
            </section>
          )}
        </div>
      )}
      {!filtrando && alterada && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3 md:p-4">
          <p className="text-[13px] font-semibold">Ainda não salvo.</p>
          <div className="flex flex-1 flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">
            <Button variante="secundario" onClick={cancelar}>
              Cancelar
            </Button>
            <Button carregando={salvando} onClick={() => void salvar()}>
              Salvar ordem e decisão
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
