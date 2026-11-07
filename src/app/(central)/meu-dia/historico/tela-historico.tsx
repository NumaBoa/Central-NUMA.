'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarRange, Check, History, Info, X } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { CartoesDeResumo } from '@/componentes/padroes/cartoes-resumo';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto } from '@/componentes/padroes/etiquetas';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { BotaoExportarCsv } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { carregarMeuDia, contextosDaAtividade, estaAberta, ROTULOS_SITUACAO_ATIVIDADE, ROTULOS_TIPO_ATIVIDADE, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import { atividadesDoHistorico, CONCLUIDA_PELO_SISTEMA, encerradaEm, FILTROS_HISTORICO_INICIAIS, quemEncerrou, resumoDoHistorico, ROTULOS_PERIODO_CONCLUSAO, type FiltrosHistorico, type PeriodoDaConclusao } from '@/dominio/atividades-historico';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDataHora } from '@/lib/formatacao';
import { useAcoesDaAtividade } from '../acoes-atividade';
import { MenuDaAtividade, TipoDaAtividade } from '../cartao-atividade';
import { ativosComuns, CamposAvancados, quantosComuns, removerComum, seletorDePeriodo, seletorDePessoa, textoDoPeriodo } from '../filtros-meu-dia';
import { JanelaAtividade } from '../janela-atividade';
import { SituacaoDaAtividade } from '../lista-atividades';

const CAMINHO = '/meu-dia/historico';
const NA_ORDEM_DO_ENCERRAMENTO = (a: AtividadeDoDia, b: AtividadeDoDia) => encerradaEm(a).localeCompare(encerradaEm(b));

function nomeDeQuemEncerrou(atividade: AtividadeDoDia, dados: DadosMeuDia): string {
  const id = quemEncerrou(atividade);
  if (!id) return 'Sistema';
  return dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
}

const SELETOR_DE_PERIODO = seletorDePeriodo<FiltrosHistorico>({
  id: 'filtro-conclusao',
  rotulo: 'Período de conclusão',
  largura: 202,
  rotulos: ROTULOS_PERIODO_CONCLUSAO,
  ler: ({ conclusao, conclusaoDe, conclusaoAte }) => ({ periodo: conclusao, de: conclusaoDe, ate: conclusaoAte }),
  gravar: ({ periodo, de, ate }) => ({ conclusao: periodo as PeriodoDaConclusao, conclusaoDe: de, conclusaoAte: ate }),
});

/** T03.04: o que já foi concluído ou cancelado, com o padrão de filtros do Meu dia (CA-03.08). */
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
  const opcoes = { hoje, pessoaAtualId: pessoa.id, contextoGlobalId: contexto.id, nomeDaPessoa };
  const linhas = useMemo(() => (dados ? atividadesDoHistorico(dados.atividades, filtros, opcoes) : []), [dados, filtros, hoje, pessoa.id, contexto.id]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaPessoa só depende de dados
  const resumo = useMemo(() => resumoDoHistorico(dados?.atividades ?? [], filtros, opcoes), [dados, filtros, hoje, pessoa.id, contexto.id]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaPessoa só depende de dados
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
            <span className="text-[13px] font-semibold break-words">{atividade.titulo}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft tabular-nums">
              <TipoDaAtividade tipo={atividade.tipo} />
              {atividade.codigo}
            </span>
            {atividade.cancelada_motivo && <span className="text-xs break-words text-ink-soft">Motivo: {atividade.cancelada_motivo}</span>}
            <span className="text-xs text-ink-soft @min-[860px]:hidden">
              {formatarDataHora(encerradaEm(atividade))} · {nomeDeQuemEncerrou(atividade, dados)}
            </span>
          </span>
        ),
      },
      { id: 'responsavel', titulo: 'Responsável', essencial: true, classe: 'hidden @min-[1060px]:table-cell', celula: (atividade) => <NomeDaPessoa nome={nomeDaPessoa(atividade.responsavel_id)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
      {
        id: 'contexto',
        titulo: 'Contexto',
        essencial: true,
        classe: 'hidden @min-[960px]:table-cell',
        celula: (atividade) => (
          <span className="flex flex-wrap gap-1">
            {contextosDaAtividade(atividade, dados).map((item) => (
              <EtiquetaContexto key={item.id} contexto={item} />
            ))}
          </span>
        ),
      },
      { id: 'encerrada', titulo: 'Encerrada em', essencial: true, classe: 'hidden @min-[860px]:table-cell', ordenar: NA_ORDEM_DO_ENCERRAMENTO, celula: (atividade) => <span className="whitespace-nowrap tabular-nums">{formatarDataHora(encerradaEm(atividade))}</span> },
      { id: 'por', titulo: 'Encerrada por', essencial: true, classe: 'hidden @min-[860px]:table-cell', celula: (atividade) => <NomeDaPessoa nome={nomeDeQuemEncerrou(atividade, dados)} className="min-w-max [&>span:last-child]:overflow-visible" /> },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (atividade) => <SituacaoDaAtividade atividade={atividade} /> },
    ];
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaPessoa só depende de dados

  // Exporta o recorte inteiro, com o que na tela fica junto em outras colunas.
  const colunasDoCsv = useMemo<readonly Coluna<AtividadeDoDia>[]>(() => {
    if (!dados) return [];
    const celula = () => null;
    return [
      { id: 'codigo', titulo: 'Código', celula, texto: (atividade) => atividade.codigo },
      { id: 'titulo', titulo: 'Atividade', celula, texto: (atividade) => atividade.titulo },
      { id: 'tipo', titulo: 'Tipo', celula, texto: (atividade) => ROTULOS_TIPO_ATIVIDADE[atividade.tipo] },
      { id: 'responsavel', titulo: 'Responsável', celula, texto: (atividade) => nomeDaPessoa(atividade.responsavel_id) },
      { id: 'contexto', titulo: 'Contexto', celula, texto: (atividade) => contextosDaAtividade(atividade, dados).map((item) => item.nome).join(', ') },
      { id: 'encerrada', titulo: 'Encerrada em', celula, texto: (atividade) => formatarDataHora(encerradaEm(atividade)) },
      { id: 'por', titulo: 'Encerrada por', celula, texto: (atividade) => nomeDeQuemEncerrou(atividade, dados) },
      { id: 'situacao', titulo: 'Situação', celula, texto: (atividade) => ROTULOS_SITUACAO_ATIVIDADE[atividade.situacao] },
      { id: 'motivo', titulo: 'Motivo do cancelamento', celula, texto: (atividade) => atividade.cancelada_motivo ?? '' },
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
  const periodo = textoDoPeriodo({ periodo: filtros.conclusao, de: filtros.conclusaoDe, ate: filtros.conclusaoAte }, ROTULOS_PERIODO_CONCLUSAO);
  const ativos: FiltroAtivo[] = [
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: filtros.situacao === 'concluida' ? 'Concluídas' : 'Canceladas' }] : []),
    ...(filtros.conclusao ? [{ id: 'conclusao', rotulo: `Período: ${periodo}` }] : []),
    ...(filtros.concluidaPor ? [{ id: 'concluidaPor', rotulo: `Concluída por: ${filtros.concluidaPor === CONCLUIDA_PELO_SISTEMA ? 'Sistema' : nomeDaPessoa(filtros.concluidaPor)}` }] : []),
    ...ativosComuns(filtros, dados),
  ];

  function remover(id: string) {
    if (id === 'conclusao') return mudar({ conclusao: '', conclusaoDe: '', conclusaoAte: '' });
    if (id === 'situacao' || id === 'concluidaPor') return mudar({ [id]: '' });
    removerComum(id, filtros, mudar);
  }

  const limpar = () => setFiltros(FILTROS_HISTORICO_INICIAIS);
  const totalEncerradas = dados.atividades.filter((atividade) => !estaAberta(atividade) && !atividade.arquivado_em).length;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        migalhas={['Meu dia', 'Histórico']}
        kicker="Meu dia"
        titulo="Histórico de atividades"
        resumo="O que foi concluído ou cancelado continua por aqui."
        acoes={
          <>
            <Button asChild variante="secundario">
              <LinkCentral href="/meu-dia">
                <ArrowLeft aria-hidden />
                Voltar ao Meu dia
              </LinkCentral>
            </Button>
            <BotaoExportarCsv nomeDoArquivo="historico-de-atividades" colunas={colunasDoCsv} linhas={linhas} />
          </>
        }
      />

      <div className="space-y-2">
        <CartoesDeResumo
          rotulo="Resumo do histórico"
          className="md:grid-cols-3"
          cartoes={[
            { id: 'todas', rotulo: 'Atividades no período', valor: resumo.total, icone: History },
            { id: 'concluida', rotulo: 'Concluídas', valor: resumo.concluidas, icone: Check, tom: 'sucesso' },
            { id: 'cancelada', rotulo: 'Canceladas', valor: resumo.canceladas, icone: X },
          ]}
          ativo={(id) => (id === 'todas' ? !filtros.situacao : filtros.situacao === id)}
          aoEscolher={(id) => mudar({ situacao: id === 'todas' || filtros.situacao === id ? '' : id })}
        />
        <p className="flex items-center gap-1.5 text-[13px] text-ink-soft [&_svg]:size-4">
          <CalendarRange aria-hidden />
          {periodo || 'Todo o período'}
        </p>
      </div>

      <FiltrosEmLinha
        filtros={filtros}
        aoMudar={mudar}
        aoLimpar={limpar}
        rotuloBusca="Buscar por título, código, descrição ou responsável"
        seletores={[seletorDePessoa<FiltrosHistorico>(pessoas), SELETOR_DE_PERIODO]}
        avancados={(valor, mudarValor) => (
          <CamposAvancados
            filtros={valor}
            aoMudar={mudarValor}
            dados={dados}
            extra={
              <Campo rotulo="Concluída por" id="filtro-concluida-por">
                {(controle) => (
                  <Selecao {...controle} value={valor.concluidaPor} onChange={(evento) => mudarValor({ concluidaPor: evento.target.value })}>
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
            }
          />
        )}
        quantosAvancados={(valor) => quantosComuns(valor) + (valor.concluidaPor ? 1 : 0)}
        ativos={ativos}
        aoRemoverAtivo={remover}
      />

      <Lista
        rotulo="Atividades concluídas e canceladas"
        linhas={linhas}
        colunas={colunas}
        chave={(atividade) => atividade.id}
        aoAbrir={acoes.abrir}
        compacta
        acoesDaLinha={(atividade) => (
          <span className="inline-flex items-center justify-end gap-1">
            <Button variante="secundario" tamanho="pequeno" onClick={() => acoes.abrir(atividade)}>
              Abrir
            </Button>
            <MenuDaAtividade atividade={atividade} acoes={acoes} />
          </span>
        )}
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim())}
        aoLimparFiltros={limpar}
        rodape={<span className="font-normal text-ink-soft tabular-nums">Mostrando {linhas.length} de {totalEncerradas === 1 ? '1 atividade' : `${totalEncerradas} atividades`}</span>}
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
                {formatarData(encerradaEm(atividade))} · {nomeDeQuemEncerrou(atividade, dados)}
              </span>
            </span>
            {atividade.cancelada_motivo && <span className="text-[13px] break-words text-ink-soft">Motivo: {atividade.cancelada_motivo}</span>}
          </span>
        )}
      />
      <p className="flex items-center gap-2 text-[13px] text-ink-soft [&_svg]:size-4 [&_svg]:shrink-0">
        <Info aria-hidden />
        Reabrir preserva o histórico e exige uma justificativa.
      </p>
      <JanelaAtividade id={painelId} dados={dados} acoes={acoes} aoFechar={fecharPainel} aoAbrir={abrirPainel} />
      {dialogos}
    </div>
  );
}
