'use client';

import { useEffect, type ReactElement } from 'react';
import { Bell, CheckSquare, FileText, Inbox, AlarmClock, Receipt, Search, Users, Wrench } from 'lucide-react';
import { EmBreve } from '@/componentes/padroes/etiquetas';
import { useAdicionarAtividade } from '@/componentes/atividades/adicionar-atividade';
import { CLASSE_LINHA_MENU, LinhaEmBreve, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { cn } from '@/lib/utils';

/**
 * Busca (T13.03) e sino (T13.04) só ganham função na etapa 9, e cada formulário de "+ Novo" chega
 * com sua tela. Até lá aparecem como "Em breve", sem resultados de mentira (decisão de 05/11/2026).
 * Tarefa, Demanda e Lembrete já abrem o formulário (T03.03).
 */
const ITENS_DE_ATIVIDADE = [
  { rotulo: 'Tarefa', tipo: 'tarefa', icone: <CheckSquare aria-hidden /> },
  { rotulo: 'Demanda', tipo: 'demanda', icone: <Inbox aria-hidden /> },
  { rotulo: 'Lembrete', tipo: 'lembrete', icone: <AlarmClock aria-hidden /> },
] as const;

const ITENS_NOVO = [
  { rotulo: 'Despesa', icone: <Receipt aria-hidden /> },
  { rotulo: 'Ferramenta', icone: <Wrench aria-hidden /> },
  { rotulo: 'Arquivo', icone: <FileText aria-hidden /> },
  { rotulo: 'Contraparte', icone: <Users aria-hidden /> },
];

/** "+ Novo" no computador; "Criar" no "+" da barra do celular (18 §10.5). */
export function MenuNovo({ gatilho, alinhar = 'end' }: { gatilho: ReactElement; alinhar?: 'start' | 'end' }) {
  const { abrirAdicionar } = useAdicionarAtividade();
  return (
    <MenuSobreposto titulo="Criar" gatilho={gatilho} alinhar={alinhar}>
      {(fechar) => (
        <ul className="grid gap-0.5">
          {ITENS_DE_ATIVIDADE.map((item) => (
            <li key={item.tipo}>
              <button
                type="button"
                className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}
                onClick={() => {
                  fechar();
                  abrirAdicionar(item.tipo);
                }}
              >
                {item.icone}
                {item.rotulo}
              </button>
            </li>
          ))}
          {ITENS_NOVO.map((item) => (
            <LinhaEmBreve key={item.rotulo} rotulo={item.rotulo} icone={item.icone} />
          ))}
        </ul>
      )}
    </MenuSobreposto>
  );
}

export function MenuAlertas() {
  return (
    <MenuSobreposto
      titulo="Alertas"
      alinhar="end"
      largura={360}
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label="Alertas">
          <Bell aria-hidden />
        </Button>
      }
    >
      <div className="px-1 pb-4 md:px-3">
        <EmBreve className="text-[13px]" />
        <p className="mt-1 text-sm text-ink-soft">A central de alertas chega junto com o Meu dia.</p>
      </div>
    </MenuSobreposto>
  );
}

/** Busca: pílula no computador, ícone no tablet e no celular (18 §10.4). */
export function PilulaBusca({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="hidden h-10 max-w-[340px] min-w-0 flex-1 items-center gap-2 rounded-pill border border-line bg-paper pr-2 pl-3.5 text-[13px] font-medium whitespace-nowrap text-ink-soft hover:border-ink-soft lg:flex"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">Buscar…</span>
      <span className="rounded-pill bg-mist px-2 py-0.5 text-xs font-semibold">Em breve</span>
    </button>
  );
}

export function BotaoBuscaIcone({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <Button variante="icone" tamanho="icone" aria-label="Buscar" className="lg:hidden" onClick={aoAbrir}>
      <Search aria-hidden />
    </Button>
  );
}

/** Abre também com Ctrl+K (02 §4). */
export function DialogoBusca({ aberta, aoMudar }: { aberta: boolean; aoMudar: (aberta: boolean) => void }) {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        aoMudar(true);
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoMudar]);

  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent>
        <DialogTitle className="pr-12">Busca</DialogTitle>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />
          <Input disabled aria-label="Buscar" placeholder="Código, título ou nome" className="pl-[42px]" />
        </div>
        <p className="mt-4 text-sm text-ink-soft">A busca chega em breve, depois do Meu dia.</p>
      </DialogContent>
    </Dialog>
  );
}
