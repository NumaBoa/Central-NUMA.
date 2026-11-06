'use client';

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { assinarDados } from './armazenamento';

export type ResultadoConsulta<T> =
  | { estado: 'carregando'; dados?: undefined; erro?: undefined }
  | { estado: 'pronto'; dados: T; erro?: undefined }
  | { estado: 'erro'; dados?: undefined; erro: unknown };

/**
 * Lê dados pelos repositórios e atualiza sozinho quando eles mudam, nesta aba ou em outra.
 * Devolve os estados que toda tela precisa mostrar: carregando, pronto e erro (02 §5).
 */
export function useConsulta<T>(consultar: () => Promise<T>, dependencias: DependencyList = []): ResultadoConsulta<T> & { recarregar: () => void } {
  const [resultado, setResultado] = useState<ResultadoConsulta<T>>({ estado: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const consultaAtual = useRef(consultar);
  consultaAtual.current = consultar;

  useEffect(() => {
    let ultimaBusca = 0;
    function buscar() {
      const busca = ++ultimaBusca;
      consultaAtual.current().then(
        (dados) => {
          if (busca === ultimaBusca) setResultado({ estado: 'pronto', dados });
        },
        (erro: unknown) => {
          if (busca === ultimaBusca) setResultado({ estado: 'erro', erro });
        },
      );
    }
    buscar();
    const cancelar = assinarDados(buscar);
    return () => {
      ultimaBusca = -1;
      cancelar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a consulta muda a cada render; as dependências dizem quando refazer
  }, [tentativa, ...dependencias]);

  const recarregar = useCallback(() => {
    setResultado({ estado: 'carregando' });
    setTentativa((atual) => atual + 1);
  }, []);

  return { ...resultado, recarregar };
}
