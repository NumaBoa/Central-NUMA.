'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { MolduraDaEmpresa, SituacaoDaObrigacao } from '@/componentes/empresa/aparencia';
import { FormularioDaObrigacao } from '@/componentes/empresa/formulario-obrigacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { EtiquetasDosFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { PERIODICIDADES, SITUACOES_DA_OBRIGACAO } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { faseLiberada } from '@/dominio/navegacao';
import { carregarObrigacoes, filtrarObrigacoes, MENSAGEM_FASE_DAS_OBRIGACOES, FILTROS_OBRIGACOES_INICIAIS, linhasDasObrigacoes, NOTA_PAGAMENTO, NOTA_SEM_PRESUNCAO, ROTULOS_PERIODICIDADE_OBRIGACAO, ROTULOS_SITUACAO_OBRIGACAO, type LinhaDaObrigacao } from '@/dominio/obrigacoes';
import { nomeDaPessoa } from '@/dominio/sociedade';
import { formatarDiaISO } from '@/lib/formatacao';

/** T06.08 (F1). Antes da F1, a tela só abre pelo endereço, e nada gera ocorrência. */
export function TelaObrigacoes() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const consulta = useConsulta(carregarObrigacoes);
  const [filtros, setFiltros] = useState(FILTROS_OBRIGACOES_INICIAIS);
  const [nova, setNova] = useState(false);
  const dados = consulta.dados;
  const todas = useMemo(() => (dados ? linhasDasObrigacoes(dados) : []), [dados]);
  const linhas = useMemo(() => filtrarObrigacoes(todas, filtros), [todas, filtros]);

  // Vindo do alerta de uma ocorrência (05-M03 §5): abre a obrigação.
  const ocorrenciaPedida = parametros.get('ocorrencia');
  useEffect(() => {
    if (!ocorrenciaPedida || !dados) return;
    const ocorrencia = dados.ocorrencias.find((item) => item.id === ocorrenciaPedida);
    if (ocorrencia) roteador.replace(`/empresa/obrigacoes/${ocorrencia.obrigacao_id}`);
  }, [ocorrenciaPedida, dados, roteador]);

  const moldura = (conteudo: React.ReactNode) => (
    <MolduraDaEmpresa
      ativa="obrigacoes"
      titulo="Obrigações corporativas"
      resumo={NOTA_SEM_PRESUNCAO}
      acoes={
        <Button onClick={() => setNova(true)} disabled={!dados}>
          <Plus aria-hidden />
          Nova obrigação
        </Button>
      }
    >
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro' || !dados) return moldura(<EstadoErro titulo="Não deu para ler as obrigações." aoTentarDeNovo={consulta.recarregar} />);

  const nomeDaEntidade = (id: string) => dados.entidades.find((entidade) => entidade.id === id)?.nome ?? 'Entidade removida';
  const nomeDaCategoria = (id: string) => dados.categorias.find((categoria) => categoria.id === id)?.nome ?? '';
  const responsaveis = [...new Set(dados.obrigacoes.map((obrigacao) => obrigacao.responsavel_id))];
  const categorias = [...new Set(dados.obrigacoes.flatMap((obrigacao) => (obrigacao.categoria_id ? [obrigacao.categoria_id] : [])))];
  const ativos: FiltroAtivo[] = [
    ...(filtros.busca.trim() ? [{ id: 'busca', rotulo: `Busca: ${filtros.busca.trim()}` }] : []),
    ...(filtros.entidade ? [{ id: 'entidade', rotulo: `Entidade: ${nomeDaEntidade(filtros.entidade)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_OBRIGACAO[filtros.situacao as keyof typeof ROTULOS_SITUACAO_OBRIGACAO]}` }] : []),
    ...(filtros.periodicidade ? [{ id: 'periodicidade', rotulo: `Periodicidade: ${ROTULOS_PERIODICIDADE_OBRIGACAO[filtros.periodicidade as keyof typeof ROTULOS_PERIODICIDADE_OBRIGACAO]}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomeDaPessoa(dados.pessoas, filtros.responsavel)}` }] : []),
    ...(filtros.categoria ? [{ id: 'categoria', rotulo: `Categoria: ${nomeDaCategoria(filtros.categoria)}` }] : []),
  ];
  const quantosMais = [filtros.periodicidade, filtros.responsavel, filtros.categoria].filter(Boolean).length;

  const colunas: readonly Coluna<LinhaDaObrigacao>[] = [
    {
      id: 'nome',
      titulo: 'Obrigação',
      essencial: true,
      ordenar: (a, b) => a.obrigacao.nome.localeCompare(b.obrigacao.nome, 'pt-BR'),
      celula: ({ obrigacao }) => (
        <span className="grid justify-items-start gap-1">
          <span className="font-semibold">{obrigacao.nome}</span>
          <SituacaoDaObrigacao situacao={obrigacao.situacao} />
        </span>
      ),
    },
    { id: 'orgao', titulo: 'Órgão', celula: ({ obrigacao }) => obrigacao.orgao ?? <span className="text-ink-soft">Não informado</span> },
    { id: 'periodicidade', titulo: 'Periodicidade', celula: ({ obrigacao }) => ROTULOS_PERIODICIDADE_OBRIGACAO[obrigacao.periodicidade] },
    { id: 'proximo', titulo: 'Próximo vencimento', essencial: true, ordenar: (a, b) => (a.proximo ?? '9999').localeCompare(b.proximo ?? '9999'), celula: ({ proximo }) => (proximo ? formatarDiaISO(proximo) : <span className="text-ink-soft">Nenhum</span>) },
    { id: 'responsavel', titulo: 'Responsável', celula: ({ obrigacao }) => nomeDaPessoa(dados.pessoas, obrigacao.responsavel_id) },
    { id: 'ultima', titulo: 'Última cumprida', celula: ({ ultimaCumprida }) => (ultimaCumprida?.cumprida_em ? formatarDiaISO(ultimaCumprida.cumprida_em) : <span className="text-ink-soft">Nenhuma</span>) },
  ];

  return moldura(
    <>
      {!faseLiberada('f1', dados.fase) && <Faixa tipo="info">{MENSAGEM_FASE_DAS_OBRIGACOES}</Faixa>}
      <section aria-label="Filtros das obrigações" className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_200px_170px_auto] md:items-end">
          <div>
            <label htmlFor="busca-obrigacoes" className="mb-[7px] block texto-rotulo">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <Input id="busca-obrigacoes" type="search" placeholder="Nome ou órgão" value={filtros.busca} onChange={(evento) => setFiltros({ ...filtros, busca: evento.target.value })} className="rounded-pill bg-paper pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="filtro-obrigacao-entidade" className="mb-[7px] block texto-rotulo">
              Entidade
            </label>
            <Selecao id="filtro-obrigacao-entidade" value={filtros.entidade} onChange={(evento) => setFiltros({ ...filtros, entidade: evento.target.value })}>
              <option value="">Todas</option>
              {dados.entidades.map((entidade) => (
                <option key={entidade.id} value={entidade.id}>
                  {entidade.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <label htmlFor="filtro-obrigacao-situacao" className="mb-[7px] block texto-rotulo">
              Situação
            </label>
            <Selecao id="filtro-obrigacao-situacao" value={filtros.situacao} onChange={(evento) => setFiltros({ ...filtros, situacao: evento.target.value })}>
              <option value="">Todas</option>
              {SITUACOES_DA_OBRIGACAO.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {ROTULOS_SITUACAO_OBRIGACAO[situacao]}
                </option>
              ))}
            </Selecao>
          </div>
          <MenuSobreposto
            titulo="Mais filtros"
            alinhar="end"
            gatilho={
              <Button variante="secundario" className="shrink-0">
                <SlidersHorizontal aria-hidden />
                {quantosMais ? `Mais filtros (${quantosMais})` : 'Mais filtros'}
              </Button>
            }
          >
            <div className="grid gap-4 px-3 pb-2">
              <Campo id="filtro-obrigacao-periodicidade" rotulo="Periodicidade">
                {(controle) => (
                  <Selecao {...controle} value={filtros.periodicidade} onChange={(evento) => setFiltros({ ...filtros, periodicidade: evento.target.value })}>
                    <option value="">Todas</option>
                    {PERIODICIDADES.map((valor) => (
                      <option key={valor} value={valor}>
                        {ROTULOS_PERIODICIDADE_OBRIGACAO[valor]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Campo id="filtro-obrigacao-responsavel" rotulo="Responsável">
                {(controle) => (
                  <Selecao {...controle} value={filtros.responsavel} onChange={(evento) => setFiltros({ ...filtros, responsavel: evento.target.value })}>
                    <option value="">Todas</option>
                    {responsaveis.map((id) => (
                      <option key={id} value={id}>
                        {nomeDaPessoa(dados.pessoas, id)}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Campo id="filtro-obrigacao-categoria" rotulo="Categoria">
                {(controle) => (
                  <Selecao {...controle} value={filtros.categoria} onChange={(evento) => setFiltros({ ...filtros, categoria: evento.target.value })}>
                    <option value="">Todas</option>
                    {categorias.map((id) => (
                      <option key={id} value={id}>
                        {nomeDaCategoria(id)}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </div>
          </MenuSobreposto>
        </div>
        <EtiquetasDosFiltros ativos={ativos} aoRemoverAtivo={(id) => setFiltros({ ...filtros, [id]: '' })} aoLimpar={() => setFiltros(FILTROS_OBRIGACOES_INICIAIS)} />
        <p role="status" className="text-sm font-semibold">
          {linhas.length === 1 ? '1 obrigação' : `${linhas.length} obrigações`}
        </p>
      </section>
      <Lista
        rotulo="Obrigações corporativas"
        linhas={linhas}
        colunas={colunas}
        chave={(linha) => linha.obrigacao.id}
        aoAbrir={(linha) => roteador.push(`/empresa/obrigacoes/${linha.obrigacao.id}`)}
        filtrando={ativos.length > 0}
        aoLimparFiltros={() => setFiltros(FILTROS_OBRIGACOES_INICIAIS)}
        vazio={<EstadoVazio icone={CalendarClock} titulo="Nenhuma obrigação cadastrada." texto="Cadastre as obrigações da entidade para organizar prazos, responsáveis e ocorrências." acao={<Button onClick={() => setNova(true)}>Nova obrigação</Button>} />}
        cartao={({ obrigacao, proximo, ultimaCumprida }) => (
          <span className="grid justify-items-start gap-1.5">
            <span className="font-semibold">{obrigacao.nome}</span>
            <SituacaoDaObrigacao situacao={obrigacao.situacao} />
            <span className="text-[13px] text-ink-soft">
              {obrigacao.orgao ?? 'Órgão não informado'} · {ROTULOS_PERIODICIDADE_OBRIGACAO[obrigacao.periodicidade]}
            </span>
            <span className="text-[13px] text-ink-soft">Próximo vencimento: {proximo ? formatarDiaISO(proximo) : 'Nenhum'}</span>
            <span className="text-[13px] text-ink-soft">Responsável: {nomeDaPessoa(dados.pessoas, obrigacao.responsavel_id)}</span>
            <span className="text-[13px] text-ink-soft">Última cumprida: {ultimaCumprida?.cumprida_em ? formatarDiaISO(ultimaCumprida.cumprida_em) : 'Nenhuma'}</span>
          </span>
        )}
      />
      <Faixa tipo="info">{NOTA_PAGAMENTO} Cada ocorrência registra o cumprimento, com data e comprovante; o pagamento é a baixa do título, em Financeiro.</Faixa>
      {nova && <FormularioDaObrigacao dados={dados} aoFechar={() => setNova(false)} />}
    </>,
  );
}
