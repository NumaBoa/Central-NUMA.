'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, CircleCheck, CircleX, FileBarChart, Pencil, Plus, Tag } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { AvisoDeFase, CartaoDaFicha, SituacaoDaOferta, SituacaoDaVersao, textoDoPreco } from '@/componentes/produtos/aparencia';
import { DialogoAprovarPreco } from '@/componentes/produtos/dialogo-aprovar-preco';
import { FormularioOferta, FormularioVersao } from '@/componentes/produtos/formularios-oferta';
import { Button, variantesBotao } from '@/componentes/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { PrecoVersao } from '@/dados/tipos/precificacao';
import { useConsulta } from '@/dados/use-consulta';
import { carregarOferta, descartarRascunhoDePreco, inativarOferta, NAO_DEFINIDO, precoVigente, reativarOferta, ROTULOS_FORMALIZACAO, ROTULOS_PERIODICIDADE_PRECO, ROTULOS_PUBLICO_OFERTA, ROTULOS_TIPO_OFERTA, situacaoEfetivaDaOferta, TODOS_OS_CANAIS } from '@/dominio/precificacao';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO } from '@/lib/formatacao';

/** T07.04: dados, recursos e versões de preço. A produto fica sempre à vista: cada um tem as suas ofertas. */
export function FichaDaOferta() {
  const { id, ofertaId } = useParams<{ id: string; ofertaId: string }>();
  const roteador = useRouter();
  const parametros = useSearchParams();
  const hoje = hojeISO();
  const consulta = useConsulta(async () => {
    const [dados, produto] = await Promise.all([carregarOferta(ofertaId), repositorios.produto.obter(id)]);
    return { dados, produto };
  }, [id, ofertaId]);
  const [editando, setEditando] = useState(false);
  const [versao, setVersao] = useState<{ aberto: boolean; preco: PrecoVersao | null }>({ aberto: false, preco: null });
  const [aprovando, setAprovando] = useState<PrecoVersao | null>(null);
  const [descartando, setDescartando] = useState<PrecoVersao | null>(null);
  const [inativando, setInativando] = useState(false);
  const [aba, setAba] = useState('precos');
  const dados = consulta.dados?.dados;
  const pedido = parametros.get('aprovar');

  // "Usar como base de preço" (T07.06) chega aqui com o rascunho já criado.
  useEffect(() => {
    if (!pedido || !dados) return;
    const rascunho = dados.precos.find((preco) => preco.id === pedido && preco.situacao === 'rascunho');
    if (rascunho) setAprovando(rascunho);
    roteador.replace(`/produtos/${id}/ofertas/${ofertaId}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só uma vez, ao chegar pelo link
  }, [pedido, Boolean(dados)]);

  const colunas = useMemo<readonly Coluna<PrecoVersao>[]>(() => {
    if (!dados) return [];
    const nome = (idDoNome: string | null, vazio: string) => (idDoNome ? (dados.nomes.get(idDoNome) ?? 'Removido') : vazio);
    return [
      { id: 'versao', titulo: 'Versão', essencial: true, celula: (preco) => <span className="font-semibold tabular-nums">v{preco.versao}</span> },
      { id: 'canal', titulo: 'Canal', essencial: true, celula: (preco) => <span className="whitespace-nowrap">{nome(preco.canal_id, TODOS_OS_CANAIS)}</span> },
      { id: 'valor', titulo: 'Valor', essencial: true, celula: (preco) => <span className={`whitespace-nowrap tabular-nums ${preco.valor === null ? 'text-ink-soft' : 'font-medium'}`}>{textoDoPreco(preco)}</span> },
      { id: 'periodo', titulo: 'Periodicidade', celula: (preco) => ROTULOS_PERIODICIDADE_PRECO[preco.periodicidade] },
      { id: 'validade', titulo: 'Validade', celula: (preco) => <span className="whitespace-nowrap tabular-nums">{preco.valido_de ? `${formatarDiaISO(preco.valido_de)}${preco.valido_ate ? ` a ${formatarDiaISO(preco.valido_ate)}` : ' em diante'}` : 'A definir'}</span> },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (preco) => <SituacaoDaVersao preco={preco} hoje={hoje} /> },
      { id: 'simulacao', titulo: 'Simulação', celula: (preco) => <span className="tabular-nums">{nome(preco.simulacao_id, '—')}</span> },
      {
        id: 'decisao',
        titulo: 'Decisão',
        celula: (preco) =>
          preco.situacao === 'rascunho' ? (
            '—'
          ) : (
            <span className="grid whitespace-nowrap">
              <span className="tabular-nums">{nome(preco.decisao_id, '—')}</span>
              <span className="text-xs text-ink-soft">
                {nome(preco.aprovado_por, '')}
                {preco.aprovado_em ? ` · ${formatarData(preco.aprovado_em)}` : ''}
              </span>
            </span>
          ),
      },
    ];
  }, [dados, hoje]);

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler esta oferta." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />;
  const produto = consulta.dados.produto;
  if (!dados || !produto || dados.oferta.produto_id !== produto.id) return <EstadoVazio icone={Tag} titulo="Essa oferta não existe neste produto." texto="Cada produto tem as suas ofertas. Volte ao portfólio e abra por lá." acao={<LinkCentral href="/produtos" className={variantesBotao({ variante: 'secundario' })}>Portfólio</LinkCentral>} />;

  const { oferta, recursos, precos, canais, simulacoes } = dados;
  const situacao = situacaoEfetivaDaOferta(oferta, precos, hoje);
  const inativa = oferta.situacao === 'inativa';
  const gratuidade = oferta.tipo === 'gratuidade';
  const canaisAtivos = canais.filter((canal) => canal.situacao === 'ativo' && !canal.arquivado_em);
  const novaVersao = () => setVersao({ aberto: true, preco: null });
  const futuras = precos.filter((preco) => preco.situacao === 'aprovada' && preco.valido_de && preco.valido_de > hoje);

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  return (
    <article className="space-y-5">
      <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1 text-[13px] text-ink-soft">
        <LinkCentral href="/produtos" className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
          Produtos
        </LinkCentral>
        <ChevronRight aria-hidden className="size-3.5" />
        <LinkCentral href={`/produtos/${produto.id}?aba=ofertas`} className="inline-flex min-h-11 items-center font-medium text-ink hover:underline md:min-h-0">
          {produto.nome} · Ofertas
        </LinkCentral>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page">{oferta.nome}</span>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-soft tabular-nums">{oferta.codigo}</p>
          <h1 className="mt-1 break-words">{oferta.nome}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SituacaoDaOferta situacao={situacao} />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto max-md:[&>*]:flex-1">
          {!inativa && (
            <Button onClick={novaVersao}>
              <Plus aria-hidden />
              Nova versão de preço
            </Button>
          )}
          <LinkCentral href={`/produtos/simulador?produto=${produto.id}&oferta=${oferta.id}`} className={variantesBotao({ variante: 'secundario' })}>
            <FileBarChart aria-hidden />
            Nova simulação
          </LinkCentral>
          <Button variante="secundario" onClick={() => setEditando(true)}>
            <Pencil aria-hidden />
            Editar oferta
          </Button>
          {inativa ? (
            <Button variante="terciario" onClick={() => void executar(() => reativarOferta(oferta.id, hoje), 'Oferta reativada.')}>
              <CircleCheck aria-hidden />
              Reativar
            </Button>
          ) : (
            <Button variante="terciario" onClick={() => setInativando(true)}>
              <CircleX aria-hidden />
              Inativar
            </Button>
          )}
        </div>
      </header>
      <AvisoDeFase />
      {futuras.length > 0 && situacao !== 'aprovada' && <Faixa tipo="info">Há preço aprovado para o futuro. A oferta só passa a Aprovada quando ele entrar em vigência.</Faixa>}

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-paper p-4 text-[13px] md:grid-cols-4">
        <div>
          <dt className="text-ink-soft">Tipo</dt>
          <dd className="font-semibold">{ROTULOS_TIPO_OFERTA[oferta.tipo]}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Público</dt>
          <dd className="font-semibold">{ROTULOS_PUBLICO_OFERTA[oferta.publico]}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Cobrança</dt>
          <dd className="font-semibold">{oferta.periodicidade ? ROTULOS_PERIODICIDADE_PRECO[oferta.periodicidade] : 'Não se aplica'}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Formalização</dt>
          <dd className="font-semibold">{ROTULOS_FORMALIZACAO[oferta.formalizacao]}</dd>
        </div>
      </dl>

      <Tabs value={aba} onValueChange={setAba} className="min-w-0">
        <TabsList aria-label={`Seções de ${oferta.nome}`}>
          <TabsTrigger value="precos">Preços</TabsTrigger>
          <TabsTrigger value="dados">Dados e recursos</TabsTrigger>
        </TabsList>
        <TabsContent value="precos" className="mt-4 space-y-4 text-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Lista
              rotulo="Versões de preço"
              linhas={precos}
              colunas={colunas}
              chave={(preco) => preco.id}
              compacta
              cartaoInterativo
              vazio={<EstadoVazio icone={Tag} titulo="Sem preço definido." texto={gratuidade ? 'Gratuidade tem preço R$ 0,00 explícito: crie a versão e aprove, com a decisão. A simulação é dispensada.' : 'A oferta está Em estudo. Simule, crie uma versão em rascunho e aprove com a decisão.'} acao={inativa ? undefined : <Button onClick={novaVersao}>Nova versão de preço</Button>} />}
              acoesDaLinha={(preco) =>
                preco.situacao === 'rascunho' && !inativa ? (
                  <span className="flex justify-end gap-1">
                    <Button tamanho="pequeno" onClick={() => setAprovando(preco)}>
                      Aprovar
                    </Button>
                    <Button variante="terciario" tamanho="pequeno" onClick={() => setVersao({ aberto: true, preco })}>
                      Editar
                    </Button>
                    <Button variante="terciario" tamanho="pequeno" onClick={() => setDescartando(preco)}>
                      Descartar
                    </Button>
                  </span>
                ) : null
              }
              cartao={(preco) => (
                <span className="grid gap-1.5">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold tabular-nums">
                      v{preco.versao} · {textoDoPreco(preco)}
                    </span>
                    <SituacaoDaVersao preco={preco} hoje={hoje} />
                  </span>
                  <span className="text-[13px] text-ink-soft">
                    {(preco.canal_id && dados.nomes.get(preco.canal_id)) || TODOS_OS_CANAIS} · {ROTULOS_PERIODICIDADE_PRECO[preco.periodicidade]}
                  </span>
                  <span className="text-[13px] text-ink-soft tabular-nums">{preco.valido_de ? `${formatarDiaISO(preco.valido_de)}${preco.valido_ate ? ` a ${formatarDiaISO(preco.valido_ate)}` : ' em diante'}` : 'Validade a definir'}</span>
                  {preco.situacao !== 'rascunho' && (
                    <span className="text-[13px] text-ink-soft">
                      Decisão {(preco.decisao_id && dados.nomes.get(preco.decisao_id)) || '—'} · {(preco.aprovado_por && dados.nomes.get(preco.aprovado_por)) || ''}
                    </span>
                  )}
                  {preco.justificativa_excecao && <span className="text-[13px] break-words">Exceção abaixo do piso: {preco.justificativa_excecao}</span>}
                  {preco.situacao === 'rascunho' && !inativa && (
                    <span className="flex flex-wrap gap-2 [&>*]:flex-1">
                      <Button tamanho="pequeno" onClick={() => setAprovando(preco)}>
                        Aprovar
                      </Button>
                      <Button variante="secundario" tamanho="pequeno" onClick={() => setVersao({ aberto: true, preco })}>
                        Editar
                      </Button>
                      <Button variante="terciario" tamanho="pequeno" onClick={() => setDescartando(preco)}>
                        Descartar
                      </Button>
                    </span>
                  )}
                </span>
              )}
            />
            <CartaoDaFicha titulo="Preço por canal">
              <ul className="grid gap-2 text-[13px]">
                {[...canaisAtivos.map((canal) => ({ id: canal.id, nome: canal.nome })), { id: null, nome: TODOS_OS_CANAIS }].map((item) => {
                  const vigente = precoVigente(precos.filter((preco) => preco.canal_id === item.id), item.id, hoje);
                  return (
                    <li key={item.id ?? 'todos'} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words text-ink-soft">{item.nome}</span>
                      <span className={`shrink-0 tabular-nums ${vigente ? 'font-semibold' : 'text-ink-soft'}`}>{vigente ? textoDoPreco(vigente) : NAO_DEFINIDO}</span>
                    </li>
                  );
                })}
              </ul>
              {!canaisAtivos.length && (
                <p className="mt-2 text-xs text-ink-soft">
                  Nenhum canal cadastrado.{' '}
                  <LinkCentral href="/produtos/canais" className="underline">
                    Cadastrar
                  </LinkCentral>
                </p>
              )}
            </CartaoDaFicha>
          </div>
          <Faixa tipo="info">Aprovar uma nova versão encerra a anterior, na mesma oferta e canal, no dia anterior ao início da nova. Propostas e contratos existentes não mudam.</Faixa>
        </TabsContent>
        <TabsContent value="dados" className="mt-4 space-y-3 text-sm">
          <CartaoDaFicha titulo="Descrição">{oferta.descricao ? <p className="break-words whitespace-pre-line">{oferta.descricao}</p> : <p className="text-ink-soft">Não informada.</p>}</CartaoDaFicha>
          <CartaoDaFicha titulo="Recursos incluídos">
            {recursos.length ? (
              <ul className="grid gap-1.5 text-[13px]">
                {recursos.map((recurso) => (
                  <li key={recurso.id} className="flex items-start gap-2">
                    {recurso.incluido ? <CircleCheck aria-hidden className="mt-px size-4 shrink-0 text-ok" /> : <CircleX aria-hidden className="mt-px size-4 shrink-0 text-ink-soft" />}
                    <span className="min-w-0 break-words">
                      <span className="sr-only">{recurso.incluido ? 'Incluído: ' : 'Não incluído: '}</span>
                      {recurso.nome}
                      {recurso.limite ? ` · ${recurso.limite}` : ''}
                      {recurso.observacao ? <span className="text-ink-soft"> · {recurso.observacao}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-soft">Nenhum recurso cadastrado.</p>
            )}
          </CartaoDaFicha>
          <CartaoDaFicha titulo="Exclusões">{oferta.exclusoes ? <p className="break-words whitespace-pre-line">{oferta.exclusoes}</p> : <p className="text-ink-soft">Não informadas.</p>}</CartaoDaFicha>
        </TabsContent>
      </Tabs>

      <FormularioOferta aberto={editando} aoFechar={() => setEditando(false)} produtoId={produto.id} nomeDoProduto={produto.nome} oferta={oferta} recursos={recursos} />
      <FormularioVersao aberto={versao.aberto} aoFechar={() => setVersao((atual) => ({ ...atual, aberto: false }))} oferta={oferta} canais={canais} simulacoes={simulacoes} preco={versao.preco} />
      <DialogoAprovarPreco preco={aprovando} aoFechar={() => setAprovando(null)} oferta={oferta} precos={precos} canais={canais} simulacoes={simulacoes} nomeDoProduto={produto.nome} />
      <Confirmacao
        aberto={descartando !== null}
        aoFechar={() => setDescartando(null)}
        titulo={`Descartar o rascunho v${descartando?.versao ?? ''}?`}
        texto="Ele sai da lista. Só rascunho pode ser descartado: versão aprovada fica para sempre."
        rotuloConfirmar="Descartar rascunho"
        perigo
        aoConfirmar={() => {
          const alvo = descartando;
          setDescartando(null);
          if (alvo) void executar(() => descartarRascunhoDePreco(alvo.id), 'Rascunho descartado.');
        }}
      />
      <Confirmacao
        aberto={inativando}
        aoFechar={() => setInativando(false)}
        titulo={`Inativar ${oferta.nome}?`}
        texto="Ela deixa de ser oferecida, e nenhuma versão nova pode ser aprovada. Propostas e contratos existentes não mudam."
        rotuloConfirmar="Inativar oferta"
        perigo
        pedirMotivo
        aoConfirmar={(motivo) => {
          setInativando(false);
          void executar(() => inativarOferta(oferta.id, motivo), 'Oferta inativada.');
        }}
      />
    </article>
  );
}
