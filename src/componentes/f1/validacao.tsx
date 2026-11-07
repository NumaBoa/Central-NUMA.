'use client';

import { useState } from 'react';
import { Check, CornerDownLeft, Send, ShieldCheck } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Textarea } from '@/componentes/ui/textarea';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Validacao } from '@/dados/tipos/legal';
import { decidirValidacao, enviarParaValidacao, type TipoValidavel } from '@/dominio/legal';
import { formatarDataHora } from '@/lib/formatacao';
import { CartaoDePainel, executar } from './apoio';

const nome = (pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[], id: string | null) => (id ? (pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida') : 'Sistema');

/**
 * A validação fica no próprio registro (decisão vigente 2): sem fila, com quem pediu, quem decidiu, data,
 * observações e motivo obrigatório na devolução (RN-09.03).
 */
export function PainelDeValidacao({ tipo, registroId, ultima, pessoas, podeEnviar, validado, avisoValidar, naoEnviar }: { tipo: TipoValidavel; registroId: string; ultima: Validacao | null; pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]; podeEnviar: boolean; validado: boolean; avisoValidar?: string | null; naoEnviar?: string | null }) {
  const [observacoes, setObservacoes] = useState('');
  const [devolvendo, setDevolvendo] = useState(false);
  const pendente = ultima?.situacao === 'pendente';
  return (
    <CartaoDePainel titulo="Validação">
      <div className="grid gap-3 text-[13px]">
        {pendente ? <EtiquetaSituacao tipo="atencao">Aguardando validação</EtiquetaSituacao> : validado ? <EtiquetaSituacao tipo="sucesso" icone={ShieldCheck}>Validado</EtiquetaSituacao> : <EtiquetaSituacao tipo="neutro">Não validado</EtiquetaSituacao>}
        {avisoValidar && <Faixa tipo="atencao">{avisoValidar}</Faixa>}
        {ultima && (
          <dl className="grid gap-1 text-ink-soft">
            <div>
              <dt className="inline">Pedido por </dt>
              <dd className="inline">
                {nome(pessoas, ultima.solicitado_por)} em {formatarDataHora(ultima.solicitado_em)}
              </dd>
            </div>
            {ultima.decidido_em && (
              <div>
                <dt className="inline">{ultima.situacao === 'validado' ? 'Validado por ' : 'Devolvido por '}</dt>
                <dd className="inline">
                  {nome(pessoas, ultima.decidido_por)} em {formatarDataHora(ultima.decidido_em)}
                </dd>
              </div>
            )}
            {ultima.observacoes && <div>Observações: {ultima.observacoes}</div>}
            {ultima.motivo_devolucao && <div className="font-medium text-err">Motivo da devolução: {ultima.motivo_devolucao}</div>}
          </dl>
        )}
        {pendente && ultima && (
          <>
            <Campo rotulo="Observações da validação">{(controle) => <Textarea {...controle} rows={2} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} />}</Campo>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void executar(() => decidirValidacao(ultima.id, 'validar', { observacoes }), 'Validado.')}>
                <Check aria-hidden />
                Validar
              </Button>
              <Button variante="secundario" onClick={() => setDevolvendo(true)}>
                <CornerDownLeft aria-hidden />
                Devolver
              </Button>
            </div>
          </>
        )}
        {podeEnviar && !pendente && (
          naoEnviar ? <Faixa tipo="info">{naoEnviar}</Faixa> : (
            <Button variante="secundario" className="justify-self-start" onClick={() => void executar(() => enviarParaValidacao(tipo, registroId), 'Enviado para validação.')}>
              <Send aria-hidden />
              Enviar para validação
            </Button>
          )
        )}
      </div>
      {ultima && (
        <Confirmacao
          aberto={devolvendo}
          aoFechar={() => setDevolvendo(false)}
          titulo="Devolver para rascunho?"
          texto="A versão volta a ser editável, e o motivo fica registrado aqui."
          rotuloConfirmar="Devolver"
          pedirMotivo
          aoConfirmar={(motivo) => {
            setDevolvendo(false);
            void executar(() => decidirValidacao(ultima.id, 'devolver', { motivo, observacoes }), 'Devolvido para rascunho.');
          }}
        />
      )}
    </CartaoDePainel>
  );
}
