'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { executar } from '@/componentes/f1/apoio';
import { DocumentoRenderizadoVista } from '@/componentes/f1/documento';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Button } from '@/componentes/ui/button';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { emissaoDoSnapshot, registrarArquivoDoDocumento } from '@/dominio/documentos-emitidos';
import { LEMBRETE_LINK_DRIVE } from '@/dominio/link-drive';
import { formatarDataHora } from '@/lib/formatacao';

/** O documento como foi emitido (RT-10). O PDF é a impressão do navegador; o arquivo salvo vai para o Drive (D6). */
export function VistaDoDocumento() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => repositorios.documento_emitido.obter(id), [id]);
  const [arquivo, setArquivo] = useState('');
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro aoTentarDeNovo={consulta.recarregar} />;
  const documento = consulta.dados;
  if (!documento) return <EstadoVazio icone={TriangleAlert} titulo="Documento não encontrado." texto="Ele pode ter sido removido." />;
  const emissao = emissaoDoSnapshot(documento);
  return (
    <>
      <style>{'@media print { [data-menu-lateral], header, nav, .nao-imprimir { display: none !important } main { padding: 0 !important } }'}</style>
      <div className="nao-imprimir">
        <CabecalhoPagina kicker={`${documento.codigo} · emissão ${documento.numero_emissao}`} titulo={emissao.titulo} resumo={`${documento.final ? 'Final' : 'Rascunho'} · emitido em ${formatarDataHora(documento.emitido_em)}${emissao.modelo.codigo ? ` · ${emissao.modelo.codigo} v${emissao.modelo.versao}` : ''}`} acoes={<Button variante="secundario" onClick={() => window.print()}><Printer aria-hidden />Imprimir ou salvar em PDF</Button>} />
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Campo id="documento-arquivo" rotulo="PDF no Drive" ajuda={documento.arquivo_url ? `Registrado: ${documento.arquivo_url}` : LEMBRETE_LINK_DRIVE}>
            {(controle) => <EntradaLinkDrive {...controle} link={arquivo} value={arquivo} onChange={(evento) => setArquivo(evento.target.value)} placeholder="Cole o link do PDF salvo" />}
          </Campo>
          <Button variante="secundario" disabled={!arquivo.trim()} onClick={() => void executar(() => registrarArquivoDoDocumento(documento.id, arquivo), 'Link do PDF registrado.')}>Registrar link</Button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Volta para{' '}
          <LinkCentral className="underline" href={documento.registro_tipo === 'proposta_versao' ? '/comercial/propostas' : '/contratos'}>
            {documento.registro_tipo === 'proposta_versao' ? 'Propostas' : 'Contratos'}
          </LinkCentral>
        </p>
      </div>
      <div className="mt-5">
        <DocumentoRenderizadoVista nos={emissao.nos} rascunho={emissao.rascunho} aviso={emissao.aviso} />
      </div>
    </>
  );
}
