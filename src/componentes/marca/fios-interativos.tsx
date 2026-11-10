'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type Fio = { base: number; amp: number; freq: number; ph: number; sp: number; destaque: boolean };

/** Fios pela tela inteira, com os mesmos sorteios dos fios da abertura (18 §2.2). */
function gerarFios(largura: number, altura: number): Fio[] {
  const espaco = largura < 700 ? 34 : 30;
  const quantidade = Math.ceil(altura / espaco) + 2;
  let semente = 11;
  const sortear = () => {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };
  const destaque = Math.round(quantidade * 0.68);
  return Array.from({ length: quantidade }, (_, i) => ({
    base: (i - 1) * espaco + sortear() * 6,
    amp: 4 + sortear() * 7,
    freq: 0.0024 + sortear() * 0.002,
    ph: sortear() * 6.28,
    sp: 0.00012 + sortear() * 0.00014,
    destaque: i === destaque,
  }));
}

/**
 * Fundo do login: passe o cursor nos fios e o atrito aparece, e logo se desfaz.
 * Sem movimento (prefers-reduced-motion), desenha uma vez e fica parado.
 */
export function FiosInterativos({ className }: { className?: string }) {
  const referencia = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = referencia.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;

    const tokens = getComputedStyle(document.documentElement);
    const corFio = tokens.getPropertyValue('--line').trim();
    const corDestaque = tokens.getPropertyValue('--indigo').trim();
    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let largura = 0;
    let altura = 0;
    let fios: Fio[] = [];
    let quadro = 0;
    // Onde o cursor está (suavizado) e quanto atrito há agora, de 0 a 1.
    const cursor = { x: -9999, y: -9999, alvoX: -9999, alvoY: -9999, atrito: 0 };

    function montar() {
      const caixa = tela!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = caixa.width;
      altura = caixa.height;
      tela!.width = largura * dpr;
      tela!.height = altura * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      fios = gerarFios(largura, altura);
    }

    function desenhar(tempo: number) {
      ctx!.clearRect(0, 0, largura, altura);
      const pontos = Math.max(80, Math.round(largura / 8));
      const raio = largura < 700 ? 90 : 140;
      for (const fio of fios) {
        ctx!.beginPath();
        for (let j = 0; j <= pontos; j++) {
          const x0 = (j / pontos) * (largura + 80) - 40;
          let y = fio.base + Math.sin(x0 * fio.freq + fio.ph + tempo * fio.sp) * fio.amp;
          let x = x0;
          if (cursor.atrito > 0.001) {
            const dx = x0 - cursor.x;
            const dy = y - cursor.y;
            const perto = Math.exp(-(dx * dx + dy * dy) / (2 * raio * raio)) * cursor.atrito;
            if (perto > 0.002) {
              const angulo = x0 * 0.03 + fio.ph + tempo * 0.003;
              x += Math.cos(angulo) * 26 * perto;
              y += Math.sin(angulo * 1.3) * 30 * perto;
            }
          }
          if (j === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.globalAlpha = fio.destaque ? 0.85 : 1;
        ctx!.strokeStyle = fio.destaque ? corDestaque : corFio;
        ctx!.lineWidth = fio.destaque ? 1.6 : 1;
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
    }

    montar();
    if (parado) {
      desenhar(0);
    } else {
      const inicio = performance.now();
      const animar = (agora: number) => {
        cursor.x += (cursor.alvoX - cursor.x) * 0.18;
        cursor.y += (cursor.alvoY - cursor.y) * 0.18;
        cursor.atrito *= 0.965;
        desenhar(agora - inicio);
        quadro = requestAnimationFrame(animar);
      };
      quadro = requestAnimationFrame(animar);
    }

    function aoMover(evento: PointerEvent) {
      if (cursor.alvoX < -9000) {
        cursor.x = evento.clientX;
        cursor.y = evento.clientY;
      }
      const passo = Math.hypot(evento.clientX - cursor.alvoX, evento.clientY - cursor.alvoY);
      cursor.alvoX = evento.clientX;
      cursor.alvoY = evento.clientY;
      cursor.atrito = Math.min(1, cursor.atrito + Math.min(passo, 60) / 220);
    }
    function aoRedimensionar() {
      montar();
      if (parado) desenhar(0);
    }
    if (!parado) window.addEventListener('pointermove', aoMover);
    window.addEventListener('resize', aoRedimensionar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('resize', aoRedimensionar);
    };
  }, []);

  return <canvas ref={referencia} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)} />;
}
