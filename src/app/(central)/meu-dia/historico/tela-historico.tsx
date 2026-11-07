'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, History } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Input } from '@/componentes/ui/input';
import { useConsulta } from '@/dados/use-consulta';
import { carregarMeuDia, contextosDaAtividade, prazoEfetivo, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import { atividadesDoHistorico, CONCLUIDA_PELO_SISTEMA, encerradaEm, FILTROS_HISTORICO_INICIAIS, ROTULOS_PERIODO_CONCLUSAO, type FiltrosHistorico, type PeriodoDaConclusao } from '@/dominio/atividades-historico';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO } from '@/lib/formatacao';
import { useAcoesDaAtividade } from '../acoes-atividade';
import { MenuDaAtividade, TipoDaAtividade } from '../cartao-atividade';
import { ativosComuns, CamposAvancados, removerComum } from '../filtros-meu-dia';
import { SituacaoDaAtividade } from '../lista-atividades';
import { PainelAtividade } from '../painel-atividade';

const CAMINHO = '/meu-dia/historico';
const NA_ORDEM_DA_CONCLUSAO = (a: AtividadeDoDia, b: AtividadeDoDia) => encerradaEm(a).localeCompare(encerradaEm(b));

function quemConcluiu(atividade: AtividadeDoDia, dados: DadosMeuDia): string {
  if (!atividade.concluida_por) return 'Sistema';
  return dados.pessoas.find((pessoa) => pessoa.id === atividade.concluida_por)?.nome_completo ?? 'Pessoa removida';
}

const textoDoPrazo = (atividade: AtividadeDoDia) => {
  const prazo = prazoEfetivo(atividade);
  return prazo ? formatarDiaISO(prazo) : 'Sem prazo';
};

/** T03.04: o que já foi concluído ou cancelado, com os filtros do Meu dia (CA-03.08). */
export function TelaHistorico() {
  const { pessoa, contexto } = useCentral();
  const painelId = useSearchParams().get('atividade');
  const consulta = useConsulta(carregarMeuDia);
  const [filtros, setFiltros] = useState<FiltrosHistorico>(FILTROS_HISTORICO_INICIAIS);
  const dados = consulta.dados;
  const hoje = hojeISO();
  const abrirPainel = useCallback((id: string) => window.history.pushState(null, '', `${CAMINHO}?atividade=${id}`), []);
  const fecharPainel = useCallback(() => window.history.pushState(null, '', CAMINHO), []);
  const { acoes, dialogos } = useAcoesDaAtividade(dados, hoje, abrirPainel);

  const nomeDaPessoa = (id: string) => dados?.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
  const linhas = useMemo(() => (dados ? atividadesDoHistorico(dados.atividades, filtros, { hoje, pessoaAtualId: pessoa.id, contextoGlobalId: contexto.id, nomeDaPessoa }) : []), [dados, filtros, hoje, pessoa.id, contexto.id]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaPessoa só depende de dados
  const mudar = (parcial: Partial<FiltrosHistorico>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));

  const colunas = useMemo<readonly Coluna<AtividadeDoDia>[]>(() => {
    if (!dados) return [];
    return [
      {
        id: 'titulo',
        titulo: 'Atividade',
        essencial: true,
        celula: (atividade) => (
          <span className="grid min-w-44 gap-0.5">
            <span className="font-medium break-words">{atividade.titulo}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft tabular-nums">
              <TipoDaAtividade tipo={atividade.tipo} />
              {atividade.codigo}
            </span>
          </span>
        ),
      },
      { id: 'responsavel', titulo: 'Responsável', celula: (atividade) => <NomeDaPessoa nome={nomeDaPessoa(atividade.responsavel_id)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
      {
        id: 'contexto',
        titulo: 'Contexto',
        celula: (atividade) => (
          <span className="flex flex-wrap gap-1">
            {contextosDaAtividade(atividade, dados).map((item) => (
              <EtiquetaContexto key={item.id} contexto={item} />
            ))}
          </span>
        ),
      },
      { id: 'prazo', titulo: 'Prazo', celula: (atividade) => <span className="whitespace-nowrap">{textoDoPrazo(atividade)}</span> },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (atividade) => <SituacaoDaAtividade atividade={atividade} /> },
      {
        id: 'encerrada',
        titulo: 'Concluída em e por',
        essencial: true,
        ordenar: NA_ORDEM_DA_CONCLUSAO,
        celula: (atividade) => (
          <span className="grid gap-0.5 whitespace-nowrap">
            <span className="tabular-nums">{formatarData(encerradaEm(atividade))}</span>
            {atividade.situacao === 'concluida' && <span className="text-xs text-ink-soft">{quemConcluiu(atividade, dados)}</span>}
          </span>
        ),
      },
      { id: 'motivo', titulo: 'Motivo do cancelamento', celula: (atividade) => <span className="block max-w-48 break-words whitespace-normal">{atividade.cancelada_motivo ?? '—'}</span> },
    ];
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaPessoa só depende de dados

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Histórico</h1>
        <EstadoErro titulo="Não deu para ler o histórico." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const pessoas = pessoasDoSeletor(dados.pessoas);
  const ativos: FiltroAtivo[] = [
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${filtros.situacao === 'concluida' ? 'Concluída' : 'Cancelada'}` }] : []),
    ...(filtros.conclusao ? [{ id: 'conclusao', rotulo: `Concluída: ${ROTULOS_PERIODO_CONCLUSAO[filtros.conclusao]}` }] : []),
    ...(filtros.concluidaPor ? [{ id: 'concluidaPor', rotulo: `Concluída por: ${filtros.concluidaPor === CONCLUIDA_PELO_SISTEMA ? 'Sistema' : nomeDaPessoa(filtros.concluidaPor)}` }] : []),
    ...ativosComuns(filtros, dados),
  ];

  function remover(id: string) {
    if (id === 'conclusao') return mudar({ conclusao: '', conclusaoDe: '', conclusaoAte: '' });
    if (id === 'situacao' || id === 'concluidaPor') return mudar({ [id]: '' });
    removerComum(id, filtros, mudar);
  }

  const limpar = () => setFiltros(FILTROS_HISTORICO_INICIAIS);

  return (
    <div className="space-y-5">
      <header>
        <LinkCentral href="/meu-dia" className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
          <ArrowLeft aria-hidden />
          Meu dia
        </LinkCentral>
        <h1>Histórico</h1>
        <p className="mt-1 text-sm text-ink-soft">O que já foi concluído ou cancelado. Dá para abrir e reabrir, com motivo.</p>
      </header>

      <BarraFiltros
        busca={filtros.busca}
        aoBuscar={(busca) => mudar({ busca })}
        rotuloBusca="Buscar por título, código, descrição ou responsável"
        ativos={ativos}
        aoRemoverAtivo={remover}
        aoLimpar={limpar}
        filtrosDetalhados={
          <div className="grid gap-4 px-1 pb-2 md:px-3">
            <Campo rotulo="Situação" id="filtro-situacao">
              {(controle) => (
                <Selecao {...controle} value={filtros.situacao} onChange={(evento) => mudar({ situacao: evento.target.value as FiltrosHistorico['situacao'] })}>
                  <option value="">Concluídas e canceladas</option>
                  <option value="concluida">Concluídas</option>
                  <option value="cancelada">Canceladas</option>
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Período de conclusão" id="filtro-conclusao">
              {(controle) => (
                <Selecao {...controle} value={filtros.conclusao} onChange={(evento) => mudar({ conclusao: evento.target.value as PeriodoDaConclusao, conclusaoDe: '', conclusaoAte: '' })}>
                  <option value="">Todos</option>
                  {Object.entries(ROTULOS_PERIODO_CONCLUSAO).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            {filtros.conclusao === 'intervalo' && (
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="De" id="filtro-conclusao-de">
                  {(controle) => <Input type="date" {...controle} value={filtros.conclusaoDe} onChange={(evento) => mudar({ conclusaoDe: evento.target.value })} />}
                </Campo>
                <Campo rotulo="Até" id="filtro-conclusao-ate">
                  {(controle) => <Input type="date" {...controle} value={filtros.conclusaoAte} onChange={(evento) => mudar({ conclusaoAte: evento.target.value })} />}
                </Campo>
              </div>
            )}
            <Campo rotulo="Concluída por" id="filtro-concluida-por">
              {(controle) => (
                <Selecao {...controle} value={filtros.concluidaPor} onChange={(evento) => mudar({ concluidaPor: evento.target.value })}>
                  <option value="">Qualquer pessoa</option>
                  {pessoas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome_completo}
                    </option>
                  ))}
                  <option value={CONCLUIDA_PELO_SISTEMA}>Sistema</option>
                </Selecao>
              )}
            </Campo>
            <CamposAvancados filtros={filtros} aoMudar={mudar} dados={dados} />
          </div>
        }
      />

      <Lista
        rotulo="Atividades concluídas e canceladas"
        linhas={linhas}
        colunas={colunas}
        chave={(atividade) => atividade.id}
        aoAbrir={acoes.abrir}
        acoesDaLinha={(atividade) => <MenuDaAtividade atividade={atividade} acoes={acoes} />}
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim())}
        aoLimparFiltros={limpar}
        vazio={<EstadoVazio icone={History} titulo="Nada por aqui ainda." texto="O que for concluído ou cancelado no Meu dia vem para cá." />}
        cartao={(atividade) => (
          <span className="grid gap-1.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
              <TipoDaAtividade tipo={atividade.tipo} />
              <span className="tabular-nums">{atividade.codigo}</span>
            </span>
            <span className="font-semibold break-words">{atividade.titulo}</span>
            <span className="flex flex-wrap items-center gap-2 text-[13px]">
              <SituacaoDaAtividade atividade={atividade} />
              <span className="text-ink-soft">
                {formatarData(encerradaEm(atividade))}
                {atividade.situacao === 'concluida' ? ` · ${quemConcluiu(atividade, dados)}` : ''}
              </span>
            </span>
            {atividade.cancelada_motivo && <span className="text-[13px] break-words text-ink-soft">Motivo: {atividade.cancelada_motivo}</span>}
          </span>
        )}
      />
      <PainelAtividade id={painelId} dados={dados} acoes={acoes} aoFechar={fecharPainel} aoAbrir={abrirPainel} />
      {dialogos}
    </div>
  );
}
