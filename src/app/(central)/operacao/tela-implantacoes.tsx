'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleDot, Layers, Plus, Rocket, UserRound } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { AbasOperacao } from '@/componentes/operacao/abas-operacao';
import { JanelaCriarImplantacao } from '@/componentes/operacao/criar-implantacao';
import { SituacaoDaImplantacao, TextoDoDesvio } from '@/componentes/operacao/situacoes';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Indicador } from '@/componentes/padroes/indicador';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA } from '@/dominio/contextos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { formatarHoras } from '@/dominio/horas';
import { carregarImplantacoes, ROTULOS_MARCO, ROTULOS_SITUACAO_IMPLANTACAO, type LinhaDaImplantacao } from '@/dominio/implantacoes';
import { formatarDiaISO } from '@/lib/formatacao';

type Filtros = { busca: string; produto: string; responsavel: string; situacao: string; desvio: string; contrato: string };
const INICIAIS: Filtros = { busca: '', produto: '', responsavel: '', situacao: '', desvio: '', contrato: '' };

const ROTULOS_DESVIO = { depois: 'Planejada depois do prazo', no_prazo: 'No prazo ou antes', sem_plano: 'Entrega não planejada', sem_contratual: 'Sem prazo contratual' } as const;

function grupoDoDesvio(linha: LinhaDaImplantacao): keyof typeof ROTULOS_DESVIO {
  if (!linha.contratual || linha.contratual.pendente) return 'sem_contratual';
  if (!linha.entrega_planejada) return 'sem_plano';
  return (linha.desvioPlanejado.dias ?? 0) > 0 ? 'depois' : 'no_prazo';
}

const ENCERRADAS = new Set(['concluida', 'cancelada']);

/** T12.01: uma linha por implantação (contrato + produto), com o desvio em relação ao prazo contratual. */
export function TelaImplantacoes() {
  const roteador = useRouter();
  const { contexto } = useCentral();
  const consulta = useConsulta(() => carregarImplantacoes());
  const dados = consulta.dados;
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const [criando, setCriando] = useState(false);
  const pessoa = (id: string) => dados?.pessoas.find((linha) => linha.id === id)?.nome_completo ?? 'Pessoa removida';
  const produto = (id: string) => dados?.produtos.find((linha) => linha.id === id)?.nome ?? 'Produto removido';
  const contraparte = (id: string) => {
    const linha = dados?.contrapartes.find((item) => item.id === id);
    return linha ? nomeDaContraparte(linha) : 'Contraparte removida';
  };

  const doContexto = useMemo(() => (dados?.linhas ?? []).filter((linha) => !linha.arquivado_em && (contexto.id === ID_CONSOLIDADA || linha.produto_id === contexto.id)), [dados, contexto.id]);
  const linhas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return doContexto
      .filter((linha) => (!filtros.produto || linha.produto_id === filtros.produto) && (!filtros.responsavel || linha.responsavel_id === filtros.responsavel) && (!filtros.situacao || linha.situacao === filtros.situacao) && (!filtros.desvio || grupoDoDesvio(linha) === filtros.desvio) && (!filtros.contrato || linha.contrato_id === filtros.contrato) && (!termo || `${linha.codigo} ${linha.contrato?.codigo ?? ''} ${contraparte(linha.contraparte_id)} ${produto(linha.produto_id)}`.toLowerCase().includes(termo)))
      .sort((a, b) => Number(ENCERRADAS.has(a.situacao)) - Number(ENCERRADAS.has(b.situacao)) || b.codigo.localeCompare(a.codigo));
  }, [doContexto, filtros]); // eslint-disable-line react-hooks/exhaustive-deps -- `contraparte` e `produto` leem `dados`
  const abertas = doContexto.filter((linha) => !ENCERRADAS.has(linha.situacao));
  const filtrando = Object.entries(filtros).some(([campo, valor]) => (campo === 'busca' ? Boolean(valor.trim()) : Boolean(valor)));

  const colunas: readonly Coluna<LinhaDaImplantacao>[] = [
    { id: 'codigo', titulo: 'Implantação', essencial: true, ordenar: (a, b) => a.codigo.localeCompare(b.codigo), celula: (linha) => <span className="grid"><span className="font-medium">{contraparte(linha.contraparte_id)}</span><span className="text-xs text-ink-soft">{linha.codigo} · {produto(linha.produto_id)}</span></span>, texto: (linha) => `${linha.codigo} ${contraparte(linha.contraparte_id)}` },
    { id: 'contrato', titulo: 'Contrato', celula: (linha) => linha.contrato?.codigo ?? 'Contrato removido' },
    { id: 'responsavel', titulo: 'Responsável', celula: (linha) => pessoa(linha.responsavel_id) },
    { id: 'marco', titulo: 'Marco atual', celula: (linha) => (linha.atual ? ROTULOS_MARCO[linha.atual.marco] : 'Todos registrados') },
    { id: 'contratual', titulo: 'Entrega contratual', essencial: true, ordenar: (a, b) => (a.contratual?.data ?? '9').localeCompare(b.contratual?.data ?? '9'), celula: (linha) => (linha.contratual ? (linha.contratual.pendente ? <span className="text-ink-soft">{linha.contratual.texto}</span> : formatarDiaISO(linha.contratual.data)) : <span className="text-ink-soft">Sem prazo contratual</span>) },
    { id: 'planejada', titulo: 'Entrega planejada', celula: (linha) => (linha.entrega_planejada ? formatarDiaISO(linha.entrega_planejada) : '—') },
    { id: 'desvio', titulo: 'Desvio', essencial: true, celula: (linha) => <TextoDoDesvio desvio={linha.entrega_realizada ? linha.desvioRealizado : linha.desvioPlanejado} /> },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => <SituacaoDaImplantacao situacao={linha.situacao} /> },
    { id: 'horas', titulo: 'Horas est. × apontadas', numerica: true, celula: (linha) => `${linha.horas_estimadas === null ? '—' : formatarHoras(linha.horas_estimadas)} × ${formatarHoras(linha.horasApontadas)}` },
  ];

  const botaoNovo = (
    <Button onClick={() => setCriando(true)}>
      <Plus aria-hidden />
      Nova implantação
    </Button>
  );

  return (
    <>
      <CabecalhoPagina kicker="Operação" titulo="Implantações" resumo="O que foi vendido, entregue dentro do combinado. O prazo contratual vem do contrato e não muda aqui." acoes={botaoNovo} />
      <AbasOperacao ativa="implantacoes" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as implantações." aoTentarDeNovo={consulta.recarregar} />}
        {dados && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <Indicador titulo="Em aberto" valor={String(abertas.length)} contexto="Nem concluídas nem canceladas" />
            <Indicador titulo="Entrega planejada depois do prazo" valor={String(abertas.filter((linha) => !linha.entrega_realizada && grupoDoDesvio(linha) === 'depois').length)} tom={abertas.some((linha) => !linha.entrega_realizada && grupoDoDesvio(linha) === 'depois') ? 'erro' : 'neutro'} />
            <Indicador titulo="Entregues aguardando aceite" valor={String(abertas.filter((linha) => linha.entrega_realizada && !linha.aceite_em).length)} className="max-lg:col-span-2" />
          </div>
        )}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(INICIAIS)}
          rotuloBusca="Buscar implantação, contrato ou contraparte"
          seletores={[
            seletorDeOpcoes<Filtros>({ id: 'produto', rotulo: 'Produto', icone: Layers, campo: 'produto', opcoes: (dados?.produtos ?? []).filter((linha) => doContexto.some((item) => item.produto_id === linha.id)).map((linha) => ({ valor: linha.id, rotulo: linha.nome })) }),
            seletorDeOpcoes<Filtros>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes: paraOpcoes(ROTULOS_SITUACAO_IMPLANTACAO), todos: 'Todas' }),
            seletorDeOpcoes<Filtros>({ id: 'responsavel', rotulo: 'Responsável', icone: UserRound, campo: 'responsavel', opcoes: (dados?.pessoas ?? []).filter((linha) => doContexto.some((item) => item.responsavel_id === linha.id)).map((linha) => ({ valor: linha.id, rotulo: linha.nome_completo })), todos: 'Todas' }),
          ]}
          avancados={(valor, mudar) => (
            <>
              <Campo id="imp-desvio" rotulo="Desvio">
                {(controle) => (
                  <select {...controle} className="campo" value={valor.desvio} onChange={(evento) => mudar({ desvio: evento.target.value })}>
                    <option value="">Todos</option>
                    {paraOpcoes(ROTULOS_DESVIO).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                  </select>
                )}
              </Campo>
              <Campo id="imp-contrato" rotulo="Contrato">
                {(controle) => (
                  <select {...controle} className="campo" value={valor.contrato} onChange={(evento) => mudar({ contrato: evento.target.value })}>
                    <option value="">Todos</option>
                    {[...new Map(doContexto.filter((linha) => linha.contrato).map((linha) => [linha.contrato_id, linha.contrato!])).values()].map((contrato) => <option key={contrato.id} value={contrato.id}>{contrato.codigo} · {contrato.titulo}</option>)}
                  </select>
                )}
              </Campo>
            </>
          )}
          quantosAvancados={(valor) => [valor.desvio, valor.contrato].filter(Boolean).length}
          ativos={[
            ...(filtros.produto ? [{ id: 'produto', rotulo: `Produto: ${produto(filtros.produto)}` }] : []),
            ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_IMPLANTACAO[filtros.situacao as keyof typeof ROTULOS_SITUACAO_IMPLANTACAO]}` }] : []),
            ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${pessoa(filtros.responsavel)}` }] : []),
            ...(filtros.desvio ? [{ id: 'desvio', rotulo: `Desvio: ${ROTULOS_DESVIO[filtros.desvio as keyof typeof ROTULOS_DESVIO]}` }] : []),
            ...(filtros.contrato ? [{ id: 'contrato', rotulo: `Contrato: ${doContexto.find((linha) => linha.contrato_id === filtros.contrato)?.contrato?.codigo ?? ''}` }] : []),
          ]}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
        />
        <Lista
          rotulo="Implantações"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={filtrando}
          aoLimparFiltros={() => setFiltros(INICIAIS)}
          aoAbrir={(linha) => roteador.push(`/operacao/${linha.id}`)}
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <span className="font-semibold">{contraparte(linha.contraparte_id)}</span>
              <span className="text-[13px] text-ink-soft">
                {linha.codigo} · {produto(linha.produto_id)} · {linha.atual ? ROTULOS_MARCO[linha.atual.marco] : 'Todos os marcos registrados'}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-[13px]">
                <SituacaoDaImplantacao situacao={linha.situacao} />
                <TextoDoDesvio desvio={linha.entrega_realizada ? linha.desvioRealizado : linha.desvioPlanejado} />
              </span>
            </span>
          )}
          vazio={<EstadoVazio icone={Rocket} titulo="Nenhuma implantação ainda." texto="A implantação nasce de um contrato assinado com item de implantação ou sob medida, uma por produto." acao={botaoNovo} />}
        />
      </div>
      {criando && (
        <JanelaCriarImplantacao
          aoFechar={() => setCriando(false)}
          aoCriar={(id) => {
            setCriando(false);
            roteador.push(`/operacao/${id}`);
          }}
        />
      )}
    </>
  );
}
