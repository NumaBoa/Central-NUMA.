'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';
import { EtiquetasDosFiltros, type FiltroAtivo } from './filtros';
import { MenuSobreposto } from './menu-sobreposto';

type Mudar<F> = (parcial: Partial<F>) => void;

/** O que fica na linha enquanto couber. A ordem é do mais usado para o menos usado. */
export type SeletorEmLinha<F> = {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  /** O que o botão mostra: o valor escolhido. */
  valor: (filtros: F) => string;
  /** Fora do padrão: o botão fica em espresso e, dentro de "Filtros", conta no número do botão. */
  ativo: (filtros: F) => boolean;
  /** Quanto ocupa na linha, para saber o que cabe. */
  largura: number;
  /** Só faz sentido em algumas situações, como "Agrupar por" na lista. */
  visivel?: (filtros: F) => boolean;
  /** O mesmo conteúdo no menu da linha, em "Filtros" e na folha do celular. `fechar` só existe no menu da linha. */
  campos: (filtros: F, mudar: Mudar<F>, fechar: () => void) => ReactNode;
};

type FiltrosEmLinhaProps<F extends { busca: string }> = {
  filtros: F;
  aoMudar: Mudar<F>;
  aoLimpar: () => void;
  rotuloBusca: string;
  /** O texto de dentro da busca, quando "Buscar…" não basta. */
  placeholderBusca?: string;
  /** O nome do botão, quando não é "Filtros". */
  rotuloAvancados?: string;
  /** A largura do menu no computador, para os muitos campos caberem sem rolar. */
  larguraAvancados?: number;
  seletores: readonly SeletorEmLinha<F>[];
  /** O conteúdo de "Filtros". */
  avancados: (filtros: F, mudar: Mudar<F>) => ReactNode;
  quantosAvancados: (filtros: F) => number;
  /** À direita da linha, no computador: Quadro | Lista. */
  direita?: ReactNode;
  larguraDireita?: number;
  /** O que no celular só cabe na folha: Quadro | Lista. */
  soNaFolha?: (filtros: F, mudar: Mudar<F>) => ReactNode;
  ativos: readonly FiltroAtivo[];
  aoRemoverAtivo: (id: string) => void;
};

const BUSCA_MINIMA = 160;
const LARGURA_DO_BOTAO_FILTROS = 116;
const ESPACO = 8;

function useLarguraDoElemento() {
  const elemento = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    const atual = elemento.current;
    if (!atual) return;
    const medir = () => setLargura(atual.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(atual);
    return () => observador.disconnect();
  }, []);
  return { elemento, largura };
}

/** O botão de um seletor na linha: selecionado em espresso (18 §9.3). */
function SeletorNaLinha<F>({ seletor, filtros, aoMudar }: { seletor: SeletorEmLinha<F>; filtros: F; aoMudar: Mudar<F> }) {
  const Icone = seletor.icone;
  const valor = seletor.valor(filtros);
  return (
    <MenuSobreposto
      titulo={seletor.rotulo}
      largura={340}
      gatilho={
        <button
          type="button"
          aria-label={`${seletor.rotulo}: ${valor}`}
          className={cn(
            'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 [&_svg]:size-[15px] [&_svg]:shrink-0',
            seletor.ativo(filtros) ? 'border-espresso bg-espresso text-linen' : 'border-line bg-paper text-ink hover:border-ink-soft',
          )}
        >
          <Icone aria-hidden />
          <span className="max-w-36 truncate">{valor}</span>
          <ChevronDown aria-hidden />
        </button>
      }
    >
      {/* O menu já tem o título: o rótulo do primeiro grupo fica só para o leitor de tela. */}
      {(fechar) => <div className="grid gap-3.5 px-1 pb-2 md:px-3 [&>fieldset:first-child>legend]:sr-only">{seletor.campos(filtros, aoMudar, fechar)}</div>}
    </MenuSobreposto>
  );
}

const nada = () => {};

/** Celular: a folha inferior trabalha num rascunho, e só "Aplicar" muda a tela. */
function FolhaDeFiltros<F>({ filtros, aoAplicar, aoLimpar, conteudo, botao }: { filtros: F; aoAplicar: (rascunho: F) => void; aoLimpar: () => void; conteudo: (rascunho: F, mudar: Mudar<F>) => ReactNode; botao: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const [rascunho, setRascunho] = useState(filtros);
  return (
    <Dialog
      open={aberta}
      onOpenChange={(proximo) => {
        if (proximo) setRascunho(filtros);
        setAberta(proximo);
      }}
    >
      <DialogTrigger asChild>{botao}</DialogTrigger>
      <DialogContent semFechar>
        <div className="flex items-center justify-between gap-3 pb-3">
          <DialogTitle className="text-[17px] leading-6 tracking-[-.01em]">Filtros</DialogTitle>
          <BotaoFechar onClick={() => setAberta(false)} />
        </div>
        <div className="grid gap-[18px]">{conteudo(rascunho, (parcial) => setRascunho((atual) => ({ ...atual, ...parcial })))}</div>
        <div className="acoes-dialogo">
          <Button
            variante="secundario"
            onClick={() => {
              aoLimpar();
              setAberta(false);
            }}
          >
            Limpar
          </Button>
          <Button
            onClick={() => {
              aoAplicar(rascunho);
              setAberta(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Filtros do M03, numa linha só: busca, seletores, "Filtros" e o que vier à direita. Sem espaço, o seletor
 * menos usado passa para dentro de "Filtros". No celular, sobram a busca e "Filtros"; o resto vai para a folha.
 */
export function FiltrosEmLinha<F extends { busca: string }>({ filtros, aoMudar, aoLimpar, rotuloBusca, placeholderBusca = 'Buscar…', rotuloAvancados = 'Filtros', larguraAvancados = 360, seletores, avancados, quantosAvancados, direita, larguraDireita = 0, soNaFolha, ativos, aoRemoverAtivo }: FiltrosEmLinhaProps<F>) {
  const celular = useEhCelular();
  const { elemento, largura } = useLarguraDoElemento();
  const emUso = seletores.filter((seletor) => seletor.visivel?.(filtros) ?? true);

  // Do mais usado para o menos usado: o primeiro que não couber leva junto os que vêm depois.
  const larguraDoBotao = rotuloAvancados === 'Filtros' ? LARGURA_DO_BOTAO_FILTROS : LARGURA_DO_BOTAO_FILTROS + 40;
  let ocupado = BUSCA_MINIMA + ESPACO + larguraDoBotao + (larguraDireita ? ESPACO + larguraDireita : 0);
  let cabe = !celular;
  const naLinha: SeletorEmLinha<F>[] = [];
  const dentro: SeletorEmLinha<F>[] = [];
  for (const seletor of emUso) {
    cabe = cabe && ocupado + ESPACO + seletor.largura <= largura;
    if (cabe) {
      ocupado += ESPACO + seletor.largura;
      naLinha.push(seletor);
    } else dentro.push(seletor);
  }

  const quantos = quantosAvancados(filtros) + dentro.filter((seletor) => seletor.ativo(filtros)).length;
  const conteudoDosFiltros = (valor: F, mudar: Mudar<F>) => (
    <>
      {celular && soNaFolha?.(valor, mudar)}
      {(celular ? seletores.filter((seletor) => seletor.visivel?.(valor) ?? true) : dentro).map((seletor) => (
        <div key={seletor.id} className="grid gap-3.5">
          {seletor.campos(valor, mudar, nada)}
        </div>
      ))}
      {avancados(valor, mudar)}
    </>
  );
  const botao = (
    <Button variante="secundario" className="shrink-0">
      <SlidersHorizontal aria-hidden />
      {quantos ? `${rotuloAvancados} (${quantos})` : rotuloAvancados}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div ref={elemento} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <Input type="search" aria-label={rotuloBusca} placeholder={placeholderBusca} value={filtros.busca} onChange={(evento) => aoMudar({ busca: evento.target.value } as Partial<F>)} className="rounded-pill bg-paper pl-10" />
        </div>
        {naLinha.map((seletor) => (
          <SeletorNaLinha key={seletor.id} seletor={seletor} filtros={filtros} aoMudar={aoMudar} />
        ))}
        {celular ? (
          <FolhaDeFiltros filtros={filtros} aoAplicar={(rascunho) => aoMudar(rascunho)} aoLimpar={aoLimpar} conteudo={conteudoDosFiltros} botao={botao} />
        ) : (
          <MenuSobreposto
            titulo={rotuloAvancados}
            largura={larguraAvancados}
            gatilho={botao}
            acaoCabecalho={
              quantos > 0 ? (
                <Button variante="terciario" tamanho="pequeno" onClick={aoLimpar}>
                  Limpar
                </Button>
              ) : undefined
            }
          >
            <div className="grid gap-4 px-1 pb-2 md:px-3">{conteudoDosFiltros(filtros, aoMudar)}</div>
          </MenuSobreposto>
        )}
        {!celular && direita && <div className="ml-auto shrink-0 pl-1">{direita}</div>}
      </div>
      <EtiquetasDosFiltros ativos={ativos} aoRemoverAtivo={aoRemoverAtivo} aoLimpar={aoLimpar} />
    </div>
  );
}
