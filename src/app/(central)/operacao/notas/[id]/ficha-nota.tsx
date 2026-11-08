'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Download, Pencil, Plus, Send, Trash2, TriangleAlert } from 'lucide-react';
import { ChipDaMarca } from '@/app/(central)/configuracoes/cadastros/marcas/aparencia';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { CartaoDePainel, executar, paraOpcoes } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { CANAIS_NOTA, CATEGORIAS_ITEM_NOTA, type NotaLiberacao, type NotaLiberacaoItem } from '@/dados/tipos/operacao';
import { useConsulta } from '@/dados/use-consulta';
import { tintaDaCor } from '@/dominio/cores';
import { candidatosParaPuxar, carregarNota, historicoDaNota, moverItem, previaDaNota, publicarNota, puxarItens, registrarComunicacao, removerItem, removerRascunho, ROTULOS_CANAL_NOTA, ROTULOS_CATEGORIA_ITEM, ROTULOS_CATEGORIA_ITEM_SINGULAR, ROTULOS_PUBLICO_NOTA, salvarCabecalho, salvarItem, type CategoriaItem } from '@/dominio/notas';
import { formatarDataHora, formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

type Dados = NonNullable<Awaited<ReturnType<typeof carregarNota>>>;
type Janela = '' | 'cabecalho' | 'item' | 'puxar' | 'publicar' | 'comunicacao' | 'remover';

/** T12.07, editor: itens por categoria, puxar da operação, prévia com a marca, publicar e comunicar. */
export function FichaNota() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregarNota(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler a nota." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados) return <EstadoVazio icone={TriangleAlert} titulo="Nota não encontrada." texto="Ela pode ter sido removida." acao={<LinkCentral href="/operacao/notas">Voltar</LinkCentral>} />;
  return <Conteudo dados={consulta.dados} aoMudar={consulta.recarregar} />;
}

function Conteudo({ dados, aoMudar }: { dados: Dados; aoMudar: () => void }) {
  const roteador = useRouter();
  const { nota, itens, produto, marca } = dados;
  const [janela, setJanela] = useState<Janela>('');
  const [itemEmEdicao, setItemEmEdicao] = useState<NotaLiberacaoItem | null>(null);
  const publicada = nota.situacao === 'publicada';
  const fechar = () => {
    setJanela('');
    setItemEmEdicao(null);
  };
  const depois = () => {
    fechar();
    aoMudar();
  };
  const nomeDoProduto = produto?.nome ?? 'Produto removido';
  const previa = previaDaNota(nota, itens, nomeDoProduto, dados.referencias);
  const acaoPrincipal = publicada ? <Button onClick={() => setJanela('comunicacao')}><Send aria-hidden />Registrar comunicação</Button> : <Button onClick={() => setJanela('publicar')}><Send aria-hidden />Publicar</Button>;
  const maisAcoes = !publicada && (
    <MenuSobreposto titulo="Mais ações" largura={260} alinhar="end" gatilho={<Button variante="secundario" aria-label="Mais ações da nota">Mais ações</Button>}>
      {(fecharMenu) => (
        <div className="grid gap-0.5">
          {[['Editar versão e público', () => setJanela('cabecalho'), false], ['Puxar da operação', () => setJanela('puxar'), false], ['Remover rascunho', () => setJanela('remover'), true]].map(([rotulo, acao, perigo]) => (
            <button key={rotulo as string} type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover', perigo && 'text-err')} onClick={() => { fecharMenu(); (acao as () => void)(); }}>
              {rotulo as string}
            </button>
          ))}
        </div>
      )}
    </MenuSobreposto>
  );

  const editor = (
    <div className="grid gap-3">
      {!publicada && (
        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" onClick={() => setJanela('item')}><Plus aria-hidden />Novo item</Button>
          <Button variante="secundario" onClick={() => setJanela('puxar')}><Download aria-hidden />Puxar da operação</Button>
        </div>
      )}
      {itens.length ? (
        CATEGORIAS_ITEM_NOTA.filter((categoria) => itens.some((item) => item.categoria === categoria)).map((categoria) => (
          <CartaoDePainel key={categoria} titulo={ROTULOS_CATEGORIA_ITEM[categoria]}>
            <ul aria-label={ROTULOS_CATEGORIA_ITEM[categoria]} className="grid gap-1.5">
              {itens.filter((item) => item.categoria === categoria).map((item) => {
                const posicao = itens.indexOf(item);
                return (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 text-[13px]">
                    <span className="min-w-0 flex-1">
                      {item.texto}
                      {item.origem_id && <span className="block text-xs text-ink-soft">De {dados.referencias.get(item.origem_id) ?? 'registro removido'}: texto sugerido, editável. A origem não muda.</span>}
                    </span>
                    {!publicada && (
                      <span className="flex gap-0.5">
                        <Button variante="icone" tamanho="icone" aria-label={`Subir ${item.texto}`} disabled={posicao === 0} onClick={() => void executar(() => moverItem(item.id, -1)).then(aoMudar)}><ArrowUp aria-hidden /></Button>
                        <Button variante="icone" tamanho="icone" aria-label={`Descer ${item.texto}`} disabled={posicao === itens.length - 1} onClick={() => void executar(() => moverItem(item.id, 1)).then(aoMudar)}><ArrowDown aria-hidden /></Button>
                        <Button variante="icone" tamanho="icone" aria-label={`Editar ${item.texto}`} onClick={() => { setItemEmEdicao(item); setJanela('item'); }}><Pencil aria-hidden /></Button>
                        <Button variante="icone" tamanho="icone" aria-label={`Tirar ${item.texto}`} onClick={() => void executar(() => removerItem(item.id), 'Item tirado.').then(aoMudar)}><Trash2 aria-hidden /></Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </CartaoDePainel>
        ))
      ) : (
        <EstadoVazio icone={Plus} titulo="Nenhum item ainda." texto="Escreva os itens, ou puxe das solicitações resolvidas e das tarefas concluídas desde a última versão." />
      )}
    </div>
  );

  const corDaMarca = marca?.cor_hex ?? '#4F52D9';
  const comunicado = (
    <section aria-label="Prévia da comunicação" className="overflow-hidden rounded-lg border border-line bg-paper" style={{ '--tinta': tintaDaCor(corDaMarca) } as CSSProperties}>
      <header className="flex items-center gap-3 bg-[var(--tinta)] px-5 py-4">
        {marca && <ChipDaMarca marca={marca} />}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-soft">{marca?.nome ?? 'Numa'} · {previa.interna ? 'Nota interna' : 'Novidades da versão'}</p>
          <h2 className="text-[21px] leading-7">{previa.titulo}</h2>
          {previa.data && <p className="text-xs text-ink-soft">{formatarDiaISO(previa.data)}</p>}
        </div>
      </header>
      <div className="grid gap-4 px-5 py-4 text-[14px]">
        {previa.resumo && <p>{previa.resumo}</p>}
        {previa.grupos.length ? (
          previa.grupos.map((grupo) => (
            <div key={grupo.categoria}>
              <h3 className="mb-1.5 text-[15px] font-semibold">{grupo.rotulo}</h3>
              <ul className="grid list-disc gap-1 pl-5">
                {grupo.itens.map((item, indice) => <li key={indice}>{item.texto}{item.referencia && <span className="text-xs text-ink-soft"> ({item.referencia})</span>}</li>)}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-ink-soft">Sem itens: a nota não se publica vazia.</p>
        )}
      </div>
      {!previa.interna && <p className="border-t border-line px-5 py-2.5 text-xs text-ink-soft">Para clientes: sem códigos internos nem referências às solicitações.</p>}
    </section>
  );

  return (
    <>
      <LinkCentral href="/operacao/notas" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Notas de liberação
      </LinkCentral>
      <Ficha
        tituloDePagina
        codigo={nota.codigo}
        titulo={`${nomeDoProduto} ${nota.versao}`}
        etiquetas={<><EtiquetaSituacao tipo={publicada ? 'sucesso' : 'neutro'}>{publicada ? 'Publicada' : 'Rascunho'}</EtiquetaSituacao><EtiquetaLivre>{ROTULOS_PUBLICO_NOTA[nota.publico]}</EtiquetaLivre></>}
        acoes={<>{maisAcoes}{acaoPrincipal}</>}
        acoesCelular={<>{maisAcoes}{acaoPrincipal}</>}
        lateral={
          <CartaoDePainel titulo="Versão">
            <ListaDeDados>
              <Dado rotulo="Data">{nota.data ? formatarDiaISO(nota.data) : 'Sem data'}</Dado>
              <Dado rotulo="Público">{ROTULOS_PUBLICO_NOTA[nota.publico]}</Dado>
              <Dado rotulo="Itens">{String(itens.length)}</Dado>
              {publicada && <Dado rotulo="Publicada em">{nota.publicada_em ? formatarDataHora(nota.publicada_em) : null}</Dado>}
              {publicada && <Dado rotulo="Comunicada em">{nota.canais.length ? nota.canais.map((canal) => ROTULOS_CANAL_NOTA[canal]).join(', ') : 'Ainda não registrado'}</Dado>}
              {nota.comunicacao_observacao && <Dado rotulo="Observação">{nota.comunicacao_observacao}</Dado>}
            </ListaDeDados>
          </CartaoDePainel>
        }
        abas={[
          { id: 'itens', rotulo: 'Itens', conteudo: editor },
          { id: 'previa', rotulo: 'Prévia', conteudo: comunicado },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={nota.id} /> },
        ]}
      />
      {publicada && <Faixa className="mt-4">Publicada: a nota não muda. Para corrigir, crie a próxima versão. A comunicação (loja, e-mail, site) se registra aqui.</Faixa>}
      {janela === 'cabecalho' && <JanelaCabecalho nota={nota} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'item' && <JanelaItem notaId={nota.id} item={itemEmEdicao} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'puxar' && <JanelaPuxar notaId={nota.id} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'comunicacao' && <JanelaComunicacao nota={nota} aoFechar={fechar} aoSalvar={depois} />}
      <Confirmacao aberto={janela === 'publicar'} aoFechar={fechar} titulo={`Publicar ${previa.titulo}?`} texto={<>Depois de publicada, a nota não muda: confira a prévia.{!nota.data && <span className="mt-2 block font-semibold">Falta a data da versão.</span>}</>} rotuloConfirmar="Publicar" aoConfirmar={async () => { if (await executar(() => publicarNota(nota.id), 'Nota publicada. Registre onde ela foi comunicada.')) depois(); }} />
      <Confirmacao aberto={janela === 'remover'} aoFechar={fechar} titulo="Remover o rascunho?" texto="A nota e os itens saem da lista e ficam no histórico. As solicitações e tarefas de origem não mudam." rotuloConfirmar="Remover rascunho" perigo aoConfirmar={async () => { if (await executar(() => removerRascunho(nota.id), 'Rascunho removido.')) roteador.push('/operacao/notas'); }} />
    </>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaNota(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

function JanelaCabecalho({ nota, aoFechar, aoSalvar }: { nota: NotaLiberacao; aoFechar: () => void; aoSalvar: () => void }) {
  const [valores, setValores] = useState({ versao: nota.versao, data: nota.data ?? '', publico: nota.publico, resumo: nota.resumo ?? '' });
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<typeof valores>) => setValores((atuais) => ({ ...atuais, ...parcial }));
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await salvarCabecalho(nota.id, valores);
      aviso('Nota atualizada.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Versão e público" aoEnviar={enviar} salvando={salvando} rotuloSalvar="Salvar alterações">
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="nota-versao" rotulo="Versão" obrigatorio>
          {(controle) => <Input {...controle} autoComplete="off" value={valores.versao} onChange={(evento) => mudar({ versao: evento.target.value })} />}
        </Campo>
        <Campo id="nota-data" rotulo="Data da versão">
          {(controle) => <EntradaData {...controle} value={valores.data} onChange={(evento) => mudar({ data: evento.target.value })} />}
        </Campo>
        <Campo id="nota-publico" rotulo="Público" obrigatorio>
          {(controle) => <Selecao {...controle} value={valores.publico} onChange={(evento) => mudar({ publico: evento.target.value as NotaLiberacao['publico'] })}>{paraOpcoes(ROTULOS_PUBLICO_NOTA).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Selecao>}
        </Campo>
        <Campo id="nota-resumo" rotulo="Resumo" className="md:col-span-2">
          {(controle) => <Textarea {...controle} rows={2} value={valores.resumo} onChange={(evento) => mudar({ resumo: evento.target.value })} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaItem({ notaId, item, aoFechar, aoSalvar }: { notaId: string; item: NotaLiberacaoItem | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [categoria, setCategoria] = useState<CategoriaItem>(item?.categoria ?? 'novidade');
  const [texto, setTexto] = useState(item?.texto ?? '');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await salvarItem(notaId, { categoria, texto }, item?.id);
      aviso(item ? 'Item atualizado.' : 'Item incluído.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={item ? 'Editar item' : 'Novo item'} descricao={item?.origem_id ? 'Editar aqui não muda a solicitação ou a tarefa de origem.' : undefined} alterado={texto !== (item?.texto ?? '') || categoria !== (item?.categoria ?? 'novidade')} aoEnviar={enviar} salvando={salvando} rotuloSalvar={item ? 'Salvar item' : 'Incluir item'}>
      <div className="grid gap-[18px]">
        <Campo id="item-categoria" rotulo="Categoria" obrigatorio>
          {(controle) => <Selecao {...controle} value={categoria} onChange={(evento) => setCategoria(evento.target.value as CategoriaItem)}>{paraOpcoes(ROTULOS_CATEGORIA_ITEM_SINGULAR).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Selecao>}
        </Campo>
        <Campo id="item-texto" rotulo="Texto" obrigatorio ajuda="Escrito para quem vai ler a nota.">
          {(controle) => <Textarea {...controle} rows={3} value={texto} onChange={(evento) => setTexto(evento.target.value)} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaPuxar({ notaId, aoFechar, aoSalvar }: { notaId: string; aoFechar: () => void; aoSalvar: () => void }) {
  const consulta = useConsulta(() => candidatosParaPuxar(notaId), [notaId]);
  const [escolhidos, setEscolhidos] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const candidatos = consulta.dados?.candidatos ?? [];
  const marcados = escolhidos ?? candidatos.map((linha) => `${linha.tipo}:${linha.id}`);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!marcados.length) {
      aoFechar();
      return;
    }
    setSalvando(true);
    try {
      const novos = await puxarItens(notaId, marcados.map((chave) => { const [tipo, id] = chave.split(':') as ['solicitacao_suporte' | 'atividade', string]; return { tipo, id }; }));
      aviso(`${novos === 1 ? '1 item puxado' : `${novos} itens puxados`}. Revise o texto: é sugestão.`);
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto larga aoFechar={aoFechar} titulo="Puxar da operação" descricao={consulta.dados?.desde ? `Solicitações resolvidas e tarefas concluídas do produto desde ${formatarDiaISO(consulta.dados.desde)}, a última versão publicada.` : 'Solicitações resolvidas e tarefas concluídas do produto: ainda não há versão publicada.'} aoEnviar={enviar} salvando={salvando} rotuloSalvar={candidatos.length ? 'Puxar itens' : 'Fechar'}>
      {consulta.estado === 'carregando' ? (
        <EstadoCarregando linhas={2} />
      ) : candidatos.length ? (
        <ul aria-label="O que dá para puxar" className="grid gap-1">
          {candidatos.map((linha) => {
            const chave = `${linha.tipo}:${linha.id}`;
            return (
              <li key={chave}>
                <label className="flex min-h-11 items-center gap-2.5 text-[13px] md:min-h-8">
                  <input type="checkbox" className="size-[18px] accent-[var(--indigo-dk)]" checked={marcados.includes(chave)} onChange={(evento) => setEscolhidos(evento.target.checked ? [...marcados, chave] : marcados.filter((valor) => valor !== chave))} />
                  <span>
                    {linha.texto}
                    <span className="block text-xs text-ink-soft">{linha.codigo} · vira {ROTULOS_CATEGORIA_ITEM_SINGULAR[linha.categoria].toLowerCase()}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft">Nada novo para puxar. Itens já usados numa nota não aparecem de novo.</p>
      )}
    </JanelaFormulario>
  );
}

function JanelaComunicacao({ nota, aoFechar, aoSalvar }: { nota: NotaLiberacao; aoFechar: () => void; aoSalvar: () => void }) {
  const [canais, setCanais] = useState<NotaLiberacao['canais']>(nota.canais);
  const [observacao, setObservacao] = useState(nota.comunicacao_observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await registrarComunicacao(nota.id, canais, observacao);
      aviso('Comunicação registrada.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Onde foi comunicada" aoEnviar={enviar} salvando={salvando} rotuloSalvar="Salvar comunicação">
      <div className="grid gap-[18px]">
        <fieldset>
          <legend className="mb-[7px] texto-rotulo">Canais</legend>
          <div className="flex flex-wrap gap-1.5">
            {CANAIS_NOTA.map((canal) => (
              <label key={canal} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border border-line bg-paper px-3 text-[13px] font-medium has-checked:border-espresso has-checked:bg-espresso has-checked:text-linen md:min-h-9">
                <input type="checkbox" className="sr-only" checked={canais.includes(canal)} onChange={(evento) => setCanais(evento.target.checked ? [...canais, canal] : canais.filter((valor) => valor !== canal))} />
                {ROTULOS_CANAL_NOTA[canal]}
              </label>
            ))}
          </div>
        </fieldset>
        <Campo id="nota-observacao" rotulo="Observação" ajuda="Quando e para quem, se ajudar.">
          {(controle) => <Textarea {...controle} rows={2} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}
