'use client';

import { CircleDot, Layers, Shapes } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha, type SeletorEmLinha } from '@/componentes/padroes/filtros-em-linha';
import type { Ferramenta } from '@/dados/tipos/ferramenta';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { etiquetasDoModulo } from '@/dominio/etiquetas';
import { FILTROS_FERRAMENTAS_INICIAIS, ROTULOS_MODALIDADE, ROTULOS_SITUACAO_FERRAMENTA, ROTULOS_TITULAR, type DadosDasFerramentas, type FiltrosFerramentas } from '@/dominio/ferramentas';

type Mudar = (parcial: Partial<FiltrosFerramentas>) => void;

/** Os de "Mais filtros": tudo o que não é busca, categoria, contexto e situação. */
export function quantosMaisFiltros(filtros: FiltrosFerramentas): number {
  return [filtros.modalidade, filtros.critica, filtros.titular, filtros.dados, filtros.venceEm, filtros.etiqueta].filter(Boolean).length + (filtros.arquivadas ? 1 : 0);
}

/** Um interruptor de filtro, com alvo de toque de 44px no celular. */
function Marcar({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: (marcado: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:min-h-9">
      <input type="checkbox" className="size-[18px] shrink-0 accent-[var(--ok)]" checked={marcado} onChange={(evento) => aoMudar(evento.target.checked)} />
      {rotulo}
    </label>
  );
}

function CamposMaisFiltros({ filtros, mudar, dados, arquivadas }: { filtros: FiltrosFerramentas; mudar: Mudar; dados: DadosDasFerramentas; arquivadas: number }) {
  return (
    <div className="grid gap-x-3 gap-y-3.5 md:grid-cols-2">
      <Campo rotulo="Modalidade" id="filtro-modalidade">
        {(controle) => (
          <Selecao {...controle} value={filtros.modalidade} onChange={(evento) => mudar({ modalidade: evento.target.value })}>
            <option value="">Todas</option>
            {Object.entries(ROTULOS_MODALIDADE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
            <option value="a_definir">Custo a definir</option>
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Crítica" id="filtro-critica">
        {(controle) => (
          <Selecao {...controle} value={filtros.critica} onChange={(evento) => mudar({ critica: evento.target.value as FiltrosFerramentas['critica'] })}>
            <option value="">Todas</option>
            <option value="sim">Críticas</option>
            <option value="nao">Não críticas</option>
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Titular atual" id="filtro-titular">
        {(controle) => (
          <Selecao {...controle} value={filtros.titular} onChange={(evento) => mudar({ titular: evento.target.value })}>
            <option value="">Todos</option>
            {Object.entries(ROTULOS_TITULAR).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Trata dados pessoais" id="filtro-dados">
        {(controle) => (
          <Selecao {...controle} value={filtros.dados} onChange={(evento) => mudar({ dados: evento.target.value as FiltrosFerramentas['dados'] })}>
            <option value="">Todas</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Próxima cobrança em" id="filtro-vence">
        {(controle) => (
          <Selecao {...controle} value={filtros.venceEm} onChange={(evento) => mudar({ venceEm: evento.target.value as FiltrosFerramentas['venceEm'] })}>
            <option value="">Qualquer data</option>
            {['7', '30', '60', '90'].map((dias) => (
              <option key={dias} value={dias}>
                Até {dias} dias
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Etiqueta" id="filtro-etiqueta">
        {(controle) => (
          <Selecao {...controle} value={filtros.etiqueta} onChange={(evento) => mudar({ etiqueta: evento.target.value })}>
            <option value="">Todas</option>
            {etiquetasDoModulo(dados.etiquetas, 'ferramentas').map((etiqueta) => (
              <option key={etiqueta.id} value={etiqueta.id}>
                {etiqueta.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      {arquivadas > 0 && (
        <div className="md:col-span-2">
          <Marcar rotulo={`Ver as arquivadas (${arquivadas})`} marcado={filtros.arquivadas} aoMudar={(valor) => mudar({ arquivadas: valor })} />
        </div>
      )}
    </div>
  );
}

/** T04.01: busca → categoria → produto ou contexto → situação → Mais filtros. Afeta só a lista logo abaixo. */
export function BarraDeFerramentas({ filtros, aoMudar, dados }: { filtros: FiltrosFerramentas; aoMudar: Mudar; dados: DadosDasFerramentas }) {
  const nomeDaCategoria = (id: string) => dados.categorias.find((categoria) => categoria.id === id)?.nome ?? 'Categoria removida';
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em);
  const nomeDoContexto = (id: string) => (id === ID_INSTITUCIONAL ? 'Numa' : (dados.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));
  const arquivadas = dados.ferramentas.filter((ferramenta) => ferramenta.arquivado_em).length;

  const escolher = (rotulo: string, valor: string, opcoes: readonly { valor: string; rotulo: string }[], aplicar: (valor: string) => void, fechar: () => void) => (
    <Pilulas
      rotulo={rotulo}
      valor={valor}
      aoMudar={(novo) => {
        aplicar(novo);
        fechar();
      }}
      opcoes={opcoes}
    />
  );

  const seletores: SeletorEmLinha<FiltrosFerramentas>[] = [
    {
      id: 'categoria',
      rotulo: 'Categoria',
      icone: Shapes,
      largura: 184,
      valor: ({ categoria }) => (categoria ? nomeDaCategoria(categoria) : 'Todas as categorias'),
      ativo: ({ categoria }) => Boolean(categoria),
      campos: ({ categoria }, mudar, fechar) => escolher('Categoria', categoria, [{ valor: '', rotulo: 'Todas' }, ...dados.categorias.map((item) => ({ valor: item.id, rotulo: item.nome }))], (valor) => mudar({ categoria: valor }), fechar),
    },
    {
      id: 'contexto',
      rotulo: 'Produto ou contexto',
      icone: Layers,
      largura: 168,
      valor: ({ contexto }) => (contexto ? nomeDoContexto(contexto) : 'Todos os produtos'),
      ativo: ({ contexto }) => Boolean(contexto),
      campos: ({ contexto }, mudar, fechar) => escolher('Produto ou contexto', contexto, [{ valor: '', rotulo: 'Todos' }, { valor: ID_INSTITUCIONAL, rotulo: 'Numa' }, ...produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome }))], (valor) => mudar({ contexto: valor }), fechar),
    },
    {
      id: 'situacao',
      rotulo: 'Situação',
      icone: CircleDot,
      largura: 160,
      valor: ({ situacao }) => (situacao ? ROTULOS_SITUACAO_FERRAMENTA[situacao as Ferramenta['situacao']] : 'Todas as situações'),
      ativo: ({ situacao }) => Boolean(situacao),
      campos: ({ situacao }, mudar, fechar) => escolher('Situação', situacao, [{ valor: '', rotulo: 'Todas' }, ...Object.entries(ROTULOS_SITUACAO_FERRAMENTA).map(([valor, rotulo]) => ({ valor, rotulo }))], (valor) => mudar({ situacao: valor }), fechar),
    },
  ];

  const ativos: FiltroAtivo[] = [
    ...(filtros.categoria ? [{ id: 'categoria', rotulo: `Categoria: ${nomeDaCategoria(filtros.categoria)}` }] : []),
    ...(filtros.contexto ? [{ id: 'contexto', rotulo: `Produto: ${nomeDoContexto(filtros.contexto)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_FERRAMENTA[filtros.situacao as Ferramenta['situacao']]}` }] : []),
    ...(filtros.modalidade ? [{ id: 'modalidade', rotulo: `Modalidade: ${filtros.modalidade === 'a_definir' ? 'Custo a definir' : ROTULOS_MODALIDADE[filtros.modalidade as keyof typeof ROTULOS_MODALIDADE]}` }] : []),
    ...(filtros.critica ? [{ id: 'critica', rotulo: filtros.critica === 'sim' ? 'Críticas' : 'Não críticas' }] : []),
    ...(filtros.titular ? [{ id: 'titular', rotulo: `Titular: ${ROTULOS_TITULAR[filtros.titular as keyof typeof ROTULOS_TITULAR]}` }] : []),
    ...(filtros.dados ? [{ id: 'dados', rotulo: filtros.dados === 'sim' ? 'Trata dados pessoais' : 'Não trata dados pessoais' }] : []),
    ...(filtros.venceEm ? [{ id: 'venceEm', rotulo: `Cobrança em até ${filtros.venceEm} dias` }] : []),
    ...(filtros.etiqueta ? [{ id: 'etiqueta', rotulo: `Etiqueta: ${dados.etiquetas.find((etiqueta) => etiqueta.id === filtros.etiqueta)?.nome ?? ''}` }] : []),
    ...(filtros.arquivadas ? [{ id: 'arquivadas', rotulo: 'Arquivadas' }] : []),
  ];

  return (
    <FiltrosEmLinha
      filtros={filtros}
      aoMudar={aoMudar}
      aoLimpar={() => aoMudar({ ...FILTROS_FERRAMENTAS_INICIAIS })}
      rotuloBusca="Buscar por nome, código, finalidade ou categoria"
      rotuloAvancados="Mais filtros"
      larguraAvancados={560}
      seletores={seletores}
      avancados={(valor, mudar) => <CamposMaisFiltros filtros={valor} mudar={mudar} dados={dados} arquivadas={arquivadas} />}
      quantosAvancados={quantosMaisFiltros}
      ativos={ativos}
      aoRemoverAtivo={(id) => aoMudar(id === 'arquivadas' ? { arquivadas: false } : { [id]: '' })}
    />
  );
}
