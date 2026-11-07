'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, Layers, Plus, ScrollText, ShieldCheck, UserRound } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { AbasContratos } from '@/componentes/f1/abas-modulos';
import { paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { SituacoesDoContrato } from '@/componentes/f1/situacoes-contrato';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { PilulaFiltro } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Indicador } from '@/componentes/padroes/indicador';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { carregarContratos, indicadoresDosContratos, passaNaAba, ROTULOS_DOCUMENTAL, ROTULOS_FINANCEIRA, ROTULOS_VIGENCIA, type AbaRapida, type LinhaDoContrato } from '@/dominio/contratos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { nomeDaEntidade } from '@/dominio/entidades';
import { ROTULOS_FAMILIA } from '@/dominio/modelos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const ABAS: readonly { id: AbaRapida; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'rascunhos', rotulo: 'Rascunhos' },
  { id: 'revisao', rotulo: 'Em revisão ou assinatura' },
  { id: 'vigentes', rotulo: 'Vigentes' },
  { id: 'futuros', rotulo: 'Futuros' },
  { id: 'renovar', rotulo: 'A renovar (90 dias)' },
  { id: 'encerrados', rotulo: 'Encerrados' },
];

type Filtros = { busca: string; familia: string; produto: string; responsavel: string; documental: string; vigencia: string; financeira: string; contraparte: string; entidade: string; venceAte: string; renovacaoPendente: boolean };
const INICIAIS: Filtros = { busca: '', familia: '', produto: '', responsavel: '', documental: '', vigencia: '', financeira: '', contraparte: '', entidade: '', venceAte: '', renovacaoPendente: false };

/** T11.01: uma linha por contrato, não por versão (CA-11.01). */
export function TelaContratos() {
  const roteador = useRouter();
  const consulta = useConsulta(() => carregarContratos());
  const dados = consulta.dados;
  const hoje = hojeISO();
  const [aba, setAba] = useState<AbaRapida>('todos');
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const contraparte = (id: string) => {
    const item = dados?.contrapartes.find((linha) => linha.id === id);
    return item ? nomeDaContraparte(item) : 'Contraparte removida';
  };
  const entidade = (id: string) => {
    const item = dados?.entidades.find((linha) => linha.id === id);
    return item ? nomeDaEntidade(item) : 'Entidade removida';
  };
  const pessoa = (id: string) => dados?.pessoas.find((linha) => linha.id === id)?.nome_completo ?? 'Pessoa removida';
  const produto = (id: string) => dados?.produtos.find((linha) => linha.id === id)?.nome ?? 'Produto removido';

  const semAba = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return (dados?.linhas ?? []).filter((linha) => !linha.arquivado_em && (!filtros.familia || linha.familia === filtros.familia) && (!filtros.produto || linha.produtos.includes(filtros.produto)) && (!filtros.responsavel || linha.responsavel_id === filtros.responsavel) && (!filtros.documental || linha.documental === filtros.documental) && (!filtros.vigencia || linha.vigencia === filtros.vigencia) && (!filtros.financeira || linha.financeira === filtros.financeira) && (!filtros.contraparte || linha.contraparte_id === filtros.contraparte) && (!filtros.entidade || linha.entidade_id === filtros.entidade) && (!filtros.venceAte || Boolean(linha.fim && linha.fim <= filtros.venceAte)) && (!filtros.renovacaoPendente || (Boolean(linha.dataLimite) && linha.renovacao_situacao === 'em_analise')) && (!termo || `${linha.codigo} ${linha.titulo} ${contraparte(linha.contraparte_id)}`.toLowerCase().includes(termo)));
  }, [dados, filtros]); // eslint-disable-line react-hooks/exhaustive-deps -- `contraparte` lê `dados`
  const linhas = semAba.filter((linha) => passaNaAba(linha, aba, hoje));
  const indicadores = indicadoresDosContratos(dados?.linhas.filter((linha) => !linha.arquivado_em) ?? [], hoje);
  const filtrando = aba !== 'todos' || Object.entries(filtros).some(([campo, valor]) => (campo === 'busca' ? Boolean(String(valor).trim()) : Boolean(valor)));
  const limpar = () => {
    setFiltros(INICIAIS);
    setAba('todos');
  };
  const opcoesFamilia = paraOpcoes(ROTULOS_FAMILIA);
  const opcoesProduto = (dados?.produtos ?? []).map((linha) => ({ valor: linha.id, rotulo: linha.nome }));
  const opcoesResponsavel = (dados?.pessoas ?? []).filter((linha) => linha.tipo === 'interna').map((linha) => ({ valor: linha.id, rotulo: linha.nome_completo }));
  const selecao = (rotulo: string, campo: keyof Filtros, opcoes: readonly { valor: string; rotulo: string }[], valor: Filtros, mudar: (parcial: Partial<Filtros>) => void) => (
    <Campo id={`ctr-${campo}`} rotulo={rotulo}>
      {(controle) => (
        <select {...controle} className="campo" value={String(valor[campo])} onChange={(evento) => mudar({ [campo]: evento.target.value } as Partial<Filtros>)}>
          <option value="">Todas</option>
          {opcoes.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
        </select>
      )}
    </Campo>
  );
  const ROTULOS_FILTRO: Partial<Record<keyof Filtros, [string, (valor: string) => string]>> = {
    familia: ['Família', (valor) => ROTULOS_FAMILIA[valor as keyof typeof ROTULOS_FAMILIA]],
    produto: ['Produto', produto],
    responsavel: ['Responsável', pessoa],
    documental: ['Documental', (valor) => ROTULOS_DOCUMENTAL[valor as keyof typeof ROTULOS_DOCUMENTAL]],
    vigencia: ['Vigência', (valor) => ROTULOS_VIGENCIA[valor as keyof typeof ROTULOS_VIGENCIA]],
    financeira: ['Financeiro', (valor) => ROTULOS_FINANCEIRA[valor as keyof typeof ROTULOS_FINANCEIRA]],
    contraparte: ['Contraparte', contraparte],
    entidade: ['Entidade', entidade],
    venceAte: ['Vence até', formatarDiaISO],
  };

  const colunas: readonly Coluna<LinhaDoContrato>[] = [
    { id: 'codigo', titulo: 'Contrato', essencial: true, ordenar: (a, b) => a.codigo.localeCompare(b.codigo), celula: (linha) => <span className="grid"><span className="font-medium">{linha.titulo}</span><span className="text-xs text-ink-soft">{linha.codigo} · {linha.vigente ? `V${linha.vigente.numero}` : 'sem versão assinada'}{linha.paralela ? ` · rascunho em paralelo (V${linha.paralela.numero})` : ''}</span></span> },
    { id: 'familia', titulo: 'Família', celula: (linha) => ROTULOS_FAMILIA[linha.familia] },
    { id: 'contraparte', titulo: 'Contraparte', essencial: true, celula: (linha) => contraparte(linha.contraparte_id) },
    { id: 'produtos', titulo: 'Produtos', celula: (linha) => linha.produtos.map(produto).join(', ') || '—' },
    { id: 'entidade', titulo: 'Entidade', celula: (linha) => entidade(linha.entidade_id) },
    { id: 'situacoes', titulo: 'Situações', essencial: true, celula: (linha) => <SituacoesDoContrato compacto documental={linha.documental} vigencia={linha.vigencia} financeira={linha.financeira} renovacao={linha.renovacao_situacao} /> },
    { id: 'vigencia', titulo: 'Vigência', celula: (linha) => (linha.inicio ? `${formatarDiaISO(linha.inicio)} – ${linha.fim ? formatarDiaISO(linha.fim) : 'indeterminado'}` : 'Início pendente') },
    { id: 'renovacao', titulo: 'Decidir renovação até', celula: (linha) => (linha.dataLimite ? formatarDiaISO(linha.dataLimite) : '—') },
    { id: 'mensal', titulo: 'Mensal equivalente', numerica: true, celula: (linha) => (linha.mensalEquivalente === null ? '—' : formatarDinheiro(linha.mensalEquivalente, linha.moeda)) },
    { id: 'responsavel', titulo: 'Responsável', celula: (linha) => pessoa(linha.responsavel_id) },
  ];

  const botaoNovo = (
    <MenuSobreposto titulo="Novo contrato" largura={300} alinhar="end" gatilho={<Button><Plus aria-hidden />Novo contrato</Button>}>
      <div className="grid gap-0.5">
        <LinkCentral href="/contratos/novo" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}><ScrollText className="size-4" aria-hidden />Contrato pelo assistente</LinkCentral>
        <LinkCentral href="/contratos/assinatura/novo" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}><FileSignature className="size-4" aria-hidden />Contrato de assinatura (modelo SaaS)</LinkCentral>
      </div>
    </MenuSobreposto>
  );

  return (
    <>
      <CabecalhoPagina kicker="Contratos" titulo="Contratos" resumo="O que foi combinado, com as quatro situações separadas." acoes={botaoNovo} />
      <AbasContratos ativa="contratos" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler os contratos." aoTentarDeNovo={consulta.recarregar} />}
        {dados && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Indicador titulo="Vigentes" valor={String(indicadores.vigentes)} />
            <Indicador titulo="Recorrente mensal normalizado" valor={indicadores.recorrenteMensal === null ? 'Não definido' : formatarDinheiro(indicadores.recorrenteMensal, 'BRL')} contexto={`Dos vigentes; anuais divididos por 12${indicadores.recorrenteParcial ? `. ${indicadores.recorrenteParcial} sem valor` : ''}`} />
            <Indicador titulo="A renovar em 90 dias" valor={String(indicadores.aRenovar)} />
            <Indicador titulo="Assinaturas pendentes" valor={String(indicadores.assinaturasPendentes)} />
          </div>
        )}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={limpar}
          rotuloBusca="Buscar contrato, código ou contraparte"
          seletores={[seletorDeOpcoes<Filtros>({ id: 'familia', rotulo: 'Família', icone: ShieldCheck, campo: 'familia', opcoes: opcoesFamilia, todos: 'Todas' }), seletorDeOpcoes<Filtros>({ id: 'produto', rotulo: 'Produto', icone: Layers, campo: 'produto', opcoes: opcoesProduto }), seletorDeOpcoes<Filtros>({ id: 'responsavel', rotulo: 'Responsável', icone: UserRound, campo: 'responsavel', opcoes: opcoesResponsavel, todos: 'Todas' })]}
          avancados={(valor, mudar) => (
            <>
              {selecao('Situação documental', 'documental', paraOpcoes(ROTULOS_DOCUMENTAL), valor, mudar)}
              {selecao('Vigência', 'vigencia', paraOpcoes(ROTULOS_VIGENCIA), valor, mudar)}
              {selecao('Situação financeira', 'financeira', paraOpcoes(ROTULOS_FINANCEIRA), valor, mudar)}
              {selecao('Contraparte', 'contraparte', (dados?.contrapartes ?? []).filter((linha) => dados?.linhas.some((contrato) => contrato.contraparte_id === linha.id)).map((linha) => ({ valor: linha.id, rotulo: nomeDaContraparte(linha) })), valor, mudar)}
              {selecao('Entidade', 'entidade', (dados?.entidades ?? []).map((linha) => ({ valor: linha.id, rotulo: nomeDaEntidade(linha) })), valor, mudar)}
              <Campo id="ctr-vence" rotulo="Vigência termina até">{(controle) => <EntradaData {...controle} value={valor.venceAte} onChange={(evento) => mudar({ venceAte: evento.target.value })} />}</Campo>
              <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold"><input type="checkbox" checked={valor.renovacaoPendente} onChange={(evento) => mudar({ renovacaoPendente: evento.target.checked })} />Renovação pendente de decisão</label>
            </>
          )}
          quantosAvancados={(valor) => [valor.documental, valor.vigencia, valor.financeira, valor.contraparte, valor.entidade, valor.venceAte, valor.renovacaoPendente].filter(Boolean).length}
          ativos={[...(Object.keys(ROTULOS_FILTRO) as (keyof Filtros)[]).filter((campo) => filtros[campo]).map((campo) => ({ id: campo, rotulo: `${ROTULOS_FILTRO[campo]![0]}: ${ROTULOS_FILTRO[campo]![1](String(filtros[campo]))}` })), ...(filtros.renovacaoPendente ? [{ id: 'renovacaoPendente', rotulo: 'Renovação pendente' }] : [])]}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: id === 'renovacaoPendente' ? false : '' }))}
        />
        <div role="group" aria-label="Abas rápidas" className="faixa-rolagem flex gap-1.5 py-0.5">
          {ABAS.map((linha) => <PilulaFiltro key={linha.id} filtro={{ id: linha.id, rotulo: linha.rotulo, contador: semAba.filter((contrato) => passaNaAba(contrato, linha.id, hoje)).length }} ativa={aba === linha.id} aoClicar={() => setAba(linha.id)} />)}
        </div>
        <Lista
          rotulo="Contratos"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={filtrando}
          aoLimparFiltros={limpar}
          aoAbrir={(linha) => roteador.push(`/contratos/${linha.id}`)}
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <span className="font-semibold">{linha.titulo}</span>
              <span className="text-[13px] text-ink-soft">{linha.codigo} · {contraparte(linha.contraparte_id)}</span>
              <SituacoesDoContrato compacto documental={linha.documental} vigencia={linha.vigencia} financeira={linha.financeira} renovacao={linha.renovacao_situacao} />
            </span>
          )}
          vazio={<EstadoVazio icone={ScrollText} titulo="Nenhum contrato ainda." texto="O contrato nasce da proposta aceita, do assistente ou do modelo de assinatura." acao={botaoNovo} />}
        />
      </div>
    </>
  );
}

