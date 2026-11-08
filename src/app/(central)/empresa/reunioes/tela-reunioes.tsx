'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Plus, Search } from 'lucide-react';
import { MolduraDaEmpresa, SubabasDeReunioes } from '@/componentes/empresa/aparencia';
import { FormularioDaReuniao } from '@/componentes/empresa/formularios-reuniao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { useConsulta } from '@/dados/use-consulta';
import { carregarReunioes, linhasDasReunioes, type LinhaDaReuniao } from '@/dominio/reunioes';
import { formatarDiaISO } from '@/lib/formatacao';

const COLUNAS: readonly Coluna<LinhaDaReuniao>[] = [
  { id: 'data', titulo: 'Data', essencial: true, ordenar: (a, b) => a.reuniao.data_hora.localeCompare(b.reuniao.data_hora), celula: ({ dia, hora }) => <span className="tabular-nums whitespace-nowrap">{formatarDiaISO(dia)} · {hora}</span> },
  {
    id: 'titulo',
    titulo: 'Título',
    essencial: true,
    celula: ({ reuniao }) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{reuniao.titulo}</span>
        {reuniao.arquivado_em && <EtiquetaLivre>Arquivada</EtiquetaLivre>}
      </span>
    ),
  },
  { id: 'participantes', titulo: 'Participantes', celula: ({ participantes }) => participantes.join(', ') },
  { id: 'contexto', titulo: 'Contexto', celula: ({ contexto }) => contexto },
  { id: 'decisoes', titulo: 'Decisões', numerica: true, celula: ({ decisoes }) => decisoes },
  { id: 'acoes', titulo: 'Ações abertas', numerica: true, celula: ({ acoesAbertas }) => acoesAbertas },
];

/** T06.09: a lista de reuniões. Decisões têm a própria lista, na mesma área. */
export function TelaReunioes() {
  const roteador = useRouter();
  const consulta = useConsulta(carregarReunioes);
  const [busca, setBusca] = useState('');
  const [arquivadas, setArquivadas] = useState(false);
  const [nova, setNova] = useState(false);
  const dados = consulta.dados;
  const linhas = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return linhasDasReunioes(dados).filter(({ reuniao, participantes, contexto }) => (arquivadas || !reuniao.arquivado_em) && (!termo || `${reuniao.titulo} ${reuniao.codigo} ${contexto} ${participantes.join(' ')}`.toLocaleLowerCase('pt-BR').includes(termo)));
  }, [dados, busca, arquivadas]);

  const moldura = (conteudo: React.ReactNode) => (
    <MolduraDaEmpresa
      ativa="reunioes"
      titulo="Reuniões e decisões"
      resumo="O que as sócias combinaram, com as ações que saíram de cada reunião."
      acoes={
        <Button onClick={() => setNova(true)} disabled={!dados}>
          <Plus aria-hidden />
          Nova reunião
        </Button>
      }
    >
      <SubabasDeReunioes ativa="reunioes" />
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro' || !dados) return moldura(<EstadoErro titulo="Não deu para ler as reuniões." aoTentarDeNovo={consulta.recarregar} />);

  return moldura(
    <>
      <section aria-label="Filtros das reuniões" className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 md:max-w-sm">
          <label htmlFor="busca-reunioes" className="sr-only">
            Buscar reunião
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <Input id="busca-reunioes" type="search" placeholder="Título, código ou participante" value={busca} onChange={(evento) => setBusca(evento.target.value)} className="rounded-pill bg-paper pl-10" />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] md:min-h-0">
          <input type="checkbox" className="size-[18px] accent-[var(--ok)]" checked={arquivadas} onChange={(evento) => setArquivadas(evento.target.checked)} />
          Mostrar arquivadas
        </label>
        <p role="status" className="w-full text-sm font-semibold">
          {linhas.length === 1 ? '1 reunião' : `${linhas.length} reuniões`}
        </p>
      </section>
      <Lista
        rotulo="Reuniões"
        linhas={linhas}
        colunas={COLUNAS}
        chave={(linha) => linha.reuniao.id}
        aoAbrir={(linha) => roteador.push(`/empresa/reunioes/${linha.reuniao.id}`)}
        filtrando={Boolean(busca.trim())}
        aoLimparFiltros={() => setBusca('')}
        vazio={<EstadoVazio icone={CalendarDays} titulo="Nenhuma reunião registrada." texto="Registre a próxima conversa das sócias, com pauta, decisões e ações." acao={<Button onClick={() => setNova(true)}>Nova reunião</Button>} />}
        cartao={({ reuniao, dia, hora, participantes, contexto, decisoes, acoesAbertas }) => (
          <span className="grid gap-1.5">
            <span className="font-semibold">{reuniao.titulo}</span>
            <span className="text-[13px] text-ink-soft tabular-nums">
              {formatarDiaISO(dia)} · {hora} · {contexto}
            </span>
            <span className="text-[13px] text-ink-soft">{participantes.join(', ')}</span>
            <span className="text-[13px] text-ink-soft">
              {decisoes} {decisoes === 1 ? 'decisão' : 'decisões'} · {acoesAbertas} {acoesAbertas === 1 ? 'ação aberta' : 'ações abertas'}
            </span>
          </span>
        )}
      />
      {nova && <FormularioDaReuniao dados={dados} aoFechar={() => setNova(false)} aoCriar={(reuniao) => roteador.push(`/empresa/reunioes/${reuniao.id}`)} />}
    </>,
  );
}
