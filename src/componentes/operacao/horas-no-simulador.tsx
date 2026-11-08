'use client';

import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { formatarHoras, mediaApontadaDoProduto } from '@/dominio/horas';
import { hojeISO } from '@/lib/datas';

/**
 * D20: o apontamento (T12.06) alimenta H. Sugere a média apontada, sem trocar o que a pessoa digitou:
 * "Usar" copia o valor para a simulação, como qualquer outra premissa editável.
 */
export function HorasApontadasNoSimulador({ produtoId, aoUsar }: { produtoId: string; aoUsar: (horas: string) => void }) {
  const hoje = hojeISO();
  const consulta = useConsulta(() => mediaApontadaDoProduto(produtoId, hoje), [produtoId, hoje]);
  const media = consulta.dados;
  if (!media) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-hover px-3 py-2 text-[13px] sm:col-span-2" data-horas-apontadas>
      <span className="text-ink-soft">
        {media.media === null ? (
          <>
            Sem horas apontadas neste produto nos 3 meses completos antes deste.
          </>
        ) : (
          <>
            Apontadas: média de <strong className="text-ink tabular-nums">{formatarHoras(media.media)}/mês</strong>, em {media.mesesComHoras} {media.mesesComHoras === 1 ? 'mês com apontamento' : 'meses com apontamento'} de 3.
          </>
        )}
      </span>
      {media.media === null ? (
        <LinkCentral href="/operacao/horas" className="inline-flex min-h-11 items-center font-semibold underline md:min-h-8">
          Apontar horas
        </LinkCentral>
      ) : (
        <Button variante="terciario" tamanho="pequeno" onClick={() => aoUsar(media.media!.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))}>
          Usar a média apontada
        </Button>
      )}
    </div>
  );
}
