'use client';

import { Plus, X } from 'lucide-react';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Avatar } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { cn } from '@/lib/utils';

type CampoParticipantesProps = {
  /** Quem dá para escolher. */
  pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[];
  /** Todas, para mostrar o nome de quem já está na atividade, mesmo fora da lista. */
  todas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[];
  valores: readonly string[];
  aoMudar: (valores: string[]) => void;
  desativado?: boolean;
};

/** Participantes (T03.02): quem está aparece com as iniciais e o nome; "Adicionar" lista quem falta. */
export function CampoParticipantes({ pessoas, todas, valores, aoMudar, desativado = false }: CampoParticipantesProps) {
  const disponiveis = pessoas.filter((pessoa) => !valores.includes(pessoa.id));
  return (
    <fieldset disabled={desativado} className={cn(desativado && 'opacity-60')}>
      <legend className="mb-[7px] texto-rotulo">Participantes</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {valores.map((id) => {
          const nome = todas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
          return (
            <span key={id} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-line bg-paper pr-1 pl-1.5 text-[13px] font-medium md:min-h-9">
              <Avatar nome={nome} className="size-7 text-[12px]" />
              {nome}
              {!desativado && (
                <button type="button" aria-label={`Tirar ${nome}`} onClick={() => aoMudar(valores.filter((valor) => valor !== id))} className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-hover md:size-7 [&_svg]:size-3.5">
                  <X aria-hidden />
                </button>
              )}
            </span>
          );
        })}
        {!desativado && disponiveis.length > 0 && (
          <MenuSobreposto
            titulo="Adicionar participante"
            largura={270}
            gatilho={
              <Button variante="terciario" tamanho="pequeno">
                <Plus aria-hidden />
                Adicionar
              </Button>
            }
          >
            {(fechar) => (
              <div className="grid gap-0.5">
                {disponiveis.map((pessoa) => (
                  <button
                    key={pessoa.id}
                    type="button"
                    className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')}
                    onClick={() => {
                      fechar();
                      aoMudar([...valores, pessoa.id]);
                    }}
                  >
                    <Avatar nome={pessoa.nome_completo} className="size-7 text-[12px]" />
                    {pessoa.nome_completo}
                  </button>
                ))}
              </div>
            )}
          </MenuSobreposto>
        )}
        {!valores.length && (desativado || !disponiveis.length) && <span className="text-[13px] text-ink-soft">Ninguém.</span>}
      </div>
    </fieldset>
  );
}
