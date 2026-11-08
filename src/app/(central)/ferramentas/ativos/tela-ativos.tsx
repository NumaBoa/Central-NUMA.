'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Globe, Plus } from 'lucide-react';
import { AbasFerramentas } from '@/componentes/ferramentas/abas-ferramentas';
import { EtiquetaCritica, SituacaoDaTransferencia, TextoDoVencimento } from '@/componentes/ferramentas/etiquetas-ferramentas';
import { FormularioDeAtivo } from '@/componentes/ferramentas/formulario-ativo';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { BotaoExportarCsv, MenuColunas, MenuVisoes, usePreferenciasDaLista } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import { TIPOS_DE_ATIVO, type AtivoDigital } from '@/dados/tipos/ativo';
import { useConsulta } from '@/dados/use-consulta';
import { ABAS_DE_ATIVO, carregarAtivos, contadoresDasAbas, filtrarAtivos, FILTROS_ATIVOS_INICIAIS, ROTULOS_TIPO_ATIVO, ROTULOS_TRANSFERENCIA, type FiltrosAtivos, type IdDaAbaDeAtivo } from '@/dominio/ativos';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { tintaDaCor } from '@/dominio/cores';
import { salvarColunas } from '@/dominio/preferencias-lista';
import { textoDoTitular } from '@/dominio/titularidade';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarNumero } from '@/lib/formatacao';

const LISTA = 'ativos';
const CAMINHO = '/ferramentas/ativos';
const COLUNAS_PADRAO = ['identificador', 'tipo', 'contexto', 'titular', 'transferencia', 'vencimento', 'responsavel'];

/** T04.04 (P1): o que a Numa possui, em nome de quem está, e o que falta transferir. */
export function TelaAtivos() {
  const roteador = useRouter();
  const { pessoa, contexto } = useCentral();
  const consulta = useConsulta(carregarAtivos);
  const [filtros, setFiltros] = useState<FiltrosAtivos>(FILTROS_ATIVOS_INICIAIS);
  const [cadastrando, setCadastrando] = useState(false);
  const { colunasVisiveis, visoes } = usePreferenciasDaLista(pessoa.id, LISTA, COLUNAS_PADRAO);
  const dados = consulta.dados;
  const hoje = hojeISO();

  const opcoes = useMemo(
    () => ({
      contextoGlobalId: contexto.id,
      hoje,
      pessoas: dados?.pessoas ?? [],
      nomeDaFerramenta: (id: string | null) => dados?.ferramentas.find((ferramenta) => ferramenta.id === id)?.nome ?? '',
    }),
    [contexto.id, hoje, dados],
  );
  const linhas = useMemo(() => (dados ? filtrarAtivos(dados.ativos, filtros, opcoes) : []), [dados, filtros, opcoes]);
  const contadores = useMemo(() => (dados ? contadoresDasAbas(dados.ativos, filtros, opcoes) : null), [dados, filtros, opcoes]);

  const colunas = useMemo<readonly Coluna<AtivoDigital>[]>(() => {
    if (!dados) return [];
    const contextoDe = (ativo: AtivoDigital) => {
      const produto = dados.produtos.find((item) => item.id === ativo.produto_id);
      const marca = produto ? dados.marcas.find((item) => item.id === produto.marca_id) : dados.marcas.find((item) => item.institucional);
      return marca ? { id: ativo.produto_id ?? ID_INSTITUCIONAL, nome: produto?.nome ?? 'Numa', cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) } : null;
    };
    const nomeDaPessoa = (id: string) => dados.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
    return [
      {
        id: 'identificador',
        titulo: 'Identificador',
        fixa: true,
        essencial: true,
        ordenar: (a, b) => a.identificador.localeCompare(b.identificador, 'pt-BR'),
        texto: (ativo) => ativo.identificador,
        celula: (ativo) => (
          <span className="grid min-w-44 gap-0.5">
            <span className="font-medium break-words">
              {ativo.identificador}
              {ativo.critico && (
                <span title="Crítico" className="ml-1.5 inline-block size-2 rounded-full bg-err align-middle">
                  <span className="sr-only">Crítico</span>
                </span>
              )}
            </span>
            <span className="text-xs text-ink-soft tabular-nums">{ativo.codigo}</span>
          </span>
        ),
      },
      { id: 'tipo', titulo: 'Tipo', essencial: true, ordenar: (a, b) => ROTULOS_TIPO_ATIVO[a.tipo].localeCompare(ROTULOS_TIPO_ATIVO[b.tipo], 'pt-BR'), texto: (ativo) => ROTULOS_TIPO_ATIVO[ativo.tipo], celula: (ativo) => ROTULOS_TIPO_ATIVO[ativo.tipo] },
      {
        id: 'contexto',
        titulo: 'Produto',
        texto: (ativo) => contextoDe(ativo)?.nome ?? '',
        celula: (ativo) => {
          const item = contextoDe(ativo);
          return item ? <EtiquetaContexto contexto={item} /> : '—';
        },
      },
      { id: 'ferramenta', titulo: 'Onde está', texto: (ativo) => opcoes.nomeDaFerramenta(ativo.ferramenta_id), celula: (ativo) => opcoes.nomeDaFerramenta(ativo.ferramenta_id) || '—' },
      { id: 'titular', titulo: 'Titular atual', texto: (ativo) => textoDoTitular(ativo, dados.pessoas), celula: (ativo) => <span className="block max-w-44 break-words">{textoDoTitular(ativo, dados.pessoas)}</span> },
      { id: 'desejado', titulo: 'Titular desejado', texto: (ativo) => ativo.titular_desejado, celula: (ativo) => ativo.titular_desejado },
      { id: 'transferencia', titulo: 'Transferência', essencial: true, texto: (ativo) => ROTULOS_TRANSFERENCIA[ativo.transferencia_situacao], celula: (ativo) => <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} /> },
      {
        id: 'vencimento',
        titulo: 'Vencimento',
        essencial: true,
        ordenar: (a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999'),
        texto: (ativo) => (ativo.vencimento ? formatarDiaISO(ativo.vencimento) : ''),
        celula: (ativo) => <TextoDoVencimento vencimento={ativo.vencimento} hoje={hoje} />,
      },
      { id: 'responsavel', titulo: 'Responsável', ordenar: (a, b) => nomeDaPessoa(a.responsavel_id).localeCompare(nomeDaPessoa(b.responsavel_id), 'pt-BR'), texto: (ativo) => nomeDaPessoa(ativo.responsavel_id), celula: (ativo) => <NomeDaPessoa nome={nomeDaPessoa(ativo.responsavel_id)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
    ];
  }, [dados, hoje, opcoes]);

  const visiveis = useMemo(() => colunas.filter((coluna) => coluna.fixa || colunasVisiveis.includes(coluna.id)), [colunas, colunasVisiveis]);

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Ativos digitais</h1>
        <EstadoErro titulo="Não deu para ler os ativos." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const usados = dados.ativos.filter((ativo) => !ativo.arquivado_em);
  const arquivados = dados.ativos.length - usados.length;
  const mudar = (parcial: Partial<FiltrosAtivos>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_ATIVOS_INICIAIS, aba: atuais.aba, arquivados: atuais.arquivados }));
  const nomeDoContexto = (id: string) => (id === ID_INSTITUCIONAL ? 'Numa' : (dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));
  const ativos: FiltroAtivo[] = [
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_ATIVO[filtros.tipo as AtivoDigital['tipo']]}` }] : []),
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${nomeDoContexto(filtros.contexto)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Transferência: ${ROTULOS_TRANSFERENCIA[filtros.situacao as AtivoDigital['transferencia_situacao']]}` }] : []),
    ...(filtros.titularDiferente ? [{ id: 'titularDiferente', rotulo: 'Titular diferente do desejado' }] : []),
    ...(filtros.venceEm ? [{ id: 'venceEm', rotulo: `Vence em ${filtros.venceEm} dias` }] : []),
  ];
  const { arquivados: _semArquivados, aba: _semAba, ...filtrosDaVisao } = filtros;
  const tipoDaAba = ABAS_DE_ATIVO.find((aba) => aba.id === filtros.aba)?.tipos;
  const tipoInicial = tipoDaAba && tipoDaAba.length !== TIPOS_DE_ATIVO.length ? tipoDaAba[0] : undefined;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Ferramentas e ativos"
        titulo="Ativos digitais"
        resumo={`${formatarNumero(usados.length)} ${usados.length === 1 ? 'ativo' : 'ativos'}: o que a Numa possui, em nome de quem está e o que falta transferir.`}
        acoes={
          <Button onClick={() => setCadastrando(true)}>
            <Plus aria-hidden />
            Novo ativo
          </Button>
        }
      />
      <AbasFerramentas ativa="ativos" />
      <BarraFiltros
        busca={filtros.busca}
        aoBuscar={(busca) => mudar({ busca })}
        rotuloBusca="Buscar por identificador, código ou ferramenta"
        rapidos={[...ABAS_DE_ATIVO.map(({ id, rotulo }) => ({ id, rotulo, contador: contadores?.[id] || undefined })), { id: 'marcas', rotulo: 'Marcas' }]}
        rapidoAtivo={filtros.aba}
        aoEscolherRapido={(aba) => (aba === 'marcas' ? roteador.push('/empresa/marcas') : mudar({ aba: aba as IdDaAbaDeAtivo }))}
        ativos={ativos}
        aoRemoverAtivo={(id) => mudar(id === 'titularDiferente' ? { titularDiferente: false } : { [id]: '' })}
        aoLimpar={limpar}
        filtrosDetalhados={
          <div className="grid gap-4 px-1 pb-2 md:px-3">
            <Campo rotulo="Tipo" id="filtro-tipo">
              {(controle) => (
                <Selecao {...controle} value={filtros.tipo} onChange={(evento) => mudar({ tipo: evento.target.value })}>
                  <option value="">Todos</option>
                  {TIPOS_DE_ATIVO.map((valor) => (
                    <option key={valor} value={valor}>
                      {ROTULOS_TIPO_ATIVO[valor]}
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
            <Campo rotulo="Situação da transferência" id="filtro-situacao">
              {(controle) => (
                <Selecao {...controle} value={filtros.situacao} onChange={(evento) => mudar({ situacao: evento.target.value })}>
                  <option value="">Todas</option>
                  {Object.entries(ROTULOS_TRANSFERENCIA).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Titular" id="filtro-titular">
              {(controle) => (
                <Selecao {...controle} value={filtros.titularDiferente ? 'diferente' : ''} onChange={(evento) => mudar({ titularDiferente: evento.target.value === 'diferente' })}>
                  <option value="">Todos</option>
                  <option value="diferente">Diferente do desejado</option>
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Vence em" id="filtro-vence">
              {(controle) => (
                <Selecao {...controle} value={filtros.venceEm} onChange={(evento) => mudar({ venceEm: evento.target.value as FiltrosAtivos['venceEm'] })}>
                  <option value="">Qualquer data</option>
                  {['30', '45', '60', '90'].map((dias) => (
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
                setFiltros((atuais) => ({ ...FILTROS_ATIVOS_INICIAIS, ...(visao.filtros as Partial<FiltrosAtivos>), aba: atuais.aba, arquivados: atuais.arquivados }));
                salvarColunas(pessoa.id, LISTA, visao.colunas);
              }}
            />
            <MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />
            <BotaoExportarCsv nomeDoArquivo="ativos-digitais" colunas={visiveis} linhas={linhas} />
            {arquivados > 0 && (
              <Button variante="terciario" aria-pressed={filtros.arquivados} onClick={() => mudar({ arquivados: !filtros.arquivados })}>
                <Archive aria-hidden />
                {filtros.arquivados ? 'Voltar aos ativos' : `Arquivados (${arquivados})`}
              </Button>
            )}
          </>
        }
      />
      <Lista
        rotulo="Ativos digitais"
        linhas={linhas}
        colunas={visiveis}
        chave={(ativo) => ativo.id}
        aoAbrir={(ativo) => roteador.push(`${CAMINHO}/${ativo.id}`)}
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim()) || filtros.arquivados || filtros.aba !== 'todos'}
        aoLimparFiltros={() => setFiltros((atuais) => ({ ...FILTROS_ATIVOS_INICIAIS, arquivados: atuais.arquivados }))}
        vazio={<EstadoVazio icone={Globe} titulo="Nenhum ativo ainda." texto="Domínios, contas de loja, repositórios e perfis ficam aqui." acao={<Button onClick={() => setCadastrando(true)}>Novo ativo</Button>} />}
        cartao={(ativo) => (
          <span className="grid gap-1.5">
            <span className="flex flex-wrap items-center gap-1.5 font-semibold break-words">
              {ativo.identificador}
              {ativo.critico && <EtiquetaCritica rotulo="Crítico" />}
            </span>
            <span className="text-[13px] text-ink-soft">{ROTULOS_TIPO_ATIVO[ativo.tipo]}</span>
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} />
              <span>{textoDoTitular(ativo, dados.pessoas)}</span>
            </span>
            {ativo.vencimento && (
              <span className="text-[13px] text-ink-soft">
                Vence em: <TextoDoVencimento vencimento={ativo.vencimento} hoje={hoje} />
              </span>
            )}
          </span>
        )}
      />
      <FormularioDeAtivo aberto={cadastrando} aoFechar={() => setCadastrando(false)} dados={dados} tipoInicial={tipoInicial} />
    </div>
  );
}
