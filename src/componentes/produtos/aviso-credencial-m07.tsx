'use client';

import { useState } from 'react';
import { Faixa } from '@/componentes/padroes/faixa';
import { AVISO_CREDENCIAL, pareceCredencial } from '@/dominio/segredos';

/**
 * RT-14 nos formulários do M07: texto que parece segredo avisa uma vez; enviar de novo, com o mesmo texto, segue.
 * Mesmo comportamento do motivo em `Confirmacao`.
 */
export function useAvisoDeCredencial() {
  const [avisado, setAvisado] = useState<string | null>(null);
  return {
    /** Verdadeiro quando pode seguir. */
    conferir(textos: readonly string[]): boolean {
      const suspeitos = textos.filter(pareceCredencial).join('|');
      if (suspeitos && suspeitos !== avisado) {
        setAvisado(suspeitos);
        return false;
      }
      return true;
    },
    limpar: () => setAvisado(null),
    faixa: avisado ? (
      <Faixa tipo="atencao" className="mb-4">
        <span role="alert">{AVISO_CREDENCIAL} Para manter o texto, envie de novo.</span>
      </Faixa>
    ) : null,
  };
}
