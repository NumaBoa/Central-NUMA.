'use client';

import { useEffect, useState } from 'react';
import { gravarMeta, lerMeta } from '@/dados/meta';
import { deveMostrarAbertura, duracaoDaAbertura, modoDaAbertura, SAIDA_ABERTURA_MS } from '@/dominio/abertura';
import { hojeISO } from '@/lib/datas';
import { LinhasCalmas } from './linhas-calmas';
import { Logo } from './logo';

type Etapa = 'decidindo' | 'na-tela' | 'saindo' | 'encerrada';

/** Tela de abertura (18 §10.1): uma vez por dia, até 1,6s; clique ou tecla pula. */
export function Abertura() {
  const [etapa, setEtapa] = useState<Etapa>('decidindo');
  const [semMovimento, setSemMovimento] = useState(false);

  useEffect(() => {
    const liberarMoldura = () => document.documentElement.removeAttribute('data-abertura');
    const hoje = hojeISO();
    const modo = modoDaAbertura(window.location.search);

    if (!deveMostrarAbertura(lerMeta().ultima_abertura, hoje, modo)) {
      liberarMoldura();
      setEtapa('encerrada');
      return;
    }

    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setSemMovimento(reduzir);
    setEtapa('na-tela');

    let saida: ReturnType<typeof setTimeout> | undefined;
    function encerrar() {
      clearTimeout(limite);
      window.removeEventListener('click', encerrar);
      window.removeEventListener('keydown', encerrar);
      gravarMeta({ ultima_abertura: hoje });
      liberarMoldura();
      setEtapa('saindo');
      saida = setTimeout(() => setEtapa('encerrada'), reduzir ? 0 : SAIDA_ABERTURA_MS);
    }

    const duracao = duracaoDaAbertura(reduzir, modo);
    const limite = duracao === null ? undefined : setTimeout(encerrar, duracao);
    window.addEventListener('click', encerrar);
    window.addEventListener('keydown', encerrar);

    return () => {
      clearTimeout(limite);
      clearTimeout(saida);
      window.removeEventListener('click', encerrar);
      window.removeEventListener('keydown', encerrar);
    };
  }, []);

  if (etapa === 'decidindo' || etapa === 'encerrada') return null;

  return (
    <div className="abertura" data-saindo={etapa === 'saindo' ? '' : undefined}>
      <LinhasCalmas animada={!semMovimento} />
      <Logo className="relative z-[1] text-[72px] md:text-[96px]" pontoClassName="abertura-ponto" />
      <p className="abertura-frase relative z-[1] text-center text-base leading-6 text-ink-soft md:text-[15px]">Tecnologia que simplifica a vida.</p>
    </div>
  );
}
