'use client';

import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { AlarmClock, BellRing, CalendarDays, Check, CheckSquare, Ellipsis, Inbox, OctagonX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EtiquetaContexto, EtiquetaPrioridade, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import type { Atividade } from '@/dados/tipos/atividade';
import { ACOES_DE_ALERTA, contextosDaAtividade, estaAberta, estaAtrasada, estaBloqueada, primeiroNome, ROTULOS_ORIGEM_ALERTA, ROTULOS_TIPO_ATIVIDADE, textoDoPrazo, textoDosAdiamentos, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';
import type { AcoesDaAtividade } from './acoes-atividade';

export const ICONES_DO_TIPO: Readonly<Record<Atividade['tipo'], LucideIcon>> = { tarefa: CheckSquare, demanda: Inbox, lembrete: AlarmClock, alerta: BellRing };

const nomeDaPessoa = (id: string | null, { pessoas }: Pick<DadosMeuDia, 'pessoas'>) => pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';

export function TipoDaAtividade({ tipo }: { tipo: Atividade['tipo'] }) {
  const Icone = ICONES_DO_TIPO[tipo];
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold [&_svg]:size-[14px]">
      <Icone aria-hidden />
      {ROTULOS_TIPO_ATIVIDADE[tipo]}
    </span>
  );
}

function LinhaDoMenu({ icone, rotulo, aoClicar }: { icone?: ReactNode; rotulo: string; aoClicar: () => void }) {
  return (
    <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')} onClick={aoClicar}>
      {icone}
      {rotulo}
    </button>
  );
}

const TituloDoMenu = ({ children }: { children: ReactNode }) => <p className="px-1 pt-2 pb-0.5 text-xs font-semibold text-ink-soft first:pt-0 md:px-3">{children}</p>;

/** Mover, adiar, bloquear, concluir e cancelar sem arrastar (T03.01 e RT-19). */
export function MenuDaAtividade({ atividade, acoes }: { atividade: AtividadeDoDia; acoes: AcoesDaAtividade }) {
  const aberta = estaAberta(atividade);
  return (
    <MenuSobreposto
      titulo="Ações"
      largura={270}
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
        if (!aberta) return <LinhaDoMenu rotulo="Reabrir" aoClicar={fazer(() => acoes.pedir('reabrir', atividade))} />;
        return (
          <div className="grid gap-0.5">
            <TituloDoMenu>Mover para</TituloDoMenu>
            {atividade.situacao !== 'a_fazer' && <LinhaDoMenu rotulo="A fazer" aoClicar={fazer(() => acoes.mover(atividade, 'a_fazer'))} />}
            {atividade.situacao !== 'em_andamento' && <LinhaDoMenu rotulo="Em andamento" aoClicar={fazer(() => acoes.mover(atividade, 'em_andamento'))} />}
            {atividade.situacao !== 'aguardando' && <LinhaDoMenu rotulo="Aguardando retorno" aoClicar={fazer(() => acoes.pedir('aguardando', atividade))} />}
            <TituloDoMenu>Adiar</TituloDoMenu>
            <LinhaDoMenu rotulo="+1 dia" aoClicar={fazer(() => acoes.adiarEm(atividade, 1))} />
            <LinhaDoMenu rotulo="+1 semana" aoClicar={fazer(() => acoes.adiarEm(atividade, 7))} />
            <LinhaDoMenu rotulo="Escolher data" aoClicar={fazer(() => acoes.pedir('adiar', atividade))} />
            <div className="my-1 border-t border-line" />
            {atividade.bloqueada ? <LinhaDoMenu rotulo="Desbloquear" aoClicar={fazer(() => acoes.desbloquear(atividade))} /> : <LinhaDoMenu rotulo="Marcar bloqueada" aoClicar={fazer(() => acoes.pedir('bloquear', atividade))} />}
            <LinhaDoMenu rotulo="Concluir" aoClicar={fazer(() => acoes.concluir(atividade))} />
            {atividade.tipo === 'alerta' ? <LinhaDoMenu rotulo="Dispensar alerta" aoClicar={fazer(() => acoes.pedir('dispensar', atividade))} /> : <LinhaDoMenu rotulo="Cancelar" aoClicar={fazer(() => acoes.pedir('cancelar', atividade))} />}
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
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
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
    </span>
  );
}

/** A caixa de concluir sem abrir a atividade. Marcada, reabre, e reabrir pede motivo. */
function CaixaDeConcluir({ atividade, acoes }: { atividade: AtividadeDoDia; acoes: AcoesDaAtividade }) {
  const concluida = atividade.situacao === 'concluida';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={concluida}
      aria-label={concluida ? `Reabrir ${atividade.titulo}` : `Concluir ${atividade.titulo}`}
      onClick={() => (concluida ? acoes.pedir('reabrir', atividade) : acoes.concluir(atividade))}
      className="group/caixa -m-2.5 grid size-11 shrink-0 place-items-center rounded-full md:-m-1.5 md:size-8"
    >
      <span className={cn('grid size-[22px] place-items-center rounded-full border-2 transition-colors duration-150 [&_svg]:size-[14px]', concluida ? 'border-ok bg-ok text-white' : 'border-ink-faint text-transparent group-hover/caixa:border-ok group-hover/caixa:text-ok')}>
        <Check aria-hidden strokeWidth={3} />
      </span>
    </button>
  );
}

/** O conteúdo do cartão (T03.01): o mesmo no quadro e nos cartões da lista no celular. */
export function ConteudoDoCartao({ atividade, dados, hoje, acoes }: { atividade: AtividadeDoDia; dados: DadosMeuDia; hoje: string; acoes: AcoesDaAtividade }) {
  const prazo = textoDoPrazo(atividade, hoje);
  const adiamentos = textoDosAdiamentos(atividade);
  const contextos = contextosDaAtividade(atividade, dados);
  const area = dados.areas.find((item) => item.id === atividade.area_id)?.nome;
  const acao = atividade.alerta_acao ? ACOES_DE_ALERTA[atividade.alerta_acao] : undefined;
  const concluida = atividade.situacao === 'concluida';
  const aguardandoDe = atividade.aguardando_de_pessoa_id ? nomeDaPessoa(atividade.aguardando_de_pessoa_id, dados) : atividade.aguardando_de_texto;

  return (
    <div className="relative flex items-start gap-3">
      <CaixaDeConcluir atividade={atividade} acoes={acoes} />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pr-8 text-xs leading-4 text-ink-soft">
          <TipoDaAtividade tipo={atividade.tipo} />
          <span className="tabular-nums">{atividade.codigo}</span>
          {(atividade.prioridade === 'urgente' || atividade.prioridade === 'alta') && <EtiquetaPrioridade prioridade={atividade.prioridade} />}
        </p>
        <h3 className={cn('font-body text-[15px] leading-[21px] font-semibold tracking-normal break-words [text-wrap:pretty]', concluida && 'text-ink-soft line-through')}>{atividade.titulo}</h3>
        <ResponsavelDaAtividade atividade={atividade} dados={dados} acoes={acoes} />
        <div className="flex flex-wrap items-center gap-1.5">
          {contextos.map((contexto) => (
            <EtiquetaContexto key={contexto.id} contexto={contexto} />
          ))}
          {area && <span className="text-xs text-ink-soft">{area}</span>}
        </div>
        <p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-[18px] [&_svg]:size-[14px] [&_svg]:shrink-0', prazo.atrasada ? 'font-semibold text-err' : 'text-ink-soft')}>
          <CalendarDays aria-hidden />
          {prazo.texto}
          {adiamentos && <span className="font-normal text-ink-soft">· {adiamentos}</span>}
        </p>
        {estaBloqueada(atividade) && (
          <p className="flex items-start gap-1.5 text-[13px] leading-[18px] font-medium text-err [&_svg]:mt-0.5 [&_svg]:size-[14px] [&_svg]:shrink-0">
            <OctagonX aria-hidden />
            <span className="min-w-0 break-words">Bloqueada: {atividade.bloqueio_motivo}</span>
          </p>
        )}
        {atividade.situacao === 'aguardando' && (
          <p className="text-[13px] leading-[18px] text-ink-soft">
            Aguardando {aguardandoDe}
            {atividade.acompanhamento_em === hoje ? ' · acompanhar hoje' : atividade.acompanhamento_em ? ` · acompanhar em ${atividade.acompanhamento_em.split('-').reverse().join('/').slice(0, 5)}` : ''}
          </p>
        )}
        {atividade.tipo === 'alerta' && (
          <div className="grid gap-1.5">
            <p className="text-[13px] leading-[18px] text-ink-soft">
              Origem: {ROTULOS_ORIGEM_ALERTA[atividade.origem_tipo ?? ''] ?? 'Sistema'}
              {atividade.alerta_motivo ? ` · ${atividade.alerta_motivo}` : ''}
            </p>
            {acao && estaAberta(atividade) && (
              <Button asChild variante="secundario" tamanho="pequeno" className="justify-self-start">
                <LinkCentral href={acao.href}>{acao.rotulo}</LinkCentral>
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="absolute -top-2.5 -right-2.5">
        <MenuDaAtividade atividade={atividade} acoes={acoes} />
      </div>
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
  aoComecarArrasto: (id: string) => void;
  aoTerminarArrasto: () => void;
};

/** Faixa esquerda de 3px só para atraso ou bloqueio, além do texto (18 §9.5). */
export function CartaoDoQuadro({ atividade, dados, hoje, acoes, arrastando, aoComecarArrasto, aoTerminarArrasto }: CartaoDoQuadroProps) {
  const celular = useEhCelular();
  const aberta = estaAberta(atividade);
  const { deslocamento, eventos } = useDeslizarCartao(celular && aberta, () => acoes.concluir(atividade), () => acoes.adiarEm(atividade, 1));
  const destaque = estaAtrasada(atividade, hoje) || estaBloqueada(atividade);

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
      className={cn('touch-pan-y rounded-lg border border-line bg-paper p-4 md:px-[18px] md:py-4', destaque && 'border-l-[3px] border-l-err', !celular && 'cursor-grab active:cursor-grabbing', arrastando && '-rotate-1 opacity-70 shadow-e1')}
      {...eventos}
    >
      <ConteudoDoCartao atividade={atividade} dados={dados} hoje={hoje} acoes={acoes} />
    </article>
  );
}
