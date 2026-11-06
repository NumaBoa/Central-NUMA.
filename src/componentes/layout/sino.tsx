'use client';

import { AlarmClock, AtSign, Bell, Check, ServerCrash, TriangleAlert } from 'lucide-react';
import { aviso } from '@/componentes/padroes/aviso';
import { MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { Notificacao } from '@/dados/tipos/notificacao';
import { useConsulta } from '@/dados/use-consulta';
import { caminhoDaNotificacao, carregarNotificacoes, marcarComoLida, marcarTodasComoLidas, ROTULOS_TIPO_NOTIFICACAO } from '@/dominio/notificacoes';
import { formatarDataHora } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { useCentral } from './central-provider';
import { LinkCentral } from './protecao-saida';

const ICONES = { alerta: TriangleAlert, mencao: AtSign, lembrete: AlarmClock, job: ServerCrash } as const;

function tentar(acao: () => Promise<void>) {
  acao().catch((erro: unknown) => aviso(mensagemDoErro(erro)));
}

function LinhaDaNotificacao({ notificacao, aoFechar }: { notificacao: Notificacao; aoFechar: () => void }) {
  const Icone = ICONES[notificacao.tipo];
  const caminho = caminhoDaNotificacao(notificacao);
  const naoLida = !notificacao.lida_em;
  const conteudo = (
    <>
      <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm [&_svg]:size-4', naoLida ? 'bg-indigo-wash text-indigo' : 'bg-mist text-ink-soft')}>
        <Icone aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] leading-[18px] break-words', naoLida ? 'font-semibold' : 'text-ink-soft')}>{notificacao.titulo}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">
          {ROTULOS_TIPO_NOTIFICACAO[notificacao.tipo]} · {formatarDataHora(notificacao.criado_em)}
          {naoLida ? <span className="sr-only"> · não lida</span> : ''}
        </span>
      </span>
    </>
  );
  return (
    <li className="flex items-start gap-1 rounded-sm hover:bg-hover">
      {caminho ? (
        <LinkCentral
          href={caminho}
          className="flex min-h-12 min-w-0 flex-1 items-start gap-2.5 rounded-sm p-2 text-left"
          onClick={() => {
            if (naoLida) tentar(() => marcarComoLida(notificacao.id));
            aoFechar();
          }}
        >
          {conteudo}
        </LinkCentral>
      ) : (
        <div className="flex min-h-12 min-w-0 flex-1 items-start gap-2.5 p-2">{conteudo}</div>
      )}
      {naoLida && (
        <Button variante="icone" tamanho="icone" aria-label={`Marcar como lida: ${notificacao.titulo}`} className="shrink-0" onClick={() => tentar(() => marcarComoLida(notificacao.id))}>
          <Check aria-hidden />
        </Button>
      )}
    </li>
  );
}

/** T13.04: sino com contagem, marcar como lida, marcar todas e abrir a origem. */
export function MenuNotificacoes() {
  const { pessoa } = useCentral();
  const consulta = useConsulta(() => carregarNotificacoes(pessoa.id), [pessoa.id]);
  const linhas = consulta.dados ?? [];
  const naoLidas = linhas.filter((notificacao) => !notificacao.lida_em).length;
  const rotulo = naoLidas === 0 ? 'Notificações' : naoLidas === 1 ? 'Notificações: 1 não lida' : `Notificações: ${naoLidas} não lidas`;

  return (
    <MenuSobreposto
      titulo="Notificações"
      alinhar="end"
      largura={380}
      acaoCabecalho={
        naoLidas > 0 && (
          <Button variante="terciario" tamanho="pequeno" onClick={() => tentar(() => marcarTodasComoLidas(pessoa.id))}>
            Marcar todas
          </Button>
        )
      }
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label={rotulo} className="relative">
          <Bell aria-hidden />
          {naoLidas > 0 && (
            <span aria-hidden className="absolute top-1 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-indigo px-1 text-xs leading-none font-semibold text-paper tabular-nums">
              {naoLidas > 99 ? '99+' : naoLidas}
            </span>
          )}
        </Button>
      }
    >
      {(fechar) =>
        linhas.length ? (
          <ul className="grid gap-0.5">
            {linhas.map((notificacao) => (
              <LinhaDaNotificacao key={notificacao.id} notificacao={notificacao} aoFechar={fechar} />
            ))}
          </ul>
        ) : (
          <p className="px-1 pb-4 text-sm text-ink-soft md:px-3">Nada novo por aqui.</p>
        )
      }
    </MenuSobreposto>
  );
}
