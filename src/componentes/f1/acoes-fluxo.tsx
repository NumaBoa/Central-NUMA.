'use client';

import { useState } from 'react';
import { CheckCheck, CornerDownLeft, Send } from 'lucide-react';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Button } from '@/componentes/ui/button';
import type { ContratoVersao } from '@/dados/tipos/contrato';
import { aprovarParaEnvio, bloqueiaAlgo, devolverParaRascunho, emitirContrato, enviarParaRevisao } from '@/dominio/contratos';
import type { Pendencia } from '@/dominio/pendencias';
import { executar } from './apoio';
import { BotoesDeEmissao } from './emissao';

/**
 * O fluxo documental da versão (decisão vigente 5): conferir e revisar → emitir final → aprovar para envio.
 * O envio e a assinatura ficam na ficha. Não há ciclo entre aprovar e emitir.
 */
export function AcoesDoFluxo({ contratoId, versao, pendencias, alterado, temFinal, modeloNaoValidado }: { contratoId: string; versao: ContratoVersao; pendencias: readonly Pendencia[]; alterado: boolean; temFinal: boolean; modeloNaoValidado: boolean }) {
  const [devolvendo, setDevolvendo] = useState(false);
  if (versao.situacao !== 'em_elaboracao') return null;
  const bloqueiaFinal = bloqueiaAlgo(pendencias, 'emissão final');
  return (
    <div className="grid gap-3">
      <ol className="grid gap-1 text-[13px]">
        {[
          ['rascunho', '1. Conferir os dados e enviar para revisão'],
          ['em_revisao', '2. Emitir o documento final'],
          ['em_revisao', '3. Aprovar para envio'],
          ['aprovado_envio', '4. Registrar o envio (na ficha)'],
          ['enviado_assinatura', '5. Registrar a assinatura (na ficha)'],
        ].map(([fluxo, texto], indice) => (
          <li key={texto} className={versao.fluxo === fluxo && !(indice === 2 && !temFinal) && !(indice === 1 && temFinal) ? 'font-semibold' : 'text-ink-soft'}>
            {texto}
          </li>
        ))}
      </ol>
      {versao.fluxo === 'rascunho' && (
        <Button disabled={alterado || bloqueiaAlgo(pendencias, 'envio para revisão')} onClick={() => void executar(() => enviarParaRevisao(contratoId), 'Enviado para revisão.')}>
          <Send aria-hidden />
          Enviar para revisão
        </Button>
      )}
      {(versao.fluxo === 'rascunho' || versao.fluxo === 'em_revisao') && (
        <BotoesDeEmissao podeFinal={versao.fluxo === 'em_revisao' && !bloqueiaFinal} motivoSemFinal={versao.fluxo === 'rascunho' ? 'O final vem depois de enviar para revisão.' : bloqueiaFinal ? 'Resolva as pendências que bloqueiam a emissão final.' : null} modeloNaoValidado={modeloNaoValidado} aoEmitir={(final, opcoes) => emitirContrato(contratoId, final, opcoes)} />
      )}
      {versao.fluxo === 'em_revisao' && (
        <Button disabled={!temFinal || bloqueiaAlgo(pendencias)} onClick={() => void executar(() => aprovarParaEnvio(contratoId), 'Aprovado para envio. A aprovação ficou registrada com o seu nome.')}>
          <CheckCheck aria-hidden />
          Aprovar para envio
        </Button>
      )}
      {(versao.fluxo === 'em_revisao' || versao.fluxo === 'aprovado_envio' || versao.fluxo === 'enviado_assinatura') && (
        <Button variante="secundario" onClick={() => setDevolvendo(true)}>
          <CornerDownLeft aria-hidden />
          Devolver para rascunho
        </Button>
      )}
      {versao.devolucao_motivo && versao.fluxo === 'rascunho' && <p className="text-xs text-err">Devolvido: {versao.devolucao_motivo}</p>}
      <Confirmacao aberto={devolvendo} aoFechar={() => setDevolvendo(false)} titulo="Devolver para rascunho?" texto="Nada é apagado (RN-11.08). O documento final emitido continua guardado, e um novo será emitido depois." rotuloConfirmar="Devolver" pedirMotivo aoConfirmar={(motivo) => { setDevolvendo(false); void executar(() => devolverParaRascunho(contratoId, motivo), 'Devolvido para rascunho.'); }} />
    </div>
  );
}
