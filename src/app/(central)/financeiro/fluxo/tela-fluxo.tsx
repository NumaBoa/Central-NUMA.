'use client';

/** T13.02 Fluxo de caixa (F0a): realizado e projetado, mês a mês, no Financeiro (sem a Visão geral, decisão de 07/11/2026). */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { useCentral } from '@/componentes/layout/central-provider';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { useConsulta } from '@/dados/use-consulta';
import { controlaSaldo } from '@/dominio/contas';
import { ID_CONSOLIDADA } from '@/dominio/contextos';
import type { Soma } from '@/dominio/custos-relatorio';
import { carregarFluxo, csvDoFluxo, fluxoDeCaixa, periodoDoFluxo, type FiltrosDoFluxo } from '@/dominio/fluxo-caixa';
import { rotuloDoMes } from '@/dominio/lancamentos';
import { baixarArquivo } from '@/lib/baixar-arquivo';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

function Valor({ soma }: { soma: Soma | number | null }) {
  if (soma === null) return <span className="text-ink-soft">—</span>;
  const valor = typeof soma === 'number' ? soma : soma.valor;
  if (valor === null) return <span className="text-warn">Falta câmbio</span>;
  return (
    <span className="tabular-nums">
      {formatarDinheiro(valor, 'BRL')}
      {typeof soma !== 'number' && soma.estimado ? <span className="text-ink-soft"> (est.)</span> : null}
    </span>
  );
}

const ROTULO_DO_TIPO = { realizado: 'Realizado', atual: 'Mês atual', projetado: 'Projetado' } as const;

export function TelaFluxo() {
  const { contexto } = useCentral();
  const hoje = hojeISO();
  const [filtros, setFiltros] = useState<FiltrosDoFluxo>({ ...periodoDoFluxo(hoje), contaId: '' });
  const consulta = useConsulta(() => carregarFluxo(), []);
  const mudar = (parcial: Partial<FiltrosDoFluxo>) => setFiltros((atual) => ({ ...atual, ...parcial }));

  if (consulta.estado === 'carregando' && !consulta.dados) return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        <h1 className="mb-5">Fluxo de caixa</h1>
        <EstadoErro titulo="Não deu para montar o fluxo de caixa." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const periodoValido = Boolean(filtros.de && filtros.ate && filtros.de <= filtros.ate);
  const consolidado = contexto.id === ID_CONSOLIDADA;
  const contas = consulta.dados.contas.filter((conta) => !conta.arquivado_em && controlaSaldo(conta.tipo));
  const meses = periodoValido ? fluxoDeCaixa(consulta.dados, consolidado ? filtros : { ...filtros, contaId: '' }, contexto.id, hoje) : [];
  const colunas = ['Mês', 'Entradas', 'Saídas', 'A receber', 'A pagar', ...(consolidado ? ['Aportes', 'Retiradas', filtros.contaId ? 'Transferências' : 'Entre contas', 'Saldo final'] : [])];

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Financeiro"
        titulo="Fluxo de caixa"
        resumo="Mês a mês, em reais: o realizado pelas baixas e o projetado pelo que falta pagar e receber."
        acoes={
          <Button variante="secundario" disabled={!meses.length} onClick={() => baixarArquivo(`numa-fluxo-de-caixa-${filtros.de}-a-${filtros.ate}.csv`, csvDoFluxo(meses), 'text/csv;charset=utf-8')}>
            <Download aria-hidden />
            Baixar CSV
          </Button>
        }
      />
      <AbasFinanceiro ativa="fluxo" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Campo id="fluxo-de" rotulo="De" erro={periodoValido ? undefined : 'O início vem antes do fim.'}>
            {(controle) => <Input {...controle} type="month" value={filtros.de} onChange={(evento) => mudar({ de: evento.target.value })} />}
          </Campo>
        </div>
        <div className="w-48">
          <Campo id="fluxo-ate" rotulo="até">
            {(controle) => <Input {...controle} type="month" value={filtros.ate} onChange={(evento) => mudar({ ate: evento.target.value })} />}
          </Campo>
        </div>
        {consolidado && (
          <div className="w-56">
            <Campo id="fluxo-conta" rotulo="Conta">
              {(controle) => (
                <Selecao {...controle} value={filtros.contaId} onChange={(evento) => mudar({ contaId: evento.target.value })}>
                  <option value="">Todas as contas controladas</option>
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
        )}
      </div>

      <p className="text-[13px] text-ink-soft" data-recorte-do-fluxo>
        {contexto.nome}
        {consolidado
          ? filtros.contaId
            ? ' · uma conta: só o realizado dela, sem projeção (o título ainda não tem conta).'
            : ' · aportes, retiradas e transferências entre contas aparecem à parte.'
          : ': só a parte de cada título rateada para este contexto. Movimentos das sócias, transferências e saldo são da Numa inteira e ficam no consolidado.'}
      </p>

      {meses.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full border-collapse text-left text-sm" data-fluxo-de-caixa>
            <caption className="sr-only">Fluxo de caixa por mês</caption>
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                {colunas.map((titulo) => (
                  <th key={titulo} scope="col" className={cn('px-3 py-2 font-semibold whitespace-nowrap', titulo !== 'Mês' && 'text-right')}>
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map((linha) => (
                <tr key={linha.mes} className={cn('border-b border-line last:border-0', linha.tipo === 'atual' && 'bg-mist/50')} data-mes={linha.mes} data-tipo={linha.tipo}>
                  <th scope="row" className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                    {rotuloDoMes(linha.mes)}
                    <span className="block text-xs font-normal text-ink-soft">{ROTULO_DO_TIPO[linha.tipo]}</span>
                  </th>
                  {[linha.entradas, linha.saidas, linha.aReceber, linha.aPagar, ...(consolidado ? [linha.aportes, linha.retiradas, linha.transferencias, linha.saldoFinal] : [])].map((soma, indice) => (
                    <td key={indice} className={cn('px-3 py-2.5 text-right whitespace-nowrap', indice === 7 && 'font-semibold')}>
                      <Valor soma={soma} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-soft">
        Realizado: baixas pelo valor efetivo em reais e movimentos das sócias em dinheiro. Projetado: o que falta dos títulos previstos, em aberto e parciais, pelo vencimento; o vencido entra no mês atual. Moeda estrangeira vai pelo câmbio de referência (est.); sem câmbio, o valor fica em aberto. Saldo final: contas controladas; nos meses projetados, o saldo de hoje mais o projetado.
      </p>
    </div>
  );
}
