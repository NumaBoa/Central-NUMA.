'use client';

import { useEffect, useRef } from 'react';
import { embaracoDoFio } from '@/dominio/abertura';
import { cn } from '@/lib/utils';

type Linha = {
  base: number;
  amp: number;
  freq: number;
  ph: number;
  sp: number;
  R: number;
  lk: number;
  lph: number;
  destaque: boolean;
};

/** Fios gerados com os mesmos parâmetros do site "Numa · Estúdio de software" (18 §2.2). */
function gerarLinhas(largura: number, altura: number): Linha[] {
  const quantidade = largura < 700 ? 9 : 14;
  let semente = 7;
  const sortear = () => {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };
  return Array.from({ length: quantidade }, (_, i) => ({
    base: altura * (0.58 + (i / (quantidade - 1)) * 0.4),
    amp: 8 + sortear() * 14,
    freq: 0.0024 + sortear() * 0.002,
    ph: sortear() * 6.28,
    sp: 0.00018 + sortear() * 0.0002,
    R: 20 + sortear() * 30,
    lk: 0.028 + sortear() * 0.03,
    lph: sortear() * 6.28,
    destaque: i === Math.round(quantidade * 0.5),
  }));
}

/** Fios espresso e um fio índigo que se desembaraça. Sem animação, desenha a imagem estática. */
export function LinhasCalmas({ animada = true, className }: { animada?: boolean; className?: string }) {
  const referencia = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = referencia.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;

    const tokens = getComputedStyle(document.documentElement);
    const corFio = tokens.getPropertyValue('--line').trim();
    const corDestaque = tokens.getPropertyValue('--indigo').trim();
    let largura = 0;
    let altura = 0;
    let linhas: Linha[] = [];
    let quadro = 0;

    function montar() {
      const caixa = tela!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = caixa.width;
      altura = caixa.height;
      tela!.width = largura * dpr;
      tela!.height = altura * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      linhas = gerarLinhas(largura, altura);
    }

    function desenhar(tempo: number, embaraco: number) {
      ctx!.clearRect(0, 0, largura, altura);
      const pontos = Math.max(90, Math.round(largura / 7));
      for (const linha of linhas) {
        ctx!.beginPath();
        for (let j = 0; j <= pontos; j++) {
          const x0 = (j / pontos) * (largura + 80) - 40;
          const onda = Math.sin(x0 * linha.freq + linha.ph + tempo * linha.sp) * linha.amp;
          const angulo = x0 * linha.lk + linha.lph + tempo * 0.0006;
          const x = x0 + embaraco * linha.R * Math.cos(angulo);
          const y = linha.base + onda + embaraco * linha.R * Math.sin(angulo) * 1.15;
          if (j === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.globalAlpha = linha.destaque ? 0.85 : 1;
        ctx!.strokeStyle = linha.destaque ? corDestaque : corFio;
        ctx!.lineWidth = linha.destaque ? 2 : 1.1;
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
    }

    montar();
    const inicio = performance.now();
    function animar(agora: number) {
      const tempo = agora - inicio;
      desenhar(tempo, embaracoDoFio(tempo));
      quadro = requestAnimationFrame(animar);
    }
    if (animada) {
      desenhar(0, 1);
      quadro = requestAnimationFrame(animar);
    } else {
      desenhar(0, 0);
    }

    function aoRedimensionar() {
      montar();
      if (!animada) desenhar(0, 0);
    }
    window.addEventListener('resize', aoRedimensionar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', aoRedimensionar);
    };
  }, [animada]);

  return <canvas ref={referencia} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full opacity-90', className)} />;
}
