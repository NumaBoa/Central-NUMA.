'use client';

import { useState, useSyncExternalStore } from 'react';
import { Bookmark, Columns3, Download, Trash2 } from 'lucide-react';
import { MensagemErro } from '@/componentes/campos/campo';
import { aviso } from '@/componentes/padroes/aviso';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { assinarMeta, lerMeta, metaDoServidor } from '@/dados/meta';
import { colunasDaPreferencia, removerVisao, salvarColunas, salvarVisao, visoesDaPreferencia, type VisaoSalva } from '@/dominio/preferencias-lista';
import { baixarArquivo } from '@/lib/baixar-arquivo';
import { gerarCsv } from '@/lib/csv';
import { hojeISO } from '@/lib/datas';
import { CLASSE_LINHA_MENU, MenuSobreposto } from './menu-sobreposto';
import type { Coluna } from './lista';

/** As preferências de uma lista (P1), por pessoa: colunas e visões salvas. */
export function usePreferenciasDaLista(pessoaId: string, lista: string, colunasPadrao: readonly string[]) {
  const meta = useSyncExternalStore(assinarMeta, lerMeta, metaDoServidor);
  return { colunasVisiveis: colunasDaPreferencia(meta, pessoaId, lista) ?? colunasPadrao, visoes: visoesDaPreferencia(meta, pessoaId, lista) };
}

/** Colunas configuráveis (P1). A coluna fixa, que abre o registro, não sai. */
export function MenuColunas<T>({ pessoaId, lista, colunas, visiveis, padrao }: { pessoaId: string; lista: string; colunas: readonly Coluna<T>[]; visiveis: readonly string[]; padrao: readonly string[] }) {
  function alternar(id: string, ligada: boolean) {
    salvarColunas(pessoaId, lista, colunas.map((coluna) => coluna.id).filter((coluna) => (coluna === id ? ligada : visiveis.includes(coluna))));
  }
  return (
    <MenuSobreposto
      titulo="Colunas"
      largura={260}
      alinhar="end"
      gatilho={
        <Button variante="secundario" className="max-md:hidden">
          <Columns3 aria-hidden />
          Colunas
        </Button>
      }
    >
      <ul className="grid gap-0.5">
        {colunas.map((coluna) => (
          <li key={coluna.id}>
            <label className={`${CLASSE_LINHA_MENU} cursor-pointer hover:bg-hover has-disabled:cursor-default has-disabled:text-ink-soft md:min-h-9 md:py-1.5`}>
              <input type="checkbox" className="size-[18px] shrink-0 accent-[var(--ok)]" disabled={coluna.fixa} checked={coluna.fixa || visiveis.includes(coluna.id)} onChange={(evento) => alternar(coluna.id, evento.target.checked)} />
              {coluna.titulo}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-1 border-t border-line pt-1">
        <Button variante="terciario" tamanho="pequeno" onClick={() => salvarColunas(pessoaId, lista, [...padrao])}>
          Voltar ao padrão
        </Button>
      </div>
    </MenuSobreposto>
  );
}

/** Visões salvas (P1): a combinação de filtros e colunas, com um nome, para a pessoa. */
export function MenuVisoes({ pessoaId, lista, visoes, filtros, colunas, aoAplicar }: { pessoaId: string; lista: string; visoes: readonly VisaoSalva[]; filtros: Record<string, unknown>; colunas: readonly string[]; aoAplicar: (visao: VisaoSalva) => void }) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    try {
      salvarVisao(pessoaId, lista, { nome, filtros, colunas: [...colunas] });
      setNome('');
      setErro(null);
      aviso('Visão salva.');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para salvar a visão.');
    }
  }

  return (
    <MenuSobreposto
      titulo="Visões salvas"
      largura={300}
      alinhar="end"
      gatilho={
        <Button variante="secundario">
          <Bookmark aria-hidden />
          {visoes.length ? `Visões (${visoes.length})` : 'Visões'}
        </Button>
      }
    >
      {(fechar) => (
        <div className="grid gap-3 px-1 pb-2 md:px-3">
          {visoes.length > 0 ? (
            <ul className="grid gap-0.5">
              {visoes.map((visao) => (
                <li key={visao.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`${CLASSE_LINHA_MENU} min-w-0 flex-1 break-words hover:bg-hover md:min-h-9 md:py-1.5`}
                    onClick={() => {
                      aoAplicar(visao);
                      fechar();
                    }}
                  >
                    {visao.nome}
                  </button>
                  <Button variante="icone" tamanho="icone" aria-label={`Tirar a visão ${visao.nome}`} onClick={() => removerVisao(pessoaId, lista, visao.id)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-soft">Salve os filtros e as colunas de agora para voltar a eles depois.</p>
          )}
          <div className="grid gap-2 border-t border-line pt-3">
            <label htmlFor={`visao-${lista}`} className="texto-rotulo">
              Salvar esta visão
            </label>
            <Input
              id={`visao-${lista}`}
              autoComplete="off"
              placeholder="Nome da visão"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault();
                  salvar();
                }
              }}
            />
            {erro && <MensagemErro>{erro}</MensagemErro>}
            <Button variante="secundario" tamanho="pequeno" className="justify-self-start" onClick={salvar}>
              Salvar visão
            </Button>
          </div>
        </div>
      )}
    </MenuSobreposto>
  );
}

/** Exportar CSV (P1): só as colunas visíveis, do que está filtrado. */
export function BotaoExportarCsv<T>({ nomeDoArquivo, colunas, linhas }: { nomeDoArquivo: string; colunas: readonly Coluna<T>[]; linhas: readonly T[] }) {
  function exportar() {
    const comTexto = colunas.filter((coluna) => coluna.texto);
    baixarArquivo(`${nomeDoArquivo}-${hojeISO()}.csv`, gerarCsv(comTexto.map((coluna) => coluna.titulo), linhas.map((linha) => comTexto.map((coluna) => coluna.texto?.(linha) ?? ''))), 'text/csv;charset=utf-8');
    aviso(linhas.length === 1 ? '1 linha exportada.' : `${linhas.length} linhas exportadas.`);
  }
  return (
    <Button variante="secundario" onClick={exportar} disabled={!linhas.length}>
      <Download aria-hidden />
      Exportar
    </Button>
  );
}
