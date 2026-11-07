'use client';

import type { ReactNode } from 'react';
import { Layers, Radio, SlidersHorizontal } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import type { Produto } from '@/dados/tipos/marca';
import type { Oferta, PrecoVersao } from '@/dados/tipos/precificacao';
import { faseDaVersao, NAO_DEFINIDO, ROTULOS_PERIODICIDADE_PRECO, ROTULOS_SITUACAO_OFERTA, ROTULOS_SITUACAO_PRECO } from '@/dominio/precificacao';
import { ROTULOS_ESTAGIO } from '@/dominio/produtos';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const TIPOS_DO_ESTAGIO: Readonly<Record<Produto['estagio'], TipoSituacao>> = { ideia: 'info', validacao: 'info', mvp: 'sucesso', em_uso: 'sucesso', crescimento: 'sucesso', pausado: 'atencao', descontinuado: 'neutro' };

export function EtiquetaEstagio({ produto }: { produto: Pick<Produto, 'estagio' | 'ordem_fila'> }) {
  return (
    <EtiquetaSituacao tipo={TIPOS_DO_ESTAGIO[produto.estagio]}>
      {ROTULOS_ESTAGIO[produto.estagio]}
      {produto.ordem_fila !== null && ` · fila ${produto.ordem_fila}`}
    </EtiquetaSituacao>
  );
}

const TIPOS_DA_OFERTA: Readonly<Record<Oferta['situacao'], TipoSituacao>> = { em_estudo: 'info', aprovada: 'sucesso', inativa: 'neutro' };

export function SituacaoDaOferta({ situacao }: { situacao: Oferta['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_DA_OFERTA[situacao]}>{ROTULOS_SITUACAO_OFERTA[situacao]}</EtiquetaSituacao>;
}

/** A situação gravada e o que ela quer dizer hoje: a substituída ainda vale até o dia anterior ao início da nova. */
export function SituacaoDaVersao({ preco, hoje }: { preco: PrecoVersao; hoje: string }) {
  const fase = faseDaVersao(preco, hoje);
  if (preco.situacao === 'rascunho') return <EtiquetaSituacao tipo="neutro">{ROTULOS_SITUACAO_PRECO.rascunho}</EtiquetaSituacao>;
  if (fase === 'futura') return <EtiquetaSituacao tipo="info">Aprovada · a partir de {formatarDiaISO(preco.valido_de as string)}</EtiquetaSituacao>;
  if (fase === 'vigente') return <EtiquetaSituacao tipo="sucesso">{preco.situacao === 'substituida' ? `Vigente até ${formatarDiaISO(preco.valido_ate as string)}` : 'Aprovada · vigente'}</EtiquetaSituacao>;
  return <EtiquetaSituacao tipo="neutro">{ROTULOS_SITUACAO_PRECO.substituida}</EtiquetaSituacao>;
}

/** Vazio é "Não definido"; zero é R$ 0,00 (RN-07.02). */
export function textoDoPreco(preco: Pick<PrecoVersao, 'valor' | 'moeda'> | null | undefined): string {
  return !preco || preco.valor === null ? NAO_DEFINIDO : formatarDinheiro(preco.valor, preco.moeda);
}

export function textoDoPrecoComPeriodo(preco: Pick<PrecoVersao, 'valor' | 'moeda' | 'periodicidade'> | null | undefined): string {
  if (!preco || preco.valor === null) return NAO_DEFINIDO;
  return `${formatarDinheiro(preco.valor, preco.moeda)} · ${ROTULOS_PERIODICIDADE_PRECO[preco.periodicidade].toLocaleLowerCase('pt-BR')}`;
}

/** Valor calculado, ou o aviso de que falta informação: nunca zero (RN-07.16). */
export function ValorOuFalta({ valor, formato = 'dinheiro', falta = 'Falta dado', className }: { valor: number | null | undefined; formato?: 'dinheiro' | 'percentual'; falta?: string; className?: string }) {
  if (valor === null || valor === undefined) return <span className={cn('text-xs font-medium text-ink-soft', className)}>{falta}</span>;
  return <span className={cn('tabular-nums', className)}>{formato === 'percentual' ? `${(valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : formatarDinheiro(valor, 'BRL')}</span>;
}

/** O que depende de um módulo ainda não construído: nunca aparece como zero, vazio ou concluído. */
export function Indisponivel({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <Faixa tipo="info" className={className}>
      <strong className="font-semibold">{titulo}.</strong> {children}
    </Faixa>
  );
}

/** Seções do módulo. Ofertas, simulações e indicadores ficam dentro de cada produto, com o contexto dele. */
export function AbasProdutos({ ativa }: { ativa: 'portfolio' | 'simulador' | 'canais' }) {
  return (
    <AbasPagina
      rotulo="Seções de produtos"
      className="!mt-0"
      abas={[
        { rotulo: 'Portfólio', icone: Layers, href: '/produtos', ativa: ativa === 'portfolio' },
        { rotulo: 'Simulador', icone: SlidersHorizontal, href: '/produtos/simulador', ativa: ativa === 'simulador' },
        { rotulo: 'Canais de venda', icone: Radio, href: '/produtos/canais', ativa: ativa === 'canais' },
      ]}
    />
  );
}

export function CartaoDaFicha({ titulo, acao, className, children }: { titulo: string; acao?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('min-w-0 rounded-lg border border-line bg-paper p-4 md:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] leading-6">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
