'use client';

import { Wrench } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import type { Ferramenta } from '@/dados/tipos/ferramenta';
import { useConsulta } from '@/dados/use-consulta';
import { ROTULOS_SITUACAO_FERRAMENTA } from '@/dominio/ferramentas';

/** Na ficha do produto e na da contraparte: o mesmo registro, sem cópia (RN-04.01 e CA-04.01). */
export function AbaFerramentas({ consultar, dependencia, vazio }: { consultar: () => Promise<Ferramenta[]>; dependencia: string; vazio: string }) {
  const consulta = useConsulta(consultar, [dependencia]);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler as ferramentas." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados.length) return <EstadoVazio icone={Wrench} titulo="Nenhuma ferramenta ainda." texto={vazio} />;
  return (
    <ul className="grid gap-2">
      {consulta.dados.map((ferramenta) => (
        <li key={ferramenta.id} className="rounded-lg border border-line bg-paper p-4">
          <LinkCentral href={`/ferramentas/${ferramenta.id}`} className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline md:min-h-0">
            {ferramenta.nome}
          </LinkCentral>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-soft">
            <span className="tabular-nums">{ferramenta.codigo}</span>
            <span>{ROTULOS_SITUACAO_FERRAMENTA[ferramenta.situacao]}</span>
            <span className="min-w-0 break-words">{ferramenta.finalidade}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
