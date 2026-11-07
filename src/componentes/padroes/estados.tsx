import type { ReactNode } from 'react';
import { CircleAlert, SearchX, type LucideIcon } from 'lucide-react';
import { MarcaDagua } from '@/componentes/marca/marca-dagua';
import { Button } from '@/componentes/ui/button';
import { Skeleton } from '@/componentes/ui/skeleton';
import { cn } from '@/lib/utils';

type EstadoVazioProps = {
  icone: LucideIcon;
  titulo: string;
  texto: string;
  acao?: ReactNode;
  /** Opcional nas telas principais (18 §9.11). */
  comMarcaDagua?: boolean;
  className?: string;
};

/** Estado vazio (18 §9.11): chip do módulo, título, frase acolhedora e ação. */
export function EstadoVazio({ icone: Icone, titulo, texto, acao, comMarcaDagua = false, className }: EstadoVazioProps) {
  return (
    <div className={cn('relative flex flex-col items-center overflow-hidden rounded-lg border border-line bg-paper px-4 py-12 text-center md:py-16', comMarcaDagua && 'pb-[clamp(96px,16vw,190px)] md:pb-[clamp(96px,16vw,190px)]', className)}>
      <span className="grid size-10 place-items-center rounded-sm bg-indigo-wash text-indigo">
        <Icone className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4">{titulo}</h2>
      <p className="mt-2 max-w-[46ch] text-sm text-ink-soft">{texto}</p>
      {acao && <div className="mt-5 flex flex-wrap justify-center gap-2">{acao}</div>}
      {comMarcaDagua && <MarcaDagua className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[clamp(96px,18vw,220px)]" />}
    </div>
  );
}

/** Vazio por filtro (18 §8): "Nada com esses filtros." + "Limpar filtros". */
export function EstadoVazioFiltro({ titulo = 'Nada com esses filtros.', aoLimpar, className }: { titulo?: string; aoLimpar?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-lg border border-line bg-paper px-4 py-10 text-center', className)}>
      <SearchX className="size-6 text-ink-soft" aria-hidden />
      <p className="mt-3 text-sm font-semibold">{titulo}</p>
      {aoLimpar && (
        <Button variante="terciario" className="mt-2" onClick={aoLimpar}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

/** Erro (18 §8 e §9.11): os dados continuam onde estão; a mensagem diz o que fazer. */
export function EstadoErro({
  titulo = 'Não deu para carregar agora.',
  texto = 'Seus dados continuam aqui; tente de novo.',
  aoTentarDeNovo,
  className,
}: {
  titulo?: string;
  texto?: string;
  aoTentarDeNovo?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-lg border border-line bg-paper px-4 py-12 text-center', className)}>
      <span className="grid size-10 place-items-center rounded-sm bg-err-wash text-err">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4">{titulo}</h2>
      <p className="mt-2 max-w-[46ch] text-sm text-ink-soft">{texto}</p>
      {aoTentarDeNovo && (
        <Button variante="secundario" className="mt-5" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

/** Carregando: esqueleto do layout, nunca tela em branco (P1 e 18 §9.11). */
export function EstadoCarregando({ linhas = 5, className }: { linhas?: number; className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={cn('space-y-3', className)}>
      <Skeleton className="h-10 max-w-[300px]" />
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-[52px]" />
      ))}
    </div>
  );
}
