'use client';

import { Landmark } from 'lucide-react';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { nomeDoTitular, ROTULOS_TIPO_CONTA } from '@/dominio/contas';
import type { Soma } from '@/dominio/custos-relatorio';
import { projecaoDeCaixa } from '@/dominio/projecao-caixa';
import { carregarSaldos, contasDoPainel, saldoDaConta, ultimaMovimentacao } from '@/dominio/saldos';
import { cn } from '@/lib/utils';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const CADASTRO = '/configuracoes/cadastros/contas';

/** Sem câmbio, a projeção fica escrita em aberto, nunca zero. */
function ValorProjetado({ soma, className }: { soma: Soma; className?: string }) {
  if (soma.valor === null) return <span className={cn('text-warn', className)}>Falta câmbio</span>;
  return (
    <span className={cn('tabular-nums', soma.valor < 0 && 'text-warn', className)} data-valor={soma.valor}>
      {formatarDinheiro(soma.valor, 'BRL')}
      {soma.estimado && <span className="text-xs font-normal text-ink-soft"> (estimado)</span>}
    </span>
  );
}

/** Projeção de 30, 60 e 90 dias (15-M13 §2), aqui onde já se olha o saldo. */
function ProjecaoDeCaixa({ dados }: { dados: Parameters<typeof projecaoDeCaixa>[0] }) {
  const horizontes = projecaoDeCaixa(dados);
  return (
    <section aria-labelledby="projecao-titulo" className="space-y-3" data-projecao-de-caixa>
      <h2 id="projecao-titulo" className="text-base font-semibold">
        Projeção de caixa
      </h2>
      <ul className="grid gap-3 md:grid-cols-3">
        {horizontes.map((horizonte) => (
          <li key={horizonte.dias} className="rounded-lg border border-line bg-paper p-4 md:px-5 md:py-[18px]" data-horizonte={horizonte.dias}>
            <span className="block text-[13px] font-semibold text-ink-soft">
              Em {horizonte.dias} dias · até {formatarDiaISO(horizonte.ate)}
            </span>
            <ValorProjetado soma={horizonte.projetado} className="mt-2 block texto-kpi font-semibold md:max-lg:text-[26px] md:max-lg:leading-[30px]" />
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-ink-soft">Saldo hoje</dt>
              <dd className="text-right">
                <ValorProjetado soma={horizonte.saldo} />
              </dd>
              <dt className="text-ink-soft">+ A receber</dt>
              <dd className="text-right">
                <ValorProjetado soma={horizonte.aReceber} />
              </dd>
              <dt className="text-ink-soft">− A pagar</dt>
              <dd className="text-right">
                <ValorProjetado soma={horizonte.aPagar} />
              </dd>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-ink-soft">Saldo das contas com saldo controlado, mais o que vence a receber e menos o que vence a pagar até a data, em aberto e previstos. Vencidos ainda em aberto entram. Moeda estrangeira, pelo câmbio de referência.</p>
    </section>
  );
}

/** T05.07: cartões por conta. O saldo só aparece em conta controlada (RN-05.16). */
export function TelaContas() {
  const consulta = useConsulta(carregarSaldos);
  const dados = consulta.dados;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Contas e saldos</h1>
        <EstadoErro titulo="Não deu para ler as contas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const contas = contasDoPainel(dados.contas);
  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Financeiro"
        titulo="Contas e saldos"
        resumo="Onde está o dinheiro da Numa. Banco e caixa têm saldo; cartão e conta pessoal de sócia, só o extrato."
        acoes={
          <Button variante="secundario" asChild>
            <LinkCentral href={CADASTRO}>Cadastrar conta</LinkCentral>
          </Button>
        }
      />
      <AbasFinanceiro ativa="contas" />
      {contas.length === 0 ? (
        <EstadoVazio icone={Landmark} titulo="Nenhuma conta ainda." texto="Cadastre a primeira conta para acompanhar o saldo e o extrato." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Contas">
          {contas.map((conta) => {
            const saldo = saldoDaConta(conta, dados);
            const ultima = ultimaMovimentacao(conta, dados);
            const titular = nomeDoTitular(conta, dados);
            return (
              <li key={conta.id} className="min-w-0">
                <LinkCentral href={`/financeiro/contas/${conta.id}`} className="block h-full rounded-lg border border-line bg-paper p-4 transition-colors duration-150 hover:border-ink-soft md:px-5 md:py-[18px]">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 font-semibold break-words">{conta.nome}</span>
                    {conta.situacao === 'encerrada' && <EtiquetaSituacao tipo="neutro">Encerrada</EtiquetaSituacao>}
                  </span>
                  <span className="mt-1 block text-[13px] leading-[18px] text-ink-soft">
                    {ROTULOS_TIPO_CONTA[conta.tipo]}
                    {titular ? ` · ${titular}` : ''}
                  </span>
                  {saldo === null ? <span className="mt-3 block text-sm text-ink-soft">Sem saldo controlado</span> : <strong className="mt-3 block texto-kpi tabular-nums md:max-lg:text-[26px] md:max-lg:leading-[30px]">{formatarDinheiro(saldo, conta.moeda)}</strong>}
                  <span className="mt-2 block text-[13px] leading-[18px] text-ink-soft">{ultima ? `Última movimentação em ${formatarDiaISO(ultima)}` : 'Nenhuma movimentação ainda'}</span>
                </LinkCentral>
              </li>
            );
          })}
        </ul>
      )}
      {contas.length > 0 && <ProjecaoDeCaixa dados={dados} />}
    </div>
  );
}
