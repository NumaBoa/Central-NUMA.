'use client';

import { useRouter } from 'next/navigation';
import { ArrowRightLeft, ChevronDown, Layers } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { PilulaFiltro, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha, type SeletorEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import { ABAS_DE_ATIVO, FILTROS_ATIVOS_INICIAIS, ROTULOS_TIPO_ATIVO, ROTULOS_TRANSFERENCIA, type DadosDosAtivos, type FiltrosAtivos, type IdDaAbaDeAtivo } from '@/dominio/ativos';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { cn } from '@/lib/utils';

type Mudar = (parcial: Partial<FiltrosAtivos>) => void;

/** Os grupos à vista; os demais ficam em "Outros tipos", para a faixa não crescer. */
const GRUPOS_A_VISTA: readonly IdDaAbaDeAtivo[] = ['todos', 'dominios', 'lojas', 'repositorios'];

/** T04.04: grupos de tipo, e não um filtro de tipo repetido. "Marcas" leva a Empresa › Marcas (T06.05). */
export function GruposDeAtivos({ aba, contadores, aoEscolher }: { aba: IdDaAbaDeAtivo; contadores: Record<IdDaAbaDeAtivo, number> | null; aoEscolher: (aba: IdDaAbaDeAtivo) => void }) {
  const roteador = useRouter();
  const outros = ABAS_DE_ATIVO.filter((item) => !GRUPOS_A_VISTA.includes(item.id));
  const outroEscolhido = outros.find((item) => item.id === aba);
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipos de ativo">
      {ABAS_DE_ATIVO.filter((item) => GRUPOS_A_VISTA.includes(item.id)).map((item) => (
        <PilulaFiltro key={item.id} filtro={{ id: item.id, rotulo: item.rotulo, contador: contadores?.[item.id] || undefined }} ativa={aba === item.id} aoClicar={() => aoEscolher(item.id)} />
      ))}
      <MenuSobreposto
        titulo="Outros tipos"
        largura={240}
        gatilho={
          <button
            type="button"
            aria-label={outroEscolhido ? `Outros tipos: ${outroEscolhido.rotulo}` : 'Outros tipos'}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 md:min-h-9 [&_svg]:size-[15px]',
              outroEscolhido ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper text-ink hover:border-ink-soft',
            )}
          >
            {outroEscolhido ? outroEscolhido.rotulo : 'Outros tipos'}
            <ChevronDown aria-hidden />
          </button>
        }
      >
        {(fechar) => (
          <ul className="grid gap-0.5">
            {outros.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={aba === item.id}
                  className={cn(CLASSE_LINHA_MENU, 'justify-between hover:bg-hover md:min-h-9 md:py-1.5', aba === item.id && 'font-semibold')}
                  onClick={() => {
                    fechar();
                    aoEscolher(item.id);
                  }}
                >
                  {item.rotulo}
                  <span className="text-xs text-ink-soft tabular-nums">{contadores?.[item.id] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </MenuSobreposto>
      <PilulaFiltro filtro={{ id: 'marcas', rotulo: 'Marcas' }} ativa={false} aoClicar={() => roteador.push('/empresa/marcas')} />
    </div>
  );
}

export function quantosMaisFiltrosDeAtivos(filtros: FiltrosAtivos): number {
  return (filtros.titularDiferente ? 1 : 0) + (filtros.venceEm ? 1 : 0) + (filtros.arquivados ? 1 : 0) + (filtros.tipo ? 1 : 0);
}

function Marcar({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: (marcado: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:min-h-9">
      <input type="checkbox" className="size-[18px] shrink-0 accent-[var(--ok)]" checked={marcado} onChange={(evento) => aoMudar(evento.target.checked)} />
      {rotulo}
    </label>
  );
}

/** Busca → produto → transferência → Mais filtros. Afeta só a lista logo abaixo. */
export function BarraDeAtivos({ filtros, aoMudar, dados }: { filtros: FiltrosAtivos; aoMudar: Mudar; dados: DadosDosAtivos }) {
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em);
  const nomeDoContexto = (id: string) => (id === ID_INSTITUCIONAL ? 'Numa' : (dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));
  const arquivados = dados.ativos.filter((ativo) => ativo.arquivado_em).length;

  const seletores: SeletorEmLinha<FiltrosAtivos>[] = [
    {
      id: 'contexto',
      rotulo: 'Produto',
      icone: Layers,
      largura: 168,
      valor: ({ contexto }) => (contexto ? nomeDoContexto(contexto) : 'Todos os produtos'),
      ativo: ({ contexto }) => Boolean(contexto),
      campos: ({ contexto }, mudar, fechar) => (
        <Pilulas
          rotulo="Produto"
          valor={contexto}
          aoMudar={(valor) => {
            mudar({ contexto: valor });
            fechar();
          }}
          opcoes={[{ valor: '', rotulo: 'Todos' }, { valor: ID_INSTITUCIONAL, rotulo: 'Numa' }, ...produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome }))]}
        />
      ),
    },
    {
      id: 'situacao',
      rotulo: 'Transferência',
      icone: ArrowRightLeft,
      largura: 200,
      valor: ({ situacao }) => (situacao ? ROTULOS_TRANSFERENCIA[situacao as AtivoDigital['transferencia_situacao']] : 'Toda transferência'),
      ativo: ({ situacao }) => Boolean(situacao),
      campos: ({ situacao }, mudar, fechar) => (
        <Pilulas
          rotulo="Situação da transferência"
          valor={situacao}
          aoMudar={(valor) => {
            mudar({ situacao: valor });
            fechar();
          }}
          opcoes={[{ valor: '', rotulo: 'Todas' }, ...Object.entries(ROTULOS_TRANSFERENCIA).map(([valor, rotulo]) => ({ valor, rotulo }))]}
        />
      ),
    },
  ];

  const ativos: FiltroAtivo[] = [
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_ATIVO[filtros.tipo as AtivoDigital['tipo']]}` }] : []),
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Produto: ${nomeDoContexto(filtros.contexto)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Transferência: ${ROTULOS_TRANSFERENCIA[filtros.situacao as AtivoDigital['transferencia_situacao']]}` }] : []),
    ...(filtros.titularDiferente ? [{ id: 'titularDiferente', rotulo: 'Titular diferente do desejado' }] : []),
    ...(filtros.venceEm ? [{ id: 'venceEm', rotulo: `Vence em até ${filtros.venceEm} dias` }] : []),
    ...(filtros.arquivados ? [{ id: 'arquivados', rotulo: 'Arquivados' }] : []),
  ];

  return (
    <FiltrosEmLinha
      filtros={filtros}
      aoMudar={aoMudar}
      aoLimpar={() => aoMudar({ ...FILTROS_ATIVOS_INICIAIS, aba: filtros.aba })}
      rotuloBusca="Buscar por identificador, código ou plataforma"
      rotuloAvancados="Mais filtros"
      larguraAvancados={420}
      seletores={seletores}
      avancados={(valor, mudar) => (
        <div className="grid gap-3.5">
          <Marcar rotulo="Titular atual diferente do desejado" marcado={valor.titularDiferente} aoMudar={(marcado) => mudar({ titularDiferente: marcado })} />
          <Campo rotulo="Vence em" id="filtro-vence">
            {(controle) => (
              <Selecao {...controle} value={valor.venceEm} onChange={(evento) => mudar({ venceEm: evento.target.value as FiltrosAtivos['venceEm'] })}>
                <option value="">Qualquer data</option>
                {['30', '45', '60', '90'].map((dias) => (
                  <option key={dias} value={dias}>
                    Até {dias} dias
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          {arquivados > 0 && <Marcar rotulo={`Ver os arquivados (${arquivados})`} marcado={valor.arquivados} aoMudar={(marcado) => mudar({ arquivados: marcado })} />}
        </div>
      )}
      quantosAvancados={quantosMaisFiltrosDeAtivos}
      ativos={ativos}
      aoRemoverAtivo={(id) => aoMudar(id === 'titularDiferente' || id === 'arquivados' ? { [id]: false } : { [id]: '' })}
    />
  );
}
