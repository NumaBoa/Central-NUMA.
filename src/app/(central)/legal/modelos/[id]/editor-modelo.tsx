'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, CopyPlus, Plus, Save, Trash2, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { CartaoDePainel, executar } from '@/componentes/f1/apoio';
import { DocumentoRenderizadoVista } from '@/componentes/f1/documento';
import { PainelDeValidacao } from '@/componentes/f1/validacao';
import { InsercaoDeVariaveis } from '@/componentes/f1/variaveis';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';
import { repositorios } from '@/dados/repositorios';
import type { BlocoModelo, ModeloVersao } from '@/dados/tipos/legal';
import { useConsulta } from '@/dados/use-consulta';
import { DICIONARIO_VARIAVEIS } from '@/dominio/modelo-variaveis';
import { atualizarBloco, carregarEditorDeModelo, errosDaEstrutura, moverBloco, novaVersaoDoModelo, novoBloco, pendenciasParaValidarModelo, removerBloco, renderizarVersao, ROTULOS_SITUACAO_MODELO, ROTULOS_TIPO_BLOCO, salvarEstruturaDoModelo, ultimaValidacao, variaveisDaEstrutura, type DadosDoEditorDeModelo } from '@/dominio/modelos';
import { SituacaoDoModelo } from '../tela-modelos';

const DADOS_DE_PREVIA = { itens: [{ descricao: 'Item de exemplo', quantidade: 1, valor_formatado: 'R$ 0,00', periodicidade_texto: 'Mensal' }], assinaturas: [{ nome: 'Nome de exemplo', papel: 'Pela Numa' }], totais_texto: 'Totais de exemplo: só para a prévia.' };

function EditorDeBloco({ bloco, dados, somenteLeitura, aoMudar, aoMover, aoRemover, nivel = 0 }: { bloco: BlocoModelo; dados: DadosDoEditorDeModelo; somenteLeitura: boolean; aoMudar: (id: string, parcial: Partial<BlocoModelo>) => void; aoMover: (id: string, passo: -1 | 1) => void; aoRemover: (id: string) => void; nivel?: number }) {
  const [aberto, setAberto] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const clausulasDisponiveis = dados.clausulas.filter((clausula) => clausula.versoes.some((versao) => versao.situacao !== 'obsoleta' || versao.id === bloco.clausula_versao_id));
  const rotulo = bloco.titulo ?? ROTULOS_TIPO_BLOCO[bloco.tipo];
  const versaoLigada = dados.versoesDeClausula.find((versao) => versao.id === bloco.clausula_versao_id);
  const ultimaDaClausula = versaoLigada ? dados.clausulas.find((clausula) => clausula.id === versaoLigada.clausula_id)?.atual : null;
  return (
    <li className="min-w-0 overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <button type="button" aria-expanded={aberto} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-semibold md:min-h-9" onClick={() => setAberto((atual) => !atual)}>
          <span className="truncate">{rotulo}</span>
          <EtiquetaLivre>{ROTULOS_TIPO_BLOCO[bloco.tipo]}</EtiquetaLivre>
        </button>
        {!somenteLeitura && (
          <span className="flex">
            <Button variante="icone" tamanho="icone" aria-label={`Subir ${rotulo}`} onClick={() => aoMover(bloco.id, -1)}>
              <ArrowUp aria-hidden />
            </Button>
            <Button variante="icone" tamanho="icone" aria-label={`Descer ${rotulo}`} onClick={() => aoMover(bloco.id, 1)}>
              <ArrowDown aria-hidden />
            </Button>
            <Button variante="icone" tamanho="icone" aria-label={`Tirar ${rotulo}`} onClick={() => aoRemover(bloco.id)}>
              <Trash2 aria-hidden />
            </Button>
          </span>
        )}
      </div>
      {aberto && (
        <div className="grid gap-3 border-t border-line p-3">
          {bloco.tipo !== 'assinaturas' && bloco.tipo !== 'tabela_itens' && (
            <Campo id={`bloco-${bloco.id}-titulo`} rotulo="Título do bloco" ajuda="Só organiza a estrutura; não sai no documento.">
              {(controle) => <Input {...controle} autoComplete="off" disabled={somenteLeitura} value={bloco.titulo ?? ''} onChange={(evento) => aoMudar(bloco.id, { titulo: evento.target.value || null })} />}
            </Campo>
          )}
          {bloco.tipo === 'texto' && (
            <>
              <Campo id={`bloco-${bloco.id}-texto`} rotulo="Texto">
                {(controle) => <Textarea {...controle} ref={campo} rows={Math.min(16, Math.max(5, (bloco.conteudo ?? '').split('\n').length + 1))} disabled={somenteLeitura} value={bloco.conteudo ?? ''} onChange={(evento) => aoMudar(bloco.id, { conteudo: evento.target.value })} />}
              </Campo>
              {!somenteLeitura && (
                <InsercaoDeVariaveis
                  aoInserir={(trecho) => {
                    const atual = bloco.conteudo ?? '';
                    const inicio = campo.current?.selectionStart ?? atual.length;
                    aoMudar(bloco.id, { conteudo: `${atual.slice(0, inicio)}${trecho}${atual.slice(campo.current?.selectionEnd ?? inicio)}` });
                  }}
                />
              )}
            </>
          )}
          {bloco.tipo === 'clausula' && (
            <>
              <Campo id={`bloco-${bloco.id}-clausula`} rotulo="Cláusula e versão" obrigatorio ajuda="A versão fica presa: novas versões não entram sozinhas.">
                {(controle) => (
                  <Selecao {...controle} disabled={somenteLeitura} value={bloco.clausula_versao_id ?? ''} onChange={(evento) => aoMudar(bloco.id, { clausula_versao_id: evento.target.value || null })}>
                    <option value="">Escolha</option>
                    {clausulasDisponiveis.flatMap((clausula) =>
                      clausula.versoes.map((versao) => (
                        <option key={versao.id} value={versao.id}>
                          {clausula.codigo} V{versao.numero} ({versao.situacao === 'validada' ? 'validada' : versao.situacao === 'rascunho' ? 'rascunho' : 'obsoleta'})
                        </option>
                      )),
                    )}
                  </Selecao>
                )}
              </Campo>
              {versaoLigada && ultimaDaClausula && ultimaDaClausula.numero > versaoLigada.numero && (
                <Faixa acao={!somenteLeitura ? <Button variante="secundario" tamanho="pequeno" onClick={() => aoMudar(bloco.id, { clausula_versao_id: ultimaDaClausula.id })}>Atualizar para V{ultimaDaClausula.numero}</Button> : undefined}>
                  Existe a V{ultimaDaClausula.numero} desta cláusula. O modelo segue na V{versaoLigada.numero} até você atualizar.
                </Faixa>
              )}
              {versaoLigada && <p className="max-h-40 overflow-y-auto rounded-md bg-linen p-3 text-[13px] whitespace-pre-wrap">{versaoLigada.texto}</p>}
            </>
          )}
          {bloco.tipo === 'condicional' && (
            <>
              <Campo id={`bloco-${bloco.id}-condicao`} rotulo="Aparece se" obrigatorio ajuda='Derivada dos dados na geração, como contrato.periodicidade = "anual".'>
                {(controle) => <Input {...controle} autoComplete="off" spellCheck={false} disabled={somenteLeitura} value={bloco.condicao ?? ''} onChange={(evento) => aoMudar(bloco.id, { condicao: evento.target.value })} />}
              </Campo>
              <ListaDeBlocos blocos={bloco.blocos} dados={dados} somenteLeitura={somenteLeitura} aoMudar={aoMudar} aoMover={aoMover} aoRemover={aoRemover} nivel={nivel + 1} />
              {!somenteLeitura && <AcrescentarBloco aoAcrescentar={(novo) => aoMudar(bloco.id, { blocos: [...bloco.blocos, novo] })} semCondicional={nivel >= 2} />}
            </>
          )}
          {bloco.tipo === 'tabela_itens' && <p className="text-[13px] text-ink-soft">Os itens da proposta ou do contrato, com os totais separados por natureza.</p>}
          {bloco.tipo === 'assinaturas' && <p className="text-[13px] text-ink-soft">Os signatários da emissão, um por linha.</p>}
        </div>
      )}
    </li>
  );
}

function ListaDeBlocos({ blocos, ...resto }: { blocos: readonly BlocoModelo[]; dados: DadosDoEditorDeModelo; somenteLeitura: boolean; aoMudar: (id: string, parcial: Partial<BlocoModelo>) => void; aoMover: (id: string, passo: -1 | 1) => void; aoRemover: (id: string) => void; nivel?: number }) {
  return (
    <ol className="grid gap-1.5">
      {blocos.map((bloco) => (
        <EditorDeBloco key={bloco.id} bloco={bloco} {...resto} />
      ))}
    </ol>
  );
}

function AcrescentarBloco({ aoAcrescentar, semCondicional = false }: { aoAcrescentar: (bloco: BlocoModelo) => void; semCondicional?: boolean }) {
  const tipos: readonly BlocoModelo['tipo'][] = semCondicional ? ['clausula', 'texto', 'tabela_itens', 'assinaturas'] : ['clausula', 'texto', 'tabela_itens', 'condicional', 'assinaturas'];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[13px] font-semibold">Acrescentar:</span>
      {tipos.map((tipo) => (
        <Button key={tipo} variante="secundario" tamanho="pequeno" onClick={() => aoAcrescentar(novoBloco(tipo))}>
          <Plus aria-hidden />
          {ROTULOS_TIPO_BLOCO[tipo]}
        </Button>
      ))}
    </div>
  );
}

function EditorDaVersao({ versao, dados, pessoas }: { versao: ModeloVersao; dados: DadosDoEditorDeModelo; pessoas: readonly { id: string; nome_completo: string }[] }) {
  const ultima = ultimaValidacao(dados.validacoes, versao.id);
  const pendente = ultima?.situacao === 'pendente';
  const editavel = versao.situacao === 'rascunho' && !pendente;
  const [estrutura, setEstrutura] = useState<BlocoModelo[]>(versao.estrutura);
  const [cabecalho, setCabecalho] = useState(versao.cabecalho ?? '');
  const [observacoes, setObservacoes] = useState(versao.observacoes ?? '');
  const [opcionais, setOpcionais] = useState<string[]>(versao.variaveis.filter((variavel) => !variavel.obrigatoria).map((variavel) => variavel.nome));
  useEffect(() => {
    setEstrutura(versao.estrutura);
    setCabecalho(versao.cabecalho ?? '');
    setObservacoes(versao.observacoes ?? '');
  }, [versao.id, versao.versao_registro]); // eslint-disable-line react-hooks/exhaustive-deps -- recomeça do que está salvo

  const alterado = JSON.stringify(estrutura) !== JSON.stringify(versao.estrutura) || cabecalho !== (versao.cabecalho ?? '') || observacoes !== (versao.observacoes ?? '') || JSON.stringify([...opcionais].sort()) !== JSON.stringify(versao.variaveis.filter((variavel) => !variavel.obrigatoria).map((variavel) => variavel.nome).sort());
  useAlteracoesPendentes(alterado);

  const variaveis = useMemo(() => variaveisDaEstrutura(estrutura, dados.versoesDeClausula), [estrutura, dados.versoesDeClausula]);
  const erros = useMemo(() => errosDaEstrutura(estrutura, dados.versoesDeClausula), [estrutura, dados.versoesDeClausula]);
  const previa = useMemo(() => renderizarVersao({ estrutura, variaveis: variaveis.map((nome) => ({ nome, origem: '', formato: '', obrigatoria: !opcionais.includes(nome) })) }, dados.versoesDeClausula, DADOS_DE_PREVIA), [estrutura, variaveis, opcionais, dados.versoesDeClausula]);
  const pendenciasValidar = useMemo(() => pendenciasParaValidarModelo({ estrutura }, dados.versoesDeClausula), [estrutura, dados.versoesDeClausula]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 gap-4">
        {versao.aviso && <Faixa tipo="atencao">{versao.aviso}</Faixa>}
        {!editavel && <Faixa>{pendente ? 'Esta versão está aguardando a validação: decida antes de editar.' : `Versão ${ROTULOS_SITUACAO_MODELO[versao.situacao].toLowerCase()}: não muda mais. Para alterar, crie uma nova versão. O que já foi emitido não muda (CA-11.04).`}</Faixa>}
        {erros.map((erro) => (
          <Faixa key={erro} tipo="erro">
            {erro}
          </Faixa>
        ))}
        <Tabs defaultValue="estrutura" className="min-w-0">
          <TabsList aria-label="Editor do modelo">
            <TabsTrigger value="estrutura">Estrutura</TabsTrigger>
            <TabsTrigger value="previa">Prévia</TabsTrigger>
            <TabsTrigger value="versoes">Versões</TabsTrigger>
          </TabsList>
          <TabsContent value="estrutura" className="mt-4 grid gap-3">
            {!estrutura.length && <p className="text-sm text-ink-soft">Nenhum bloco ainda. Comece por uma cláusula ou um texto.</p>}
            <ListaDeBlocos
              blocos={estrutura}
              dados={dados}
              somenteLeitura={!editavel}
              aoMudar={(id, parcial) => setEstrutura((atual) => atualizarBloco(atual, id, parcial))}
              aoMover={(id, passo) => setEstrutura((atual) => moverBloco(atual, id, passo))}
              aoRemover={(id) => setEstrutura((atual) => removerBloco(atual, id))}
            />
            {editavel && <AcrescentarBloco aoAcrescentar={(bloco) => setEstrutura((atual) => [...atual, bloco])} />}
          </TabsContent>
          <TabsContent value="previa" className="mt-4 grid gap-3">
            <Faixa>Prévia sem dados reais: as variáveis aparecem como pendentes, e a tabela e as assinaturas são só para ver a forma. Os dados de cada documento vêm da emissão.</Faixa>
            <DocumentoRenderizadoVista nos={previa.nos} rascunho />
          </TabsContent>
          <TabsContent value="versoes" className="mt-4">
            <ul className="grid gap-2">
              {dados.modelo.versoes.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper px-3.5 py-2.5 text-[13px]">
                  <span className="font-semibold">v{item.rotulo_versao}</span>
                  <SituacaoDoModelo situacao={item.situacao} />
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </div>
      <aside className="grid content-start gap-4">
        {editavel && (
          <Button disabled={!alterado || erros.length > 0} onClick={() => void executar(() => salvarEstruturaDoModelo(versao.id, { estrutura, cabecalho, observacoes, opcionais }), 'Rascunho salvo.')}>
            <Save aria-hidden />
            Salvar rascunho
          </Button>
        )}
        {versao.situacao !== 'rascunho' && (
          <Button variante="secundario" onClick={() => void executar(() => novaVersaoDoModelo(dados.modelo.id), 'Nova versão em rascunho.')}>
            <CopyPlus aria-hidden />
            Nova versão
          </Button>
        )}
        <PainelDeValidacao tipo="modelo_versao" registroId={versao.id} ultima={ultima} pessoas={pessoas} podeEnviar={versao.situacao === 'rascunho'} validado={versao.situacao === 'validada'} avisoValidar={pendente ? versao.aviso : null} naoEnviar={alterado ? 'Salve o rascunho antes de enviar.' : (pendenciasValidar[0] ?? null)} />
        <CartaoDePainel titulo={`Variáveis (${variaveis.length})`}>
          {!variaveis.length && <p className="text-[13px] text-ink-soft">Nenhuma variável na estrutura.</p>}
          <ul className="grid max-h-80 gap-1 overflow-y-auto text-xs">
            {variaveis.map((nome) => {
              const conhecida = DICIONARIO_VARIAVEIS[nome];
              return (
                <li key={nome} className="flex items-start justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                  <span className="min-w-0 break-all">
                    <span className="font-mono">{nome}</span>
                    <span className={conhecida ? 'block text-ink-soft' : 'block font-semibold text-err'}>{conhecida?.origem ?? 'Fora do dicionário'}</span>
                  </span>
                  <label className="flex min-h-11 shrink-0 items-center gap-1.5 md:min-h-0">
                    <input type="checkbox" disabled={!editavel} checked={!opcionais.includes(nome)} onChange={(evento) => setOpcionais((atuais) => (evento.target.checked ? atuais.filter((item) => item !== nome) : [...atuais, nome]))} />
                    Obrigatória
                  </label>
                </li>
              );
            })}
          </ul>
        </CartaoDePainel>
        <CartaoDePainel titulo="Observações">
          <div className="grid gap-3">
            <Campo id="modelo-cabecalho" rotulo="Cabeçalho ou rodapé">
              {(controle) => <Input {...controle} autoComplete="off" disabled={!editavel} value={cabecalho} onChange={(evento) => setCabecalho(evento.target.value)} />}
            </Campo>
            <Campo id="modelo-observacoes" rotulo="Observações sobre o uso">
              {(controle) => <Textarea {...controle} rows={3} disabled={!editavel} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} />}
            </Campo>
          </div>
        </CartaoDePainel>
      </aside>
    </div>
  );
}

async function carregar(id: string) {
  const [editor, pessoas] = await Promise.all([carregarEditorDeModelo(id), repositorios.pessoa.listar({ incluirArquivados: true })]);
  return { editor, pessoas };
}

/** T09.07, editor: estrutura de blocos, variáveis, prévia e validação no próprio registro. */
export function EditorDeModelo() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregar(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler o modelo." aoTentarDeNovo={consulta.recarregar} />;
  const { editor, pessoas } = consulta.dados;
  if (!editor?.modelo.atual) return <EstadoVazio icone={TriangleAlert} titulo="Modelo não encontrado." texto="Ele pode ter sido removido." acao={<LinkCentral href="/legal/modelos">Voltar à lista</LinkCentral>} />;
  const versao = editor.modelo.atual;
  return (
    <>
      <LinkCentral href="/legal/modelos" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Modelos de documentos
      </LinkCentral>
      <CabecalhoPagina
        kicker={editor.modelo.codigo}
        titulo={editor.modelo.nome}
        resumo={
          <span className="flex flex-wrap items-center gap-2">
            v{versao.rotulo_versao} <SituacaoDoModelo situacao={versao.situacao} />
          </span>
        }
      />
      <div className="mt-5">
        <EditorDaVersao key={versao.id} versao={versao} dados={editor} pessoas={pessoas} />
      </div>
    </>
  );
}
