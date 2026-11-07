'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, CheckCircle2, Copy, Send, TriangleAlert } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { CartaoDePainel, executar, ListaDePendencias, type Pendencia } from '@/componentes/f1/apoio';
import { PainelDeValidacao } from '@/componentes/f1/validacao';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { ErroDeRegra } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { historicoDoRegistro } from '@/dominio/historico';
import { cancelarVersaoDoDocumento, carregarDocumentosLegais, carregarInventario, compararTextos, esquemaRascunhoDocumento, novaVersaoDoDocumento, pendenciasParaPublicar, publicarVersao, registrarRevisaoSemAlteracoes, ROTULOS_BASE_LEGAL, ROTULOS_CATEGORIA_DADOS, ROTULOS_TIPO_DOCUMENTO_LEGAL, salvarRascunhoDoDocumento, type DadosDocumentos, type LinhaDocumentoLegal } from '@/dominio/legal';
import { ultimaValidacao } from '@/dominio/modelos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { SituacaoDoDocumento } from '../../tela-documentos';

function AbaVersaoAtual({ documento, dados }: { documento: LinhaDocumentoLegal; dados: DadosDocumentos }) {
  const versao = documento.atual;
  const editavel = versao.situacao === 'rascunho';
  const [texto, setTexto] = useState(versao.texto ?? '');
  const [resumo, setResumo] = useState(versao.resumo_mudancas ?? '');
  const [arquivo, setArquivo] = useState(versao.arquivo_url ?? '');
  const [url, setUrl] = useState(versao.url_publica ?? '');
  const [dataPublicacao, setDataPublicacao] = useState(hojeISO());
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [cancelando, setCancelando] = useState(false);
  const ultima = ultimaValidacao(dados.validacoes, versao.id);

  useEffect(() => {
    setTexto(versao.texto ?? '');
    setResumo(versao.resumo_mudancas ?? '');
    setArquivo(versao.arquivo_url ?? '');
    setUrl(versao.url_publica ?? '');
  }, [versao.id, versao.versao_registro]); // eslint-disable-line react-hooks/exhaustive-deps -- recomeça do que está salvo

  useEffect(() => {
    if (versao.situacao !== 'validado') return;
    void pendenciasParaPublicar({ ...versao, url_publica: url || null }, documento, dataPublicacao).then((lista) => setPendencias(lista.map((item, indice) => ({ id: String(indice), mensagem: item.mensagem, bloqueia: 'publicação', tipo: 'bloqueia' as const, ...(item.href.startsWith('/') ? { href: item.href } : {}) }))));
  }, [versao, documento, url, dataPublicacao]);

  const alterado = (versao.texto ?? '') !== texto || (versao.resumo_mudancas ?? '') !== resumo || (versao.arquivo_url ?? '') !== arquivo || (versao.url_publica ?? '') !== url;
  useAlteracoesPendentes(alterado);

  const salvar = () => {
    const lido = esquemaRascunhoDocumento.safeParse({ texto, resumo_mudancas: resumo, arquivo_url: arquivo, url_publica: url });
    if (!lido.success) return executar(() => Promise.reject(new ErroDeRegra(lido.error.issues[0]?.message ?? 'Confira os campos.')));
    return executar(() => salvarRascunhoDoDocumento(versao.id, lido.data), 'Versão salva.');
  };

  return (
    <div id="versao" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid min-w-0 gap-4">
        <CartaoDePainel titulo={`Versão V${versao.numero}`}>
          <div className="grid gap-[18px]">
            <Campo id="documento-texto" rotulo="Texto" obrigatorio ajuda="O sistema organiza e controla: o texto jurídico é de quem valida.">
              {(controle) => <Textarea {...controle} rows={12} disabled={!editavel} value={texto} onChange={(evento) => setTexto(evento.target.value)} />}
            </Campo>
            <Campo id="documento-resumo" rotulo="Resumo das mudanças">
              {(controle) => <Input {...controle} autoComplete="off" disabled={!editavel} value={resumo} onChange={(evento) => setResumo(evento.target.value)} />}
            </Campo>
            <Campo id="documento-arquivo" rotulo="Link do Drive (anexo)" ajuda="Opcional, como o PDF publicado.">
              {(controle) => <EntradaLinkDrive {...controle} link={arquivo} disabled={!editavel} value={arquivo} onChange={(evento) => setArquivo(evento.target.value)} />}
            </Campo>
            <Campo id="documento-url" rotulo="URL pública" ajuda="Exigida para publicar.">
              {(controle) => <Input {...controle} type="url" inputMode="url" spellCheck={false} disabled={versao.situacao !== 'rascunho' && versao.situacao !== 'validado'} value={url} onChange={(evento) => setUrl(evento.target.value)} />}
            </Campo>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(editavel || versao.situacao === 'validado') && (
              <Button variante={versao.situacao === 'validado' ? 'secundario' : 'primario'} disabled={!alterado} onClick={() => void salvar()}>
                Salvar versão
              </Button>
            )}
            {(editavel || versao.situacao === 'em_validacao' || versao.situacao === 'validado') && (
              <Button variante="terciario" onClick={() => setCancelando(true)}>
                <Ban aria-hidden />
                Cancelar esta versão
              </Button>
            )}
          </div>
        </CartaoDePainel>
        {versao.situacao === 'validado' && (
          <CartaoDePainel titulo="Publicar">
            <div className="grid gap-3">
              <Campo id="documento-data-publicacao" rotulo="Data de publicação" obrigatorio>
                {(controle) => <EntradaData {...controle} value={dataPublicacao} onChange={(evento) => setDataPublicacao(evento.target.value)} />}
              </Campo>
              <ListaDePendencias pendencias={pendencias} vazio="Tudo certo para publicar." rotulo="O que falta para publicar" />
              <Button className="justify-self-start" disabled={pendencias.length > 0 || alterado} onClick={() => void executar(() => publicarVersao(versao.id, dataPublicacao), 'Publicado.')}>
                <Send aria-hidden />
                Publicar
              </Button>
              {alterado && <p className="text-xs text-ink-soft">Salve a versão antes de publicar.</p>}
            </div>
          </CartaoDePainel>
        )}
      </div>
      <aside className="grid content-start gap-4">
        <PainelDeValidacao tipo="documento_legal_versao" registroId={versao.id} ultima={ultima} pessoas={dados.pessoas} podeEnviar={versao.situacao === 'rascunho'} validado={versao.situacao === 'validado' || versao.situacao === 'publicado'} />
        <ListaDeDados>
          <Dado rotulo="Publicado em">{versao.publicado_em ? formatarDiaISO(versao.publicado_em) : null}</Dado>
          <Dado rotulo="Próxima revisão">{documento.proxima_revisao ? formatarDiaISO(documento.proxima_revisao) : null}</Dado>
          {versao.revisado_sem_alteracoes_em && <Dado rotulo="Revisado sem alterações">{formatarDiaISO(versao.revisado_sem_alteracoes_em)}</Dado>}
        </ListaDeDados>
      </aside>
      <Confirmacao
        aberto={cancelando}
        aoFechar={() => setCancelando(false)}
        titulo="Cancelar esta versão?"
        texto="Ela continua no histórico, sem valer como documento."
        rotuloConfirmar="Cancelar versão"
        rotuloCancelar="Voltar"
        perigo
        pedirMotivo
        aoConfirmar={(motivo) => {
          setCancelando(false);
          void executar(() => cancelarVersaoDoDocumento(versao.id, motivo), 'Versão cancelada.');
        }}
      />
    </div>
  );
}

function AbaVersoes({ documento }: { documento: LinhaDocumentoLegal }) {
  const [a, setA] = useState(documento.versoes[1]?.id ?? '');
  const [b, setB] = useState(documento.versoes[0]?.id ?? '');
  const versaoA = documento.versoes.find((versao) => versao.id === a);
  const versaoB = documento.versoes.find((versao) => versao.id === b);
  const comparacao = versaoA && versaoB ? compararTextos(versaoA.texto ?? '', versaoB.texto ?? '') : null;
  const opcoes = documento.versoes.map((versao) => (
    <option key={versao.id} value={versao.id}>
      V{versao.numero}
    </option>
  ));
  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {documento.versoes.map((versao) => (
          <li key={versao.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
            <span className="font-semibold">V{versao.numero}</span>
            <SituacaoDoDocumento situacao={versao.situacao} />
            {versao.publicado_em && <span className="text-ink-soft">Publicado em {formatarDiaISO(versao.publicado_em)}</span>}
            {versao.substituido_em && <span className="text-ink-soft">Substituído em {formatarDiaISO(versao.substituido_em)}</span>}
            {versao.resumo_mudancas && <span className="w-full text-ink-soft">{versao.resumo_mudancas}</span>}
          </li>
        ))}
      </ul>
      {documento.versoes.length > 1 && (
        <CartaoDePainel titulo="Comparar versões">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Campo id="comparar-de" rotulo="De">
              {(controle) => (
                <Selecao {...controle} value={a} onChange={(evento) => setA(evento.target.value)}>
                  {opcoes}
                </Selecao>
              )}
            </Campo>
            <Campo id="comparar-para" rotulo="Para">
              {(controle) => (
                <Selecao {...controle} value={b} onChange={(evento) => setB(evento.target.value)}>
                  {opcoes}
                </Selecao>
              )}
            </Campo>
          </div>
          <div className="grid gap-0.5 text-[13px]">
            {comparacao?.map((linha, indice) => (
              <p key={indice} className={cn('rounded-sm px-2 py-0.5 break-words whitespace-pre-wrap', linha.tipo === 'entrou' && 'bg-ok-wash text-ok', linha.tipo === 'saiu' && 'bg-err-wash text-err line-through')}>
                <span className="sr-only">{linha.tipo === 'entrou' ? 'Entrou: ' : linha.tipo === 'saiu' ? 'Saiu: ' : ''}</span>
                {linha.texto || ' '}
              </p>
            ))}
          </div>
        </CartaoDePainel>
      )}
    </div>
  );
}

function AbaDadosTratados({ produtoId }: { produtoId: string | null }) {
  const consulta = useConsulta(carregarInventario);
  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro aoTentarDeNovo={consulta.recarregar} />;
  const proprias = consulta.dados.tratamentos.filter((tratamento) => tratamento.produto_id === produtoId && !tratamento.arquivado_em);
  if (!proprias.length) return <p className="text-sm text-ink-soft">Nenhuma operação no inventário deste contexto.</p>;
  return (
    <ul className="grid gap-2">
      {proprias.map((tratamento) => (
        <li key={tratamento.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
          <span className="block font-semibold">{tratamento.nome}</span>
          <span className="block text-ink-soft">
            {tratamento.finalidade} · {ROTULOS_BASE_LEGAL[tratamento.base_legal]} · {tratamento.categorias_dados.map((categoria) => ROTULOS_CATEGORIA_DADOS[categoria]).join(', ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro('documento_legal', id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T09.02, ficha: validação e publicação dentro do próprio registro. */
export function FichaDocumentoLegal() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarDocumentosLegais);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler o documento." aoTentarDeNovo={consulta.recarregar} />;
  const dados = consulta.dados;
  const documento = dados.documentos.find((item) => item.id === id);
  if (!documento) return <EstadoVazio icone={TriangleAlert} titulo="Documento não encontrado." texto="Ele pode ter sido removido." acao={<LinkCentral href="/legal">Voltar à lista</LinkCentral>} />;
  const produto = dados.produtos.find((item) => item.id === documento.produto_id);
  const emAndamento = documento.versoes.some((versao) => versao.situacao === 'rascunho' || versao.situacao === 'em_validacao' || versao.situacao === 'validado');

  return (
    <>
      <LinkCentral href="/legal" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Documentos legais
      </LinkCentral>
      {documento.revisao_necessaria && (
        <Faixa tipo="atencao" className="mb-4" acao={<Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => registrarRevisaoSemAlteracoes(documento.id), 'Revisão registrada.')}>Registrar revisão sem alterações</Button>}>
          Revisão necessária: {documento.revisao_motivo}
        </Faixa>
      )}
      <Ficha
        tituloDePagina
        codigo={documento.codigo}
        titulo={`${ROTULOS_TIPO_DOCUMENTO_LEGAL[documento.tipo]} · ${produto?.nome ?? 'Numa'}`}
        etiquetas={
          <>
            <SituacaoDoDocumento situacao={documento.atual.situacao} />
            {documento.vigente && <EtiquetaSituacao tipo="sucesso" icone={CheckCircle2}>Vigente: V{documento.vigente.numero}</EtiquetaSituacao>}
          </>
        }
        acoes={
          <>
            {documento.vigente && !documento.revisao_necessaria && (
              <Button variante="secundario" onClick={() => void executar(() => registrarRevisaoSemAlteracoes(documento.id), 'Revisão registrada.')}>
                Registrar revisão sem alterações
              </Button>
            )}
            {!emAndamento && (
              <Button onClick={() => void executar(() => novaVersaoDoDocumento(documento.id), 'Nova versão em rascunho.')}>
                <Copy aria-hidden />
                Nova versão
              </Button>
            )}
          </>
        }
        acoesCelular={
          !emAndamento ? (
            <Button onClick={() => void executar(() => novaVersaoDoDocumento(documento.id), 'Nova versão em rascunho.')}>
              <Copy aria-hidden />
              Nova versão
            </Button>
          ) : undefined
        }
        abas={[
          { id: 'atual', rotulo: 'Versão atual', conteudo: <AbaVersaoAtual key={documento.atual.id} documento={documento} dados={dados} /> },
          { id: 'versoes', rotulo: 'Versões', conteudo: <AbaVersoes documento={documento} /> },
          { id: 'dados', rotulo: 'Dados tratados', conteudo: <AbaDadosTratados produtoId={documento.produto_id} /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('documento_legal', documento.id)} dependencia={documento.id} vazio="Os alertas e as tarefas deste documento aparecem aqui." /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={documento.id} /> },
        ]}
      />
    </>
  );
}
