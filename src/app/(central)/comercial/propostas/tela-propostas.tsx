'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleDot, Files } from 'lucide-react';
import { AbasComercial } from '@/componentes/f1/abas-modulos';
import { paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { linhasDosTotais, ROTULOS_SITUACAO_VERSAO, totaisDosItens } from '@/dominio/comercial';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { formatarDiaISO } from '@/lib/formatacao';

async function carregar() {
  const [propostas, versoes, itens, contrapartes, oportunidades] = await Promise.all([repositorios.proposta.listar(), repositorios.proposta_versao.listar(), repositorios.proposta_item.listar(), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.oportunidade.listar()]);
  return propostas.map((proposta) => {
    const proprias = versoes.filter((versao) => versao.proposta_id === proposta.id).sort((a, b) => b.numero - a.numero);
    const atual = proprias[0];
    const contraparte = contrapartes.find((item) => item.id === proposta.contraparte_id);
    return { ...proposta, atual, versoes: proprias.length, contraparte: contraparte ? nomeDaContraparte(contraparte) : 'Contraparte removida', oportunidade: oportunidades.find((item) => item.id === proposta.oportunidade_id)?.titulo ?? '', valores: atual ? linhasDosTotais(totaisDosItens(itens.filter((item) => item.versao_id === atual.id))).join(' · ') : '' };
  });
}
type Linha = Awaited<ReturnType<typeof carregar>>[number];
type Filtros = { busca: string; situacao: string };

/** Propostas, cada uma na versão mais recente. As versões ficam no editor. */
export function TelaPropostas() {
  const roteador = useRouter();
  const consulta = useConsulta(carregar);
  const [filtros, setFiltros] = useState<Filtros>({ busca: '', situacao: '' });
  const linhas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return (consulta.dados ?? []).filter((linha) => linha.atual && (!filtros.situacao || linha.atual.situacao === filtros.situacao) && (!termo || `${linha.codigo} ${linha.contraparte} ${linha.oportunidade}`.toLowerCase().includes(termo)));
  }, [consulta.dados, filtros]);
  const opcoes = paraOpcoes(ROTULOS_SITUACAO_VERSAO);
  const colunas: readonly Coluna<Linha>[] = [
    { id: 'codigo', titulo: 'Proposta', essencial: true, celula: (linha) => <span className="grid"><span className="font-medium">{linha.codigo}</span><span className="text-xs text-ink-soft">{linha.oportunidade}</span></span> },
    { id: 'contraparte', titulo: 'Contraparte', essencial: true, celula: (linha) => linha.contraparte },
    { id: 'versao', titulo: 'Versão', celula: (linha) => `V${linha.atual?.numero} de ${linha.versoes}` },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => linha.atual && <EtiquetaSituacao tipo={linha.atual.situacao === 'aceita' ? 'sucesso' : linha.atual.situacao === 'enviada' ? 'atencao' : 'neutro'}>{ROTULOS_SITUACAO_VERSAO[linha.atual.situacao]}</EtiquetaSituacao> },
    { id: 'validade', titulo: 'Validade', celula: (linha) => (linha.atual ? formatarDiaISO(linha.atual.validade) : '—') },
    { id: 'valores', titulo: 'Valores', celula: (linha) => linha.valores || '—' },
  ];
  return (
    <>
      <CabecalhoPagina kicker="Comercial" titulo="Propostas" resumo="Nova proposta nasce na ficha da oportunidade." />
      <AbasComercial ativa="propostas" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as propostas." aoTentarDeNovo={consulta.recarregar} />}
        <FiltrosEmLinha filtros={filtros} aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))} aoLimpar={() => setFiltros({ busca: '', situacao: '' })} rotuloBusca="Buscar propostas" seletores={[seletorDeOpcoes<Filtros>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes, todos: 'Todas' })]} avancados={() => null} quantosAvancados={() => 0} ativos={filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${opcoes.find((opcao) => opcao.valor === filtros.situacao)?.rotulo}` }] : []} aoRemoverAtivo={() => setFiltros((atuais) => ({ ...atuais, situacao: '' }))} />
        <Lista rotulo="Propostas" linhas={linhas} colunas={colunas} chave={(linha) => linha.id} estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'} filtrando={Boolean(filtros.busca.trim() || filtros.situacao)} aoLimparFiltros={() => setFiltros({ busca: '', situacao: '' })} aoAbrir={(linha) => roteador.push(`/comercial/propostas/${linha.id}`)} cartao={(linha) => <span className="grid gap-1"><span className="font-semibold">{linha.codigo} · {linha.contraparte}</span><span className="text-[13px] text-ink-soft">{linha.atual && ROTULOS_SITUACAO_VERSAO[linha.atual.situacao]}</span></span>} vazio={<EstadoVazio icone={Files} titulo="Nenhuma proposta ainda." texto="Abra uma oportunidade no funil e use “Nova proposta”." />} />
      </div>
    </>
  );
}
