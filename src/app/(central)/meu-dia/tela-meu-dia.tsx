'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAdicionarAtividade } from '@/componentes/atividades/adicionar-atividade';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { CartoesDeResumo } from '@/componentes/padroes/cartoes-resumo';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { assinarMeta, gravarMeta, lerMeta, metaDoServidor } from '@/dados/meta';
import { useConsulta } from '@/dados/use-consulta';
import { AlarmClock, CheckSquare, ChevronDown, History, Inbox, Plus, Repeat, Sun } from 'lucide-react';
import {
  atividadesDaBase,
  atividadesVisiveis,
  CARTOES_DO_RESUMO,
  carregarMeuDia,
  cartaoEstaAtivo,
  colunasDoQuadro,
  dataPorExtenso,
  filtroDoCartao,
  FILTROS_MEU_DIA_INICIAIS,
  fraseDoResumo,
  primeiroNome,
  recorteDosFiltros,
  resumoDoRecorte,
  saudacao,
  type AgruparPor,
  type FiltrosMeuDia as Filtros,
  type ResumoDoDia,
} from '@/dominio/atividades';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { hojeISO } from '@/lib/datas';
import { cn } from '@/lib/utils';
import { useAcoesDaAtividade } from './acoes-atividade';
import { BarraDoMeuDia, ROTULOS_CARTAO } from './filtros-meu-dia';
import { ListaAtividades } from './lista-atividades';
import { PainelAtividade } from './painel-atividade';
import { QuadroAtividades } from './quadro-atividades';

/** Linhas calmas do cabeçalho do Meu dia, versão estática em SVG (18 §2.2). */
function LinhasDoCabecalho() {
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 right-0 hidden h-full w-[46%] lg:block" viewBox="0 0 520 140" preserveAspectRatio="none" fill="none">
      {[34, 52, 70, 88, 106].map((base, i) => (
        <path key={base} d={`M0 ${base} C 110 ${base - 18 + i * 3}, 210 ${base + 22 - i * 4}, 330 ${base - 6} S 470 ${base + 14 - i * 2}, 520 ${base - 10}`} stroke="var(--espresso)" strokeOpacity=".12" strokeWidth="1" />
      ))}
      <path d="M0 78 C 120 44, 190 118, 300 74 S 460 40, 520 62" stroke="var(--indigo)" strokeOpacity=".55" strokeWidth="1.4" />
    </svg>
  );
}

const TIPOS_DO_MENU = [
  { tipo: 'tarefa', rotulo: 'Tarefa', icone: <CheckSquare aria-hidden /> },
  { tipo: 'demanda', rotulo: 'Demanda', icone: <Inbox aria-hidden /> },
  { tipo: 'lembrete', rotulo: 'Lembrete', icone: <AlarmClock aria-hidden /> },
] as const;

/** "Adicionar ▾": Tarefa, Demanda ou Lembrete (T03.01). O atalho N abre a tarefa. */
function BotaoAdicionar() {
  const { abrirAdicionar } = useAdicionarAtividade();
  return (
    <MenuSobreposto
      titulo="Adicionar"
      largura={220}
      alinhar="end"
      gatilho={
        <Button>
          <Plus aria-hidden />
          Adicionar
          <ChevronDown aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <div className="grid gap-0.5">
          {TIPOS_DO_MENU.map(({ tipo, rotulo, icone }) => (
            <button
              key={tipo}
              type="button"
              className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}
              onClick={() => {
                fechar();
                abrirAdicionar(tipo);
              }}
            >
              {icone}
              {rotulo}
            </button>
          ))}
        </div>
      )}
    </MenuSobreposto>
  );
}

/** Histórico (T03.04) e Rotinas (T03.05). */
function LinksDoDia() {
  return (
    <>
      <Button asChild variante="terciario" className="max-md:px-2.5 max-md:[&_svg]:hidden">
        <LinkCentral href="/meu-dia/historico">
          <History aria-hidden />
          Histórico
        </LinkCentral>
      </Button>
      <Button asChild variante="terciario" className="max-md:px-2.5 max-md:[&_svg]:hidden">
        <LinkCentral href="/meu-dia/rotinas">
          <Repeat aria-hidden />
          Rotinas
        </LinkCentral>
      </Button>
    </>
  );
}

/** Saudação, data por extenso e a frase-resumo, com o marca-texto em um só trecho (18 §2.2). */
function CabecalhoDoDia({ nome, resumo }: { nome: string; resumo: ResumoDoDia }) {
  const frase = fraseDoResumo(resumo);
  return (
    <header className="relative">
      <LinhasDoCabecalho />
      <div className="relative float-right ml-3 hidden items-center gap-1 md:flex">
        <LinksDoDia />
        <BotaoAdicionar />
      </div>
      <p className="relative text-[13px] leading-[18px] font-medium text-ink-soft first-letter:uppercase">{dataPorExtenso()}</p>
      <h1 className="relative mt-1.5 texto-display">
        {saudacao()}, {primeiroNome(nome)}.
      </h1>
      <p className="relative mt-2 text-[15px] leading-[22px] text-ink-soft md:text-base">
        {frase ? (
          <>
            {frase.abertura}
            <mark>{frase.itens}</mark>
            {frase.resto}
          </>
        ) : (
          'Nada para hoje por enquanto.'
        )}
      </p>
      <div className="relative mt-3 flex items-center gap-0.5 md:hidden">
        <BotaoAdicionar />
        <LinksDoDia />
      </div>
    </header>
  );
}

function AlternanciaDeVisao({ visao }: { visao: 'quadro' | 'lista' }) {
  const opcoes = [
    { id: 'quadro', rotulo: 'Quadro' },
    { id: 'lista', rotulo: 'Lista' },
  ] as const;
  return (
    <div role="group" aria-label="Visão" className="inline-flex rounded-pill border border-line bg-paper p-0.5">
      {opcoes.map(({ id, rotulo }) => (
        <button key={id} type="button" aria-pressed={visao === id} onClick={() => gravarMeta({ visao_meu_dia: id })} className={cn('min-h-11 rounded-pill px-4 text-[13px] font-semibold transition-colors duration-150 md:min-h-9', visao === id ? 'bg-espresso text-linen' : 'text-ink-soft hover:text-ink')}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}

/** T03.01: a tela inicial. Mostra tudo o que está aberto, das duas sócias, em todos os produtos (RN-03.01). */
export function TelaMeuDia() {
  const { pessoa, contexto } = useCentral();
  const { abrirAdicionar, recenteId } = useAdicionarAtividade();
  const parametros = useSearchParams();
  const painelId = parametros.get('atividade');
  const consulta = useConsulta(carregarMeuDia);
  const { visao_meu_dia: visao } = useSyncExternalStore(assinarMeta, lerMeta, metaDoServidor);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_MEU_DIA_INICIAIS);
  const [agruparPor, setAgruparPor] = useState<AgruparPor>('nenhum');

  const dados = consulta.dados;
  const hoje = hojeISO();
  // O painel fica no endereço, para copiar o link; o histórico do navegador fecha e abre (T03.02).
  const abrirPainel = useCallback((id: string) => window.history.pushState(null, '', `/meu-dia?atividade=${id}`), []);
  const fecharPainel = useCallback(() => window.history.pushState(null, '', '/meu-dia'), []);
  const { acoes, dialogos } = useAcoesDaAtividade(dados, hoje, abrirPainel);

  // Atalho N (T03.01): só quando ninguém está digitando e não há nada aberto por cima.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key.toLowerCase() !== 'n' || evento.ctrlKey || evento.metaKey || evento.altKey || evento.repeat) return;
      const alvo = evento.target as HTMLElement | null;
      if (alvo?.closest('input, textarea, select, [contenteditable=true], [role=dialog], .menu-suspenso')) return;
      if (document.querySelector('[role=dialog]')) return;
      evento.preventDefault();
      abrirAdicionar('tarefa');
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [abrirAdicionar]);

  const nomeDaPessoa = (id: string) => dados?.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
  const nomeDaArea = (id: string) => dados?.areas.find((area) => area.id === id)?.nome ?? 'Área removida';
  const nomeDoContexto = (id: string) => (id === ID_INSTITUCIONAL ? 'Numa' : (dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));

  const opcoes = { hoje, pessoaAtualId: pessoa.id, contextoGlobalId: contexto.id, nomeDaPessoa };
  const base = useMemo(() => (dados ? atividadesDaBase(dados.atividades, filtros, opcoes) : []), [dados, filtros, hoje, pessoa.id, contexto.id]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaPessoa só depende de dados
  const resumo = useMemo(() => resumoDoRecorte(dados?.atividades ?? [], filtros, opcoes), [dados, filtros, hoje, pessoa.id, contexto.id]); // eslint-disable-line react-hooks/exhaustive-deps -- nomeDaPessoa só depende de dados
  const visiveis = useMemo(() => atividadesVisiveis(base, filtros, hoje), [base, filtros, hoje]);
  const colunas = useMemo(() => colunasDoQuadro(visiveis), [visiveis]);
  const recorte = recorteDosFiltros(filtros, { nomeDaPessoa, nomeDaArea, nomeDoContexto, contextoGlobalId: contexto.id });

  const mudar = (parcial: Partial<Filtros>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const nadaNoDia = dados && dados.atividades.every((atividade) => atividade.situacao === 'cancelada' || atividade.situacao === 'concluida') && resumo.concluidas === 0;
  const limpar = () => setFiltros(FILTROS_MEU_DIA_INICIAIS);

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Meu dia</h1>
        <EstadoErro titulo="Não deu para ler as atividades." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <CabecalhoDoDia nome={pessoa.nome} resumo={resumo} />
      <div className="space-y-2">
        <CartoesDeResumo
          rotulo="Resumo do dia"
          className="md:grid-cols-3 lg:grid-cols-6"
          cartoes={CARTOES_DO_RESUMO.map((id) => ({ id, rotulo: ROTULOS_CARTAO[id], valor: resumo[id], atencao: (id === 'atrasadas' || id === 'bloqueadas') && resumo[id] > 0 }))}
          ativo={(id) => cartaoEstaAtivo(filtros, id)}
          aoEscolher={(id) => mudar(filtroDoCartao(filtros, id))}
        />
        {recorte.length > 0 && <p className="text-xs text-ink-soft">Contagem com filtro: {recorte.join(', ')}</p>}
      </div>
      <BarraDoMeuDia filtros={filtros} aoMudar={mudar} visao={visao} aoMudarVisao={(novaVisao) => gravarMeta({ visao_meu_dia: novaVisao })} agruparPor={agruparPor} aoMudarAgrupar={setAgruparPor} dados={dados} alternancia={<AlternanciaDeVisao visao={visao} />} />

      {nadaNoDia ? (
        <EstadoVazio icone={Sun} titulo="Tudo em dia por aqui." texto="Que tal registrar o que vem pela frente?" acao={<BotaoAdicionar />} />
      ) : visiveis.length === 0 ? (
        <EstadoVazioFiltro titulo="Há atividades ocultas pelos filtros." aoLimpar={limpar} />
      ) : visao === 'quadro' ? (
        <QuadroAtividades colunas={colunas} dados={dados} hoje={hoje} acoes={acoes} recenteId={recenteId} />
      ) : (
        <ListaAtividades linhas={visiveis} dados={dados} hoje={hoje} acoes={acoes} agruparPor={agruparPor} />
      )}
      <PainelAtividade id={painelId} dados={dados} acoes={acoes} aoFechar={fecharPainel} aoAbrir={abrirPainel} />
      {dialogos}
    </div>
  );
}
