'use client';

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type SerieDoGrafico = { id: string; nome: string; pontos: readonly { x: number; y: number | null }[] };

type GraficoLinhasProps = {
  /** Descrição para leitor de tela. A tabela completa fica sempre ao lado do gráfico. */
  rotulo: string;
  series: readonly SerieDoGrafico[];
  formatarY: (valor: number) => string;
  formatarX: (valor: number) => string;
  /** Para o título do eixo. */
  rotuloX: string;
  /** Marca o zero, como no resultado mensal × clientes. */
  linhaZero?: boolean;
  /** Retas entre os pontos: dá para ler qualquer x, não só os informados. */
  continuo?: boolean;
  /** Marcas verticais, como o ponto de equilíbrio. */
  marcas?: readonly { x: number; rotulo: string }[];
  altura?: number;
};

/**
 * Paleta validada (dataviz: CVD ΔE ≥ 8 entre vizinhas, contraste ≥ 3:1 sobre o papel). Segue sempre a mesma ordem, e cada
 * série também tem o seu traço: a cor nunca é o único jeito de saber qual é qual.
 */
export const CORES_DAS_SERIES = ['#4F52D9', '#0E8F86', '#C4641A', '#7A3FA8'] as const;
const TRACOS = [undefined, '7 4', '2 4', '10 3 2 3'] as const;

const MARGEM = { topo: 14, direita: 16, baixo: 44 };

/** Divisões "redondas": 1, 2 ou 5 × 10ⁿ. */
function escalaBonita(minimo: number, maximo: number, quantas: number): number[] {
  if (minimo === maximo) {
    const folga = Math.abs(minimo) || 1;
    return escalaBonita(minimo - folga, maximo + folga, quantas);
  }
  const bruto = (maximo - minimo) / Math.max(1, quantas);
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const fracao = bruto / potencia;
  const passo = (fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 5 ? 5 : 10) * potencia;
  const inicio = Math.floor(minimo / passo) * passo;
  const fim = Math.ceil(maximo / passo) * passo;
  const marcas: number[] = [];
  for (let valor = inicio; valor <= fim + passo / 2; valor += passo) marcas.push(Math.round(valor / passo) * passo);
  return marcas;
}

function valorEm(pontos: SerieDoGrafico['pontos'], x: number, continuo: boolean): number | null {
  const exato = pontos.find((ponto) => ponto.x === x);
  if (exato) return exato.y;
  if (!continuo) return null;
  const depois = pontos.findIndex((ponto) => ponto.x > x);
  if (depois <= 0) return null;
  const a = pontos[depois - 1]!;
  const b = pontos[depois]!;
  if (a.y === null || b.y === null) return null;
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** Desenhado a partir dos dados, sem biblioteca nova. Com teclado, as setas percorrem os pontos. */
export function GraficoLinhas({ rotulo, series, formatarY, formatarX, rotuloX, linhaZero = false, continuo = false, marcas = [], altura = 280 }: GraficoLinhasProps) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [foco, setFoco] = useState<number | null>(null);

  useLayoutEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;
    const medir = () => setLargura(elemento.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const xs = useMemo(() => [...new Set(series.flatMap((serie) => serie.pontos.map((ponto) => ponto.x)))].sort((a, b) => a - b), [series]);
  const valores = series.flatMap((serie) => serie.pontos.flatMap((ponto) => (ponto.y === null ? [] : [ponto.y])));
  if (!valores.length || !xs.length) return null;

  const ticksY = escalaBonita(Math.min(...valores, ...(linhaZero ? [0] : [])), Math.max(...valores, ...(linhaZero ? [0] : [])), altura < 240 ? 3 : 5);
  const larguraDoRotulo = Math.max(...ticksY.map((tick) => formatarY(tick).length)) * 7 + 10;
  const esquerda = Math.min(larguraDoRotulo, 92);
  const larguraUtil = Math.max(40, largura - esquerda - MARGEM.direita);
  const alturaUtil = altura - MARGEM.topo - MARGEM.baixo;
  const minX = xs[0] as number;
  const maxX = xs.at(-1) as number;
  const minY = ticksY[0] as number;
  const maxY = ticksY.at(-1) as number;
  const px = (x: number) => esquerda + (maxX === minX ? larguraUtil / 2 : ((x - minX) / (maxX - minX)) * larguraUtil);
  const py = (y: number) => MARGEM.topo + alturaUtil - ((y - minY) / (maxY - minY)) * alturaUtil;

  // Só os rótulos que cabem: nunca um sobre o outro.
  const espacoPorRotulo = Math.max(...xs.map((x) => formatarX(x).length)) * 7 + 12;
  const passoX = Math.max(1, Math.ceil(xs.length / Math.max(1, Math.floor(larguraUtil / espacoPorRotulo))));
  const ticksX = xs.filter((_, indice) => indice % passoX === 0);

  const xEmFoco = foco === null ? null : foco;
  const naPosicao = xEmFoco === null ? [] : series.map((serie, indice) => ({ serie, indice, y: valorEm(serie.pontos, xEmFoco, continuo) }));

  function aoMover(evento: PointerEvent<SVGSVGElement>) {
    const quadro = evento.currentTarget.getBoundingClientRect();
    const alvo = minX + ((evento.clientX - quadro.left - esquerda) / larguraUtil) * (maxX - minX);
    const limitado = Math.max(minX, Math.min(maxX, alvo));
    setFoco(continuo ? Math.round(limitado) : xs.reduce((maisPerto, x) => (Math.abs(x - limitado) < Math.abs(maisPerto - limitado) ? x : maisPerto), minX));
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
    evento.preventDefault();
    const indice = foco === null ? -1 : xs.findIndex((x) => x >= foco);
    const proximo = evento.key === 'ArrowRight' ? Math.min(xs.length - 1, indice + 1) : Math.max(0, indice <= 0 ? 0 : indice - 1);
    setFoco(xs[proximo] ?? null);
  }

  const dicaAEsquerda = xEmFoco !== null && px(xEmFoco) > largura / 2;

  return (
    <figure className="min-w-0">
      <div ref={caixa} className="relative rounded-md" tabIndex={0} role="group" aria-label={`${rotulo}. Use as setas para percorrer os pontos.`} onKeyDown={aoTeclar} onBlur={() => setFoco(null)}>
        {largura > 0 && (
          <svg width={largura} height={altura} role="img" aria-label={rotulo} onPointerMove={aoMover} onPointerLeave={() => setFoco(null)} className="block touch-pan-y">
            {ticksY.map((tick) => (
              <g key={tick}>
                <line x1={esquerda} x2={largura - MARGEM.direita} y1={py(tick)} y2={py(tick)} stroke="var(--line)" strokeWidth={1} />
                <text x={esquerda - 6} y={py(tick) + 4} textAnchor="end" fontSize={12} fill="var(--ink-soft)" className="tabular-nums">
                  {formatarY(tick)}
                </text>
              </g>
            ))}
            {linhaZero && minY <= 0 && maxY >= 0 && <line x1={esquerda} x2={largura - MARGEM.direita} y1={py(0)} y2={py(0)} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" />}
            {ticksX.map((x) => (
              <text key={x} x={px(x)} y={altura - MARGEM.baixo + 18} textAnchor="middle" fontSize={12} fill="var(--ink-soft)" className="tabular-nums">
                {formatarX(x)}
              </text>
            ))}
            <text x={esquerda + larguraUtil / 2} y={altura - 6} textAnchor="middle" fontSize={12} fill="var(--ink-soft)">
              {rotuloX}
            </text>
            {marcas.map((marca) => (
              <line key={`${marca.rotulo}-${marca.x}`} x1={px(marca.x)} x2={px(marca.x)} y1={MARGEM.topo} y2={MARGEM.topo + alturaUtil} stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="2 3">
                <title>{marca.rotulo}</title>
              </line>
            ))}
            {series.map((serie, indice) => {
              const cor = CORES_DAS_SERIES[indice % CORES_DAS_SERIES.length];
              // Mês sem valor interrompe a linha: não é zero.
              const trechos: { x: number; y: number }[][] = [[]];
              for (const ponto of serie.pontos) {
                if (ponto.y === null) trechos.push([]);
                else trechos.at(-1)?.push({ x: ponto.x, y: ponto.y });
              }
              return (
                <g key={serie.id}>
                  {trechos.map((trecho, posicao) =>
                    trecho.length > 1 ? <polyline key={posicao} points={trecho.map((ponto) => `${px(ponto.x)},${py(ponto.y)}`).join(' ')} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={TRACOS[indice % TRACOS.length]} /> : null,
                  )}
                  {serie.pontos.map((ponto) => (ponto.y === null ? null : <circle key={ponto.x} cx={px(ponto.x)} cy={py(ponto.y)} r={4} fill={cor} stroke="var(--paper)" strokeWidth={2} />))}
                </g>
              );
            })}
            {xEmFoco !== null && (
              <g pointerEvents="none">
                <line x1={px(xEmFoco)} x2={px(xEmFoco)} y1={MARGEM.topo} y2={MARGEM.topo + alturaUtil} stroke="var(--ink-soft)" strokeWidth={1} />
                {naPosicao.map(({ serie, indice, y }) => (y === null ? null : <circle key={serie.id} cx={px(xEmFoco)} cy={py(y)} r={5} fill={CORES_DAS_SERIES[indice % CORES_DAS_SERIES.length]} stroke="var(--paper)" strokeWidth={2} />))}
              </g>
            )}
          </svg>
        )}
        {xEmFoco !== null && largura > 0 && (
          <div role="status" className="pointer-events-none absolute top-1 z-[1] max-w-[240px] rounded-md border border-line bg-paper px-3 py-2 text-xs shadow-e2" style={dicaAEsquerda ? { right: Math.max(0, largura - px(xEmFoco) + 10) } : { left: px(xEmFoco) + 10 }}>
            <p className="font-semibold">{formatarX(xEmFoco)}</p>
            {naPosicao.map(({ serie, indice, y }) => (
              <p key={serie.id} className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: CORES_DAS_SERIES[indice % CORES_DAS_SERIES.length] }} />
                {series.length > 1 && <span className="min-w-0 truncate text-ink-soft">{serie.nome}:</span>}
                <span>{y === null ? 'Sem registro' : formatarY(y)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {series.map((serie, indice) => (
            <span key={serie.id} className="inline-flex items-center gap-1.5">
              <svg width="26" height="8" aria-hidden className="shrink-0">
                <line x1="1" x2="25" y1="4" y2="4" stroke={CORES_DAS_SERIES[indice % CORES_DAS_SERIES.length]} strokeWidth={2} strokeDasharray={TRACOS[indice % TRACOS.length]} />
              </svg>
              {serie.nome}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
