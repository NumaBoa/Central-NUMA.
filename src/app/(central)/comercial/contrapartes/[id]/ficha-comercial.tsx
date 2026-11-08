'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileSignature, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { AbaLancamentos } from '@/componentes/financeiro/aba-lancamentos';
import { CartaoDePainel } from '@/componentes/f1/apoio';
import { FormularioOportunidade } from '@/componentes/f1/formulario-oportunidade';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { Button } from '@/componentes/ui/button';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { carregarComercial, estaAbertaNoFunil, ROTULOS_ETAPA, ROTULOS_PERIODICIDADE_VALOR, ROTULOS_SITUACAO_VERSAO, textoDosValores } from '@/dominio/comercial';
import { produtosDaContraparte } from '@/dominio/comercial-contrapartes';
import { ROTULOS_DOCUMENTAL, ROTULOS_FINANCEIRA, ROTULOS_VIGENCIA } from '@/dominio/contratos';
import { nomeDaContraparte, ROTULOS_PAPEL_CONTRAPARTE } from '@/dominio/contrapartes';
import { titulosDaContraparte } from '@/dominio/titulos';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

async function carregar(id: string) {
  const [comercial, produtos, propostas, versoes] = await Promise.all([carregarComercial(), produtosDaContraparte(id), repositorios.proposta.listar({ onde: { contraparte_id: id } }), repositorios.proposta_versao.listar()]);
  return { comercial, produtos, propostas: propostas.map((proposta) => ({ proposta, atual: versoes.filter((versao) => versao.proposta_id === proposta.id).sort((a, b) => b.numero - a.numero)[0] })), contraparte: comercial.contrapartes.find((item) => item.id === id) ?? null };
}

/** T10.01, ficha: as abas comerciais sobre o mesmo cadastro. Editar o cadastro leva a T02.06. */
export function FichaComercialDaContraparte() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregar(id), [id]);
  const [nova, setNova] = useState(false);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler a contraparte." aoTentarDeNovo={consulta.recarregar} />;
  const { contraparte, comercial, produtos, propostas } = consulta.dados;
  if (!contraparte) return <EstadoVazio icone={TriangleAlert} titulo="Contraparte não encontrada." texto="Ela pode ter sido removida." acao={<LinkCentral href="/comercial/contrapartes">Voltar</LinkCentral>} />;
  const oportunidades = comercial.oportunidades.filter((linha) => linha.contraparte_id === id);
  const nomeProduto = (produtoId: string) => comercial.produtos.find((produto) => produto.id === produtoId)?.nome ?? 'Produto removido';
  return (
    <>
      <LinkCentral href="/comercial/contrapartes" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Contrapartes
      </LinkCentral>
      <Ficha
        tituloDePagina
        titulo={nomeDaContraparte(contraparte)}
        etiquetas={contraparte.papeis.map((papel) => <EtiquetaLivre key={papel}>{ROTULOS_PAPEL_CONTRAPARTE[papel]}</EtiquetaLivre>)}
        acoes={
          <>
            <Button asChild variante="secundario"><LinkCentral href={`/comercial/contrapartes/${contraparte.id}/cadastro`}><Pencil aria-hidden />Cadastro</LinkCentral></Button>
            <Button asChild variante="secundario"><LinkCentral href={`/contratos/assinatura/novo?contraparte=${contraparte.id}`}><FileSignature aria-hidden />Novo contrato de assinatura</LinkCentral></Button>
            <Button onClick={() => setNova(true)}><Plus aria-hidden />Nova oportunidade</Button>
          </>
        }
        acoesCelular={<Button onClick={() => setNova(true)}>Nova oportunidade</Button>}
        abas={[
          {
            id: 'oportunidades',
            rotulo: 'Oportunidades',
            conteudo: oportunidades.length ? (
              <ul className="grid gap-2">
                {oportunidades.map((linha) => (
                  <li key={linha.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
                    <LinkCentral href={`/comercial/oportunidades/${linha.id}`} className="font-semibold underline">{linha.titulo}</LinkCentral>
                    <span className="ml-2 text-ink-soft">{ROTULOS_ETAPA[linha.etapa]} · {linha.valor_estimado === null ? 'valor não informado' : textoDosValores([{ periodicidade: linha.valor_periodicidade ?? 'unica', valor: linha.valor_estimado }])} · {estaAbertaNoFunil(linha) ? (linha.proxima ? `próxima: ${linha.proxima.titulo}, ${formatarDiaISO(linha.proxima.prazo as string)}` : 'sem próxima ação') : 'encerrada'}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Nenhuma oportunidade.</p>,
          },
          {
            id: 'propostas',
            rotulo: 'Propostas',
            conteudo: propostas.length ? (
              <ul className="grid gap-2">
                {propostas.map(({ proposta, atual }) => (
                  <li key={proposta.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
                    <LinkCentral href={`/comercial/propostas/${proposta.id}`} className="font-semibold underline">{proposta.codigo}</LinkCentral>
                    {atual && <span className="ml-2 text-ink-soft">V{atual.numero} · {ROTULOS_SITUACAO_VERSAO[atual.situacao]} · validade {formatarDiaISO(atual.validade)}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Nenhuma proposta.</p>,
          },
          {
            id: 'contratos',
            rotulo: 'Contratos',
            conteudo: produtos.contratos.length ? (
              <ul className="grid gap-2">
                {produtos.contratos.map((linha) => (
                  <li key={linha.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
                    <LinkCentral href={`/contratos/${linha.id}`} className="font-semibold underline">{linha.codigo} · {linha.titulo}</LinkCentral>
                    <EtiquetaSituacao tipo="info">{ROTULOS_DOCUMENTAL[linha.documental]}</EtiquetaSituacao>
                    <EtiquetaSituacao tipo={linha.vigencia === 'vigente' ? 'sucesso' : 'neutro'}>{ROTULOS_VIGENCIA[linha.vigencia]}</EtiquetaSituacao>
                    <EtiquetaSituacao tipo={linha.financeira === 'com_vencidos' ? 'erro' : 'neutro'}>{ROTULOS_FINANCEIRA[linha.financeira]}</EtiquetaSituacao>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Nenhum contrato.</p>,
          },
          {
            id: 'produtos',
            rotulo: 'Produtos contratados',
            conteudo: (
              <div className="grid gap-4">
                {produtos.catalogoAusente && <Faixa>Contratadas × Disponíveis usa os recursos das ofertas do M07, que ainda não está conectado.</Faixa>}
                {!produtos.contratados.length && <p className="text-sm text-ink-soft">Nenhum produto contratado.</p>}
                {produtos.contratados.map((produto) => (
                  <CartaoDePainel key={produto.produtoId} titulo={nomeProduto(produto.produtoId)}>
                    <ul className="grid gap-1 text-[13px]">
                      {produto.itens.map((item) => <li key={item.id}>{item.descricao} · {item.valor_total === null ? 'sem valor' : formatarDinheiro(item.valor_total, 'BRL')} · {item.periodicidade ? ROTULOS_PERIODICIDADE_VALOR[item.periodicidade] : ''} · {item.contrato}</li>)}
                    </ul>
                    <p className="mt-2 text-xs text-ink-soft">De {produto.inicio ? formatarDiaISO(produto.inicio) : 'início pendente'} {produto.fim ? `a ${formatarDiaISO(produto.fim)}` : 'sem fim definido'}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div><p className="texto-rotulo">Contratadas</p><p className="mt-1 text-[13px]">{produto.incluidos.join('; ') || '—'}</p></div>
                      <div><p className="texto-rotulo">Disponíveis em outras ofertas</p><p className="mt-1 text-[13px]">{produto.disponiveis.map((linha) => `${linha.recurso} (${linha.oferta})`).join('; ') || '—'}</p></div>
                    </div>
                  </CartaoDePainel>
                ))}
                <CartaoDePainel titulo="Apenas interesse">
                  <p className="text-[13px]">{produtos.interesse.map(nomeProduto).join(', ') || 'Nenhum.'}</p>
                </CartaoDePainel>
              </div>
            ),
          },
          { id: 'financeiro', rotulo: 'Financeiro', conteudo: <AbaLancamentos consultar={() => titulosDaContraparte(contraparte.id)} dependencia={contraparte.id} vazio="Os títulos a receber e a pagar desta contraparte aparecem aqui." /> },
        ]}
      />
      {nova && <FormularioOportunidade dados={comercial} contraparteInicial={contraparte.id} aoFechar={() => setNova(false)} />}
    </>
  );
}
