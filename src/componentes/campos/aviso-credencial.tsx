'use client';

import { useState } from 'react';
import { Faixa } from '@/componentes/padroes/faixa';
import { AVISO_CREDENCIAL, pareceCredencial } from '@/dominio/segredos';

/**
 * RT-14, nos diálogos: texto que parece senha ou token avisa e pede confirmação antes de gravar.
 * A primeira tentativa mostra o aviso; a segunda, com o mesmo texto, é a confirmação.
 */
export function useAvisoDeCredencial(textos: readonly string[]) {
  const chave = textos.join('\u0000');
  const [avisado, setAvisado] = useState<string | null>(null);
  const parece = textos.some(pareceCredencial);
  return {
    podeGravar: () => {
      if (!parece || avisado === chave) return true;
      setAvisado(chave);
      return false;
    },
    aviso: parece && avisado === chave ? <Faixa tipo="atencao">{AVISO_CREDENCIAL}</Faixa> : null,
  };
}
