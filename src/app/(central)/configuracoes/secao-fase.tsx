'use client';

import { useState } from 'react';
import { ArrowRight, Check, Undo2 } from 'lucide-react';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { avancarFase, voltarFase } from '@/dominio/configuracoes';
import { faseAnterior, INFO_FASES, proximaFase, rotuloDaFase } from '@/dominio/fases';
import type { LinhaHistorico } from '@/dominio/historico';
import { FASES, type Fase } from '@/dominio/navegacao';
import { formatarDataHora } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

function TelasDaFase({ fase }: { fase: Fase }) {
  return (
    <>
      <p className="mt-4 mb-2.5 text-[13px] font-semibold text-ink">Telas desta fase</p>
      <ul className="grid gap-2 text-[13px] text-ink">
        {INFO_FASES[fase].telas.map((tela) => (
          <li key={tela} className="flex items-start gap-2 leading-[1.45]">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-indigo" />
            {tela}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Fase ativa (T02.01 e RT-23): grava ao confirmar, sem depender de "Salvar alterações". */
export function SecaoFase({ fase, ultimaMudanca }: { fase: Fase; ultimaMudanca: LinhaHistorico | null }) {
  const [confirmando, setConfirmando] = useState<'avancar' | 'voltar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const info = INFO_FASES[fase];
  const proxima = proximaFase(fase);
  const anterior = faseAnterior(fase);

  async function mudar(acao: () => Promise<string>) {
    setConfirmando(null);
    setOcupado(true);
    try {
      aviso(await acao());
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-linen p-3.5 md:flex-nowrap md:items-center md:p-4">
        <div className="min-w-0">
          <strong className="block text-[13px] font-semibold md:text-sm">
            {rotuloDaFase(fase)} · {info.nome}
          </strong>
          <p className="mt-[3px] text-xs text-ink-soft">{info.pergunta}</p>
        </div>
        <EtiquetaSituacao tipo="sucesso" icone={Check}>
          Fase atual
        </EtiquetaSituacao>
      </div>

      <ol aria-label="Fases da Numa" className="my-4 grid grid-cols-1 md:my-5 md:grid-cols-5 md:gap-2">
        {FASES.map((item, indice) => {
          const atual = item === fase;
          const passou = indice < FASES.indexOf(fase);
          return (
            <li
              key={item}
              aria-current={atual ? 'step' : undefined}
              className={cn(
                'flex gap-2 border-l-[3px] py-1.5 pl-3 text-[13px] leading-4 md:flex-col md:gap-0.5 md:border-t-[3px] md:border-l-0 md:pt-[9px] md:pb-0 md:pl-0 md:text-xs',
                atual || passou ? 'border-indigo' : 'border-oat',
                atual ? 'font-semibold text-indigo-dk' : 'text-ink-soft',
              )}
            >
              <strong className="min-w-6 font-semibold">{INFO_FASES[item].codigo}</strong>
              <span>{INFO_FASES[item].nome}</span>
            </li>
          );
        })}
      </ol>

      <Faixa>Mudar de fase não apaga dados nem muda o menu: tudo o que já foi construído fica liberado em qualquer fase. A fase decide quais rotinas do dia rodam.</Faixa>

      <div className="mt-4 flex flex-wrap items-center gap-2 max-md:[&>*]:basis-full">
        <Button variante="secundario" disabled={!proxima || ocupado} onClick={() => setConfirmando('avancar')}>
          <ArrowRight aria-hidden />
          {proxima ? `Avançar para a ${rotuloDaFase(proxima)}` : 'Já está na última fase'}
        </Button>
        <Button variante="terciario" disabled={!anterior || ocupado} onClick={() => setConfirmando('voltar')}>
          <Undo2 aria-hidden />
          {anterior ? `Voltar para a ${rotuloDaFase(anterior)}` : 'Ainda não há fase anterior'}
        </Button>
      </div>

      {ultimaMudanca && (
        <p className="mt-3 text-xs leading-normal text-ink-soft">
          {ultimaMudanca.texto} · {formatarDataHora(ultimaMudanca.em)}
        </p>
      )}

      {proxima && (
        <Confirmacao
          aberto={confirmando === 'avancar'}
          aoFechar={() => setConfirmando(null)}
          titulo={`Avançar para a ${rotuloDaFase(proxima)}?`}
          texto={
            <>
              <p>
                {INFO_FASES[proxima].nome}: {INFO_FASES[proxima].pergunta}
              </p>
              <TelasDaFase fase={proxima} />
              <Faixa className="mt-4">As que ainda não foram construídas continuam com “Em breve”.</Faixa>
            </>
          }
          rotuloConfirmar={`Avançar para a ${rotuloDaFase(proxima)}`}
          rotuloCancelar="Cancelar"
          aoConfirmar={() =>
            void mudar(async () => {
              const nova = await avancarFase();
              return `Agora a Numa está na ${rotuloDaFase(nova)}.`;
            })
          }
        />
      )}
      {anterior && (
        <Confirmacao
          aberto={confirmando === 'voltar'}
          aoFechar={() => setConfirmando(null)}
          titulo={`Voltar para a ${rotuloDaFase(anterior)}?`}
          texto={
            <>
              <p>Nenhum dado é apagado, e as telas continuam no menu. As rotinas desta fase deixam de rodar até a fase avançar de novo.</p>
              <TelasDaFase fase={fase} />
            </>
          }
          rotuloConfirmar={`Voltar para a ${rotuloDaFase(anterior)}`}
          rotuloCancelar="Cancelar"
          pedirMotivo
          mensagemSemMotivo="Informe o motivo para voltar de fase."
          aoConfirmar={(motivo) =>
            void mudar(async () => {
              const nova = await voltarFase(motivo);
              return `A Numa voltou para a ${rotuloDaFase(nova)}. Nenhum dado foi apagado.`;
            })
          }
        />
      )}
    </>
  );
}
