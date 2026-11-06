import type { CSSProperties } from 'react';
import { Circle, Cookie, MapPin, Package, PawPrint, Plane, Scissors, type LucideIcon } from 'lucide-react';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { ID_MARCA_KIPI, ID_MARCA_MIMO, ID_MARCA_NUMA, ID_MARCA_URBANA, ID_MARCA_ZARPA, ID_MARCA_ZUPI } from '@/dados/exemplos/base';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { tintaDaCor } from '@/dominio/cores';
import { ROTULOS_SITUACAO_MARCA } from '@/dominio/marcas';
import { ROTULOS_SITUACAO_PRODUTO } from '@/dominio/produtos';
import { cn } from '@/lib/utils';

/** Os ícones de 18 §3.2. Marca nova usa o ícone genérico. */
const ICONES: Readonly<Record<string, LucideIcon>> = {
  [ID_MARCA_NUMA]: Circle,
  [ID_MARCA_URBANA]: MapPin,
  [ID_MARCA_KIPI]: Cookie,
  [ID_MARCA_ZUPI]: PawPrint,
  [ID_MARCA_ZARPA]: Plane,
  [ID_MARCA_MIMO]: Scissors,
};

/** Chip da marca: o ícone na cor dela, sobre a tinta. Nunca a cor como texto (CA-18.03). */
export function ChipDaMarca({ marca, className }: { marca: Pick<Marca, 'id' | 'cor_hex'>; className?: string }) {
  const Icone = ICONES[marca.id] ?? Package;
  return (
    <span style={{ '--tinta': tintaDaCor(marca.cor_hex), '--ponto': marca.cor_hex } as CSSProperties} className={cn('grid size-9 shrink-0 place-items-center rounded-sm bg-[var(--tinta)] text-[var(--ponto)]', className)}>
      <Icone className="size-[18px]" aria-hidden />
    </span>
  );
}

const TIPOS_MARCA: Record<Marca['situacao'], TipoSituacao> = { ativa: 'sucesso', pausada: 'atencao', encerrada: 'neutro' };
const TIPOS_PRODUTO: Record<Produto['situacao'], TipoSituacao> = { ativo: 'sucesso', pausado: 'atencao', descontinuado: 'neutro' };

export function SituacaoDaMarca({ situacao }: { situacao: Marca['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_MARCA[situacao]}>{ROTULOS_SITUACAO_MARCA[situacao]}</EtiquetaSituacao>;
}

export function SituacaoDoProduto({ situacao }: { situacao: Produto['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_PRODUTO[situacao]}>{ROTULOS_SITUACAO_PRODUTO[situacao]}</EtiquetaSituacao>;
}
