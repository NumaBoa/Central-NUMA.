'use client';

import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Faixa } from './faixa';

type PreviaProps = {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  texto: string;
  colunas: readonly string[];
  linhas: ReadonlyArray<readonly string[]>;
  avisos?: readonly string[];
  rotuloConfirmar: string;
  aoConfirmar: () => void;
};

/** Prévia (P6): mostra exatamente o que será criado ou alterado. Só depois de confirmar o sistema grava. */
export function Previa({ aberto, aoFechar, titulo, texto, colunas, linhas, avisos = [], rotuloConfirmar, aoConfirmar }: PreviaProps) {
  return (
    <Dialog open={aberto} onOpenChange={(proximo) => !proximo && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription className="mt-3 leading-[1.6]">{texto}</DialogDescription>
        <div className="faixa-rolagem mt-4 rounded-md border border-line">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                {colunas.map((coluna, i) => (
                  <th key={coluna} scope="col" className={`bg-mist px-3 py-2 font-semibold whitespace-nowrap text-ink-soft first:rounded-tl-md last:rounded-tr-md ${i === 0 ? 'text-left' : 'text-right'}`}>
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha[0]}>
                  {linha.map((celula, i) => (
                    <td key={i} className={`border-t border-line px-3 py-2 ${i === 0 ? 'text-left font-semibold' : 'text-right tabular-nums'}`}>
                      {celula}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {avisos.map((aviso) => (
          <Faixa key={aviso} tipo="atencao" className="mt-3">
            {aviso}
          </Faixa>
        ))}
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button onClick={aoConfirmar}>{rotuloConfirmar}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
