'use client';

/** T05.09 Custos e resultado por produto (F0b). Receita líquida e resultado gerencial entram com a F1. */
import { useState, type ReactNode } from 'react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { useCentral } from '@/componentes/layout/central-provider';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Input } from '@/componentes/ui/input';
import { useConsulta } from '@/dados/use-consulta';
import { carregarCustos, periodoPadrao, type FiltrosDeCusto, type LinhaPorCategoria, type Soma } from '@/dominio/custos-relatorio';
import { rotuloDoMes } from '@/dominio/lancamentos';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { Coins } from 'lucide-react';

const VISOES = [
  { id: 'produto', rotulo: 'Por produto' },
  { id: 'categoria', rotulo: 'Por categoria' },
  { id: 'ferramentas', rotulo: 'Ferramentas' },
  { id: 'institucional', rotulo: 'Numa institucional' },
] as const;
type Visao = (typeof VISOES)[number]['id'];

const NATUREZAS = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'direto', rotulo: 'Direto do produto' },
  { valor: 'compartilhado', rotulo: 'Compartilhado' },
  { valor: 'operacional', rotulo: 'Operacional da Numa' },
  { valor: 'investimento', rotulo: 'Investimento' },
  { valor: 'sem', rotulo: 'Natureza não informada' },
] as const;

/** Falta de câmbio aparece escrita, nunca como zero; o estimado diz que é estimado. */
function Valor({ soma, forte = false }: { soma: Soma; forte?: boolean }) {
  if (soma.valor === null) return <span className="text-warn">Falta câmbio</span>;
  return (
    <span className={cn('whitespace-nowrap tabular-nums', forte && 'font-semibold')}>
      {formatarDinheiro(soma.valor, 'BRL')}
      {soma.estimado && <span className="text-xs text-ink-soft"> (estimado)</span>}
    </span>
  );
}

function Quadro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{rotulo}</caption>
        {children}
      </table>
    </div>
  );
}

const TH = 'px-3 py-2 text-xs font-semibold text-ink-soft';
const TD = 'px-3 py-2.5 align-top';

function TabelaPorCategoria({ linhas, meses, rotulo }: { linhas: LinhaPorCategoria[]; meses: string[]; rotulo: string }) {
  if (!linhas.length) return <EstadoVazio icone={Coins} titulo="Nenhum custo no período." texto="Os custos aparecem aqui quando houver despesa na competência escolhida." />;
  return (
    <Quadro rotulo={rotulo}>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={TH}>
            Categoria
          </th>
          {meses.map((mes) => (
            <th key={mes} scope="col" className={cn(TH, 'text-right')}>
              {rotuloDoMes(mes).replace(/ de \d{4}$/, '').slice(0, 3).toLowerCase()}/{mes.slice(2, 4)}
            </th>
          ))}
          <th scope="col" className={cn(TH, 'text-right')}>
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha) => (
          <tr key={linha.categoriaId} className="border-b border-line last:border-0">
            <th scope="row" className={cn(TD, 'font-medium')}>
              {linha.nome}
            </th>
            {meses.map((mes) => (
              <td key={mes} className={cn(TD, 'text-right')}>
                <Valor soma={linha.meses[mes]!} />
              </td>
            ))}
            <td className={cn(TD, 'text-right')}>
              <Valor soma={linha.total} forte />
            </td>
          </tr>
        ))}
      </tbody>
    </Quadro>
  );
}

export function TelaCustos() {
  const { contexto } = useCentral();
  const hoje = hojeISO();
  const [filtros, setFiltros] = useState<FiltrosDeCusto>({ ...periodoPadrao(hoje), natureza: '', incluirInvestimento: true });
  const [visao, setVisao] = useState<Visao>('produto');
  const periodoValido = filtros.de && filtros.ate && filtros.de <= filtros.ate;
  const consulta = useConsulta(() => carregarCustos(periodoValido ? filtros : { ...filtros, ...periodoPadrao(hoje) }, contexto.id, hoje), [JSON.stringify(filtros), contexto.id]);
  const mudar = (parcial: Partial<FiltrosDeCusto>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        <h1 className="mb-5">Custos por produto</h1>
        <EstadoErro titulo="Não deu para ler os custos." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const tela = consulta.dados;
  const periodo = `${rotuloDoMes(tela.meses[0] ?? filtros.de)} a ${rotuloDoMes(tela.meses.at(-1) ?? filtros.ate)}`.toLowerCase();

  return (
    <div className="space-y-5">
      <CabecalhoPagina kicker="Financeiro" titulo="Custos por produto" resumo="Quanto cada produto custa, com os rateios. Receita e resultado entram na F1." />
      <AbasFinanceiro ativa="custos" />

      <div className="grid grid-cols-2 items-end gap-3 md:flex md:flex-wrap" role="group" aria-label="Filtros dos custos">
        <Campo id="custos-de" rotulo="Competência de" erro={periodoValido ? undefined : 'O início vem antes do fim.'}>
          {(controle) => <Input {...controle} type="month" value={filtros.de} onChange={(evento) => mudar({ de: evento.target.value })} />}
        </Campo>
        <Campo id="custos-ate" rotulo="até">
          {(controle) => <Input {...controle} type="month" value={filtros.ate} onChange={(evento) => mudar({ ate: evento.target.value })} />}
        </Campo>
        <div className="col-span-2 md:w-60">
          <Campo id="custos-natureza" rotulo="Natureza do custo">
            {(controle) => (
              <Selecao {...controle} value={filtros.natureza} onChange={(evento) => mudar({ natureza: evento.target.value as FiltrosDeCusto['natureza'] })}>
                {NATUREZAS.map((natureza) => (
                  <option key={natureza.valor} value={natureza.valor}>
                    {natureza.rotulo}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:min-h-9">
          <input type="checkbox" className="size-[18px] accent-[var(--ok)]" checked={filtros.incluirInvestimento} onChange={(evento) => mudar({ incluirInvestimento: evento.target.checked })} />
          Incluir investimento
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Visões">
        {VISOES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={visao === item.id}
            onClick={() => setVisao(item.id)}
            className={cn('min-h-11 rounded-pill border px-3.5 text-[13px] font-semibold md:min-h-9', visao === item.id ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:bg-hover')}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <p className="text-[13px] text-ink-soft" data-base-dos-custos>
        {periodo} · {contexto.nome} · {filtros.incluirInvestimento ? 'com investimento' : 'sem investimento'}. Total no período: <Valor soma={tela.total} forte />
      </p>

      {visao === 'produto' && (
        <Quadro rotulo="Custos por produto">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={TH}>
                Contexto
              </th>
              <th scope="col" className={cn(TH, 'text-right')}>
                Diretos
              </th>
              <th scope="col" className={cn(TH, 'text-right')}>
                Compartilhados (rateados)
              </th>
              <th scope="col" className={cn(TH, 'text-right')}>
                Custo total
              </th>
              <th scope="col" className={cn(TH, 'text-right')}>
                Custo médio mensal
              </th>
            </tr>
          </thead>
          <tbody>
            {tela.porProduto.map((linha) => (
              <tr key={linha.contextoId} className="border-b border-line last:border-0">
                <th scope="row" className={cn(TD, 'font-medium')}>
                  {linha.nome}
                </th>
                <td className={cn(TD, 'text-right')}>
                  <Valor soma={linha.direto} />
                </td>
                <td className={cn(TD, 'text-right')}>
                  <Valor soma={linha.compartilhado} />
                </td>
                <td className={cn(TD, 'text-right')}>
                  <Valor soma={linha.total} forte />
                </td>
                <td className={cn(TD, 'text-right text-[13px]')}>
                  {!linha.media ? (
                    <span className="text-ink-soft">Não se aplica</span>
                  ) : linha.media.valor === null ? (
                    <span className="text-ink-soft">{linha.media.situacao === 'sem_historico' ? 'Sem histórico' : 'Falta câmbio'}</span>
                  ) : (
                    <span className="tabular-nums">
                      {formatarDinheiro(linha.media.valor, 'BRL')}
                      <span className="block text-xs text-ink-soft">últimos 3 meses, sem investimento</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Quadro>
      )}
      {visao === 'categoria' && <TabelaPorCategoria linhas={tela.porCategoria} meses={tela.meses} rotulo="Custos por categoria e mês" />}
      {visao === 'ferramentas' &&
        (tela.porFerramenta.length ? (
          <Quadro rotulo="Custos por ferramenta e produto">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  Ferramenta
                </th>
                <th scope="col" className={TH}>
                  Por contexto
                </th>
                <th scope="col" className={cn(TH, 'text-right')}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {tela.porFerramenta.map((linha) => (
                <tr key={linha.ferramentaId} className="border-b border-line last:border-0">
                  <th scope="row" className={cn(TD, 'font-medium')}>
                    {linha.nome}
                  </th>
                  <td className={TD}>
                    <ul className="grid gap-0.5">
                      {linha.porContexto.map((parte) => (
                        <li key={parte.nome}>
                          {parte.nome}: <Valor soma={parte.soma} />
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <Valor soma={linha.total} forte />
                  </td>
                </tr>
              ))}
            </tbody>
          </Quadro>
        ) : (
          <EstadoVazio icone={Coins} titulo="Nenhuma cobrança de ferramenta no período." texto="As cobranças das assinaturas (M04) aparecem aqui, com a parte de cada produto." />
        ))}
      {visao === 'institucional' && <TabelaPorCategoria linhas={tela.institucional} meses={tela.meses} rotulo="Custos da Numa institucional por categoria e mês" />}

      <div className="grid gap-1 text-[13px] text-ink-soft" data-notas-dos-custos>
        <p>Rateios não são saídas adicionais de caixa: no total, cada despesa conta uma vez.</p>
        <p>Valores em moeda estrangeira em aberto são estimados pelo câmbio de referência.</p>
        <p>Reembolsos às sócias não entram: o custo já está na despesa original.</p>
      </div>
    </div>
  );
}
