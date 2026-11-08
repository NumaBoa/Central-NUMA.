'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Plus } from 'lucide-react';
import { AbasFerramentas } from '@/componentes/ferramentas/abas-ferramentas';
import { EtiquetaCritica, SituacaoDaTransferencia, TextoDoVencimento } from '@/componentes/ferramentas/etiquetas-ferramentas';
import { FormularioDeAtivo } from '@/componentes/ferramentas/formulario-ativo';
import { useCentral } from '@/componentes/layout/central-provider';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto } from '@/componentes/padroes/etiquetas';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { BotaoExportarCsv, MenuColunas, MenuVisoes, usePreferenciasDaLista } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import { TIPOS_DE_ATIVO, type AtivoDigital } from '@/dados/tipos/ativo';
import { useConsulta } from '@/dados/use-consulta';
import { ABAS_DE_ATIVO, carregarAtivos, contadoresDasAbas, diasParaVencer, filtrarAtivos, FILTROS_ATIVOS_INICIAIS, ROTULOS_TIPO_ATIVO, ROTULOS_TRANSFERENCIA, type FiltrosAtivos } from '@/dominio/ativos';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { tintaDaCor } from '@/dominio/cores';
import { salvarColunas } from '@/dominio/preferencias-lista';
import { textoDoTitular } from '@/dominio/titularidade';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarNumero } from '@/lib/formatacao';
import { BarraDeAtivos, GruposDeAtivos } from './filtros-ativos';

/** "Vence em 33 dias", "venceu há 3 dias" ou "vence hoje": a data sozinha não diz a urgência. */
function prazo(vencimento: string | null, hoje: string): string | null {
  const dias = diasParaVencer({ vencimento }, hoje);
  if (dias === null) return null;
  if (dias === 0) return 'vence hoje';
  if (dias < 0) return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`;
  return dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;
}

const LISTA = 'ativos';
const CAMINHO = '/ferramentas/ativos';
/** As seis do protótipo de 07/11/2026; tipo, titular e transferência separados continuam em Colunas. */
const COLUNAS_PADRAO = ['identificador', 'contexto', 'ferramenta', 'titularidade', 'vencimento', 'responsavel'];

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
        titulo: 'Ativo',
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
            <span className="text-xs text-ink-soft">
              {ROTULOS_TIPO_ATIVO[ativo.tipo]} · <span className="tabular-nums">{ativo.codigo}</span>
            </span>
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
      { id: 'ferramenta', titulo: 'Plataforma', texto: (ativo) => opcoes.nomeDaFerramenta(ativo.ferramenta_id), celula: (ativo) => opcoes.nomeDaFerramenta(ativo.ferramenta_id) || '—' },
      { id: 'titular', titulo: 'Titular atual', texto: (ativo) => textoDoTitular(ativo, dados.pessoas), celula: (ativo) => <span className="block max-w-44 break-words">{textoDoTitular(ativo, dados.pessoas)}</span> },
      { id: 'desejado', titulo: 'Titular desejado', texto: (ativo) => ativo.titular_desejado, celula: (ativo) => ativo.titular_desejado },
      {
        id: 'titularidade',
        titulo: 'Titularidade',
        texto: (ativo) => `Atual: ${textoDoTitular(ativo, dados.pessoas)} · Desejado: ${ativo.titular_desejado} · ${ROTULOS_TRANSFERENCIA[ativo.transferencia_situacao]}`,
        celula: (ativo) => (
          <span className="grid min-w-52 gap-1 text-[13px]">
            <span className="break-words">Atual: {textoDoTitular(ativo, dados.pessoas)}</span>
            <span className="break-words text-ink-soft">Desejado: {ativo.titular_desejado}</span>
            <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} />
          </span>
        ),
      },
      { id: 'transferencia', titulo: 'Transferência', essencial: true, texto: (ativo) => ROTULOS_TRANSFERENCIA[ativo.transferencia_situacao], celula: (ativo) => <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} /> },
      {
        id: 'vencimento',
        titulo: 'Vencimento',
        essencial: true,
        ordenar: (a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999'),
        texto: (ativo) => (ativo.vencimento ? formatarDiaISO(ativo.vencimento) : ''),
        celula: (ativo) =>
          ativo.vencimento ? (
            <span className="grid">
              <TextoDoVencimento vencimento={ativo.vencimento} hoje={hoje} />
              <span className="text-xs text-ink-soft">{prazo(ativo.vencimento, hoje)}</span>
            </span>
          ) : (
            <span className="text-ink-soft">Sem vencimento</span>
          ),
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
  const mudar = (parcial: Partial<FiltrosAtivos>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const { arquivados: _semArquivados, aba: _semAba, ...filtrosDaVisao } = filtros;
  const tipoDaAba = ABAS_DE_ATIVO.find((aba) => aba.id === filtros.aba)?.tipos;
  const tipoInicial = tipoDaAba && tipoDaAba.length !== TIPOS_DE_ATIVO.length ? tipoDaAba[0] : undefined;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Ferramentas e ativos"
        titulo="Ativos digitais"
        resumo={`${formatarNumero(usados.length)} ${usados.length === 1 ? 'ativo' : 'ativos'}: o que a Numa possui, onde está e em nome de quem.`}
        acoes={
          <Button onClick={() => setCadastrando(true)}>
            <Plus aria-hidden />
            Novo ativo
          </Button>
        }
      />
      <AbasFerramentas ativa="ativos" />
      <GruposDeAtivos aba={filtros.aba} contadores={contadores} aoEscolher={(aba) => mudar({ aba })} />
      <BarraDeAtivos filtros={filtros} aoMudar={mudar} dados={dados} />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Utilidades da lista">
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
        {/* Em cartões, no celular, colunas não fazem sentido. */}
        <div className="hidden md:block">
          <MenuColunas pessoaId={pessoa.id} lista={LISTA} colunas={colunas} visiveis={colunasVisiveis} padrao={COLUNAS_PADRAO} />
        </div>
        <BotaoExportarCsv nomeDoArquivo="ativos-digitais" colunas={visiveis} linhas={linhas} />
        <p className="ml-auto text-[13px] text-ink-soft tabular-nums" aria-live="polite" data-quantos-ativos>
          {linhas.length === 1 ? '1 ativo' : `${formatarNumero(linhas.length)} ativos`}
          {filtros.arquivados ? ' arquivados' : ''}
        </p>
      </div>
      <Lista
        rotulo="Ativos digitais"
        linhas={linhas}
        colunas={visiveis}
        chave={(ativo) => ativo.id}
        aoAbrir={(ativo) => roteador.push(`${CAMINHO}/${ativo.id}`)}
        filtrando={JSON.stringify(filtros) !== JSON.stringify(FILTROS_ATIVOS_INICIAIS)}
        aoLimparFiltros={() => setFiltros((atuais) => ({ ...FILTROS_ATIVOS_INICIAIS, arquivados: atuais.arquivados }))}
        vazio={<EstadoVazio icone={Globe} titulo="Nenhum ativo ainda." texto="Domínios, contas de loja, repositórios e perfis ficam aqui." acao={<Button onClick={() => setCadastrando(true)}>Novo ativo</Button>} />}
        cartao={(ativo) => (
          <span className="grid gap-1.5">
            <span className="flex flex-wrap items-center gap-1.5 font-semibold break-words">
              {ativo.identificador}
              {ativo.critico && <EtiquetaCritica rotulo="Crítico" />}
            </span>
            <span className="text-[13px] text-ink-soft">{ROTULOS_TIPO_ATIVO[ativo.tipo]}</span>
            <span className="grid gap-1 text-[13px] text-ink-soft">
              <span>Atual: {textoDoTitular(ativo, dados.pessoas)}</span>
              <span>Desejado: {ativo.titular_desejado}</span>
              <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} />
            </span>
            {ativo.vencimento && (
              <span className="text-[13px] text-ink-soft">
                Vencimento: <TextoDoVencimento vencimento={ativo.vencimento} hoje={hoje} /> · {prazo(ativo.vencimento, hoje)}
              </span>
            )}
          </span>
        )}
      />
      <FormularioDeAtivo aberto={cadastrando} aoFechar={() => setCadastrando(false)} dados={dados} tipoInicial={tipoInicial} />
    </div>
  );
}
