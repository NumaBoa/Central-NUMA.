'use client';

import { CheckSquare } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import type { Atividade } from '@/dados/tipos/atividade';
import { useConsulta } from '@/dados/use-consulta';
import { estaAberta, ordenarAtividades, ROTULOS_SITUACAO_ATIVIDADE, ROTULOS_TIPO_ATIVIDADE, textoDoPrazo } from '@/dominio/atividades';
import { CAMINHO_DA_ATIVIDADE } from '@/dominio/atividades-painel';
import { hojeISO } from '@/lib/datas';
import { cn } from '@/lib/utils';

const TIPOS: Readonly<Record<Atividade['situacao'], TipoSituacao>> = { a_fazer: 'neutro', em_andamento: 'info', aguardando: 'atencao', concluida: 'sucesso', cancelada: 'neutro' };

/** RN-03.20: a atividade aparece na ficha do registro. É o mesmo registro, sem cópia: abre no Meu dia. */
export function AbaAtividades({ consultar, dependencia, vazio }: { consultar: () => Promise<Atividade[]>; dependencia: string; vazio: string }) {
  const consulta = useConsulta(consultar, [dependencia]);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler as atividades." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados.length) return <EstadoVazio icone={CheckSquare} titulo="Nenhuma atividade ainda." texto={vazio} />;

  const hoje = hojeISO();
  const abertas = ordenarAtividades(consulta.dados.filter(estaAberta), hoje);
  const encerradas = consulta.dados.filter((atividade) => !estaAberta(atividade));
  return (
    <ul className="grid gap-2">
      {[...abertas, ...encerradas].map((atividade) => {
        const prazo = textoDoPrazo(atividade, hoje);
        return (
          <li key={atividade.id} className="rounded-lg border border-line bg-paper p-4">
            <LinkCentral href={CAMINHO_DA_ATIVIDADE(atividade.id)} className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline md:min-h-0">
              {atividade.titulo}
            </LinkCentral>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
              <span>{ROTULOS_TIPO_ATIVIDADE[atividade.tipo]}</span>
              <span className="tabular-nums">{atividade.codigo}</span>
              <span className={cn(prazo.atrasada && 'font-semibold text-err')}>{prazo.texto}</span>
              <EtiquetaSituacao tipo={TIPOS[atividade.situacao]}>{ROTULOS_SITUACAO_ATIVIDADE[atividade.situacao]}</EtiquetaSituacao>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
