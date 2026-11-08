'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gavel, Plus, Search } from 'lucide-react';
import { Selecao } from '@/componentes/campos/selecao';
import { MolduraDaEmpresa, SubabasDeReunioes } from '@/componentes/empresa/aparencia';
import { FormularioDaDecisao } from '@/componentes/empresa/formularios-reuniao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetasDosFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import type { Decisao } from '@/dados/tipos/decisao';
import { useConsulta } from '@/dados/use-consulta';
import { carregarReunioes, filtrarDecisoes, FILTROS_DECISOES_INICIAIS, nomeDoContexto, nomesDosDecisores } from '@/dominio/reunioes';
import { formatarDiaISO } from '@/lib/formatacao';
import { SituacaoDaDecisao } from './situacao-da-decisao';

/** T06.09: a lista geral. É a mesma tabela que o M07 usa: nenhuma outra base de decisões. */
export function TelaDecisoes() {
  const roteador = useRouter();
  const consulta = useConsulta(carregarReunioes);
  const [filtros, setFiltros] = useState(FILTROS_DECISOES_INICIAIS);
  const [nova, setNova] = useState(false);
  const dados = consulta.dados;
  const linhas = useMemo(() => (dados ? filtrarDecisoes(dados.decisoes, filtros) : []), [dados, filtros]);

  const moldura = (conteudo: React.ReactNode) => (
    <MolduraDaEmpresa
      ativa="reunioes"
      titulo="Reuniões e decisões"
      resumo="Decisões registradas não mudam: só podem ser substituídas por outra, com o vínculo preservado."
      acoes={
        <Button onClick={() => setNova(true)} disabled={!dados}>
          <Plus aria-hidden />
          Nova decisão
        </Button>
      }
    >
      <SubabasDeReunioes ativa="decisoes" />
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro' || !dados) return moldura(<EstadoErro titulo="Não deu para ler as decisões." aoTentarDeNovo={consulta.recarregar} />);

  const nomeDaArea = (id: string | null) => dados.areas.find((area) => area.id === id)?.nome ?? null;
  const codigoDaSubstituta = (decisao: Decisao) => dados.decisoes.find((outra) => outra.id === decisao.substituida_por_id)?.codigo ?? null;
  const contextos = [...new Set(dados.decisoes.flatMap((decisao) => (decisao.produto_id ? [decisao.produto_id] : [])))];
  const ativos: FiltroAtivo[] = [
    ...(filtros.busca.trim() ? [{ id: 'busca', rotulo: `Busca: ${filtros.busca.trim()}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: filtros.situacao === 'registrada' ? 'Registradas' : 'Substituídas' }] : []),
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Contexto: ${filtros.contexto === 'numa' ? 'Numa' : nomeDoContexto(filtros.contexto, dados.produtos)}` }] : []),
    ...(filtros.area ? [{ id: 'area', rotulo: `Área: ${nomeDaArea(filtros.area)}` }] : []),
  ];

  const colunas: readonly Coluna<Decisao>[] = [
    { id: 'codigo', titulo: 'Código', essencial: true, celula: (decisao) => <span className="whitespace-nowrap tabular-nums">{decisao.codigo}</span> },
    { id: 'titulo', titulo: 'Título', essencial: true, celula: (decisao) => <span className="font-semibold">{decisao.titulo}</span> },
    { id: 'data', titulo: 'Data', ordenar: (a, b) => a.data.localeCompare(b.data), celula: (decisao) => formatarDiaISO(decisao.data) },
    { id: 'decidido', titulo: 'Decidido por', celula: (decisao) => nomesDosDecisores(decisao.id, dados).join(', ') },
    { id: 'contexto', titulo: 'Contexto', celula: (decisao) => nomeDoContexto(decisao.produto_id, dados.produtos) },
    { id: 'area', titulo: 'Área', celula: (decisao) => nomeDaArea(decisao.area_id) ?? <span className="text-ink-soft">Nenhuma</span> },
    {
      id: 'situacao',
      titulo: 'Situação',
      essencial: true,
      celula: (decisao) => (
        <span className="grid justify-items-start gap-0.5">
          <SituacaoDaDecisao situacao={decisao.situacao} />
          {codigoDaSubstituta(decisao) && <span className="text-xs text-ink-soft">por {codigoDaSubstituta(decisao)}</span>}
        </span>
      ),
    },
  ];

  return moldura(
    <>
      <section aria-label="Filtros das decisões" className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_170px_170px_190px]">
          <div>
            <label htmlFor="busca-decisoes" className="mb-[7px] block texto-rotulo">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input id="busca-decisoes" type="search" placeholder="Código, título ou texto" value={filtros.busca} onChange={(evento) => setFiltros({ ...filtros, busca: evento.target.value })} className="rounded-pill bg-paper pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="filtro-decisao-situacao" className="mb-[7px] block texto-rotulo">
              Situação
            </label>
            <Selecao id="filtro-decisao-situacao" value={filtros.situacao} onChange={(evento) => setFiltros({ ...filtros, situacao: evento.target.value })}>
              <option value="">Todas</option>
              <option value="registrada">Registrada</option>
              <option value="substituida">Substituída</option>
            </Selecao>
          </div>
          <div>
            <label htmlFor="filtro-decisao-contexto" className="mb-[7px] block texto-rotulo">
              Contexto
            </label>
            <Selecao id="filtro-decisao-contexto" value={filtros.contexto} onChange={(evento) => setFiltros({ ...filtros, contexto: evento.target.value })}>
              <option value="">Todos</option>
              <option value="numa">Numa</option>
              {contextos.map((id) => (
                <option key={id} value={id}>
                  {nomeDoContexto(id, dados.produtos)}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <label htmlFor="filtro-decisao-area" className="mb-[7px] block texto-rotulo">
              Área
            </label>
            <Selecao id="filtro-decisao-area" value={filtros.area} onChange={(evento) => setFiltros({ ...filtros, area: evento.target.value })}>
              <option value="">Todas</option>
              {dados.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.nome}
                </option>
              ))}
            </Selecao>
          </div>
        </div>
        <EtiquetasDosFiltros ativos={ativos} aoRemoverAtivo={(id) => setFiltros({ ...filtros, [id]: '' })} aoLimpar={() => setFiltros(FILTROS_DECISOES_INICIAIS)} />
        <p role="status" className="text-sm font-semibold">
          {linhas.length === 1 ? '1 decisão' : `${linhas.length} decisões`}
        </p>
      </section>
      <Lista
        rotulo="Decisões"
        linhas={linhas}
        colunas={colunas}
        chave={(decisao) => decisao.id}
        aoAbrir={(decisao) => roteador.push(`/empresa/decisoes/${decisao.id}`)}
        filtrando={ativos.length > 0}
        aoLimparFiltros={() => setFiltros(FILTROS_DECISOES_INICIAIS)}
        vazio={<EstadoVazio icone={Gavel} titulo="Nenhuma decisão registrada." texto="O que as sócias decidem fica aqui, com o motivo e quem decidiu." acao={<Button onClick={() => setNova(true)}>Nova decisão</Button>} />}
        cartao={(decisao) => (
          <span className="grid justify-items-start gap-1.5">
            <span className="text-xs font-semibold text-ink-soft tabular-nums">{decisao.codigo}</span>
            <span className="font-semibold">{decisao.titulo}</span>
            <SituacaoDaDecisao situacao={decisao.situacao} />
            <span className="text-[13px] text-ink-soft">
              {formatarDiaISO(decisao.data)} · {nomesDosDecisores(decisao.id, dados).join(', ')}
            </span>
            <span className="text-[13px] text-ink-soft">Contexto: {nomeDoContexto(decisao.produto_id, dados.produtos)}</span>
          </span>
        )}
      />
      {nova && <FormularioDaDecisao dados={dados} aoFechar={() => setNova(false)} aoRegistrar={(decisao) => roteador.push(`/empresa/decisoes/${decisao.id}`)} />}
    </>,
  );
}
