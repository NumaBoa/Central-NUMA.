'use client';

import { useState, type ReactNode } from 'react';
import { CalendarDays, Copy, ExternalLink, FileImage, FileQuestion, FileText, FileVideo, Files, Globe, Image as ImagemIcone, Lock, Megaphone, Palette, Presentation, ScrollText, Shapes, Stamp, UsersRound, type LucideIcon } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { AbasPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EtiquetaContexto, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Arquivo, ClasseDeInformacao, SituacaoDaPeca, SituacaoDoInscrito, TipoDeArquivo } from '@/dados/tipos/marketing';
import { situacaoDosDireitos, textoDosDireitos } from '@/dominio/biblioteca';
import { ROTULOS_SITUACAO_CAMPANHA } from '@/dominio/campanhas';
import { DESCRICOES_CLASSE, ROTULOS_CLASSE } from '@/dominio/classes';
import { ROTULOS_SITUACAO_PECA } from '@/dominio/conteudo';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { tintaDaCor } from '@/dominio/cores';
import { ROTULOS_ELEGIBILIDADE, ROTULOS_SITUACAO_INSCRITO, type Elegibilidade } from '@/dominio/listas-espera';
import { rotuloDaFase } from '@/dominio/fases';
import { faseLiberada, type Fase } from '@/dominio/navegacao';
import { REGISTROS_DO_ARQUIVO, type RegistroVinculavel } from '@/dominio/vinculos-arquivo';
import { cn } from '@/lib/utils';

export const KICKER_MARKETING = 'Marca e marketing';

export type IdDaAreaDeMarketing = 'biblioteca' | 'marcas' | 'conteudo' | 'campanhas' | 'listas' | 'apresentacoes';

/** Navegação do módulo, separada dos filtros. O que é da F1 fica "Em breve" até a fase chegar (decisão de 05/11/2026). */
export function AbasMarketing({ ativa }: { ativa: IdDaAreaDeMarketing }) {
  const { faseAtiva } = useCentral();
  const f1 = faseLiberada('f1', faseAtiva);
  const faseDaTela: Fase = ativa === 'conteudo' || ativa === 'campanhas' || ativa === 'listas' ? 'f1' : 'f0b';
  return (
    <>
    <AbasPagina
      rotulo="Áreas de Marca e marketing"
      abas={[
        { rotulo: 'Biblioteca', icone: Files, href: '/marketing', ativa: ativa === 'biblioteca' },
        { rotulo: 'Marcas', icone: Palette, href: '/marketing/marcas', ativa: ativa === 'marcas' },
        { rotulo: 'Conteúdo', icone: CalendarDays, href: f1 || ativa === 'conteudo' ? '/marketing/conteudo' : undefined, ativa: ativa === 'conteudo' },
        { rotulo: 'Campanhas', icone: Megaphone, href: f1 || ativa === 'campanhas' ? '/marketing/campanhas' : undefined, ativa: ativa === 'campanhas' },
        { rotulo: 'Listas de espera', icone: UsersRound, href: f1 || ativa === 'listas' ? '/marketing/listas' : undefined, ativa: ativa === 'listas' },
        { rotulo: 'Apresentações', icone: Presentation, href: '/marketing/apresentacoes', ativa: ativa === 'apresentacoes' },
      ]}
    />
    {!faseLiberada(faseDaTela, faseAtiva) && <Faixa className="mt-4">A {rotuloDaFase(faseDaTela)} ainda não está ativa. Esta tela já funciona, com os dados de exemplo; ela entra no menu quando a fase for ativada em Configurações.</Faixa>}
    </>
  );
}

const ICONES_POR_TIPO: Readonly<Record<TipoDeArquivo, LucideIcon>> = {
  logo: Stamp,
  imagem: ImagemIcone,
  icone: Shapes,
  identidade: Palette,
  apresentacao: Presentation,
  modelo_proposta: FileText,
  modelo_documento: FileText,
  documento_institucional: ScrollText,
  contrato: FileText,
  video: FileVideo,
  print: FileImage,
  outro: FileQuestion,
};

/** Sem integração com o Drive, a Central não sabe se o arquivo é público: sempre ícone por tipo, nunca miniatura. */
export function IconeDoTipo({ tipo, className }: { tipo: TipoDeArquivo; className?: string }) {
  const Icone = ICONES_POR_TIPO[tipo] ?? FileQuestion;
  return <Icone className={className} aria-hidden />;
}

const TONS_DA_CLASSE: Readonly<Record<ClasseDeInformacao, TipoSituacao>> = { pub: 'sucesso', int: 'neutro', fin: 'atencao', doc: 'info' };
const ICONES_DA_CLASSE: Readonly<Record<ClasseDeInformacao, LucideIcon>> = { pub: Globe, int: UsersRound, fin: Lock, doc: Lock };

/** A classe é da Central. FIN e DOC levam cadeado, além da cor e do texto (CA-18.07). */
export function EtiquetaClasse({ classe }: { classe: ClasseDeInformacao }) {
  return (
    <span title={DESCRICOES_CLASSE[classe]}>
      <EtiquetaSituacao tipo={TONS_DA_CLASSE[classe]} icone={ICONES_DA_CLASSE[classe]}>
        {ROTULOS_CLASSE[classe]}
      </EtiquetaSituacao>
    </span>
  );
}

export function EtiquetaDireitos({ arquivo, hoje }: { arquivo: Pick<Arquivo, 'direitos_validade'>; hoje: string }) {
  const texto = textoDosDireitos(arquivo, hoje);
  if (!texto) return null;
  return (
    <span className="max-w-full [&>span]:whitespace-normal">
      <EtiquetaSituacao tipo={situacaoDosDireitos(arquivo, hoje).estado === 'expirados' ? 'erro' : 'atencao'}>{texto}</EtiquetaSituacao>
    </span>
  );
}

const TONS_DA_PECA: Readonly<Record<SituacaoDaPeca, TipoSituacao>> = { ideia: 'neutro', producao: 'atencao', revisao: 'info', aprovado: 'info', publicado: 'sucesso', cancelado: 'erro' };

export function EtiquetaDaPeca({ situacao }: { situacao: SituacaoDaPeca }) {
  return <EtiquetaSituacao tipo={TONS_DA_PECA[situacao]}>{ROTULOS_SITUACAO_PECA[situacao]}</EtiquetaSituacao>;
}

const TONS_DA_CAMPANHA: Readonly<Record<keyof typeof ROTULOS_SITUACAO_CAMPANHA, TipoSituacao>> = { planejada: 'neutro', em_andamento: 'info', encerrada: 'sucesso', cancelada: 'erro' };

export function EtiquetaDaCampanha({ situacao }: { situacao: keyof typeof ROTULOS_SITUACAO_CAMPANHA }) {
  return <EtiquetaSituacao tipo={TONS_DA_CAMPANHA[situacao]}>{ROTULOS_SITUACAO_CAMPANHA[situacao]}</EtiquetaSituacao>;
}

const TONS_DO_INSCRITO: Readonly<Record<SituacaoDoInscrito, TipoSituacao>> = { ativo: 'sucesso', convidado: 'info', convertido: 'info', descadastrado: 'neutro' };

export function EtiquetaDoInscrito({ situacao }: { situacao: SituacaoDoInscrito }) {
  return <EtiquetaSituacao tipo={TONS_DO_INSCRITO[situacao]}>{ROTULOS_SITUACAO_INSCRITO[situacao]}</EtiquetaSituacao>;
}

const TONS_DA_ELEGIBILIDADE: Readonly<Record<Elegibilidade, TipoSituacao>> = { apto: 'sucesso', pendente_consentimento: 'atencao', descadastrado: 'neutro' };

export function EtiquetaElegibilidade({ elegibilidade }: { elegibilidade: Elegibilidade }) {
  return <EtiquetaSituacao tipo={TONS_DA_ELEGIBILIDADE[elegibilidade]}>{ROTULOS_ELEGIBILIDADE[elegibilidade]}</EtiquetaSituacao>;
}

/** A etiqueta de contexto a partir do cadastro único de marcas e produtos. `id` é o produto ou a Numa. */
export function EtiquetaDoContexto({ id, produtos, marcas }: { id: string | null; produtos: readonly Produto[]; marcas: readonly Marca[] }) {
  const produto = id && id !== ID_INSTITUCIONAL ? produtos.find((item) => item.id === id) : undefined;
  const marca = produto ? marcas.find((item) => item.id === produto.marca_id) : marcas.find((item) => item.institucional);
  if (!marca) return <span className="text-ink-soft">Contexto removido</span>;
  return <EtiquetaContexto contexto={{ id: produto?.id ?? ID_INSTITUCIONAL, nome: produto?.nome ?? 'Numa institucional', cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }} />;
}

export const nomeDoContexto = (id: string, produtos: readonly Pick<Produto, 'id' | 'nome'>[]) => (id === ID_INSTITUCIONAL ? 'Numa institucional' : (produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido'));

/** Numa e os produtos ativos, para os formulários. Contexto é Numa ou produto, nunca um tipo de material. */
export const opcoesDeContexto = (produtos: readonly Produto[]) => [{ valor: ID_INSTITUCIONAL, rotulo: 'Numa institucional' }, ...produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo').map((produto) => ({ valor: produto.id, rotulo: produto.nome }))];

export async function copiarLink(link: string) {
  try {
    await navigator.clipboard.writeText(link);
    aviso('Link copiado.');
  } catch {
    aviso('Não deu para copiar. Abra no Drive e copie por lá.');
  }
}

export function BotaoCopiarLink({ link }: { link: string }) {
  return (
    <Button variante="secundario" onClick={() => void copiarLink(link)}>
      <Copy aria-hidden />
      Copiar link
    </Button>
  );
}

export function BotaoAbrirNoDrive({ link, variante = 'primario' }: { link: string; variante?: 'primario' | 'secundario' }) {
  return (
    <Button asChild variante={variante}>
      <a href={link} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden />
        Abrir no Drive
      </a>
    </Button>
  );
}

export type AbaDoFormulario<A extends string> = { id: A; rotulo: string; erros?: number; conteudo: ReactNode };

/** Formulário longo em abas. Todas ficam montadas: trocar de aba não perde o que foi digitado. */
export function AbasDoFormulario<A extends string>({ abas, ativa, aoMudar, rotulo }: { abas: readonly AbaDoFormulario<A>[]; ativa: A; aoMudar: (aba: A) => void; rotulo: string }) {
  return (
    <Tabs value={ativa} onValueChange={(valor) => aoMudar(valor as A)}>
      <TabsList aria-label={rotulo} className="mb-4">
        {abas.map((aba) => (
          <TabsTrigger key={aba.id} value={aba.id}>
            {aba.rotulo}
            {aba.erros ? (
              <span className="ml-1.5 rounded-pill bg-err-wash px-1.5 text-xs text-err tabular-nums">
                {aba.erros}
                <span className="sr-only"> com erro</span>
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {abas.map((aba) => (
        <TabsContent key={aba.id} value={aba.id} forceMount className="grid gap-[18px] data-[state=inactive]:hidden">
          {aba.conteudo}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** Dá o foco ao campo depois que a aba dele aparecer. */
export function focarCampo(campoId: string) {
  requestAnimationFrame(() => document.getElementById(campoId)?.focus());
}

/** Escolher o que vincular: primeiro o tipo do registro, depois o registro. Devolve "tipo:id". */
export function SeletorDeRegistro({ id, registros, valor, aoMudar, rotulo = 'Vincular a' }: { id: string; registros: readonly RegistroVinculavel[]; valor: string; aoMudar: (valor: string) => void; rotulo?: string }) {
  const [tipoEscolhido, setTipoEscolhido] = useState(valor.split(':')[0] ?? '');
  const disponiveis = Object.entries(REGISTROS_DO_ARQUIVO).filter(([tipo]) => registros.some((registro) => registro.tipo === tipo));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Campo id={`${id}-tipo`} rotulo={rotulo}>
        {(controle) => (
          <Selecao
            {...controle}
            value={tipoEscolhido}
            onChange={(evento) => {
              setTipoEscolhido(evento.target.value);
              aoMudar('');
            }}
          >
            <option value="">Nenhum</option>
            {disponiveis.map(([tipo, { rotulo: nome }]) => (
              <option key={tipo} value={tipo}>
                {nome}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Campo id={id} rotulo="Registro">
        {(controle) => (
          <Selecao {...controle} disabled={!tipoEscolhido} value={valor.split(':').slice(1).join(':')} onChange={(evento) => aoMudar(evento.target.value ? `${tipoEscolhido}:${evento.target.value}` : '')}>
            <option value="">Escolha</option>
            {registros
              .filter((registro) => registro.tipo === tipoEscolhido)
              .map((registro) => (
                <option key={registro.id} value={registro.id}>
                  {registro.nome}
                </option>
              ))}
          </Selecao>
        )}
      </Campo>
    </div>
  );
}

/** Alternância Grade | Lista e semelhantes, com o selecionado em espresso (18 §9.3). */
export function AlternarVisao<V extends string>({ rotulo, opcoes, ativa, aoMudar }: { rotulo: string; opcoes: readonly { id: V; rotulo: string; icone?: LucideIcon }[]; ativa: V; aoMudar: (visao: V) => void }) {
  return (
    <div role="group" aria-label={rotulo} className="inline-flex rounded-pill border border-line bg-paper p-0.5">
      {opcoes.map(({ id, rotulo: nome, icone: Icone }) => (
        <button key={id} type="button" aria-pressed={ativa === id} onClick={() => aoMudar(id)} className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-[13px] font-semibold md:min-h-9 [&_svg]:size-[15px]', ativa === id ? 'bg-espresso text-linen' : 'text-ink-soft hover:bg-hover')}>
          {Icone && <Icone aria-hidden />}
          {nome}
        </button>
      ))}
    </div>
  );
}
