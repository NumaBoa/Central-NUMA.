'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Plus, Tag, Target, UserRound, Users } from 'lucide-react';
import { useNovaContraparte } from '@/componentes/contrapartes/nova-contraparte';
import { AbasComercial } from '@/componentes/f1/abas-modulos';
import { seletorDeOpcoes } from '@/componentes/f1/apoio';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import type { Contraparte } from '@/dados/tipos/contraparte';
import { useConsulta } from '@/dados/use-consulta';
import { carregarComercial, ETAPAS_FUNIL_ORDEM, ROTULOS_ETAPA } from '@/dominio/comercial-contrapartes';
import { carregarContratos } from '@/dominio/contratos';
import { nomeDaContraparte, ROTULOS_PAPEL_CONTRAPARTE } from '@/dominio/contrapartes';

async function carregar() {
  const [comercial, contratos] = await Promise.all([carregarComercial(), carregarContratos()]);
  return { ...comercial, contratos: contratos.linhas };
}
type Filtros = { busca: string; papel: string; produtoContratado: string; produtoInteresse: string; responsavel: string; etapa: string };
const INICIAIS: Filtros = { busca: '', papel: '', produtoContratado: '', produtoInteresse: '', responsavel: '', etapa: '' };
type Linha = Contraparte & { interesse: string[]; contratados: string[]; etapaMaisAvancada: string | null };

/**
 * T10.01: a mesma contraparte de T02.06, com os filtros comerciais. Não há cadastro comercial à parte:
 * criar e editar abrem o mesmo formulário de Configurações › Contrapartes.
 */
export function TelaContrapartesComercial() {
  const roteador = useRouter();
  const { abrirNovaContraparte } = useNovaContraparte();
  const consulta = useConsulta(carregar);
  const dados = consulta.dados;
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const linhas: Linha[] = useMemo(() => {
    if (!dados) return [];
    return dados.contrapartes
      .filter((contraparte) => !contraparte.arquivado_em && contraparte.papeis.some((papel) => papel === 'prospect' || papel === 'cliente' || papel === 'parceiro'))
      .map((contraparte) => {
        const oportunidades = dados.oportunidades.filter((linha) => linha.contraparte_id === contraparte.id);
        const contratados = [...new Set(dados.contratos.filter((linha) => linha.contraparte_id === contraparte.id && (linha.vigencia === 'vigente' || linha.vigencia === 'futuro')).flatMap((linha) => linha.produtos))];
        const etapas = oportunidades.map((linha) => linha.etapa).sort((a, b) => ETAPAS_FUNIL_ORDEM.indexOf(b) - ETAPAS_FUNIL_ORDEM.indexOf(a));
        return { ...contraparte, contratados, interesse: [...new Set(oportunidades.flatMap((linha) => linha.produtos))].filter((id) => !contratados.includes(id)), etapaMaisAvancada: etapas[0] ?? null };
      });
  }, [dados]);
  const visiveis = linhas.filter((linha) => {
    const termo = filtros.busca.trim().toLowerCase();
    return (!filtros.papel || linha.papeis.includes(filtros.papel as Contraparte['papeis'][number])) && (!filtros.produtoContratado || linha.contratados.includes(filtros.produtoContratado)) && (!filtros.produtoInteresse || linha.interesse.includes(filtros.produtoInteresse)) && (!filtros.responsavel || linha.responsavel_id === filtros.responsavel) && (!filtros.etapa || linha.etapaMaisAvancada === filtros.etapa) && (!termo || `${linha.nome} ${linha.nome_fantasia ?? ''} ${linha.email ?? ''}`.toLowerCase().includes(termo));
  });
  const nomeProduto = (id: string) => dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido';
  const opcoesProduto = (dados?.produtos ?? []).filter((produto) => !produto.arquivado_em).map((produto) => ({ valor: produto.id, rotulo: produto.nome }));
  const opcoesPapel = (['prospect', 'cliente', 'parceiro'] as const).map((papel) => ({ valor: papel, rotulo: ROTULOS_PAPEL_CONTRAPARTE[papel] }));
  const opcoesResponsavel = (dados?.pessoas ?? []).filter((pessoa) => pessoa.tipo === 'interna' && !pessoa.arquivado_em).map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }));
  const opcoesEtapa = ETAPAS_FUNIL_ORDEM.map((etapa) => ({ valor: etapa, rotulo: ROTULOS_ETAPA[etapa] }));
  const filtrando = Object.entries(filtros).some(([campo, valor]) => (campo === 'busca' ? Boolean(String(valor).trim()) : Boolean(valor)));
  const rotuloDe = (campo: keyof Filtros, valor: string) => ({ papel: opcoesPapel, produtoContratado: opcoesProduto, produtoInteresse: opcoesProduto, responsavel: opcoesResponsavel, etapa: opcoesEtapa, busca: [] })[campo].find((opcao) => opcao.valor === valor)?.rotulo ?? valor;
  const ROTULOS_FILTRO: Record<keyof Filtros, string> = { busca: 'Busca', papel: 'Papel', produtoContratado: 'Contratado', produtoInteresse: 'Interesse', responsavel: 'Responsável', etapa: 'Etapa' };

  const colunas: readonly Coluna<Linha>[] = [
    { id: 'nome', titulo: 'Contraparte', essencial: true, ordenar: (a, b) => nomeDaContraparte(a).localeCompare(nomeDaContraparte(b), 'pt-BR'), celula: (linha) => <span className="font-medium">{nomeDaContraparte(linha)}</span> },
    { id: 'papeis', titulo: 'Papéis', essencial: true, celula: (linha) => <span className="flex flex-wrap gap-1">{linha.papeis.map((papel) => <EtiquetaLivre key={papel}>{ROTULOS_PAPEL_CONTRAPARTE[papel]}</EtiquetaLivre>)}</span> },
    { id: 'contratados', titulo: 'Contratados', celula: (linha) => linha.contratados.map(nomeProduto).join(', ') || '—' },
    { id: 'interesse', titulo: 'Interesse', celula: (linha) => linha.interesse.map(nomeProduto).join(', ') || '—' },
    { id: 'etapa', titulo: 'Etapa mais avançada', celula: (linha) => (linha.etapaMaisAvancada ? ROTULOS_ETAPA[linha.etapaMaisAvancada as keyof typeof ROTULOS_ETAPA] : '—') },
  ];
  return (
    <>
      <CabecalhoPagina kicker="Comercial" titulo="Contrapartes" resumo="O mesmo cadastro de Configurações, na visão comercial." acoes={<Button onClick={abrirNovaContraparte}><Plus aria-hidden />Nova contraparte</Button>} />
      <AbasComercial ativa="contrapartes" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as contrapartes." aoTentarDeNovo={consulta.recarregar} />}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(INICIAIS)}
          rotuloBusca="Buscar contrapartes"
          seletores={[seletorDeOpcoes<Filtros>({ id: 'papel', rotulo: 'Papel', icone: Tag, campo: 'papel', opcoes: opcoesPapel }), seletorDeOpcoes<Filtros>({ id: 'responsavel', rotulo: 'Responsável', icone: UserRound, campo: 'responsavel', opcoes: opcoesResponsavel, todos: 'Todas' }), seletorDeOpcoes<Filtros>({ id: 'produtoContratado', rotulo: 'Contratado', icone: Layers, campo: 'produtoContratado', opcoes: opcoesProduto }), seletorDeOpcoes<Filtros>({ id: 'produtoInteresse', rotulo: 'Interesse', icone: Layers, campo: 'produtoInteresse', opcoes: opcoesProduto }), seletorDeOpcoes<Filtros>({ id: 'etapa', rotulo: 'Etapa', icone: Target, campo: 'etapa', opcoes: opcoesEtapa, todos: 'Todas' })]}
          avancados={() => null}
          quantosAvancados={() => 0}
          ativos={(Object.keys(INICIAIS) as (keyof Filtros)[]).filter((campo) => campo !== 'busca' && filtros[campo]).map((campo) => ({ id: campo, rotulo: `${ROTULOS_FILTRO[campo]}: ${rotuloDe(campo, filtros[campo])}` }))}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
        />
        <Lista rotulo="Contrapartes comerciais" linhas={visiveis} colunas={colunas} chave={(linha) => linha.id} estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'} filtrando={filtrando} aoLimparFiltros={() => setFiltros(INICIAIS)} aoAbrir={(linha) => roteador.push(`/comercial/contrapartes/${linha.id}`)} cartao={(linha) => <span className="grid gap-1"><span className="font-semibold">{nomeDaContraparte(linha)}</span><span className="text-[13px] text-ink-soft">{linha.papeis.map((papel) => ROTULOS_PAPEL_CONTRAPARTE[papel]).join(', ')}</span></span>} vazio={<EstadoVazio icone={Users} titulo="Nenhum prospect, cliente ou parceiro ainda." texto="A contraparte vira prospect quando ganha uma oportunidade. Ela também pode ser cadastrada aqui." acao={<Button onClick={abrirNovaContraparte}>Nova contraparte</Button>} />} />
      </div>
    </>
  );
}
