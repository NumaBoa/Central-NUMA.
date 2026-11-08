'use client';

import { useState, type ReactNode } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { aviso } from '@/componentes/padroes/aviso';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { adicionarLinkAoRegistro, linksDoRegistro, removerLinkDoRegistro } from '@/dominio/anexos-do-registro';

/** Os links do Drive de um registro (D23). `extra` são os arquivos que vêm do próprio registro, como o assinado de cada versão. */
export function AbaArquivosDoRegistro({ tipo, id, extra, somenteLeitura = false }: { tipo: string; id: string; extra?: ReactNode; somenteLeitura?: boolean }) {
  const consulta = useConsulta(() => linksDoRegistro(tipo, id), [tipo, id]);
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    try {
      await adicionarLinkAoRegistro(tipo, id, link);
      setLink('');
      setErro(null);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  const temLinks = Boolean(consulta.dados?.length);
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-paper p-4 md:p-5">
      {extra}
      {temLinks ? (
        <ul className="grid gap-1">
          {consulta.dados?.map((anexo) => (
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
        !extra && <p className="text-sm text-ink-soft">Nenhum link por enquanto.</p>
      )}
      {!somenteLeitura && (
        <Campo id={`${tipo}-link`} rotulo="Link do Drive" {...(erro ? { erro } : {})}>
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
