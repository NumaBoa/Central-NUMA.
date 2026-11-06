'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { aviso } from '@/componentes/padroes/aviso';
import { ID_KIMBERLY } from '@/dados/exemplos/base';
import { assinarMeta, gravarMeta, lerMeta, metaDoServidor } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { VALORES_PADRAO } from '@/dados/tipos/configuracao';
import { lerConfiguracoes } from '@/dominio/configuracoes';
import { acharContexto, carregarContextos, CONTEXTOS_SEM_DADOS, type Contexto } from '@/dominio/contextos';
import { existemDadosDeExemplo } from '@/dominio/dados';
import type { Fase } from '@/dominio/navegacao';
import { pessoasDoSeletor, resolverPessoaAtual } from '@/dominio/pessoa-atual';
import { sincronizarNotificacoes } from '@/dominio/notificacoes';
import { executarRotinas, mensagemDasRotinas } from '@/dominio/rotinas';

export type PessoaDoSeletor = { id: string; nome: string };

/** Enquanto os dados carregam, ou se estiverem danificados. */
const PESSOA_PADRAO: PessoaDoSeletor = { id: ID_KIMBERLY, nome: 'Kimberly Grebe' };

type ValorCentral = {
  /** "Você é" (02 §0.4): não é controle de segurança, só define a pessoa atual. */
  pessoa: PessoaDoSeletor;
  /** Pessoas internas ativas (02 §0.4). */
  pessoas: readonly PessoaDoSeletor[];
  escolherPessoa: (id: string) => void;
  contexto: Contexto;
  /** Os produtos ativos + as duas visões da Numa (CA-02.03). */
  contextos: readonly Contexto[];
  escolherContexto: (id: string) => void;
  /** De T02.01 (RT-23). Enquanto os dados carregam, ou se estiverem danificados, a fase inicial. */
  faseAtiva: Fase;
  /** A etiqueta discreta fica no cabeçalho enquanto existirem (02 §0.3). */
  temDadosDeExemplo: boolean;
  alternarMenu: () => void;
};

const ContextoCentral = createContext<ValorCentral | null>(null);

export function CentralProvider({ children }: { children: ReactNode }) {
  const meta = useSyncExternalStore(assinarMeta, lerMeta, metaDoServidor);
  const [menuAbertoNoTablet, setMenuAbertoNoTablet] = useState(false);
  const pessoas = useConsulta(() => repositorios.pessoa.listar());
  const exemplos = useConsulta(existemDadosDeExemplo);
  const configuracoes = useConsulta(lerConfiguracoes);
  const consultaContextos = useConsulta(carregarContextos);

  // Rotinas do dia ao abrir (02 §0.5): aviso discreto só quando há novidade.
  // Depois, a cada minuto, os lembretes que chegaram na hora e os alertas novos vão para o sino (RN-03.21).
  useEffect(() => {
    const sincronizar = () => {
      sincronizarNotificacoes().catch(() => {
        // dados danificados: a tela de Dados mostra o problema e o caminho de saída
      });
    };
    executarRotinas()
      .then((resultado) => {
        if (resultado.novidades.length > 0 || resultado.falhas.length > 0) aviso(mensagemDasRotinas(resultado));
      })
      .catch(() => {
        // dados danificados: a tela de Dados mostra o problema e o caminho de saída
      })
      .finally(sincronizar);
    const relogio = setInterval(sincronizar, 60_000);
    return () => clearInterval(relogio);
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu-recolhido', meta.menu_recolhido);
  }, [meta.menu_recolhido]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu-aberto', menuAbertoNoTablet);
    if (!menuAbertoNoTablet) return;
    const aoClicarFora = (evento: MouseEvent) => {
      if (!(evento.target as Element).closest('[data-menu-lateral]')) setMenuAbertoNoTablet(false);
    };
    document.addEventListener('click', aoClicarFora);
    return () => document.removeEventListener('click', aoClicarFora);
  }, [menuAbertoNoTablet]);

  const alternarMenu = useCallback(() => {
    if (window.matchMedia('(max-width: 1023.98px)').matches) setMenuAbertoNoTablet((aberto) => !aberto);
    else gravarMeta({ menu_recolhido: !lerMeta().menu_recolhido });
  }, []);

  const listaDePessoas = pessoas.dados;
  const temExemplos = exemplos.dados ?? false;
  const faseAtiva = configuracoes.dados?.fase_ativa ?? VALORES_PADRAO.fase_ativa;
  const contextos = consultaContextos.dados ?? CONTEXTOS_SEM_DADOS;
  const valor = useMemo<ValorCentral>(() => {
    const paraSeletor = (pessoa: { id: string; nome_completo: string }): PessoaDoSeletor => ({ id: pessoa.id, nome: pessoa.nome_completo });
    const atual = listaDePessoas ? resolverPessoaAtual(listaDePessoas, meta.pessoa_atual_id) : null;
    return {
      pessoa: atual ? paraSeletor(atual) : PESSOA_PADRAO,
      pessoas: listaDePessoas ? pessoasDoSeletor(listaDePessoas).map(paraSeletor) : [PESSOA_PADRAO],
      escolherPessoa: (id) => gravarMeta({ pessoa_atual_id: id }),
      contexto: acharContexto(contextos, meta.contexto_id),
      contextos,
      escolherContexto: (id) => gravarMeta({ contexto_id: id }),
      faseAtiva,
      temDadosDeExemplo: temExemplos,
      alternarMenu,
    };
  }, [listaDePessoas, temExemplos, faseAtiva, contextos, meta.pessoa_atual_id, meta.contexto_id, alternarMenu]);

  return <ContextoCentral value={valor}>{children}</ContextoCentral>;
}

export function useCentral(): ValorCentral {
  const valor = use(ContextoCentral);
  if (!valor) throw new Error('useCentral precisa estar dentro de CentralProvider.');
  return valor;
}
