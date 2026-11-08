'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, FilePlus2, Search } from 'lucide-react';
import { Selecao } from '@/componentes/campos/selecao';
import { MolduraDaEmpresa, SituacaoDoProcesso } from '@/componentes/empresa/aparencia';
import { JanelaDaPesquisa, JanelaDoProcesso } from '@/componentes/empresa/formularios-marca';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaColorida, EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { EtiquetasDosFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { SITUACOES_DO_PROCESSO, type MarcaPesquisa } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { AVISO_NOME_PROVISORIO, carregarMarcas, filtrarMarcas, FILTROS_MARCAS_INICIAIS, linhasDasMarcas, ROTULOS_RESULTADO_PESQUISA, ROTULOS_SITUACAO_PROCESSO, type LinhaDaMarca } from '@/dominio/marcas-inpi';
import { formatarDiaISO } from '@/lib/formatacao';

export function ResultadoDaPesquisa({ pesquisa }: { pesquisa: Pick<MarcaPesquisa, 'data' | 'resultado'> | null }) {
  if (!pesquisa) return <EtiquetaSituacao tipo="neutro">Não registrada</EtiquetaSituacao>;
  const tipo = pesquisa.resultado === 'disponivel' ? 'sucesso' : pesquisa.resultado === 'conflito_possivel' ? 'atencao' : 'erro';
  return (
    <span className="grid justify-items-start gap-0.5">
      <EtiquetaSituacao tipo={tipo}>{ROTULOS_RESULTADO_PESQUISA[pesquisa.resultado]}</EtiquetaSituacao>
      <span className="text-xs text-ink-soft">em {formatarDiaISO(pesquisa.data)}</span>
    </span>
  );
}

function ProcessosDaMarca({ linha }: { linha: LinhaDaMarca }) {
  if (!linha.processos.length) return <EtiquetaSituacao tipo="neutro">Não cadastrado</EtiquetaSituacao>;
  return (
    <ul className="grid gap-1">
      {linha.processos.map((processo) => (
        <li key={processo.id} className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span>Classe {processo.classes}</span>
          {processo.numero_processo && <span className="text-ink-soft tabular-nums">nº {processo.numero_processo}</span>}
          <SituacaoDoProcesso situacao={processo.situacao} />
        </li>
      ))}
    </ul>
  );
}

const textoDoPrazo = (linha: LinhaDaMarca) => (linha.proximoPrazo ? `${formatarDiaISO(linha.proximoPrazo.data_limite)} · ${linha.proximoPrazo.descricao}` : null);

function NomeDaMarca({ linha }: { linha: LinhaDaMarca }) {
  return (
    <span className="grid justify-items-start gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <EtiquetaColorida nome={linha.marca.nome} cor={linha.marca.cor_hex} />
        {linha.marca.provisorio && <EtiquetaLivre>Nome provisório</EtiquetaLivre>}
      </span>
      {linha.aviso && <span className="text-xs font-medium text-warn">{AVISO_NOME_PROVISORIO}</span>}
    </span>
  );
}

const COLUNAS: readonly Coluna<LinhaDaMarca>[] = [
  { id: 'marca', titulo: 'Marca', essencial: true, ordenar: (a, b) => a.marca.nome.localeCompare(b.marca.nome, 'pt-BR'), celula: (linha) => <NomeDaMarca linha={linha} /> },
  { id: 'pesquisa', titulo: 'Pesquisa de anterioridade', essencial: true, celula: (linha) => <ResultadoDaPesquisa pesquisa={linha.pesquisa} /> },
  { id: 'processos', titulo: 'Processos', celula: (linha) => <ProcessosDaMarca linha={linha} /> },
  { id: 'prazo', titulo: 'Próximo prazo', celula: (linha) => textoDoPrazo(linha) ?? <span className="text-ink-soft">Nenhum</span> },
];

/** T06.05: uma linha por marca (RN-06.08). Pesquisas e prazos são manuais: nada é consultado no INPI. */
export function TelaMarcasDaEmpresa() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const consulta = useConsulta(carregarMarcas);
  const [filtros, setFiltros] = useState(FILTROS_MARCAS_INICIAIS);
  const [pesquisa, setPesquisa] = useState(false);
  const [processo, setProcesso] = useState(false);
  const dados = consulta.dados;
  const todas = useMemo(() => (dados ? linhasDasMarcas(dados) : []), [dados]);
  const linhas = useMemo(() => filtrarMarcas(todas, filtros), [todas, filtros]);

  // Vindo do alerta de um prazo (05-M03 §5): abre a marca do processo.
  const prazoPedido = parametros.get('prazo');
  useEffect(() => {
    if (!prazoPedido || !dados) return;
    const prazo = dados.prazos.find((item) => item.id === prazoPedido);
    const marca = dados.processos.find((item) => item.id === prazo?.processo_id)?.marca_id;
    if (marca) roteador.replace(`/empresa/marcas/${marca}`);
  }, [prazoPedido, dados, roteador]);

  const moldura = (conteudo: React.ReactNode) => (
    <MolduraDaEmpresa
      ativa="marcas"
      titulo="Marcas e processos"
      resumo="Pesquisas de anterioridade e processos por classe, registrados à mão."
      acoes={
        <>
          <Button onClick={() => setPesquisa(true)} disabled={!dados}>
            <Search aria-hidden />
            Registrar pesquisa
          </Button>
          <Button variante="secundario" onClick={() => setProcesso(true)} disabled={!dados}>
            <FilePlus2 aria-hidden />
            Novo processo
          </Button>
        </>
      }
    >
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro' || !dados) return moldura(<EstadoErro titulo="Não deu para ler as marcas." aoTentarDeNovo={consulta.recarregar} />);

  const comAviso = todas.filter((linha) => linha.aviso);
  const ativos: FiltroAtivo[] = [
    ...(filtros.busca.trim() ? [{ id: 'busca', rotulo: `Busca: ${filtros.busca.trim()}` }] : []),
    ...(filtros.provisorio ? [{ id: 'provisorio', rotulo: filtros.provisorio === 'sim' ? 'Nome provisório' : 'Nome definitivo' }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: filtros.situacao === 'sem_pesquisa' ? 'Sem pesquisa' : filtros.situacao === 'sem_processo' ? 'Sem processo' : `Situação: ${ROTULOS_SITUACAO_PROCESSO[filtros.situacao as keyof typeof ROTULOS_SITUACAO_PROCESSO]}` }] : []),
  ];

  return moldura(
    <>
      {comAviso.length > 0 && (
        <Faixa tipo="atencao">
          {comAviso.map((linha) => linha.marca.nome).join(' e ')}: nome provisório, sem pesquisa. {AVISO_NOME_PROVISORIO}.
        </Faixa>
      )}
      <section aria-label="Filtros das marcas" className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_190px_210px]">
          <div>
            <label htmlFor="busca-marcas" className="mb-[7px] block texto-rotulo">
              Buscar marca
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input id="busca-marcas" type="search" value={filtros.busca} onChange={(evento) => setFiltros({ ...filtros, busca: evento.target.value })} className="rounded-pill bg-paper pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="filtro-marca-provisorio" className="mb-[7px] block texto-rotulo">
              Nome provisório
            </label>
            <Selecao id="filtro-marca-provisorio" value={filtros.provisorio} onChange={(evento) => setFiltros({ ...filtros, provisorio: evento.target.value })}>
              <option value="">Todos</option>
              <option value="sim">Provisório</option>
              <option value="nao">Definitivo</option>
            </Selecao>
          </div>
          <div>
            <label htmlFor="filtro-marca-situacao" className="mb-[7px] block texto-rotulo">
              Situação
            </label>
            <Selecao id="filtro-marca-situacao" value={filtros.situacao} onChange={(evento) => setFiltros({ ...filtros, situacao: evento.target.value })}>
              <option value="">Todas</option>
              <option value="sem_pesquisa">Sem pesquisa</option>
              <option value="sem_processo">Sem processo</option>
              {SITUACOES_DO_PROCESSO.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {ROTULOS_SITUACAO_PROCESSO[situacao]}
                </option>
              ))}
            </Selecao>
          </div>
        </div>
        <EtiquetasDosFiltros ativos={ativos} aoRemoverAtivo={(id) => setFiltros({ ...filtros, [id]: '' })} aoLimpar={() => setFiltros(FILTROS_MARCAS_INICIAIS)} />
        <p role="status" className="text-sm font-semibold">
          {linhas.length === 1 ? '1 marca' : `${linhas.length} marcas`}
        </p>
      </section>
      <Lista
        rotulo="Marcas"
        linhas={linhas}
        colunas={COLUNAS}
        chave={(linha) => linha.marca.id}
        aoAbrir={(linha) => roteador.push(`/empresa/marcas/${linha.marca.id}`)}
        filtrando={ativos.length > 0}
        aoLimparFiltros={() => setFiltros(FILTROS_MARCAS_INICIAIS)}
        vazio={<EstadoVazio icone={BadgeCheck} titulo="Nenhuma marca cadastrada." texto="As marcas vêm de Configurações › Cadastros base." />}
        cartao={(linha) => (
          <span className="grid gap-1.5">
            <NomeDaMarca linha={linha} />
            <span className="text-[13px] text-ink-soft">Pesquisa:</span>
            <ResultadoDaPesquisa pesquisa={linha.pesquisa} />
            <span className="text-[13px] text-ink-soft">Processos:</span>
            <ProcessosDaMarca linha={linha} />
            <span className="text-[13px] text-ink-soft">Próximo prazo: {textoDoPrazo(linha) ?? 'Nenhum'}</span>
          </span>
        )}
      />
      {pesquisa && <JanelaDaPesquisa dados={dados} aoFechar={() => setPesquisa(false)} />}
      {processo && <JanelaDoProcesso dados={dados} aoFechar={() => setProcesso(false)} />}
    </>,
  );
}
