'use client';

import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, FolderTree, Pencil, Plus } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { CategoriaFinanceira } from '@/dados/tipos/financeiro';
import { useConsulta } from '@/dados/use-consulta';
import {
  arquivarCategoria,
  arvoreDeCategorias,
  carregarCategorias,
  contagemPorTipo,
  entraNoResultado,
  FILTRO_SEM_NATUREZA,
  FILTROS_CATEGORIAS_INICIAIS,
  restaurarCategoria,
  ROTULOS_NATUREZA,
  ROTULOS_TIPO_CATEGORIA,
  semNatureza,
  vinculosDaCategoria,
  type FiltrosCategorias,
} from '@/dominio/categorias';
import { formatarNumero } from '@/lib/formatacao';
import { AbasConfiguracoes, SubabasCadastros } from '../../abas';
import { FormularioCategoria } from './formulario-categoria';

function SituacaoDaCategoria({ situacao }: { situacao: CategoriaFinanceira['situacao'] }) {
  return <EtiquetaSituacao tipo={situacao === 'ativa' ? 'sucesso' : 'neutro'}>{situacao === 'ativa' ? 'Ativa' : 'Inativa'}</EtiquetaSituacao>;
}

function NaturezaDaCategoria({ categoria }: { categoria: CategoriaFinanceira }) {
  if (categoria.natureza_custo) return <>{ROTULOS_NATUREZA[categoria.natureza_custo]}</>;
  return semNatureza(categoria) ? <span className="text-warn">A definir</span> : <>—</>;
}

const plural = (quantidade: number, um: string, varios: string) => `${formatarNumero(quantidade)} ${quantidade === 1 ? um : varios}`;

/** T02.07: árvore de 2 níveis, com cada grupo e as suas categorias. Lançamentos entram com a T05. */
export function TelaCategorias() {
  const consulta = useConsulta(carregarCategorias);
  const [filtros, setFiltros] = useState<FiltrosCategorias>(FILTROS_CATEGORIAS_INICIAIS);
  const [painel, setPainel] = useState<{ aberto: boolean; categoria: CategoriaFinanceira | null; grupo: CategoriaFinanceira | null }>({ aberto: false, categoria: null, grupo: null });
  const [arquivando, setArquivando] = useState<{ categoria: CategoriaFinanceira; vinculos: readonly string[] } | null>(null);

  const categorias = consulta.dados;
  const arvore = useMemo(() => arvoreDeCategorias(categorias ?? [], filtros), [categorias, filtros]);
  const contagem = useMemo(() => contagemPorTipo(categorias ?? [], filtros), [categorias, filtros]);
  const vivas = useMemo(() => (categorias ?? []).filter((categoria) => !categoria.arquivado_em), [categorias]);
  const arquivadas = useMemo(() => (categorias ?? []).filter((categoria) => categoria.arquivado_em), [categorias]);
  const grupos = vivas.filter((categoria) => !categoria.pai_id).length;
  const semDefinir = vivas.filter(semNatureza).length;

  const mudar = (parcial: Partial<FiltrosCategorias>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_CATEGORIAS_INICIAIS, arquivadas: atuais.arquivadas }));

  const novaEm = (grupo: CategoriaFinanceira | null) => setPainel({ aberto: true, categoria: null, grupo });
  const editar = (categoria: CategoriaFinanceira) => setPainel({ aberto: true, categoria, grupo: null });

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  async function pedirArquivo(categoria: CategoriaFinanceira) {
    setArquivando({ categoria, vinculos: await vinculosDaCategoria(categoria.id) });
  }

  const acoes = (categoria: CategoriaFinanceira) => (
    <span className="inline-flex">
      <Button variante="icone" tamanho="icone" aria-label={`Editar ${categoria.nome}`} onClick={() => editar(categoria)}>
        <Pencil aria-hidden />
      </Button>
      <Button variante="icone" tamanho="icone" aria-label={`Arquivar ${categoria.nome}`} onClick={() => void pedirArquivo(categoria)}>
        <Archive aria-hidden />
      </Button>
    </span>
  );

  const colunas: readonly Coluna<CategoriaFinanceira>[] = [
    { id: 'nome', titulo: 'Categoria', essencial: true, celula: (categoria) => <span className="font-medium">{categoria.nome}</span> },
    { id: 'natureza', titulo: 'Natureza do custo', largura: '200px', celula: (categoria) => <NaturezaDaCategoria categoria={categoria} /> },
    { id: 'situacao', titulo: 'Situação', essencial: true, largura: '130px', celula: (categoria) => <SituacaoDaCategoria situacao={categoria.situacao} /> },
  ];

  const colunasArquivadas: readonly Coluna<CategoriaFinanceira>[] = [
    { id: 'nome', titulo: 'Categoria', essencial: true, celula: (categoria) => <span className="font-medium">{categoria.nome}</span> },
    { id: 'tipo', titulo: 'Tipo', essencial: true, celula: (categoria) => ROTULOS_TIPO_CATEGORIA[categoria.tipo] },
  ];

  const filtrosAtivos: FiltroAtivo[] = [
    ...(filtros.situacao !== 'todas' ? [{ id: 'situacao', rotulo: `Situação: ${filtros.situacao === 'ativa' ? 'Ativa' : 'Inativa'}` }] : []),
    ...(filtros.natureza ? [{ id: 'natureza', rotulo: `Natureza: ${filtros.natureza === FILTRO_SEM_NATUREZA ? 'A definir' : ROTULOS_NATUREZA[filtros.natureza as keyof typeof ROTULOS_NATUREZA]}` }] : []),
  ];

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Configurações', 'Cadastros base', 'Categorias']}
        kicker="Configurações"
        titulo="Categorias financeiras"
        resumo={categorias ? `${plural(grupos, 'grupo', 'grupos')} · ${plural(vivas.length - grupos, 'categoria', 'categorias')}` : undefined}
        acoes={
          <Button onClick={() => novaEm(null)} disabled={!categorias}>
            <Plus aria-hidden />
            Nova categoria
          </Button>
        }
      />
      <AbasConfiguracoes ativa="cadastros" />
      <SubabasCadastros ativa="categorias" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as categorias." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && categorias && (
          <>
            {!filtros.arquivadas && (
              <BarraFiltros
                busca={filtros.busca}
                aoBuscar={(busca) => mudar({ busca })}
                rotuloBusca="Buscar por nome"
                rapidos={[
                  { id: 'todos', rotulo: 'Todas', contador: contagem.todos },
                  { id: 'despesa', rotulo: 'Despesas', contador: contagem.despesa },
                  { id: 'receita', rotulo: 'Receitas', contador: contagem.receita },
                  { id: 'movimento_societario', rotulo: 'Movimentos societários', contador: contagem.movimento_societario },
                  { id: 'transferencia', rotulo: 'Transferências', contador: contagem.transferencia },
                ]}
                rapidoAtivo={filtros.tipo}
                aoEscolherRapido={(tipo) => mudar({ tipo: tipo as FiltrosCategorias['tipo'] })}
                ativos={filtrosAtivos}
                aoRemoverAtivo={(id) => mudar(id === 'situacao' ? { situacao: 'todas' } : { natureza: '' })}
                aoLimpar={limpar}
                filtrosDetalhados={
                  <div className="grid gap-4 px-1 pb-2 md:px-3">
                    <Pilulas
                      rotulo="Situação"
                      valor={filtros.situacao}
                      aoMudar={(situacao) => mudar({ situacao: situacao as FiltrosCategorias['situacao'] })}
                      opcoes={[
                        { valor: 'todas', rotulo: 'Todas' },
                        { valor: 'ativa', rotulo: 'Ativas' },
                        { valor: 'inativa', rotulo: 'Inativas' },
                      ]}
                    />
                    <Campo rotulo="Natureza do custo" id="filtro-natureza">
                      {(controle) => (
                        <Selecao {...controle} value={filtros.natureza} onChange={(evento) => mudar({ natureza: evento.target.value })}>
                          <option value="">Todas</option>
                          <option value={FILTRO_SEM_NATUREZA}>A definir</option>
                          {Object.entries(ROTULOS_NATUREZA).map(([valor, rotulo]) => (
                            <option key={valor} value={valor}>
                              {rotulo}
                            </option>
                          ))}
                        </Selecao>
                      )}
                    </Campo>
                  </div>
                }
              />
            )}
            {semDefinir > 0 && !filtros.arquivadas && filtros.natureza !== FILTRO_SEM_NATUREZA && (
              <Faixa
                tipo="atencao"
                acao={
                  <Button variante="terciario" tamanho="pequeno" onClick={() => mudar({ natureza: FILTRO_SEM_NATUREZA })}>
                    Ver quais
                  </Button>
                }
              >
                {semDefinir === 1 ? '1 categoria de despesa está' : `${formatarNumero(semDefinir)} categorias de despesa estão`} sem natureza do custo. Ela orienta rateio e relatórios: escolha ao editar.
              </Faixa>
            )}
            <div className="flex justify-end">
              <Button variante="terciario" tamanho="pequeno" aria-pressed={filtros.arquivadas} onClick={() => mudar({ arquivadas: !filtros.arquivadas })}>
                <Archive aria-hidden />
                {filtros.arquivadas ? 'Voltar às categorias ativas' : `Arquivados (${formatarNumero(arquivadas.length)})`}
              </Button>
            </div>

            {filtros.arquivadas ? (
              <Lista
                rotulo="Categorias arquivadas"
                linhas={arquivadas}
                colunas={colunasArquivadas}
                chave={(categoria) => categoria.id}
                acoesDaLinha={(categoria) => (
                  <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${categoria.nome}`} onClick={() => void executar(() => restaurarCategoria(categoria.id), 'Categoria restaurada.')}>
                    <ArchiveRestore aria-hidden />
                  </Button>
                )}
                cartao={(categoria) => (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{categoria.nome}</p>
                      <p className="text-[13px] text-ink-soft">{ROTULOS_TIPO_CATEGORIA[categoria.tipo]}</p>
                    </div>
                    <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${categoria.nome}`} onClick={() => void executar(() => restaurarCategoria(categoria.id), 'Categoria restaurada.')}>
                      <ArchiveRestore aria-hidden />
                    </Button>
                  </div>
                )}
                vazio={<EstadoVazio icone={Archive} titulo="Nenhuma categoria arquivada." texto="As arquivadas aparecem aqui, e dá para restaurar quando precisar." />}
              />
            ) : arvore.length === 0 ? (
              vivas.length ? (
                <EstadoVazioFiltro aoLimpar={limpar} />
              ) : (
                <EstadoVazio icone={FolderTree} titulo="Nenhuma categoria ainda." texto="Comece por um grupo, como Infraestrutura e software." acao={<Button onClick={() => novaEm(null)}>Nova categoria</Button>} />
              )
            ) : (
              <div className="space-y-6">
                {arvore.map(({ grupo, categorias: doGrupo }) => (
                  <section key={grupo.id} aria-labelledby={`grupo-${grupo.id}`} className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <h2 id={`grupo-${grupo.id}`}>{grupo.nome}</h2>
                      <EtiquetaLivre>{ROTULOS_TIPO_CATEGORIA[grupo.tipo]}</EtiquetaLivre>
                      {!entraNoResultado(grupo.tipo) && <EtiquetaLivre>Fora do resultado</EtiquetaLivre>}
                      {grupo.situacao === 'inativa' && <SituacaoDaCategoria situacao="inativa" />}
                      <span className="ml-auto inline-flex">
                        <Button variante="icone" tamanho="icone" aria-label={`Nova categoria em ${grupo.nome}`} onClick={() => novaEm(grupo)}>
                          <Plus aria-hidden />
                        </Button>
                        {acoes(grupo)}
                      </span>
                    </div>
                    <Lista
                      rotulo={`Categorias de ${grupo.nome}`}
                      linhas={doGrupo}
                      colunas={colunas}
                      chave={(categoria) => categoria.id}
                      acoesDaLinha={acoes}
                      cartao={(categoria) => (
                        <div className="flex items-start justify-between gap-2">
                          <div className="grid min-w-0 gap-1.5">
                            <p className="font-semibold break-words">{categoria.nome}</p>
                            <p className="text-[13px] text-ink-soft">
                              <NaturezaDaCategoria categoria={categoria} />
                            </p>
                            <span>
                              <SituacaoDaCategoria situacao={categoria.situacao} />
                            </span>
                          </div>
                          <div className="shrink-0">{acoes(categoria)}</div>
                        </div>
                      )}
                      vazio={<p className="rounded-lg border border-dashed border-line px-4 py-3 text-[13px] text-ink-soft">{filtros.busca || filtros.tipo !== 'todos' || filtros.situacao !== 'todas' || filtros.natureza ? 'Nenhuma categoria deste grupo com esses filtros.' : 'Nenhuma categoria neste grupo.'}</p>}
                    />
                  </section>
                ))}
              </div>
            )}
            <FormularioCategoria aberto={painel.aberto} aoFechar={() => setPainel((atual) => ({ ...atual, aberto: false }))} categoria={painel.categoria} grupoInicial={painel.grupo} categorias={categorias} />
          </>
        )}
      </div>

      {arquivando?.vinculos.length ? (
        <Confirmacao
          aberto
          aoFechar={() => setArquivando(null)}
          titulo={`Não dá para arquivar ${arquivando.categoria.nome}`}
          texto={
            <>
              <p>{arquivando.categoria.pai_id ? 'Esta categoria está em uso:' : 'Este grupo tem categorias:'}</p>
              <ul className="mt-1.5 grid gap-1">
                {arquivando.vinculos.map((vinculo) => (
                  <li key={vinculo}>{vinculo}</li>
                ))}
              </ul>
              <p className="mt-3">{arquivando.categoria.pai_id ? 'Troque a categoria nesses registros antes. Se ela não for mais usada, inative: deixa de ser oferecida em novos registros.' : 'Mova ou arquive essas categorias antes. Se o grupo não for mais usado, inative: as categorias deixam de ser oferecidas em novos registros.'}</p>
            </>
          }
          rotuloConfirmar="Entendi"
          soInforma
          aoConfirmar={() => setArquivando(null)}
        />
      ) : (
        <Confirmacao
          aberto={arquivando !== null}
          aoFechar={() => setArquivando(null)}
          titulo={`Arquivar ${arquivando?.categoria.nome ?? ''}?`}
          texto="Ela sai da árvore e dos seletores. Dá para restaurar quando precisar, em Arquivados."
          rotuloConfirmar="Arquivar categoria"
          perigo
          aoConfirmar={() => {
            const alvo = arquivando?.categoria;
            setArquivando(null);
            if (alvo) void executar(() => arquivarCategoria(alvo.id), 'Categoria arquivada.');
          }}
        />
      )}
    </>
  );
}
