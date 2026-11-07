'use client';

import { BookText, FileText, Files, Handshake, RefreshCw, ScrollText, ShieldCheck, Target, Users } from 'lucide-react';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Subabas } from '@/componentes/padroes/subabas';

/** M09: três áreas, módulo próprio (decisão vigente 1). */
export function AbasLegal({ ativa, sub }: { ativa: 'documentos' | 'privacidade' | 'modelos'; sub?: 'inventario' | 'solicitacoes' | 'modelos' | 'clausulas' }) {
  return (
    <>
      <AbasPagina
        rotulo="Áreas de Legal e privacidade"
        abas={[
          { rotulo: 'Documentos legais', icone: FileText, href: '/legal', ativa: ativa === 'documentos' },
          { rotulo: 'Privacidade', icone: ShieldCheck, href: '/legal/privacidade', ativa: ativa === 'privacidade' },
          { rotulo: 'Modelos e cláusulas', icone: BookText, href: '/legal/modelos', ativa: ativa === 'modelos' },
        ]}
      />
      {ativa === 'privacidade' && (
        <Subabas
          rotulo="Privacidade"
          itens={[
            { rotulo: 'Inventário', href: '/legal/privacidade', ativa: sub === 'inventario' },
            { rotulo: 'Solicitações de titulares', href: '/legal/privacidade/solicitacoes', ativa: sub === 'solicitacoes' },
          ]}
        />
      )}
      {ativa === 'modelos' && (
        <Subabas
          rotulo="Modelos e cláusulas"
          itens={[
            { rotulo: 'Modelos de documentos', href: '/legal/modelos', ativa: sub === 'modelos' },
            { rotulo: 'Biblioteca de cláusulas', href: '/legal/modelos/clausulas', ativa: sub === 'clausulas' },
          ]}
        />
      )}
    </>
  );
}

export function AbasComercial({ ativa }: { ativa: 'contrapartes' | 'funil' | 'propostas' }) {
  return (
    <AbasPagina
      rotulo="Áreas do Comercial"
      abas={[
        { rotulo: 'Contrapartes', icone: Users, href: '/comercial/contrapartes', ativa: ativa === 'contrapartes' },
        { rotulo: 'Funil', icone: Target, href: '/comercial', ativa: ativa === 'funil' },
        { rotulo: 'Propostas', icone: Files, href: '/comercial/propostas', ativa: ativa === 'propostas' },
      ]}
    />
  );
}

export function AbasContratos({ ativa }: { ativa: 'contratos' | 'renovacao' | 'adesoes' }) {
  return (
    <AbasPagina
      rotulo="Áreas de Contratos"
      abas={[
        { rotulo: 'Contratos', icone: ScrollText, href: '/contratos', ativa: ativa === 'contratos' },
        { rotulo: 'Renovação', icone: RefreshCw, href: '/contratos/renovacao', ativa: ativa === 'renovacao' },
        { rotulo: 'Adesão padrão', icone: Handshake, href: '/contratos/adesoes', ativa: ativa === 'adesoes' },
      ]}
    />
  );
}
