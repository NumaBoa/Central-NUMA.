'use client';

import { EtiquetasDoRegistro } from '@/componentes/campos/etiquetas';
import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { AlarmClock, BellRing, CalendarDays, Check, CheckCircle2, CheckSquare, ChevronDown, Clock3, Ellipsis, ExternalLink, Inbox, Layers, ListChecks, MessageSquare, MessagesSquare, OctagonX, Repeat, TriangleAlert, type LucideIcon } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EtiquetaContexto, EtiquetaPrioridade, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import type { Atividade } from '@/dados/tipos/atividade';
import { acaoDoAlerta, contextosDaAtividade, estaAberta, estaAtrasada, estaBloqueada, primeiroNome, ROTULOS_ORIGEM_ALERTA, ROTULOS_TIPO_ATIVIDADE, textoDoPrazo, textoDosAdiamentos, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { formatarHora } from '@/lib/formatacao';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';
import type { AcoesDaAtividade } from './acoes-atividade';

export const ICONES_DO_TIPO: Readonly<Record<Atividade['tipo'], LucideIcon>> = { tarefa: CheckSquare, demanda: Inbox, lembrete: AlarmClock, alerta: BellRing };

const nomeDaPessoa = (id: string | null, { pessoas }: Pick<DadosMeuDia, 'pessoas'>) => pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';

/** Esta atividade é uma ocorrência de uma rotina (T03.05). */
export function MarcaDeRotina() {
  return (
    <span className="inline-flex items-center [&_svg]:size-[14px]" title="Faz parte de uma rotina">
      <Repeat aria-hidden />
      <span className="sr-only">Faz parte de uma rotina</span>
    </span>
  );
}

/** Alerta é do sistema: aparece em âmbar, com o ícone, para não parecer uma tarefa de alguém. */
export function TipoDaAtividade({ tipo }: { tipo: Atividade['tipo'] }) {
  const Icone = ICONES_DO_TIPO[tipo];
  if (tipo !== 'alerta') return <span className="inline-flex items-center font-semibold text-ink">{ROTULOS_TIPO_ATIVIDADE[tipo]}</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-warn-wash px-2 py-0.5 font-semibold text-warn [&_svg]:size-[13px]">
      <Icone aria-hidden />
      {ROTULOS_TIPO_ATIVIDADE[tipo]}
    </span>
  );
}

function LinhaDoMenu({ icone, rotulo, dica, aoClicar }: { icone?: ReactNode; rotulo: string; dica?: string; aoClicar: () => void }) {
  return (
    <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')} onClick={aoClicar}>
      {icone}
      <span className="min-w-0">
        {rotulo}
        {dica && <span className="block text-xs text-ink-soft">{dica}</span>}
      </span>
    </button>
  );
}

const TituloDoMenu = ({ children }: { children: ReactNode }) => <p className="px-1 pt-2 pb-0.5 text-xs font-semibold text-ink-soft first:pt-0 md:px-3">{children}</p>;

/** Mover, adiar, bloquear, concluir e cancelar sem arrastar (T03.01 e RT-19). */
export function MenuDaAtividade({ atividade, acoes }: { atividade: AtividadeDoDia; acoes: AcoesDaAtividade }) {
  const aberta = estaAberta(atividade);
  const alerta = atividade.tipo === 'alerta';
  return (
    <MenuSobreposto
      titulo="Ações"
      largura={280}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label={`Ações de ${atividade.titulo}`}>
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => {
        const fazer = (acao: () => void) => () => {
          fechar();
          acao();
        };
        if (!aberta) {
          return (
            <div className="grid gap-0.5">
              <LinhaDoMenu rotulo="Abrir" aoClicar={fazer(() => acoes.abrir(atividade))} />
              <LinhaDoMenu rotulo="Reabrir" dica="Pede um motivo, e o histórico fica." aoClicar={fazer(() => acoes.pedir('reabrir', atividade))} />
            </div>
          );
        }
        return (
          <div className="grid gap-0.5">
            <LinhaDoMenu rotulo="Abrir" aoClicar={fazer(() => acoes.abrir(atividade))} />
            <TituloDoMenu>Mover para</TituloDoMenu>
            {atividade.situacao !== 'a_fazer' && <LinhaDoMenu rotulo="A fazer" aoClicar={fazer(() => acoes.mover(atividade, 'a_fazer'))} />}
            {atividade.situacao !== 'em_andamento' && <LinhaDoMenu rotulo="Em andamento" aoClicar={fazer(() => acoes.mover(atividade, 'em_andamento'))} />}
            {atividade.situacao !== 'aguardando' && <LinhaDoMenu rotulo="Aguardando retorno" aoClicar={fazer(() => acoes.pedir('aguardando', atividade))} />}
            <div className="my-1 border-t border-line" />
            {atividade.bloqueada ? <LinhaDoMenu rotulo="Desbloquear" aoClicar={fazer(() => acoes.desbloquear(atividade))} /> : <LinhaDoMenu rotulo="Marcar bloqueada" aoClicar={fazer(() => acoes.pedir('bloquear', atividade))} />}
            <LinhaDoMenu rotulo={alerta ? 'Concluir alerta' : 'Concluir'} dica={alerta ? 'Não paga nem renova: só tira o aviso.' : undefined} aoClicar={fazer(() => acoes.concluir(atividade))} />
            {alerta ? <LinhaDoMenu rotulo="Dispensar alerta" dica="Pede um motivo e não muda a origem." aoClicar={fazer(() => acoes.pedir('dispensar', atividade))} /> : <LinhaDoMenu rotulo="Cancelar" aoClicar={fazer(() => acoes.pedir('cancelar', atividade))} />}
          </div>
        );
      }}
    </MenuSobreposto>
  );
}

/** Adiar sem abrir a atividade: +1 dia, +1 semana ou escolher a data. Com "Desfazer", sem confirmação (RN-03.08). */
export function BotaoAdiar({ atividade, acoes, soIcone = false }: { atividade: AtividadeDoDia; acoes: AcoesDaAtividade; soIcone?: boolean }) {
  return (
    <MenuSobreposto
      titulo="Adiar"
      largura={220}
      alinhar="end"
      gatilho={
        soIcone ? (
          <Button variante="icone" tamanho="icone" title="Adiar" aria-label={`Adiar ${atividade.titulo}`}>
            <Clock3 aria-hidden />
          </Button>
        ) : (
          <button type="button" aria-label={`Adiar ${atividade.titulo}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-pill border border-line bg-paper px-2.5 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:border-ink-soft hover:text-ink md:min-h-7 md:px-2 [&_svg]:size-[13px]">
            <Clock3 aria-hidden />
            Adiar
            <ChevronDown aria-hidden />
          </button>
        )
      }
    >
      {(fechar) => {
        const fazer = (acao: () => void) => () => {
          fechar();
          acao();
        };
        return (
          <div className="grid gap-0.5">
            <LinhaDoMenu rotulo="+1 dia" aoClicar={fazer(() => acoes.adiarEm(atividade, 1))} />
            <LinhaDoMenu rotulo="+1 semana" aoClicar={fazer(() => acoes.adiarEm(atividade, 7))} />
            <LinhaDoMenu rotulo="Escolher data" aoClicar={fazer(() => acoes.pedir('adiar', atividade))} />
          </div>
        );
      }}
    </MenuSobreposto>
  );
}

/** Mudar a responsável com um clique no nome (T03.01). */
function ResponsavelDaAtividade({ atividade, dados, acoes }: { atividade: AtividadeDoDia; dados: DadosMeuDia; acoes: AcoesDaAtividade }) {
  const nome = nomeDaPessoa(atividade.responsavel_id, dados);
  const pessoas = pessoasDoSeletor(dados.pessoas);
  const naLista = pessoas.some((pessoa) => pessoa.id === atividade.responsavel_id);
  if (!estaAberta(atividade)) return <NomeDaPessoa nome={nome} className="min-w-0 text-[13px]" />;
  return (
    <>
      <MenuSobreposto
        titulo="Mudar a responsável"
        largura={270}
        gatilho={
          <button type="button" aria-label={`Mudar a responsável de ${atividade.titulo}: ${nome}`} className="inline-flex min-h-11 max-w-full min-w-0 items-center rounded-pill text-[13px] underline-offset-2 hover:underline md:min-h-0">
            <NomeDaPessoa nome={nome} />
          </button>
        }
      >
        {(fechar) => (
          <div className="grid gap-0.5">
            {pessoas.map((pessoa) => (
              <LinhaDoMenu
                key={pessoa.id}
                icone={pessoa.id === atividade.responsavel_id ? <Check aria-hidden /> : <span className="size-[18px] shrink-0" aria-hidden />}
                rotulo={pessoa.nome_completo}
                aoClicar={() => {
                  fechar();
                  acoes.trocarResponsavel(atividade, pessoa.id);
                }}
              />
            ))}
          </div>
        )}
      </MenuSobreposto>
      {!naLista && (
        <EtiquetaSituacao tipo="atencao" icone={TriangleAlert}>
          Escolha outra pessoa
        </EtiquetaSituacao>
      )}
      {atividade.participantes.length > 0 && <span className="text-xs text-ink-soft">{atividade.participantes.map((id) => `+${primeiroNome(nomeDaPessoa(id, dados))}`).join(' ')}</span>}
    </>
  );
}

/** A caixa de concluir sem abrir a atividade. Marcada, reabre, e reabrir pede motivo. */
export function CaixaDeConcluir({ atividade, acoes }: { atividade: AtividadeDoDia; acoes: AcoesDaAtividade }) {
  const concluida = atividade.situacao === 'concluida';
  const cancelada = atividade.situacao === 'cancelada';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={concluida}
      aria-label={concluida || cancelada ? `Reabrir ${atividade.titulo}` : `Concluir ${atividade.titulo}`}
      onClick={(evento) => {
        evento.stopPropagation();
        if (concluida || cancelada) acoes.pedir('reabrir', atividade);
        else acoes.concluir(atividade);
      }}
      className="group/caixa -m-2.5 grid size-11 shrink-0 place-items-center rounded-full md:-m-1.5 md:size-8"
    >
      <span className={cn('grid size-[22px] place-items-center rounded-full border-2 transition-colors duration-150 [&_svg]:size-[14px]', concluida ? 'border-ok bg-ok text-white' : 'border-ink-faint text-transparent group-hover/caixa:border-ok group-hover/caixa:text-ok')}>
        <Check aria-hidden strokeWidth={3} />
      </span>
    </button>
  );
}

/** O prazo com o ícone certo: atraso sempre com texto, ícone e cor (CA-18.07). */
export function PrazoDaAtividade({ atividade, hoje }: { atividade: Atividade; hoje: string }) {
  if (atividade.situacao === 'concluida' && atividade.concluida_em) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-ok [&_svg]:size-[15px] [&_svg]:shrink-0">
        <CheckCircle2 aria-hidden />
        Concluída às {formatarHora(atividade.concluida_em)}
      </span>
    );
  }
  const prazo = textoDoPrazo(atividade, hoje);
  return (
    <span className={cn('inline-flex items-center gap-1.5 [&_svg]:size-[15px] [&_svg]:shrink-0', prazo.atrasada ? 'font-semibold text-err' : 'text-ink-soft')}>
      {prazo.atrasada ? <TriangleAlert aria-hidden /> : <CalendarDays aria-hidden />}
      {prazo.texto}
    </span>
  );
}

/** O conteúdo do cartão (T03.01): o mesmo no quadro e nos cartões da lista no celular. */
export function ConteudoDoCartao({ atividade, dados, hoje, acoes }: { atividade: AtividadeDoDia; dados: DadosMeuDia; hoje: string; acoes: AcoesDaAtividade }) {
  const adiamentos = textoDosAdiamentos(atividade);
  const contextos = contextosDaAtividade(atividade, dados);
  const acao = acaoDoAlerta(atividade);
  const aberta = estaAberta(atividade);
  const concluida = atividade.situacao === 'concluida';
  const aguardandoDe = atividade.aguardando_de_pessoa_id ? nomeDaPessoa(atividade.aguardando_de_pessoa_id, dados) : atividade.aguardando_de_texto;

  return (
    <div className="relative grid gap-2">
      <p className="flex min-h-7 flex-wrap items-center gap-x-2.5 gap-y-0.5 pr-7 text-xs leading-4 text-ink-soft">
        <CaixaDeConcluir atividade={atividade} acoes={acoes} />
        <TipoDaAtividade tipo={atividade.tipo} />
        <span className="tabular-nums">{atividade.codigo}</span>
        {atividade.recorrencia_id && <MarcaDeRotina />}
      </p>
      <div className="absolute -top-2 -right-2.5">
        <MenuDaAtividade atividade={atividade} acoes={acoes} />
      </div>
      <div className="flow-root">
        {/* A prioridade flutua: o título contorna, em vez de ficar espremido numa coluna estreita. */}
        {(atividade.prioridade === 'urgente' || atividade.prioridade === 'alta') && aberta && (
          <span className="float-right ml-2">
            <EtiquetaPrioridade prioridade={atividade.prioridade} />
          </span>
        )}
        <h3 className={cn('font-display text-base leading-[22px] font-semibold tracking-[-.01em] break-words', concluida && 'text-ink-soft')}>
          <button type="button" onClick={() => acoes.abrir(atividade)} className="min-h-11 text-left underline-offset-2 hover:underline md:min-h-0">
            {atividade.titulo}
          </button>
        </h3>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <ResponsavelDaAtividade atividade={atividade} dados={dados} acoes={acoes} />
        {contextos.map((contexto) => (
          <EtiquetaContexto key={contexto.id} contexto={contexto} />
        ))}
      </div>
      <EtiquetasDoRegistro ids={atividade.etiquetas} etiquetas={dados.etiquetas} />
      {estaBloqueada(atividade) && (
        <p className="flex items-start gap-1.5 rounded-sm bg-err-wash px-2.5 py-1.5 text-[13px] leading-[18px] font-semibold text-err [&_svg]:mt-0.5 [&_svg]:size-[14px] [&_svg]:shrink-0">
          <OctagonX aria-hidden />
          <span className="min-w-0 break-words">Bloqueada: {atividade.bloqueio_motivo}</span>
        </p>
      )}
      {atividade.situacao === 'aguardando' && (
        <p className="flex items-start gap-1.5 text-[13px] leading-[18px] text-ink-soft [&_svg]:mt-0.5 [&_svg]:size-[15px] [&_svg]:shrink-0">
          <MessagesSquare aria-hidden />
          <span className="min-w-0 break-words">
            Aguardando: {aguardandoDe}
            {atividade.acompanhamento_em === hoje ? ' · acompanhar hoje' : atividade.acompanhamento_em ? ` · acompanhar em ${atividade.acompanhamento_em.split('-').reverse().join('/').slice(0, 5)}` : ''}
          </span>
        </p>
      )}
      {atividade.tipo === 'alerta' && (
        <p className="flex items-start gap-1.5 text-[13px] leading-[18px] text-ink-soft [&_svg]:mt-0.5 [&_svg]:size-[15px] [&_svg]:shrink-0">
          <Layers aria-hidden />
          <span className="min-w-0 break-words">
            Origem: {ROTULOS_ORIGEM_ALERTA[atividade.origem_tipo ?? ''] ?? 'Sistema'}
            {atividade.alerta_motivo ? ` · ${atividade.alerta_motivo}` : ''}
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-[18px]">
          <PrazoDaAtividade atividade={atividade} hoje={hoje} />
          {adiamentos && aberta && <span className="text-ink-soft">· {adiamentos}</span>}
          {atividade.itensTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-ink-soft [&_svg]:size-[14px]" aria-label={`Checklist: ${atividade.itensFeitos} de ${atividade.itensTotal}`}>
              <ListChecks aria-hidden />
              {atividade.itensFeitos}/{atividade.itensTotal}
            </span>
          )}
          {atividade.comentarios > 0 && (
            <span className="inline-flex items-center gap-1 text-ink-soft [&_svg]:size-[14px]" aria-label={`${atividade.comentarios} ${atividade.comentarios === 1 ? 'comentário' : 'comentários'}`}>
              <MessageSquare aria-hidden />
              {atividade.comentarios}
            </span>
          )}
        </p>
        {aberta && <BotaoAdiar atividade={atividade} acoes={acoes} />}
      </div>
      {acao && aberta && (
        <Button asChild variante="terciario" tamanho="pequeno" className="justify-self-start bg-indigo-wash md:min-h-8">
          <LinkCentral href={acao.href}>
            {acao.rotulo}
            <ExternalLink aria-hidden />
          </LinkCentral>
        </Button>
      )}
    </div>
  );
}

const LIMIAR_DO_DESLIZE = 96;

/**
 * Deslizar um cartão no celular: para a direita conclui; para a esquerda, adia um dia (18 §10.5).
 * As duas têm "Desfazer", e o menu do cartão faz o mesmo sem deslizar (CA-18.06).
 */
function useDeslizarCartao(ativo: boolean, aoDireita: () => void, aoEsquerda: () => void) {
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const ultimo = useRef(0);
  const [deslocamento, setDeslocamento] = useState(0);
  const mover = (dx: number) => {
    ultimo.current = dx;
    setDeslocamento(dx);
  };

  if (!ativo) return { deslocamento: 0, eventos: {} };
  return {
    deslocamento,
    eventos: {
      onTouchStart: (evento: TouchEvent) => {
        const toque = evento.touches[0];
        if (toque) inicio.current = { x: toque.clientX, y: toque.clientY };
      },
      onTouchMove: (evento: TouchEvent) => {
        const toque = evento.touches[0];
        if (!toque || !inicio.current) return;
        const dx = toque.clientX - inicio.current.x;
        const dy = toque.clientY - inicio.current.y;
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) mover(dx);
      },
      onTouchEnd: (evento: TouchEvent) => {
        const final = ultimo.current;
        // O cartão ficou com o gesto: a aba de situação não troca junto.
        if (final) evento.stopPropagation();
        if (final >= LIMIAR_DO_DESLIZE) aoDireita();
        else if (final <= -LIMIAR_DO_DESLIZE) aoEsquerda();
        mover(0);
        inicio.current = null;
      },
      onTouchCancel: () => {
        mover(0);
        inicio.current = null;
      },
    },
  };
}

type CartaoDoQuadroProps = {
  atividade: AtividadeDoDia;
  dados: DadosMeuDia;
  hoje: string;
  acoes: AcoesDaAtividade;
  arrastando: boolean;
  /** Acabou de ser criada (T03.03). */
  recente: boolean;
  aoComecarArrasto: (id: string) => void;
  aoTerminarArrasto: () => void;
};

/** Faixa esquerda de 3px para atraso e fundo tingido para bloqueio, além do texto (18 §9.5). */
export function CartaoDoQuadro({ atividade, dados, hoje, acoes, arrastando, recente, aoComecarArrasto, aoTerminarArrasto }: CartaoDoQuadroProps) {
  const celular = useEhCelular();
  const aberta = estaAberta(atividade);
  const { deslocamento, eventos } = useDeslizarCartao(celular && aberta, () => acoes.concluir(atividade), () => acoes.adiarEm(atividade, 1));

  return (
    <article
      data-atividade={atividade.id}
      draggable={!celular}
      onDragStart={(evento) => {
        evento.dataTransfer.effectAllowed = 'move';
        evento.dataTransfer.setData('text/plain', atividade.id);
        aoComecarArrasto(atividade.id);
      }}
      onDragEnd={aoTerminarArrasto}
      style={deslocamento ? { transform: `translateX(${deslocamento}px)` } : undefined}
      className={cn('touch-pan-y rounded-lg border border-line bg-paper p-4 md:px-[18px] md:py-4', estaAtrasada(atividade, hoje) && 'border-l-[3px] border-l-err', estaBloqueada(atividade) && 'bg-err-wash/30', !celular && 'cursor-grab active:cursor-grabbing', arrastando && '-rotate-1 opacity-70 shadow-e1', recente && 'destaque-recente')}
      {...eventos}
    >
      <ConteudoDoCartao atividade={atividade} dados={dados} hoje={hoje} acoes={acoes} />
    </article>
  );
}
