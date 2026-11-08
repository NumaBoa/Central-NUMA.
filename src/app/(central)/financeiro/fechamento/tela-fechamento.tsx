'use client';

/** T05.10 Fechamento mensal (F1, RN-05.18): checklist da competência, resumo do mês, fechar e reabrir. */
import { useState } from 'react';
import { CheckCircle2, CircleAlert, Lock, LockOpen } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { executar } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { useConsulta } from '@/dados/use-consulta';
import type { Soma } from '@/dominio/custos-relatorio';
import { carregarFechamento, competenciaPadrao, fecharCompetencia, marcarItem, reabrirCompetencia } from '@/dominio/fechamento';
import { rotuloDoMes } from '@/dominio/lancamentos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

function Numero({ rotulo, valor, soma }: { rotulo: string; valor?: number; soma?: Soma }) {
  const texto = soma ? (soma.valor === null ? 'Falta câmbio' : `${formatarDinheiro(soma.valor, 'BRL')}${soma.estimado ? ' (estimado)' : ''}`) : formatarDinheiro(valor ?? 0, 'BRL');
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <span className="block text-xs text-ink-soft">{rotulo}</span>
      <strong className="mt-1 block text-lg tabular-nums">{texto}</strong>
    </div>
  );
}

export function TelaFechamento() {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const [mes, setMes] = useState(competenciaPadrao(hoje));
  const consulta = useConsulta(() => carregarFechamento(mes), [mes]);
  const [fechando, setFechando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  if (consulta.estado === 'carregando' && !consulta.dados) return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        <h1 className="mb-5">Fechamento mensal</h1>
        <EstadoErro titulo="Não deu para ler o fechamento." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const tela = consulta.dados;
  const fechada = tela.registro?.situacao === 'fechada';
  const mesEmCurso = mes >= hoje.slice(0, 7);
  const nome = (id: string | null | undefined) => (id ? (tela.nomes[id] ?? 'Pessoa removida') : '');

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        comoUsar="/ajuda/financeiro/fechamento-mensal"
        kicker="Financeiro"
        titulo="Fechamento mensal"
        resumo="Confira o mês e feche a competência: depois de fechada, ela não aceita lançamento, baixa nem rateio."
        acoes={
          fechada ? (
            <Button variante="secundario" onClick={() => setReabrindo(true)}>
              <LockOpen aria-hidden />
              Reabrir competência
            </Button>
          ) : (
            <Button disabled={mesEmCurso} onClick={() => setFechando(true)}>
              <Lock aria-hidden />
              Fechar competência
            </Button>
          )
        }
      />
      <AbasFinanceiro ativa="fechamento" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Campo id="fechamento-mes" rotulo="Competência">
            {(controle) => <Input {...controle} type="month" max={hoje.slice(0, 7)} value={mes} onChange={(evento) => evento.target.value && setMes(evento.target.value)} />}
          </Campo>
        </div>
        <p className="pb-2 text-[13px] text-ink-soft" data-situacao-da-competencia>
          {fechada
            ? `Fechada em ${formatarDiaISO(tela.registro!.fechada_em!.slice(0, 10))} por ${nome(tela.registro!.fechada_por)}.`
            : tela.registro?.situacao === 'aberta'
              ? `Reaberta em ${formatarDiaISO(tela.registro.reaberta_em!.slice(0, 10))}. Motivo: ${tela.registro.reaberta_motivo}.`
              : mesEmCurso
                ? 'O mês ainda não terminou: só se fecha um mês que já terminou.'
                : `${tela.pendencias ? `${tela.pendencias} ${tela.pendencias === 1 ? 'item pendente' : 'itens pendentes'}` : 'Tudo conferido'}.`}
        </p>
      </div>
      {fechada && tela.registro?.fechada_com_pendencias && <Faixa>Fechada com pendências. Motivo: {tela.registro.fechada_com_pendencias}</Faixa>}

      <section aria-labelledby="checklist-titulo" className="rounded-lg border border-line bg-paper">
        <h2 id="checklist-titulo" className="border-b border-line px-4 py-3 text-sm font-semibold">
          Checklist de {rotuloDoMes(mes).toLowerCase()}
        </h2>
        <ol className="divide-y divide-line" aria-label="Checklist do fechamento">
          {tela.itens.map((item, indice) => (
            <li key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3" data-item={item.id} data-ok={item.ok}>
              {item.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-label="Conferido" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-label="Pendente" />}
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-medium">
                  {indice + 1}. {item.rotulo}
                </span>
                <span className="text-[13px] text-ink-soft">
                  {item.detalhe}
                  {item.marca ? ` · marcado por ${nome(item.marca.por)} em ${formatarDiaISO(item.marca.em.slice(0, 10))}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <LinkCentral href={item.href} className="inline-flex min-h-11 min-w-11 items-center justify-center text-[13px] underline underline-offset-2 md:min-h-0 md:min-w-0">
                  Abrir
                </LinkCentral>
                {item.manual && !fechada && (
                  <label className={cn('flex min-h-11 cursor-pointer items-center gap-2 text-[13px] md:min-h-9')}>
                    <input type="checkbox" className="size-[18px] accent-[var(--ok)]" checked={item.ok} onChange={(evento) => void executar(() => marcarItem(mes, item.id, evento.target.checked, pessoa.id))} />
                    Conferido
                  </label>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="resumo-titulo" className="space-y-3">
        <h2 id="resumo-titulo" className="text-base font-semibold">
          Resumo do mês
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-resumo-do-mes>
          <Numero rotulo="Entradas (recebido)" valor={tela.resumo.entradas} />
          <Numero rotulo="Saídas (pago)" valor={tela.resumo.saidas} />
          <Numero rotulo="Resultado gerencial" soma={tela.resumo.resultado} />
          <Numero rotulo="Aportes das sócias" valor={tela.resumo.aportes} />
          <Numero rotulo="Retiradas e distribuições" valor={tela.resumo.retiradas} />
        </div>
        {tela.resumo.saldos.length > 0 && (
          <ul className="grid gap-2 md:grid-cols-3" aria-label="Saldo final por conta">
            {tela.resumo.saldos.map((linha) => (
              <li key={linha.contaId} className="rounded-lg border border-line bg-paper p-3 text-[13px]">
                <span className="block text-ink-soft">{linha.nome}</span>
                <strong className="tabular-nums">{linha.saldo === null ? 'Sem saldo controlado' : formatarDinheiro(linha.saldo, linha.moeda)}</strong>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-soft">Entradas e saídas pela data da baixa; o resultado, pela competência (receita líquida − custo, como em Resultado por produto).</p>
      </section>

      <Confirmacao
        aberto={fechando}
        aoFechar={() => setFechando(false)}
        titulo={`Fechar ${rotuloDoMes(mes).toLowerCase()}?`}
        texto={tela.pendencias ? `Há ${tela.pendencias} ${tela.pendencias === 1 ? 'item pendente' : 'itens pendentes'}. Diga por que fechar assim mesmo. Depois de fechada, a competência não aceita lançamento, baixa nem rateio.` : 'Depois de fechada, a competência não aceita lançamento, baixa nem rateio. Reabrir exige motivo.'}
        rotuloConfirmar="Fechar competência"
        pedirMotivo={tela.pendencias > 0}
        aoConfirmar={(motivo) => {
          setFechando(false);
          void executar(() => fecharCompetencia(mes, pessoa.id, motivo ?? ''), 'Competência fechada.');
        }}
      />
      <Confirmacao
        aberto={reabrindo}
        aoFechar={() => setReabrindo(false)}
        titulo={`Reabrir ${rotuloDoMes(mes).toLowerCase()}?`}
        texto="A competência volta a aceitar lançamentos. O motivo fica no histórico."
        rotuloConfirmar="Reabrir competência"
        pedirMotivo
        aoConfirmar={(motivo) => {
          setReabrindo(false);
          void executar(() => reabrirCompetencia(mes, motivo, pessoa.id), 'Competência reaberta.');
        }}
      />
    </div>
  );
}
