'use client';

/**
 * Os arquivos da biblioteca (M08) ligados a um registro de outro módulo. O vínculo se faz na ficha do arquivo
 * (RN-08.05); aqui só se lê. Os links antigos do Drive (`anexo_link`) continuam ao lado até migrarem.
 */
import { FileText } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { useConsulta } from '@/dados/use-consulta';
import { arquivosDoRegistro, ROTULOS_TIPO_ARQUIVO } from '@/dominio/biblioteca';

export function ArquivosDaBiblioteca({ tipo, id, nome }: { tipo: string; id: string; nome: string }) {
  const consulta = useConsulta(() => arquivosDoRegistro(tipo, id), [tipo, id]);
  const linhas = consulta.dados ?? [];
  return (
    <section aria-labelledby={`biblioteca-${id}`} className="grid gap-2" data-arquivos-da-biblioteca>
      <h3 id={`biblioteca-${id}`} className="text-sm font-semibold">
        Arquivos da biblioteca
      </h3>
      {consulta.estado === 'carregando' && !consulta.dados ? null : linhas.length ? (
        <ul className="grid gap-2">
          {linhas.map(({ arquivo, vinculo }) => (
            <li key={vinculo.id} className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-1 text-[13px] md:py-2">
              <FileText className="size-4 shrink-0 text-ink-soft" aria-hidden />
              <LinkCentral href={`/marketing/arquivos/${arquivo.id}`} className="flex min-h-11 min-w-0 flex-1 items-center truncate font-medium underline-offset-2 hover:underline md:min-h-0">
                {arquivo.titulo}
              </LinkCentral>
              <span className="shrink-0 text-xs text-ink-soft">
                {ROTULOS_TIPO_ARQUIVO[arquivo.tipo]} · v{arquivo.versao_atual}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft">Nenhum arquivo da biblioteca ligado a {nome}.</p>
      )}
      <p className="text-xs text-ink-soft">
        Para ligar um arquivo, abra-o na{' '}
        <LinkCentral href="/marketing" className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-2 md:min-h-0 md:min-w-0">
          Biblioteca
        </LinkCentral>{' '}
        e use “Vincular”.
      </p>
    </section>
  );
}
