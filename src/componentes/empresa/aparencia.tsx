'use client';

import type { ReactNode } from 'react';
import { ArrowRightLeft, BadgeCheck, Building2, CalendarClock, FileText, Gavel, LayoutGrid, ListChecks, Lock, Users } from 'lucide-react';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbasPagina, CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Subabas } from '@/componentes/padroes/subabas';
import type { Entidade } from '@/dados/tipos/contraparte';
import type { AcordoVersao, ConstituicaoItem, MarcaProcesso, Obrigacao } from '@/dados/tipos/sociedade';
import { ROTULOS_SITUACAO_VERSAO } from '@/dominio/acordos';
import { ROTULOS_SITUACAO_ITEM, type EstadoDoItem } from '@/dominio/constituicao';
import { ROTULOS_SITUACAO_ENTIDADE } from '@/dominio/entidades';
import { ROTULOS_SITUACAO_PROCESSO } from '@/dominio/marcas-inpi';
import { faseLiberada, type Fase } from '@/dominio/navegacao';
import { ROTULOS_SITUACAO_OBRIGACAO } from '@/dominio/obrigacoes';
import { rotuloDaFase } from '@/dominio/fases';

export type AbaDaEmpresa = 'painel' | 'socias' | 'acordos' | 'ativos' | 'marcas' | 'constituicao' | 'entidade' | 'obrigacoes' | 'reunioes';

/** As seções do módulo. Obrigações é da F1: antes dela, "Em breve", e a tela só abre pelo endereço, com o aviso. */
export function AbasEmpresa({ ativa }: { ativa: AbaDaEmpresa }) {
  const { faseAtiva } = useCentral();
  return (
    <AbasPagina
      rotulo="Seções da empresa"
      className="!mt-0"
      abas={[
        { rotulo: 'Painel', icone: LayoutGrid, href: '/empresa', ativa: ativa === 'painel' },
        { rotulo: 'Sócias', icone: Users, href: '/empresa/socias', ativa: ativa === 'socias' },
        { rotulo: 'Acordos', icone: FileText, href: '/empresa/acordos', ativa: ativa === 'acordos' },
        { rotulo: 'Ativos a transferir', icone: ArrowRightLeft, href: '/empresa/ativos', ativa: ativa === 'ativos' },
        { rotulo: 'Marcas', icone: BadgeCheck, href: '/empresa/marcas', ativa: ativa === 'marcas' },
        { rotulo: 'Constituição', icone: ListChecks, href: '/empresa/constituicao', ativa: ativa === 'constituicao' },
        { rotulo: 'Entidade', icone: Building2, href: '/empresa/entidade', ativa: ativa === 'entidade' },
        { rotulo: 'Obrigações', icone: CalendarClock, ativa: ativa === 'obrigacoes', ...(faseLiberada('f1', faseAtiva) || ativa === 'obrigacoes' ? { href: '/empresa/obrigacoes' } : {}) },
        { rotulo: 'Reuniões e decisões', icone: Gavel, href: '/empresa/reunioes', ativa: ativa === 'reunioes' },
      ]}
    />
  );
}

export function SubabasDeReunioes({ ativa }: { ativa: 'reunioes' | 'decisoes' }) {
  return (
    <Subabas
      rotulo="Reuniões e decisões"
      itens={[
        { rotulo: 'Reuniões', href: '/empresa/reunioes', ativa: ativa === 'reunioes' },
        { rotulo: 'Decisões', href: '/empresa/decisoes', ativa: ativa === 'decisoes' },
      ]}
    />
  );
}

/** A tela abre por link, mas o menu segue a fase ativa (RT-23): diz isso em vez de parecer um erro. */
export function AvisoDeFaseDaEmpresa({ fase = 'f0b', tela = 'Empresa' }: { fase?: Fase; tela?: string }) {
  const { faseAtiva } = useCentral();
  if (faseLiberada(fase, faseAtiva)) return null;
  return (
    <Faixa
      tipo="info"
      acao={
        <LinkCentral href="/configuracoes#fase" className="inline-flex min-h-11 items-center underline md:min-h-0">
          Ver fase
        </LinkCentral>
      }
    >
      A {rotuloDaFase(fase)} ainda não está ativa: no menu, {tela} continua “Em breve”, e esta tela abre só por este endereço.
    </Faixa>
  );
}

/** Cabeçalho, abas e o aviso de fase, iguais em todas as telas do módulo. */
export function MolduraDaEmpresa({ ativa, titulo, resumo, acoes, fase, tela, children }: { ativa: AbaDaEmpresa; titulo: string; resumo?: ReactNode; acoes?: ReactNode; fase?: Fase; tela?: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <CabecalhoPagina kicker="Empresa" titulo={titulo} {...(resumo ? { resumo } : {})} {...(acoes ? { acoes } : {})} />
      <AbasEmpresa ativa={ativa} />
      <AvisoDeFaseDaEmpresa {...(fase ? { fase } : {})} {...(tela ? { tela } : {})} />
      {children}
    </div>
  );
}

const TIPOS_DA_VERSAO: Readonly<Record<AcordoVersao['situacao'], TipoSituacao>> = { rascunho: 'neutro', em_revisao: 'info', aguardando_assinaturas: 'atencao', vigente: 'sucesso', substituida: 'neutro', cancelada: 'neutro' };

export function SituacaoDaVersaoDoAcordo({ situacao }: { situacao: AcordoVersao['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DA_VERSAO[situacao]}>{ROTULOS_SITUACAO_VERSAO[situacao]}</EtiquetaSituacao>;
}

const TIPOS_DA_ENTIDADE: Readonly<Record<Entidade['situacao'], TipoSituacao>> = { planejada: 'info', em_constituicao: 'atencao', ativa: 'sucesso', encerrada: 'neutro' };

export function SituacaoDaEntidadeDaEmpresa({ situacao }: { situacao: Entidade['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DA_ENTIDADE[situacao]}>{ROTULOS_SITUACAO_ENTIDADE[situacao]}</EtiquetaSituacao>;
}

const TIPOS_DO_PROCESSO: Readonly<Record<MarcaProcesso['situacao'], TipoSituacao>> = { planejado: 'neutro', protocolado: 'info', em_exame: 'info', publicado: 'info', oposicao: 'atencao', exigencia: 'atencao', deferido: 'sucesso', registrado: 'sucesso', indeferido: 'erro', arquivado: 'neutro' };

export function SituacaoDoProcesso({ situacao }: { situacao: MarcaProcesso['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DO_PROCESSO[situacao]}>{ROTULOS_SITUACAO_PROCESSO[situacao]}</EtiquetaSituacao>;
}

const TIPOS_DO_ITEM: Readonly<Record<ConstituicaoItem['situacao'], TipoSituacao>> = { a_fazer: 'neutro', em_andamento: 'info', concluido: 'sucesso', nao_se_aplica: 'neutro' };

export function SituacaoDoItem({ estado }: { estado: EstadoDoItem }) {
  if (estado === 'bloqueado') {
    return (
      <EtiquetaSituacao tipo="erro" icone={Lock}>
        Bloqueado
      </EtiquetaSituacao>
    );
  }
  return <EtiquetaSituacao tipo={TIPOS_DO_ITEM[estado]}>{ROTULOS_SITUACAO_ITEM[estado]}</EtiquetaSituacao>;
}

const TIPOS_DA_OBRIGACAO: Readonly<Record<Obrigacao['situacao'], TipoSituacao>> = { rascunho: 'neutro', ativa: 'sucesso', encerrada: 'neutro' };

export function SituacaoDaObrigacao({ situacao }: { situacao: Obrigacao['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DA_OBRIGACAO[situacao]}>{ROTULOS_SITUACAO_OBRIGACAO[situacao]}</EtiquetaSituacao>;
}

/** Faixa de contexto do módulo: entidade, sócias e o acordo principal. */
export function ResumoDaEmpresa({ itens }: { itens: readonly { rotulo: string; valor: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-lg border border-line bg-paper p-4 md:flex md:flex-wrap md:items-start">
      {itens.map(({ rotulo, valor }) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-xs font-medium text-ink-soft">{rotulo}</dt>
          <dd className="mt-0.5 text-[13px] font-semibold break-words">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Dois níveis de voltar, no alto das fichas do módulo. */
export function VoltarPara({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <LinkCentral href={href} className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0">
      <span aria-hidden>←</span>
      {rotulo}
    </LinkCentral>
  );
}
