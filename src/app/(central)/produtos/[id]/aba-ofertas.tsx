'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Tag } from 'lucide-react';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { SituacaoDaOferta, textoDoPrecoComPeriodo } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import type { CanalVenda } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import { NAO_DEFINIDO, ofertasDoProduto, ROTULOS_PUBLICO_OFERTA, ROTULOS_TIPO_OFERTA, TODOS_OS_CANAIS, type LinhaDaOferta } from '@/dominio/precificacao';

function PrecosVigentes({ oferta, canais }: { oferta: LinhaDaOferta; canais: readonly CanalVenda[] }) {
  if (!oferta.vigentes.length) return <span className="text-ink-soft">{NAO_DEFINIDO}</span>;
  return (
    <span className="grid gap-0.5">
      {oferta.vigentes.map((preco) => (
        <span key={preco.id} className="tabular-nums">
          {canais.find((canal) => canal.id === preco.canal_id)?.nome ?? TODOS_OS_CANAIS}: {textoDoPrecoComPeriodo(preco)}
        </span>
      ))}
    </span>
  );
}

/** T07.04, lista por produto. Oferta sem preço aprovado mostra "Não definido", nunca zero. */
export function AbaOfertas({ produtoId, aoNova, hoje }: { produtoId: string; aoNova: () => void; hoje: string }) {
  const roteador = useRouter();
  const consulta = useConsulta(() => ofertasDoProduto(produtoId, hoje), [produtoId, hoje]);
  const canais = consulta.dados?.canais;
  const colunas = useMemo<readonly Coluna<LinhaDaOferta>[]>(
    () => [
      {
        id: 'nome',
        titulo: 'Oferta',
        essencial: true,
        ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
        celula: (oferta) => (
          <span className="grid">
            <span className="font-medium">{oferta.nome}</span>
            <span className="text-xs text-ink-soft tabular-nums">{oferta.codigo}</span>
          </span>
        ),
      },
      { id: 'tipo', titulo: 'Tipo', celula: (oferta) => ROTULOS_TIPO_OFERTA[oferta.tipo] },
      { id: 'publico', titulo: 'Público', celula: (oferta) => ROTULOS_PUBLICO_OFERTA[oferta.publico] },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (oferta) => <SituacaoDaOferta situacao={oferta.situacaoEfetiva} /> },
      { id: 'preco', titulo: 'Preço vigente por canal', essencial: true, celula: (oferta) => <PrecosVigentes oferta={oferta} canais={canais ?? []} /> },
      { id: 'recursos', titulo: 'Recursos', numerica: true, celula: (oferta) => oferta.quantosRecursos },
    ],
    [canais],
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler as ofertas." aoTentarDeNovo={consulta.recarregar} />;
  const { ofertas } = consulta.dados;

  return (
    <div className="space-y-3">
      {ofertas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{ofertas.length === 1 ? '1 oferta' : `${ofertas.length} ofertas`}</p>
          <Button onClick={aoNova}>
            <Plus aria-hidden />
            Nova oferta
          </Button>
        </div>
      )}
      <Lista
        rotulo="Ofertas do produto"
        linhas={ofertas}
        colunas={colunas}
        chave={(oferta) => oferta.id}
        aoAbrir={(oferta) => roteador.push(`/produtos/${produtoId}/ofertas/${oferta.id}`)}
        vazio={<EstadoVazio icone={Tag} titulo="Nenhuma oferta ainda." texto="Oferta é o que se vende: plano, serviço, implantação ou gratuidade. Ela nasce Em estudo e sem preço." acao={<Button onClick={aoNova}>Nova oferta</Button>} />}
        cartao={(oferta) => (
          <span className="grid gap-1.5">
            <span className="font-semibold">{oferta.nome}</span>
            <span className="text-[13px] text-ink-soft">
              {ROTULOS_TIPO_OFERTA[oferta.tipo]} · {ROTULOS_PUBLICO_OFERTA[oferta.publico]} · {oferta.quantosRecursos === 1 ? '1 recurso' : `${oferta.quantosRecursos} recursos`}
            </span>
            <span>
              <SituacaoDaOferta situacao={oferta.situacaoEfetiva} />
            </span>
            <span className="text-[13px]">
              <PrecosVigentes oferta={oferta} canais={canais ?? []} />
            </span>
          </span>
        )}
      />
    </div>
  );
}
