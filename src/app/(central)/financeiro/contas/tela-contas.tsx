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
import { carregarSaldos, contasDoPainel, saldoDaConta, ultimaMovimentacao } from '@/dominio/saldos';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const CADASTRO = '/configuracoes/cadastros/contas';

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
    </div>
  );
}
