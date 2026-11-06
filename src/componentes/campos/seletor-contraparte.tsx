'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { Input } from '@/componentes/ui/input';
import type { Contraparte } from '@/dados/tipos/contraparte';
import { nomeDaContraparte, ROTULOS_PAPEL_CONTRAPARTE } from '@/dominio/contrapartes';
import { normalizarTexto, soDigitos } from '@/dominio/duplicidade';
import { cn } from '@/lib/utils';

const MAXIMO_NA_LISTA = 8;

type SeletorContraparteProps = {
  id?: string;
  /** O id da contraparte, ou vazio. */
  valor: string;
  aoMudar: (id: string) => void;
  contrapartes: readonly Contraparte[];
  /** T04.03: só quem tem o papel de fornecedor. */
  papel?: Contraparte['papeis'][number];
  /** Abre o cadastro rápido, com o que foi digitado (02 §6). */
  aoCriar?: (nome: string) => void;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

/**
 * Seletor de contraparte (02 §6): busca por nome, documento e e-mail, com criação rápida. Arquivadas
 * e inativas não aparecem para novos registros, mas continuam na que já estava escolhida.
 */
export function SeletorContraparte({ id, valor, aoMudar, contrapartes, papel, aoCriar, ...acessibilidade }: SeletorContraparteProps) {
  const lista = useId();
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const escolhida = contrapartes.find((contraparte) => contraparte.id === valor);

  const opcoes = useMemo(() => {
    const texto = normalizarTexto(termo);
    const digitos = soDigitos(termo);
    return contrapartes
      .filter((contraparte) => !contraparte.arquivado_em && contraparte.situacao === 'ativa' && (!papel || contraparte.papeis.includes(papel)))
      .filter((contraparte) => !texto || normalizarTexto(`${contraparte.nome} ${contraparte.nome_fantasia ?? ''} ${contraparte.email ?? ''}`).includes(texto) || (digitos.length >= 3 && soDigitos(contraparte.documento ?? '').includes(digitos)))
      .sort((a, b) => nomeDaContraparte(a).localeCompare(nomeDaContraparte(b), 'pt-BR'))
      .slice(0, MAXIMO_NA_LISTA);
  }, [contrapartes, termo, papel]);

  const podeCriar = Boolean(aoCriar);
  const total = opcoes.length + (podeCriar ? 1 : 0);

  useEffect(() => setAtivo(0), [termo, aberto]);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (evento: PointerEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', aoClicarFora);
    return () => document.removeEventListener('pointerdown', aoClicarFora);
  }, [aberto]);

  function escolher(contraparte: Contraparte) {
    aoMudar(contraparte.id);
    setTermo('');
    setAberto(false);
  }

  function criar() {
    setAberto(false);
    aoCriar?.(termo.trim());
    setTermo('');
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!aberto) return setAberto(true);
      if (total) setAtivo((atual) => (atual + (evento.key === 'ArrowDown' ? 1 : -1) + total) % total);
    } else if (evento.key === 'Enter' && aberto) {
      evento.preventDefault();
      const opcao = opcoes[ativo];
      if (opcao) escolher(opcao);
      else if (podeCriar) criar();
    } else if (evento.key === 'Escape' && aberto) {
      // Só fecha a lista: o painel continua aberto.
      evento.preventDefault();
      evento.stopPropagation();
      setAberto(false);
    }
  }

  return (
    <div ref={caixa} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={aberto ? `${lista}-${ativo}` : undefined}
        autoComplete="off"
        placeholder="Nome, documento ou e-mail"
        value={aberto ? termo : escolhida ? nomeDaContraparte(escolhida) : ''}
        onFocus={() => setAberto(true)}
        onClick={() => setAberto(true)}
        onChange={(evento) => {
          setTermo(evento.target.value);
          setAberto(true);
        }}
        onKeyDown={aoTeclar}
        className="pr-11"
        {...acessibilidade}
      />
      {escolhida && !aberto ? (
        <button type="button" aria-label="Tirar a contraparte" onClick={() => aoMudar('')} className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center text-ink-soft hover:text-ink md:size-9 [&_svg]:size-4">
          <X aria-hidden />
        </button>
      ) : (
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
      )}
      {aberto && (
        <ul id={lista} role="listbox" aria-label="Contrapartes" className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-line bg-paper p-1 shadow-[var(--sh-2)]">
          {opcoes.map((contraparte, indice) => (
            <li key={contraparte.id} id={`${lista}-${indice}`} role="option" aria-selected={indice === ativo}>
              <button type="button" tabIndex={-1} onMouseEnter={() => setAtivo(indice)} onClick={() => escolher(contraparte)} className={cn('grid min-h-11 w-full content-center rounded-sm px-2.5 py-1.5 text-left text-[13px]', indice === ativo && 'bg-hover')}>
                <span className="font-medium break-words">{nomeDaContraparte(contraparte)}</span>
                <span className="text-xs text-ink-soft">{contraparte.papeis.map((papel) => ROTULOS_PAPEL_CONTRAPARTE[papel]).join(', ')}</span>
              </button>
            </li>
          ))}
          {!opcoes.length && <li className="px-2.5 py-2 text-[13px] text-ink-soft">Nenhuma contraparte com isso.</li>}
          {podeCriar && (
            <li id={`${lista}-${opcoes.length}`} role="option" aria-selected={ativo === opcoes.length}>
              <button type="button" tabIndex={-1} onMouseEnter={() => setAtivo(opcoes.length)} onClick={criar} className={cn('flex min-h-11 w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px] font-semibold text-indigo [&_svg]:size-4', ativo === opcoes.length && 'bg-hover')}>
                <Plus aria-hidden />
                {termo.trim() ? `Cadastrar “${termo.trim()}”` : 'Cadastrar nova contraparte'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
