'use client';

import { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { aviso } from '@/componentes/padroes/aviso';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { Tabela } from '@/dados/tabelas';
import { useConsulta } from '@/dados/use-consulta';
import { historicoDoRegistro } from '@/dominio/historico';
import { adicionarLinkAoRegistro, linksDoRegistro, removerLinkDoRegistro, type RegistroComArquivos } from '@/dominio/operacao-arquivos';

/** Links do Drive do registro (D6), como nas fichas de ferramenta, até a Biblioteca (M08). */
export function AbaArquivosDoRegistro({ tipo, id, somenteLeitura = false }: { tipo: RegistroComArquivos; id: string; somenteLeitura?: boolean }) {
  const consulta = useConsulta(() => linksDoRegistro(tipo, id), [tipo, id]);
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  async function adicionar() {
    try {
      await adicionarLinkAoRegistro(tipo, id, link);
      setLink('');
      setErro(null);
      aviso('Link adicionado.');
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-paper p-4 md:p-5">
      {consulta.dados?.length ? (
        <ul className="grid gap-1" aria-label="Arquivos">
          {consulta.dados.map((anexo) => (
            <li key={anexo.id} className="flex items-center justify-between gap-2 text-[13px]">
              <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-1.5 underline underline-offset-2 md:min-h-0 [&_svg]:size-[14px] [&_svg]:shrink-0">
                <ExternalLink aria-hidden />
                <span className="truncate">{anexo.titulo}</span>
              </a>
              {!somenteLeitura && (
                <Button variante="icone" tamanho="icone" aria-label={`Tirar ${anexo.titulo}`} onClick={() => void removerLinkDoRegistro(anexo.id).catch((falha: unknown) => aviso(mensagemDoErro(falha)))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Nenhum link por enquanto.</p>
      )}
      {!somenteLeitura && (
        <Campo id={`${tipo}-link`} rotulo="Link do Drive" erro={erro ?? undefined}>
          {(controle) => (
            <div className="grid gap-2">
              <EntradaLinkDrive
                link={link}
                {...controle}
                value={link}
                onChange={(evento) => setLink(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault();
                    void adicionar();
                  }
                }}
              />
              <Button variante="secundario" tamanho="pequeno" className="justify-self-start" onClick={() => void adicionar()}>
                <Plus aria-hidden />
                Adicionar link
              </Button>
            </div>
          )}
        </Campo>
      )}
    </div>
  );
}

export function AbaHistoricoDoRegistro({ tabela, id }: { tabela: Tabela; id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro(tabela, id), [tabela, id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}
