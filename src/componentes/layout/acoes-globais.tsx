'use client';

import type { ReactElement } from 'react';
import { CheckSquare, FileText, Inbox, AlarmClock, Receipt, Users, Wrench } from 'lucide-react';
import { useAdicionarAtividade } from '@/componentes/atividades/adicionar-atividade';
import { CLASSE_LINHA_MENU, LinhaEmBreve, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { cn } from '@/lib/utils';

/**
 * Cada formulário de "+ Novo" chega com sua tela. Até lá aparece como "Em breve", sem nada de mentira
 * (decisão de 05/11/2026). Tarefa, Demanda e Lembrete já abrem o formulário (T03.03).
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
