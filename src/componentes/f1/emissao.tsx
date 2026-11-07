'use client';

import { useState } from 'react';
import { FileCheck2, FileText } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Textarea } from '@/componentes/ui/textarea';
import type { DocumentoEmitido } from '@/dados/tipos/contrato';
import { mensagemDoErro } from '@/dados/erros';
import { formatarDataHora } from '@/lib/formatacao';
import { aviso } from '@/componentes/padroes/aviso';

/** T10.06 e T11.05: emitir rascunho (marca d'água) ou final; modelo não validado pede confirmação e motivo (RN-09.13). */
export function BotoesDeEmissao({ podeFinal, motivoSemFinal, modeloNaoValidado, aoEmitir }: { podeFinal: boolean; motivoSemFinal: string | null; modeloNaoValidado: boolean; aoEmitir: (final: boolean, opcoes: { confirmarModeloNaoValidado?: boolean; motivo?: string }) => Promise<unknown> }) {
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const emitir = async (final: boolean, opcoes = {}) => {
    try {
      await aoEmitir(final, opcoes);
      aviso(final ? 'Documento final emitido.' : 'Rascunho emitido, com marca d’água.');
      return true;
    } catch (problema) {
      aviso(mensagemDoErro(problema));
      return false;
    }
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variante="secundario" onClick={() => void emitir(false)}>
          <FileText aria-hidden />
          Emitir rascunho
        </Button>
        <Button disabled={!podeFinal} onClick={() => (modeloNaoValidado ? setConfirmando(true) : void emitir(true))}>
          <FileCheck2 aria-hidden />
          Emitir final
        </Button>
      </div>
      {!podeFinal && motivoSemFinal && <p className="text-xs text-ink-soft">{motivoSemFinal}</p>}
      <JanelaFormulario
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Emitir com modelo não validado"
        rotuloSalvar="Emitir com modelo não validado"
        aoEnviar={(evento) => {
          evento.preventDefault();
          if (!motivo.trim()) return setErro('Diga o motivo.');
          void emitir(true, { confirmarModeloNaoValidado: true, motivo }).then((ok) => ok && setConfirmando(false));
        }}
      >
        <div className="grid gap-3">
          <Faixa tipo="atencao">O modelo ainda não foi validado pelo jurídico. O documento sai com esse aviso, e o motivo fica registrado.</Faixa>
          <Campo id="emissao-motivo" rotulo="Motivo" obrigatorio>
            {(controle) => <Textarea {...controle} rows={3} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
          </Campo>
          {erro && <MensagemErro>{erro}</MensagemErro>}
        </div>
      </JanelaFormulario>
    </div>
  );
}

export function ListaDeEmissoes({ documentos }: { documentos: readonly DocumentoEmitido[] }) {
  if (!documentos.length) return <p className="text-[13px] text-ink-soft">Nenhum documento emitido ainda.</p>;
  return (
    <ul className="grid gap-1.5 text-[13px]">
      {documentos.map((documento) => (
        <li key={documento.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-line bg-paper px-3 py-2">
          <LinkCentral href={`/documentos/${documento.id}`} className="font-semibold underline">
            {documento.codigo} · emissão {documento.numero_emissao}
          </LinkCentral>
          <span className="text-ink-soft">{documento.final ? 'Final' : 'Rascunho'}</span>
          {documento.enviado && <span className="text-ink-soft">Enviado</span>}
          {documento.modelo_nao_validado_confirmado && <span className="text-warn">Modelo não validado</span>}
          <span className="text-xs text-ink-soft">{formatarDataHora(documento.emitido_em)}</span>
        </li>
      ))}
    </ul>
  );
}
