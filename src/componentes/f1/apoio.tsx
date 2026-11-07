'use client';

import { useId, type ReactNode } from 'react';
import { ArrowRight, CircleAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import type { ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Faixa } from '@/componentes/padroes/faixa';
import type { SeletorEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { catalogoComercial } from '@/dominio/integracoes/conexoes';
import { cn } from '@/lib/utils';

/** Roda uma ação da tela: a mensagem de sucesso, ou a da regra que barrou. */
export async function executar(acao: () => Promise<unknown>, mensagem?: string): Promise<boolean> {
  try {
    await acao();
    if (mensagem) aviso(mensagem);
    return true;
  } catch (erro) {
    aviso(mensagemDoErro(erro));
    return false;
  }
}

/** O resumo de erros da janela (P3), a partir dos erros do formulário. */
export function errosDoFormulario<T extends FieldValues>(errors: FieldErrors<T>, ids: Readonly<Partial<Record<keyof T, string>>>): ErroDeCampo[] {
  return (Object.entries(ids) as [keyof T, string][]).flatMap(([campo, campoId]) => {
    const erro = errors[campo] as { message?: string; root?: { message?: string } } | undefined;
    const mensagem = erro?.message ?? erro?.root?.message;
    return mensagem ? [{ campoId, mensagem }] : [];
  });
}

export type Pendencia = { id: string; mensagem: string; bloqueia?: string; href?: string; aoClicar?: () => void; tipo: 'bloqueia' | 'aviso' };

/** Pendências navegáveis (T10.05 e T11.04): dizem o que falta e levam até onde corrigir. */
export function ListaDePendencias({ pendencias, vazio = 'Nenhuma pendência.', rotulo = 'Pendências' }: { pendencias: readonly Pendencia[]; vazio?: string; rotulo?: string }) {
  if (!pendencias.length) return <Faixa tipo="sucesso">{vazio}</Faixa>;
  return (
    <ul aria-label={rotulo} className="grid gap-2">
      {pendencias.map((pendencia) => {
        const Icone = pendencia.tipo === 'bloqueia' ? CircleAlert : TriangleAlert;
        const corpo = (
          <>
            <Icone className={cn('mt-0.5 size-4 shrink-0', pendencia.tipo === 'bloqueia' ? 'text-err' : 'text-warn')} aria-hidden />
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="block">{pendencia.mensagem}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{pendencia.tipo === 'bloqueia' ? `Bloqueia: ${pendencia.bloqueia ?? 'emissão final'}` : 'Aviso: não bloqueia'}</span>
            </span>
            {(pendencia.href || pendencia.aoClicar) && <ArrowRight className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />}
          </>
        );
        const classe = 'flex w-full min-h-11 items-start gap-2.5 rounded-md border border-line bg-paper px-3.5 py-2.5 text-left';
        return (
          <li key={pendencia.id}>
            {pendencia.href ? (
              <LinkCentral href={pendencia.href} className={cn(classe, 'hover:border-ink-soft')}>
                {corpo}
              </LinkCentral>
            ) : pendencia.aoClicar ? (
              <button type="button" onClick={pendencia.aoClicar} className={cn(classe, 'hover:border-ink-soft')}>
                {corpo}
              </button>
            ) : (
              <div className={classe}>{corpo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Enquanto o catálogo for o de exemplo, nada pode parecer dado real (só em desenvolvimento). */
export function AvisoCatalogoDeExemplo({ className }: { className?: string }) {
  if (catalogoComercial().estado !== 'exemplo') return null;
  return (
    <Faixa tipo="atencao" className={className}>
      Catálogo de EXEMPLO, só para desenvolvimento: ofertas, preços e configuração contratual abaixo não são dados reais do M07.
    </Faixa>
  );
}

/** Um filtro de opções para `FiltrosEmLinha`: pílula na linha e, sem espaço, dentro de "Filtros". */
export function seletorDeOpcoes<F extends Record<string, unknown>>({ id, rotulo, icone, campo, opcoes, todos = 'Todos', largura = 150 }: { id: string; rotulo: string; icone: LucideIcon; campo: keyof F & string; opcoes: readonly { valor: string; rotulo: string }[]; todos?: string; largura?: number }): SeletorEmLinha<F> {
  return {
    id,
    rotulo,
    icone,
    largura,
    valor: (filtros) => opcoes.find((opcao) => opcao.valor === filtros[campo])?.rotulo ?? `${rotulo}: ${todos}`,
    ativo: (filtros) => Boolean(filtros[campo]),
    campos: (filtros, mudar, fechar) => (
      <fieldset>
        <legend className="mb-[7px] texto-rotulo">{rotulo}</legend>
        <div className="flex flex-wrap gap-1.5">
          {[{ valor: '', rotulo: todos }, ...opcoes].map((opcao) => {
            const marcada = (filtros[campo] ?? '') === opcao.valor;
            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={marcada}
                onClick={() => {
                  mudar({ [campo]: opcao.valor } as Partial<F>);
                  fechar();
                }}
                className={cn('inline-flex min-h-11 items-center rounded-pill border px-3.5 text-[13px] font-semibold md:min-h-9', marcada ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper text-ink hover:border-ink-soft')}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      </fieldset>
    ),
  };
}

export const paraOpcoes = (rotulos: Readonly<Record<string, string>>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));

/** Etapas laterais (T10.05, T11.03 e T11.14): navegação livre, cada uma com o indicador de pendências. */
export function EtapasLaterais<E extends string>({ etapas, ativa, aoEscolher, pendencias, rotulo }: { etapas: readonly { id: E; rotulo: string }[]; ativa: E; aoEscolher: (etapa: E) => void; pendencias?: Partial<Record<E, number>>; rotulo: string }) {
  return (
    <nav aria-label={rotulo} className="faixa-rolagem flex gap-1.5 lg:grid lg:content-start lg:gap-1">
      {etapas.map((etapa, indice) => {
        const marcada = etapa.id === ativa;
        const quantas = pendencias?.[etapa.id] ?? 0;
        return (
          <button key={etapa.id} type="button" aria-current={marcada ? 'step' : undefined} onClick={() => aoEscolher(etapa.id)} className={cn('flex min-h-11 shrink-0 items-center gap-2.5 rounded-pill px-3 text-left text-[13px] font-medium lg:w-full lg:rounded-md', marcada ? 'bg-active font-semibold' : 'text-ink-soft hover:bg-hover')}>
            <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums', marcada ? 'border-indigo-dk bg-indigo-dk text-white' : 'border-line bg-paper')}>
              {indice + 1}
            </span>
            <span className="min-w-0">{etapa.rotulo}</span>
            {quantas > 0 && (
              <span className="ml-auto rounded-pill bg-warn-wash px-1.5 text-xs leading-[18px] font-semibold text-warn tabular-nums">
                {quantas}
                <span className="sr-only"> {quantas === 1 ? 'pendência' : 'pendências'}</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** Marcador de múltipla escolha, com caixa de verdade: teclado e leitor de tela funcionam. */
export function CaixasDeSelecao({ rotulo, obrigatorio = false, opcoes, valores, aoMudar, id, erro }: { rotulo: string; obrigatorio?: boolean; opcoes: readonly { valor: string; rotulo: string }[]; valores: readonly string[]; aoMudar: (novos: string[]) => void; id?: string; erro?: string }) {
  const gerado = useId();
  return (
    <fieldset id={id ?? gerado} tabIndex={-1}>
      <legend className="mb-[7px] texto-rotulo">
        {rotulo}
        {obrigatorio && ' *'}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border border-line bg-paper px-3 text-[13px] font-medium has-checked:border-espresso has-checked:bg-espresso has-checked:text-linen has-focus-visible:outline-[3px] has-focus-visible:outline-offset-[3px] has-focus-visible:outline-indigo md:min-h-9">
            <input type="checkbox" className="sr-only" checked={valores.includes(opcao.valor)} onChange={(evento) => aoMudar(evento.target.checked ? [...valores, opcao.valor] : valores.filter((valor) => valor !== opcao.valor))} />
            {opcao.rotulo}
          </label>
        ))}
      </div>
      {erro && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-err">
          <CircleAlert className="size-[13px] shrink-0" aria-hidden />
          {erro}
        </p>
      )}
    </fieldset>
  );
}

export function CartaoDePainel({ titulo, children, className, acao }: { titulo?: string; children: ReactNode; className?: string; acao?: ReactNode }) {
  return (
    <section className={cn('rounded-lg border border-line bg-paper p-4 md:p-5', className)}>
      {(titulo || acao) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-[17px] leading-6">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function BotaoLink({ href, children, variante = 'secundario' }: { href: string; children: ReactNode; variante?: 'primario' | 'secundario' | 'terciario' }) {
  return (
    <Button asChild variante={variante}>
      <LinkCentral href={href}>{children}</LinkCentral>
    </Button>
  );
}
