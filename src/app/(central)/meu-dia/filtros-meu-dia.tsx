'use client';

import type { ReactNode } from 'react';
import { CalendarRange, Rows3, UserRound, type LucideIcon } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha, type SeletorEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Input } from '@/componentes/ui/input';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Pessoa } from '@/dados/tipos/pessoa';
import {
  FILTROS_MEU_DIA_INICIAIS,
  MINHAS,
  ROTULOS_AGRUPAR,
  ROTULOS_ORIGEM_ALERTA,
  ROTULOS_PERIODO,
  ROTULOS_PRIORIDADE_ATIVIDADE,
  ROTULOS_TIPO_ATIVIDADE,
  type AgruparPor,
  type CartaoDoResumo,
  type DadosMeuDia,
  type FiltrosComuns,
  type FiltrosMeuDia,
} from '@/dominio/atividades';
import { etiquetasDoModulo } from '@/dominio/etiquetas';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { formatarDiaISO } from '@/lib/formatacao';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
const ORIGENS = [...new Set(Object.values(ROTULOS_ORIGEM_ALERTA))];

export const ROTULOS_CARTAO: Readonly<Record<CartaoDoResumo, string>> = { atrasadas: 'Atrasadas', hoje: 'Para hoje', em_andamento: 'Em andamento', aguardando: 'Aguardando retorno', bloqueadas: 'Bloqueadas', concluidas: 'Concluídas hoje' };

type PessoaDoFiltro = Pick<Pessoa, 'id' | 'nome_completo'>;

const nomeNoFiltro = (pessoa: string, pessoas: readonly PessoaDoFiltro[]) => (pessoa === MINHAS ? 'Minhas' : (pessoas.find((item) => item.id === pessoa)?.nome_completo ?? 'Pessoa removida'));

/** Pessoa: um seletor só, com Todas, Minhas e os nomes. Responsável × participante vem junto, para não virar outro filtro. */
export function seletorDePessoa<F extends { pessoa: string; soResponsavel: boolean }>(pessoas: readonly PessoaDoFiltro[]): SeletorEmLinha<F> {
  return {
    id: 'pessoa',
    rotulo: 'Pessoa',
    icone: UserRound,
    largura: 164,
    valor: ({ pessoa }) => (pessoa ? nomeNoFiltro(pessoa, pessoas) : 'Todas'),
    ativo: ({ pessoa }) => Boolean(pessoa),
    campos: (filtros, mudar) => (
      <>
        <Pilulas
          rotulo="Pessoa"
          valor={filtros.pessoa}
          aoMudar={(pessoa) => mudar({ pessoa, ...(pessoa ? {} : { soResponsavel: false }) } as Partial<F>)}
          opcoes={[{ valor: '', rotulo: 'Todas' }, { valor: MINHAS, rotulo: 'Minhas' }, ...pessoas.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))]}
        />
        {filtros.pessoa && (
          <Pilulas
            rotulo="Considerar"
            valor={filtros.soResponsavel ? 'responsavel' : 'ambos'}
            aoMudar={(valor) => mudar({ soResponsavel: valor === 'responsavel' } as Partial<F>)}
            opcoes={[
              { valor: 'ambos', rotulo: 'Responsável ou participante' },
              { valor: 'responsavel', rotulo: 'Só responsável' },
            ]}
          />
        )}
      </>
    ),
  };
}

type PeriodoDoFiltro = { periodo: string; de: string; ate: string };

/** Período: as opções da tela, e o intervalo abre duas datas. */
export function seletorDePeriodo<F>({ id, rotulo, icone = CalendarRange, largura = 168, rotulos, ler, gravar }: { id: string; rotulo: string; icone?: LucideIcon; largura?: number; rotulos: Readonly<Record<string, string>>; ler: (filtros: F) => PeriodoDoFiltro; gravar: (periodo: PeriodoDoFiltro) => Partial<F> }): SeletorEmLinha<F> {
  return {
    id,
    rotulo,
    icone,
    largura,
    valor: (filtros) => rotulos[ler(filtros).periodo] ?? rotulo,
    ativo: (filtros) => Boolean(ler(filtros).periodo),
    campos: (filtros, mudar, fechar) => {
      const atual = ler(filtros);
      return (
        <>
          <Pilulas
            rotulo={rotulo}
            valor={atual.periodo}
            aoMudar={(periodo) => {
              mudar(gravar({ periodo, de: '', ate: '' }));
              if (periodo !== 'intervalo') fechar();
            }}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...paraOpcoes(rotulos)]}
          />
          {atual.periodo === 'intervalo' && (
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="De" id={`${id}-de`}>
                {(controle) => <Input type="date" {...controle} value={atual.de} onChange={(evento) => mudar(gravar({ ...atual, de: evento.target.value }))} />}
              </Campo>
              <Campo rotulo="Até" id={`${id}-ate`}>
                {(controle) => <Input type="date" {...controle} value={atual.ate} onChange={(evento) => mudar(gravar({ ...atual, ate: evento.target.value }))} />}
              </Campo>
            </div>
          )}
        </>
      );
    },
  };
}

/** Os dias do intervalo, ou o nome do período, para a etiqueta do filtro. */
export function textoDoPeriodo({ periodo, de, ate }: PeriodoDoFiltro, rotulos: Readonly<Record<string, string>>): string {
  if (periodo !== 'intervalo' || (!de && !ate)) return rotulos[periodo] ?? '';
  if (de && ate) return `${formatarDiaISO(de)} a ${formatarDiaISO(ate)}`;
  return de ? `desde ${formatarDiaISO(de)}` : `até ${formatarDiaISO(ate)}`;
}

export const quantosComuns = (filtros: FiltrosComuns) => [filtros.area, filtros.tipo, filtros.origem, filtros.etiqueta].filter(Boolean).length + filtros.prioridades.length;

/** As etiquetas do que o Meu dia e o Histórico filtram do mesmo jeito. */
export function ativosComuns(filtros: FiltrosComuns, dados: DadosMeuDia): FiltroAtivo[] {
  const pessoas = pessoasDoSeletor(dados.pessoas);
  return [
    ...(filtros.pessoa ? [{ id: 'pessoa', rotulo: `Pessoa: ${nomeNoFiltro(filtros.pessoa, pessoas)}${filtros.soResponsavel ? ' (só responsável)' : ''}` }] : []),
    ...(filtros.area ? [{ id: 'area', rotulo: `Área: ${dados.areas.find((area) => area.id === filtros.area)?.nome ?? ''}` }] : []),
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_ATIVIDADE[filtros.tipo as Atividade['tipo']]}` }] : []),
    ...filtros.prioridades.map((prioridade) => ({ id: `prioridade:${prioridade}`, rotulo: `Prioridade: ${ROTULOS_PRIORIDADE_ATIVIDADE[prioridade as Atividade['prioridade']]}` })),
    ...(filtros.origem ? [{ id: 'origem', rotulo: `Origem: ${ROTULOS_ORIGEM_ALERTA[filtros.origem] ?? filtros.origem}` }] : []),
    ...(filtros.etiqueta ? [{ id: 'etiqueta', rotulo: `Etiqueta: ${dados.etiquetas.find((etiqueta) => etiqueta.id === filtros.etiqueta)?.nome ?? ''}` }] : []),
  ];
}

export function removerComum(id: string, filtros: FiltrosComuns, aoMudar: (parcial: Partial<FiltrosComuns>) => void) {
  if (id.startsWith('prioridade:')) return aoMudar({ prioridades: filtros.prioridades.filter((item) => `prioridade:${item}` !== id) });
  if (id === 'pessoa') return aoMudar({ pessoa: '', soResponsavel: false });
  aoMudar({ [id]: '' });
}

/** Filtros avançados: área, tipo, prioridade, origem e etiqueta. O que vier a mais em cada tela entra em `extra`. */
export function CamposAvancados({ filtros, aoMudar, dados, extra }: { filtros: FiltrosComuns; aoMudar: (parcial: Partial<FiltrosComuns>) => void; dados: DadosMeuDia; extra?: ReactNode }) {
  const areas = dados.areas.filter((area) => !area.arquivado_em);
  return (
    <>
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
      <PilulasMultiplas rotulo="Prioridade" valores={filtros.prioridades} aoMudar={(prioridades) => aoMudar({ prioridades })} opcoes={paraOpcoes(ROTULOS_PRIORIDADE_ATIVIDADE)} />
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
      {extra}
    </>
  );
}

type EstadoDaBarra = FiltrosMeuDia & { visao: 'quadro' | 'lista'; agruparPor: AgruparPor };

const SELETOR_DE_PERIODO = seletorDePeriodo<EstadoDaBarra>({
  id: 'filtro-periodo',
  rotulo: 'Período',
  rotulos: ROTULOS_PERIODO,
  ler: ({ periodo, prazoDe, prazoAte }) => ({ periodo, de: prazoDe, ate: prazoAte }),
  gravar: ({ periodo, de, ate }) => ({ periodo: periodo as FiltrosMeuDia['periodo'], prazoDe: de, prazoAte: ate }),
});

/** "Agrupar por" só existe na lista. */
const SELETOR_DE_AGRUPAR: SeletorEmLinha<EstadoDaBarra> = {
  id: 'agrupar',
  rotulo: 'Agrupar por',
  icone: Rows3,
  largura: 164,
  visivel: ({ visao }) => visao === 'lista',
  valor: ({ agruparPor }) => (agruparPor === 'nenhum' ? 'Agrupar por' : ROTULOS_AGRUPAR[agruparPor]),
  ativo: () => false,
  campos: ({ agruparPor }, mudar, fechar) => (
    <Pilulas
      rotulo="Agrupar por"
      valor={agruparPor}
      aoMudar={(valor) => {
        mudar({ agruparPor: valor as AgruparPor });
        fechar();
      }}
      opcoes={paraOpcoes(ROTULOS_AGRUPAR)}
    />
  ),
};

type BarraDoMeuDiaProps = {
  filtros: FiltrosMeuDia;
  aoMudar: (parcial: Partial<FiltrosMeuDia>) => void;
  visao: 'quadro' | 'lista';
  aoMudarVisao: (visao: 'quadro' | 'lista') => void;
  agruparPor: AgruparPor;
  aoMudarAgrupar: (agruparPor: AgruparPor) => void;
  dados: DadosMeuDia;
  /** Quadro | Lista, à direita da linha. */
  alternancia: ReactNode;
};

/** T03.01: busca → pessoa → período → Filtros → Quadro | Lista. A situação e o bloqueio vêm dos cartões do resumo. */
export function BarraDoMeuDia({ filtros, aoMudar, visao, aoMudarVisao, agruparPor, aoMudarAgrupar, dados, alternancia }: BarraDoMeuDiaProps) {
  const estado: EstadoDaBarra = { ...filtros, visao, agruparPor };
  const pessoas = pessoasDoSeletor(dados.pessoas);

  function mudar({ visao: novaVisao, agruparPor: novoAgrupar, ...resto }: Partial<EstadoDaBarra>) {
    if (novaVisao) aoMudarVisao(novaVisao);
    if (novoAgrupar) aoMudarAgrupar(novoAgrupar);
    if (Object.keys(resto).length) aoMudar(resto);
  }

  const periodo = textoDoPeriodo({ periodo: filtros.periodo, de: filtros.prazoDe, ate: filtros.prazoAte }, ROTULOS_PERIODO);
  const ativos: FiltroAtivo[] = [
    ...(filtros.destaque ? [{ id: 'destaque', rotulo: ROTULOS_CARTAO[filtros.destaque] }] : []),
    ...(filtros.periodo ? [{ id: 'periodo', rotulo: `Período: ${periodo}` }] : []),
    ...ativosComuns(filtros, dados),
  ];

  function remover(id: string) {
    if (id === 'destaque') return aoMudar({ destaque: '' });
    if (id === 'periodo') return aoMudar({ periodo: '', prazoDe: '', prazoAte: '' });
    removerComum(id, filtros, aoMudar);
  }

  return (
    <FiltrosEmLinha
      filtros={estado}
      aoMudar={mudar}
      aoLimpar={() => aoMudar({ ...FILTROS_MEU_DIA_INICIAIS })}
      rotuloBusca="Buscar por título, código, descrição ou responsável"
      seletores={[seletorDePessoa<EstadoDaBarra>(pessoas), SELETOR_DE_PERIODO, SELETOR_DE_AGRUPAR]}
      avancados={(valor, mudarValor) => <CamposAvancados filtros={valor} aoMudar={mudarValor} dados={dados} />}
      quantosAvancados={quantosComuns}
      direita={alternancia}
      larguraDireita={156}
      soNaFolha={(valor, mudarValor) => (
        <Pilulas
          rotulo="Visão"
          valor={valor.visao}
          aoMudar={(novo) => mudarValor({ visao: novo as EstadoDaBarra['visao'] })}
          opcoes={[
            { valor: 'quadro', rotulo: 'Quadro' },
            { valor: 'lista', rotulo: 'Lista' },
          ]}
        />
      )}
      ativos={ativos}
      aoRemoverAtivo={remover}
    />
  );
}
