'use client';

import { etiquetasDoModulo } from '@/dominio/etiquetas';
import type { ReactNode } from 'react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { BarraFiltros, PilulaFiltro, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Input } from '@/componentes/ui/input';
import type { Atividade } from '@/dados/tipos/atividade';
import {
  COLUNAS_DO_QUADRO,
  FILTROS_MEU_DIA_INICIAIS,
  MINHAS,
  ROTULOS_ORIGEM_ALERTA,
  ROTULOS_PERIODO,
  ROTULOS_PRIORIDADE_ATIVIDADE,
  ROTULOS_SITUACAO_ATIVIDADE,
  ROTULOS_TIPO_ATIVIDADE,
  type DadosMeuDia,
  type FiltrosComuns,
  type FiltrosMeuDia,
  type PeriodoDoPrazo,
} from '@/dominio/atividades';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
const ORIGENS = [...new Set(Object.values(ROTULOS_ORIGEM_ALERTA))];

type FiltrosProps = {
  filtros: FiltrosMeuDia;
  aoMudar: (parcial: Partial<FiltrosMeuDia>) => void;
  dados: DadosMeuDia;
  nomeDoContexto: (id: string) => string;
};

/** As etiquetas do que o Meu dia e o Histórico filtram do mesmo jeito. */
export function ativosComuns(filtros: FiltrosComuns, dados: DadosMeuDia, nomeDoContexto: (id: string) => string): FiltroAtivo[] {
  const pessoas = pessoasDoSeletor(dados.pessoas);
  return [
    ...(filtros.pessoa && filtros.pessoa !== MINHAS ? [{ id: 'pessoa', rotulo: `Pessoa: ${pessoas.find((pessoa) => pessoa.id === filtros.pessoa)?.nome_completo ?? ''}` }] : []),
    ...(filtros.pessoa && filtros.soResponsavel ? [{ id: 'soResponsavel', rotulo: 'Só responsável' }] : []),
    ...filtros.contextos.map((id) => ({ id: `contexto:${id}`, rotulo: `Contexto: ${nomeDoContexto(id)}` })),
    ...(filtros.area ? [{ id: 'area', rotulo: `Área: ${dados.areas.find((area) => area.id === filtros.area)?.nome ?? ''}` }] : []),
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_ATIVIDADE[filtros.tipo as Atividade['tipo']]}` }] : []),
    ...filtros.prioridades.map((prioridade) => ({ id: `prioridade:${prioridade}`, rotulo: `Prioridade: ${ROTULOS_PRIORIDADE_ATIVIDADE[prioridade as Atividade['prioridade']]}` })),
    ...(filtros.periodo ? [{ id: 'periodo', rotulo: `Prazo: ${ROTULOS_PERIODO[filtros.periodo]}` }] : []),
    ...(filtros.origem ? [{ id: 'origem', rotulo: `Origem: ${ROTULOS_ORIGEM_ALERTA[filtros.origem] ?? filtros.origem}` }] : []),
    ...(filtros.etiqueta ? [{ id: 'etiqueta', rotulo: `Etiqueta: ${dados.etiquetas.find((etiqueta) => etiqueta.id === filtros.etiqueta)?.nome ?? ''}` }] : []),
  ];
}

export function removerComum(id: string, filtros: FiltrosComuns, aoMudar: (parcial: Partial<FiltrosComuns>) => void) {
  if (id.startsWith('contexto:')) return aoMudar({ contextos: filtros.contextos.filter((item) => `contexto:${item}` !== id) });
  if (id.startsWith('prioridade:')) return aoMudar({ prioridades: filtros.prioridades.filter((item) => `prioridade:${item}` !== id) });
  if (id === 'pessoa') return aoMudar({ pessoa: '', soResponsavel: false });
  if (id === 'soResponsavel') return aoMudar({ soResponsavel: false });
  if (id === 'periodo') return aoMudar({ periodo: '', prazoDe: '', prazoAte: '' });
  aoMudar({ [id]: '' });
}

/** Os campos que o Meu dia e o Histórico têm em comum (T03.04). A situação de cada tela entra depois do tipo. */
export function CamposComuns({ filtros, aoMudar, dados, situacao }: { filtros: FiltrosComuns; aoMudar: (parcial: Partial<FiltrosComuns>) => void; dados: DadosMeuDia; situacao?: ReactNode }) {
  const pessoas = pessoasDoSeletor(dados.pessoas);
  const areas = dados.areas.filter((area) => !area.arquivado_em);
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo');
  return (
    <>
      <Campo rotulo="Pessoa" id="filtro-pessoa">
        {(controle) => (
          <Selecao {...controle} value={filtros.pessoa} onChange={(evento) => aoMudar({ pessoa: evento.target.value, ...(evento.target.value ? {} : { soResponsavel: false }) })}>
            <option value="">Todas</option>
            <option value={MINHAS}>Minhas</option>
            {pessoas.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome_completo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      {filtros.pessoa && (
        <Pilulas
          rotulo="Considerar"
          valor={filtros.soResponsavel ? 'responsavel' : 'ambos'}
          aoMudar={(valor) => aoMudar({ soResponsavel: valor === 'responsavel' })}
          opcoes={[
            { valor: 'ambos', rotulo: 'Responsável ou participante' },
            { valor: 'responsavel', rotulo: 'Só responsável' },
          ]}
        />
      )}
      <PilulasMultiplas rotulo="Contexto" valores={filtros.contextos} aoMudar={(contextos) => aoMudar({ contextos })} opcoes={[{ valor: ID_INSTITUCIONAL, rotulo: 'Numa' }, ...produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome }))]} />
      <Campo rotulo="Área" id="filtro-area">
        {(controle) => (
          <Selecao {...controle} value={filtros.area} onChange={(evento) => aoMudar({ area: evento.target.value })}>
            <option value="">Todas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Tipo" id="filtro-tipo">
        {(controle) => (
          <Selecao {...controle} value={filtros.tipo} onChange={(evento) => aoMudar({ tipo: evento.target.value })}>
            <option value="">Todos</option>
            {paraOpcoes(ROTULOS_TIPO_ATIVIDADE).map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      {situacao}
      <PilulasMultiplas rotulo="Prioridade" valores={filtros.prioridades} aoMudar={(prioridades) => aoMudar({ prioridades })} opcoes={paraOpcoes(ROTULOS_PRIORIDADE_ATIVIDADE)} />
      <Campo rotulo="Período do prazo" id="filtro-periodo">
        {(controle) => (
          <Selecao {...controle} value={filtros.periodo} onChange={(evento) => aoMudar({ periodo: evento.target.value as PeriodoDoPrazo, prazoDe: '', prazoAte: '' })}>
            <option value="">Todos</option>
            {paraOpcoes(ROTULOS_PERIODO).map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      {filtros.periodo === 'intervalo' && (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="De" id="filtro-prazo-de">
            {(controle) => <Input type="date" {...controle} value={filtros.prazoDe} onChange={(evento) => aoMudar({ prazoDe: evento.target.value })} />}
          </Campo>
          <Campo rotulo="Até" id="filtro-prazo-ate">
            {(controle) => <Input type="date" {...controle} value={filtros.prazoAte} onChange={(evento) => aoMudar({ prazoAte: evento.target.value })} />}
          </Campo>
        </div>
      )}
      <Campo rotulo="Etiqueta" id="filtro-etiqueta">
        {(controle) => (
          <Selecao {...controle} value={filtros.etiqueta} onChange={(evento) => aoMudar({ etiqueta: evento.target.value })}>
            <option value="">Todas</option>
            {etiquetasDoModulo(dados.etiquetas, 'atividades').map((etiqueta) => (
              <option key={etiqueta.id} value={etiqueta.id}>
                {etiqueta.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Origem do alerta" id="filtro-origem">
        {(controle) => (
          <Selecao {...controle} value={filtros.origem} onChange={(evento) => aoMudar({ origem: evento.target.value })}>
            <option value="">Todas</option>
            {ORIGENS.map((rotulo) => (
              <option key={rotulo} value={Object.entries(ROTULOS_ORIGEM_ALERTA).find(([, valor]) => valor === rotulo)?.[0]}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
    </>
  );
}

/** Barra de filtros de T03.01. Situação "abertas" é o padrão, e a pessoa começa em Todas (RN-03.01). */
export function FiltrosMeuDia({ filtros, aoMudar, dados, nomeDoContexto }: FiltrosProps) {
  const ativos: FiltroAtivo[] = [
    ...ativosComuns(filtros, dados, nomeDoContexto),
    ...(filtros.situacao !== 'abertas' ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_ATIVIDADE[filtros.situacao]}` }] : []),
    ...(filtros.destaque ? [{ id: 'destaque', rotulo: ROTULOS_DESTAQUE[filtros.destaque] }] : []),
  ];

  function remover(id: string) {
    if (id === 'situacao') return aoMudar({ situacao: 'abertas' });
    if (id === 'destaque') return aoMudar({ destaque: '' });
    removerComum(id, filtros, aoMudar);
  }

  return (
    <BarraFiltros
      busca={filtros.busca}
      aoBuscar={(busca) => aoMudar({ busca })}
      rotuloBusca="Buscar por título, código, descrição ou responsável"
      ativos={ativos}
      aoRemoverAtivo={remover}
      aoLimpar={() => aoMudar({ ...FILTROS_MEU_DIA_INICIAIS })}
      filtrosDetalhados={
        <div className="grid gap-4 px-1 pb-2 md:px-3">
          <CamposComuns
            filtros={filtros}
            aoMudar={aoMudar}
            dados={dados}
            situacao={
              <Campo rotulo="Situação" id="filtro-situacao">
                {(controle) => (
                  <Selecao {...controle} value={filtros.situacao} onChange={(evento) => aoMudar({ situacao: evento.target.value as FiltrosMeuDia['situacao'] })}>
                    <option value="abertas">Abertas</option>
                    {COLUNAS_DO_QUADRO.map((coluna) => (
                      <option key={coluna} value={coluna}>
                        {coluna === 'concluida' ? 'Concluída hoje' : ROTULOS_SITUACAO_ATIVIDADE[coluna]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            }
          />
        </div>
      }
    />
  );
}

/** Todas é o padrão (RN-03.01); "Minhas" e cada pessoa são filtros opcionais. */
export function PessoaRapida({ filtros, aoMudar }: Pick<FiltrosProps, 'filtros' | 'aoMudar'>) {
  const ativa = filtros.pessoa === MINHAS ? MINHAS : filtros.pessoa ? '' : 'todas';
  return (
    <div role="group" aria-label="De quem" className="flex items-center gap-1.5">
      {[
        { id: 'todas', rotulo: 'Todas' },
        { id: MINHAS, rotulo: 'Minhas' },
      ].map((filtro) => (
        <PilulaFiltro key={filtro.id} filtro={filtro} ativa={ativa === filtro.id} aoClicar={() => aoMudar({ pessoa: filtro.id === MINHAS ? MINHAS : '', soResponsavel: false })} />
      ))}
    </div>
  );
}

export const ROTULOS_DESTAQUE: Readonly<Record<Exclude<FiltrosMeuDia['destaque'], ''>, string>> = { atrasadas: 'Atrasadas', hoje: 'Para hoje', em_andamento: 'Em andamento', aguardando: 'Aguardando retorno', bloqueadas: 'Bloqueadas', concluidas: 'Concluídas hoje' };
