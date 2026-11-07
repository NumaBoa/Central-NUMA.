'use client';

import type { ReactNode } from 'react';
import { CalendarRange, CircleDot } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha, type SeletorEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import type { Titulo } from '@/dados/tipos/titulo';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { competenciasDosTitulos, FILTROS_LANCAMENTOS_INICIAIS, OPCOES_DE_SITUACAO, quantosMaisFiltros, rotuloDoMes, somarDias, type DadosDosLancamentos, type FiltrosLancamentos } from '@/dominio/lancamentos';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { ROTULOS_ORIGEM_TITULO } from '@/dominio/titulos';
import { formatarDiaISO } from '@/lib/formatacao';

const ORIGENS: readonly Titulo['origem'][] = ['manual', 'assinatura', 'reembolso', 'ajuste'];

function textoDoIntervalo(de: string, ate: string): string {
  if (de && ate) return `${formatarDiaISO(de)} a ${formatarDiaISO(ate)}`;
  return de ? `a partir de ${formatarDiaISO(de)}` : `até ${formatarDiaISO(ate)}`;
}

export const rotuloDaCompetenciaDoFiltro = (competencia: string) => (competencia ? rotuloDoMes(competencia) : 'Todas as competências');

const rotuloDaSituacao = (situacao: string) => OPCOES_DE_SITUACAO.find((opcao) => opcao.valor === situacao)?.rotulo ?? 'Todas as situações';

/** Um interruptor de filtro, com o mesmo alvo de toque no computador e no celular. */
function Marcar({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: (marcado: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:min-h-9">
      <input type="checkbox" className="size-[18px] shrink-0 accent-[var(--ok)]" checked={marcado} onChange={(evento) => aoMudar(evento.target.checked)} />
      {rotulo}
    </label>
  );
}

function CamposMaisFiltros({ filtros, mudar, dados, hoje, arquivados }: { filtros: FiltrosLancamentos; mudar: (parcial: Partial<FiltrosLancamentos>) => void; dados: DadosDosLancamentos; hoje: string; arquivados: number }) {
  const categorias = dados.categorias.filter((categoria) => categoria.pai_id && categoria.tipo === 'despesa' && !categoria.arquivado_em);
  const contrapartes = dados.contrapartes.filter((item) => dados.titulos.some((titulo) => titulo.contraparte_id === item.id));
  const moedas = [...new Set(dados.titulos.map((titulo) => titulo.moeda))].sort();
  const proximos = { vencimentoDe: hoje, vencimentoAte: somarDias(hoje, 30) };
  const emProximos = filtros.vencimentoDe === proximos.vencimentoDe && filtros.vencimentoAte === proximos.vencimentoAte;
  return (
    <div className="grid gap-x-3 gap-y-3.5 md:grid-cols-3">
      <div className="grid grid-cols-2 gap-3 md:col-span-3 md:grid-cols-4 md:items-end">
        <Campo rotulo="Vence de" id="filtro-vencimento-de">
          {(controle) => <Input type="date" {...controle} value={filtros.vencimentoDe} onChange={(evento) => mudar({ vencimentoDe: evento.target.value })} />}
        </Campo>
        <Campo rotulo="até" id="filtro-vencimento-ate">
          {(controle) => <Input type="date" {...controle} value={filtros.vencimentoAte} onChange={(evento) => mudar({ vencimentoAte: evento.target.value })} />}
        </Campo>
        {/* Data da baixa: recorta a lista e muda o período do cartão Pago (decisão de 07/11/2026). */}
        <Campo rotulo="Pago de" id="filtro-pagamento-de">
          {(controle) => <Input type="date" {...controle} value={filtros.pagamentoDe} onChange={(evento) => mudar({ pagamentoDe: evento.target.value })} />}
        </Campo>
        <Campo rotulo="até" id="filtro-pagamento-ate">
          {(controle) => <Input type="date" {...controle} value={filtros.pagamentoAte} onChange={(evento) => mudar({ pagamentoAte: evento.target.value })} />}
        </Campo>
      </div>
      <Campo rotulo="Categoria" id="filtro-categoria">
        {(controle) => (
          <Selecao {...controle} value={filtros.categoria} onChange={(evento) => mudar({ categoria: evento.target.value })}>
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Contraparte" id="filtro-contraparte">
        {(controle) => (
          <Selecao {...controle} value={filtros.contraparte} onChange={(evento) => mudar({ contraparte: evento.target.value })}>
            <option value="">Todas</option>
            {contrapartes.map((item) => (
              <option key={item.id} value={item.id}>
                {nomeDaContraparte(item)}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Conta da baixa" id="filtro-conta">
        {(controle) => (
          <Selecao {...controle} value={filtros.conta} onChange={(evento) => mudar({ conta: evento.target.value })}>
            <option value="">Todas</option>
            {dados.contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Origem" id="filtro-origem">
        {(controle) => (
          <Selecao {...controle} value={filtros.origem} onChange={(evento) => mudar({ origem: evento.target.value })}>
            <option value="">Todas</option>
            {ORIGENS.map((valor) => (
              <option key={valor} value={valor}>
                {ROTULOS_ORIGEM_TITULO[valor]}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Moeda" id="filtro-moeda">
        {(controle) => (
          <Selecao {...controle} value={filtros.moeda} onChange={(evento) => mudar({ moeda: evento.target.value })}>
            <option value="">Todas</option>
            {moedas.map((moeda) => (
              <option key={moeda} value={moeda}>
                {moeda}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo rotulo="Responsável" id="filtro-responsavel">
        {(controle) => (
          <Selecao {...controle} value={filtros.responsavel} onChange={(evento) => mudar({ responsavel: evento.target.value })}>
            <option value="">Todas</option>
            {pessoasDoSeletor(dados.pessoas).map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome_completo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <div className="grid gap-x-3 md:col-span-3 md:grid-cols-3 md:items-center">
        <div>
          <Button variante="terciario" tamanho="pequeno" aria-pressed={emProximos} onClick={() => mudar(emProximos ? { vencimentoDe: '', vencimentoAte: '' } : proximos)}>
            {emProximos ? 'Tirar os 30 dias' : 'Vence em 30 dias'}
          </Button>
        </div>
        <Marcar rotulo="Sem comprovante" marcado={filtros.semComprovante} aoMudar={(semComprovante) => mudar({ semComprovante })} />
        <Marcar rotulo="Reembolsos a sócias" marcado={filtros.reembolsos} aoMudar={(reembolsos) => mudar({ reembolsos })} />
        {arquivados > 0 && <Marcar rotulo={`Ver arquivados (${arquivados})`} marcado={filtros.arquivados} aoMudar={(valor) => mudar({ arquivados: valor })} />}
      </div>
    </div>
  );
}

type BarraDeLancamentosProps = {
  filtros: FiltrosLancamentos;
  aoMudar: (parcial: Partial<FiltrosLancamentos>) => void;
  dados: DadosDosLancamentos;
  hoje: string;
  /** Colunas, à direita da linha. */
  colunas: ReactNode;
};

/** T05.01: busca → competência → situação → Mais filtros → Colunas. O contexto vem do seletor global. */
export function BarraDeLancamentos({ filtros, aoMudar, dados, hoje, colunas }: BarraDeLancamentosProps) {
  const competencias = competenciasDosTitulos(dados.titulos);
  const arquivados = dados.titulos.filter((titulo) => titulo.arquivado_em).length;

  const seletores: SeletorEmLinha<FiltrosLancamentos>[] = [
    {
      id: 'competencia',
      rotulo: 'Competência',
      icone: CalendarRange,
      largura: 208,
      valor: ({ competencia }) => rotuloDaCompetenciaDoFiltro(competencia),
      ativo: ({ competencia }) => Boolean(competencia),
      campos: ({ competencia }, mudar, fechar) => (
        <Pilulas
          rotulo="Competência"
          valor={competencia}
          aoMudar={(valor) => {
            mudar({ competencia: valor });
            fechar();
          }}
          opcoes={[{ valor: '', rotulo: 'Todas' }, ...competencias.map((valor) => ({ valor, rotulo: rotuloDoMes(valor) }))]}
        />
      ),
    },
    {
      id: 'situacao',
      rotulo: 'Situação',
      icone: CircleDot,
      largura: 188,
      valor: ({ situacao }) => rotuloDaSituacao(situacao),
      ativo: ({ situacao }) => Boolean(situacao),
      campos: ({ situacao }, mudar, fechar) => (
        <Pilulas
          rotulo="Situação"
          valor={situacao}
          aoMudar={(valor) => {
            mudar({ situacao: valor });
            fechar();
          }}
          opcoes={[{ valor: '', rotulo: 'Todas' }, ...OPCOES_DE_SITUACAO.map(({ valor, rotulo }) => ({ valor, rotulo }))]}
        />
      ),
    },
  ];

  const nomeDaCategoria = dados.categorias.find((categoria) => categoria.id === filtros.categoria)?.nome ?? 'Categoria removida';
  const contraparte = dados.contrapartes.find((item) => item.id === filtros.contraparte);
  const ativos: FiltroAtivo[] = [
    ...(filtros.competencia ? [{ id: 'competencia', rotulo: `Competência: ${rotuloDoMes(filtros.competencia)}` }] : []),
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${rotuloDaSituacao(filtros.situacao)}` }] : []),
    ...(filtros.vencimentoDe || filtros.vencimentoAte ? [{ id: 'vencimento', rotulo: `Vencimento: ${textoDoIntervalo(filtros.vencimentoDe, filtros.vencimentoAte)}` }] : []),
    ...(filtros.pagamentoDe || filtros.pagamentoAte ? [{ id: 'pagamento', rotulo: `Pago: ${textoDoIntervalo(filtros.pagamentoDe, filtros.pagamentoAte)}` }] : []),
    ...(filtros.categoria ? [{ id: 'categoria', rotulo: `Categoria: ${nomeDaCategoria}` }] : []),
    ...(filtros.contraparte ? [{ id: 'contraparte', rotulo: `Contraparte: ${contraparte ? nomeDaContraparte(contraparte) : 'Removida'}` }] : []),
    ...(filtros.conta ? [{ id: 'conta', rotulo: `Conta: ${dados.contas.find((conta) => conta.id === filtros.conta)?.nome ?? 'Removida'}` }] : []),
    ...(filtros.origem ? [{ id: 'origem', rotulo: `Origem: ${ROTULOS_ORIGEM_TITULO[filtros.origem as Titulo['origem']]}` }] : []),
    ...(filtros.moeda ? [{ id: 'moeda', rotulo: `Moeda: ${filtros.moeda}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${dados.pessoas.find((pessoa) => pessoa.id === filtros.responsavel)?.nome_completo ?? 'Pessoa removida'}` }] : []),
    ...(filtros.semComprovante ? [{ id: 'semComprovante', rotulo: 'Sem comprovante' }] : []),
    ...(filtros.reembolsos ? [{ id: 'reembolsos', rotulo: 'Reembolsos a sócias' }] : []),
    ...(filtros.arquivados ? [{ id: 'arquivados', rotulo: 'Arquivados' }] : []),
  ];

  function remover(id: string) {
    if (id === 'vencimento') return aoMudar({ vencimentoDe: '', vencimentoAte: '' });
    if (id === 'pagamento') return aoMudar({ pagamentoDe: '', pagamentoAte: '' });
    if (id === 'semComprovante' || id === 'reembolsos' || id === 'arquivados') return aoMudar({ [id]: false });
    aoMudar({ [id]: '' });
  }

  return (
    <FiltrosEmLinha
      filtros={filtros}
      aoMudar={aoMudar}
      aoLimpar={() => aoMudar({ ...FILTROS_LANCAMENTOS_INICIAIS })}
      rotuloBusca="Buscar por descrição, código ou fornecedor"
      placeholderBusca="Buscar descrição, código ou fornecedor…"
      rotuloAvancados="Mais filtros"
      larguraAvancados={640}
      seletores={seletores}
      avancados={(valor, mudar) => <CamposMaisFiltros filtros={valor} mudar={mudar} dados={dados} hoje={hoje} arquivados={arquivados} />}
      quantosAvancados={quantosMaisFiltros}
      direita={colunas}
      larguraDireita={112}
      ativos={ativos}
      aoRemoverAtivo={remover}
    />
  );
}
