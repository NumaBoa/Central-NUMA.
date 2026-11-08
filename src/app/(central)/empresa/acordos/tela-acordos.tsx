'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ListOrdered, Plus, Search } from 'lucide-react';
import { Selecao } from '@/componentes/campos/selecao';
import { MolduraDaEmpresa, ResumoDaEmpresa, SituacaoDaVersaoDoAcordo } from '@/componentes/empresa/aparencia';
import { FormularioDoAcordo } from '@/componentes/empresa/formulario-acordo';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetasDosFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { SITUACOES_DA_VERSAO, TIPOS_DE_ACORDO } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { carregarAcordos, faltaTitularidade, FILTROS_ACORDOS_INICIAIS, linhasDosAcordos, ROTEIRO_DO_MEMORANDO, ROTULOS_SITUACAO_VERSAO, ROTULOS_TIPO_ACORDO, versaoVigente, type LinhaDoAcordo } from '@/dominio/acordos';
import { entidadePrincipal } from '@/dominio/constituicao';
import { ROTULOS_SITUACAO_ENTIDADE } from '@/dominio/entidades';
import { nomeDaPessoa, sociasAtivas, textoDaParticipacao } from '@/dominio/sociedade';
import { formatarDiaISO } from '@/lib/formatacao';

const COLUNAS: readonly Coluna<LinhaDoAcordo>[] = [
  {
    id: 'titulo',
    titulo: 'Título e tipo',
    essencial: true,
    ordenar: (a, b) => a.acordo.titulo.localeCompare(b.acordo.titulo, 'pt-BR'),
    celula: ({ acordo }) => (
      <span className="grid">
        <span className="font-semibold">{acordo.titulo}</span>
        <span className="text-xs text-ink-soft">
          {ROTULOS_TIPO_ACORDO[acordo.tipo]} · {acordo.codigo}
        </span>
      </span>
    ),
  },
  { id: 'versao', titulo: 'Versão', celula: ({ versao, vigente }) => (vigente ? `V${vigente.numero}${versao && versao.id !== vigente.id ? ` (V${versao.numero} em andamento)` : ''}` : versao ? `V${versao.numero}` : 'Sem versão') },
  { id: 'situacao', titulo: 'Situação', essencial: true, celula: ({ versao }) => (versao ? <SituacaoDaVersaoDoAcordo situacao={versao.situacao} /> : '—') },
  { id: 'assinatura', titulo: 'Assinatura', celula: ({ assinatura }) => assinatura },
  { id: 'revisao', titulo: 'Próxima revisão', celula: ({ revisao }) => (revisao ? formatarDiaISO(revisao) : <span className="text-ink-soft">Não definida</span>) },
];

function JanelaDoRoteiro({ aoFechar }: { aoFechar: () => void }) {
  return (
    <JanelaFormulario soLeitura aberto aoFechar={aoFechar} titulo="Roteiro do memorando" descricao="Os tópicos do resumo estruturado. O texto final é redigido fora da Central e validado por Kimberly." aoEnviar={(evento) => evento.preventDefault()}>
      <ol className="grid gap-3 text-sm">
        {ROTEIRO_DO_MEMORANDO.map(({ topico, guia }, indice) => (
          <li key={topico} className="grid grid-cols-[28px_minmax(0,1fr)]">
            <span className="font-semibold tabular-nums text-ink-soft">{indice + 1}</span>
            <span>
              <span className="font-semibold">{topico}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{guia}</span>
            </span>
          </li>
        ))}
      </ol>
    </JanelaFormulario>
  );
}

/** T06.03: a lista de acordos. O sistema não gera minuta jurídica nesta fase. */
export function TelaAcordos() {
  const roteador = useRouter();
  const consulta = useConsulta(carregarAcordos);
  const [filtros, setFiltros] = useState(FILTROS_ACORDOS_INICIAIS);
  const [novo, setNovo] = useState(false);
  const [roteiro, setRoteiro] = useState(false);
  const linhas = useMemo(() => (consulta.dados ? linhasDosAcordos(consulta.dados, filtros) : []), [consulta.dados, filtros]);

  const moldura = (conteudo: React.ReactNode) => (
    <MolduraDaEmpresa
      ativa="acordos"
      titulo="Acordos societários"
      resumo="Memorandos, termos e demais acordos entre as sócias e sobre os ativos da Numa."
      acoes={
        <Button onClick={() => setNovo(true)} disabled={!consulta.dados}>
          <Plus aria-hidden />
          Novo acordo
        </Button>
      }
    >
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro') return moldura(<EstadoErro titulo="Não deu para ler os acordos." aoTentarDeNovo={consulta.recarregar} />);

  const dados = consulta.dados;
  const entidade = entidadePrincipal(dados.entidades);
  const memorando = dados.acordos.find((acordo) => acordo.tipo === 'memorando' || acordo.tipo === 'acordo_socias');
  const linhaDoMemorando = memorando ? linhasDosAcordos(dados, { ...FILTROS_ACORDOS_INICIAIS, busca: memorando.codigo })[0] : undefined;
  const vigentes = dados.acordos.filter((acordo) => versaoVigente(acordo.id, dados.versoes));
  const ativos: FiltroAtivo[] = [
    ...(filtros.busca.trim() ? [{ id: 'busca', rotulo: `Busca: ${filtros.busca.trim()}` }] : []),
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_ACORDO[filtros.tipo as keyof typeof ROTULOS_TIPO_ACORDO]}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_VERSAO[filtros.situacao as keyof typeof ROTULOS_SITUACAO_VERSAO]}` }] : []),
  ];

  return moldura(
    <>
      <ResumoDaEmpresa
        itens={[
          { rotulo: 'Entidade', valor: entidade ? ROTULOS_SITUACAO_ENTIDADE[entidade.situacao] : 'Nenhuma' },
          { rotulo: 'Sócias (participação)', valor: sociasAtivas(dados.socias).map((socia) => `${nomeDaPessoa(dados.pessoas, socia.pessoa_id)} (${textoDaParticipacao(socia.participacao)})`).join(' · ') },
          ...(linhaDoMemorando?.versao ? [{ rotulo: 'Memorando (atual)', valor: `V${linhaDoMemorando.versao.numero} · ${ROTULOS_SITUACAO_VERSAO[linhaDoMemorando.versao.situacao]}` }] : []),
        ]}
      />
      {faltaTitularidade(dados.versoes) && <Faixa tipo="atencao">Formalize a titularidade dos ativos e da propriedade intelectual em um acordo vigente (RN-06.06).</Faixa>}

      <section aria-label="Filtros dos acordos" className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div>
            <label htmlFor="busca-acordos" className="mb-[7px] block texto-rotulo">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input id="busca-acordos" type="search" placeholder="Título ou código" value={filtros.busca} onChange={(evento) => setFiltros({ ...filtros, busca: evento.target.value })} className="rounded-pill bg-paper pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="filtro-acordo-tipo" className="mb-[7px] block texto-rotulo">
              Tipo
            </label>
            <Selecao id="filtro-acordo-tipo" value={filtros.tipo} onChange={(evento) => setFiltros({ ...filtros, tipo: evento.target.value })}>
              <option value="">Todos</option>
              {TIPOS_DE_ACORDO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULOS_TIPO_ACORDO[tipo]}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <label htmlFor="filtro-acordo-situacao" className="mb-[7px] block texto-rotulo">
              Situação
            </label>
            <Selecao id="filtro-acordo-situacao" value={filtros.situacao} onChange={(evento) => setFiltros({ ...filtros, situacao: evento.target.value })}>
              <option value="">Todas</option>
              {SITUACOES_DA_VERSAO.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {ROTULOS_SITUACAO_VERSAO[situacao]}
                </option>
              ))}
            </Selecao>
          </div>
        </div>
        <EtiquetasDosFiltros ativos={ativos} aoRemoverAtivo={(id) => setFiltros({ ...filtros, [id]: '' })} aoLimpar={() => setFiltros(FILTROS_ACORDOS_INICIAIS)} />
        <p role="status" className="text-sm font-semibold">
          {linhas.length === 1 ? '1 acordo' : `${linhas.length} acordos`}
          <span className="font-normal text-ink-soft"> · {vigentes.length ? `${vigentes.length} vigente${vigentes.length === 1 ? '' : 's'}` : 'nenhum vigente'}</span>
        </p>
      </section>

      <Lista
        rotulo="Acordos societários"
        linhas={linhas}
        colunas={COLUNAS}
        chave={(linha) => linha.acordo.id}
        aoAbrir={(linha) => roteador.push(`/empresa/acordos/${linha.acordo.id}`)}
        filtrando={ativos.length > 0}
        aoLimparFiltros={() => setFiltros(FILTROS_ACORDOS_INICIAIS)}
        vazio={<EstadoVazio icone={FileText} titulo="Nenhum acordo ainda." texto="O roteiro do memorando ajuda a organizar o primeiro." acao={<Button onClick={() => setNovo(true)}>Novo acordo</Button>} />}
        cartao={({ acordo, versao, assinatura, revisao }) => (
          <span className="grid gap-1.5">
            <span className="font-semibold">{acordo.titulo}</span>
            <span className="text-[13px] text-ink-soft">
              {ROTULOS_TIPO_ACORDO[acordo.tipo]} · {versao ? `V${versao.numero}` : 'Sem versão'}
            </span>
            {versao && (
              <span>
                <SituacaoDaVersaoDoAcordo situacao={versao.situacao} />
              </span>
            )}
            <span className="text-[13px] text-ink-soft">Assinatura: {assinatura}</span>
            <span className="text-[13px] text-ink-soft">Revisão: {revisao ? formatarDiaISO(revisao) : 'Não definida'}</span>
          </span>
        )}
      />

      <button type="button" onClick={() => setRoteiro(true)} className="flex w-full items-center gap-3 rounded-lg border border-line bg-paper p-4 text-left hover:border-ink">
        <ListOrdered className="size-5 shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0">
          <span className="block font-semibold text-indigo-dk">Roteiro do memorando</span>
          <span className="block text-[13px] text-ink-soft">Roteiro de tópicos. O texto final é elaborado fora da Central.</span>
        </span>
      </button>

      {novo && <FormularioDoAcordo dados={dados} aoFechar={() => setNovo(false)} aoCriar={(acordo) => roteador.push(`/empresa/acordos/${acordo.id}`)} />}
      {roteiro && <JanelaDoRoteiro aoFechar={() => setRoteiro(false)} />}
    </>,
  );
}
