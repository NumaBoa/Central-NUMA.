'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { CLASSES_DE_INFORMACAO, TIPOS_DE_ARQUIVO, type ClasseDeInformacao, type TipoDeArquivo } from '@/dados/tipos/marketing';
import { classePadraoDoTipo, criarLote, formularioArquivoVazio, LIMITE_DO_LOTE, lerLote, ROTULOS_TIPO_ARQUIVO, type DadosDaBiblioteca, type LinhaDoLote } from '@/dominio/biblioteca';
import { AVISO_CLASSE_DRIVE, classeRestrita, DESCRICOES_CLASSE, ROTULOS_CLASSE } from '@/dominio/classes';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { opcoesDeContexto } from './apoio';

/** T08.03, ação em lote: colar vários links, com tipo e contexto comuns → prévia → criar. Título é por linha. */
export function DialogoLote({ dados, aoFechar }: { dados: DadosDaBiblioteca; aoFechar: () => void }) {
  const { pessoa, contexto } = useCentral();
  const vazio = useMemo(() => formularioArquivoVazio(pessoa.id, contexto.id), [pessoa.id, contexto.id]);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<TipoDeArquivo>(vazio.tipo);
  const [classe, setClasse] = useState<ClasseDeInformacao>(vazio.classe);
  const [classeTocada, setClasseTocada] = useState(false);
  const [contextos, setContextos] = useState<string[]>(vazio.contextos);
  const [responsavel, setResponsavel] = useState(vazio.responsavel_id);
  const [confirmada, setConfirmada] = useState(false);
  const [linhas, setLinhas] = useState<LinhaDoLote[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const restrita = classeRestrita(classe);
  const validas = linhas?.filter((linha) => !linha.problema) ?? [];
  const internas = pessoasDoSeletor(dados.pessoas);

  function verPrevia() {
    const lidas = lerLote(texto, { arquivos: dados.arquivos, versoes: dados.versoes });
    if (!lidas.length) return setErro('Cole ao menos um link.');
    if (!contextos.length) return setErro('Escolha a Numa ou ao menos um produto.');
    if (restrita && !confirmada) return setErro('Confirme que a pasta no Drive está restrita.');
    setErro(null);
    setLinhas(lidas);
  }

  async function criar() {
    if (!linhas) return;
    setGravando(true);
    try {
      const criados = await criarLote(linhas, { tipo, classe, contextos, responsavel_id: responsavel, pasta_restrita_confirmada: confirmada, etiquetas: [] });
      aviso(criados === 1 ? '1 arquivo adicionado à biblioteca.' : `${criados} arquivos adicionados à biblioteca.`);
      aoFechar();
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    } finally {
      setGravando(false);
    }
  }

  const faltaTitulo = validas.some((linha) => !linha.titulo.trim());

  return (
    <JanelaFormulario
      larga
      aberto
      aoFechar={aoFechar}
      titulo={linhas ? 'Prévia do cadastro em lote' : 'Adicionar em lote'}
      descricao={linhas ? `${validas.length} de ${linhas.length} podem ser criados. Nada foi gravado ainda.` : 'Um link por linha. Para já trazer o título, use: link ; título.'}
      alterado={Boolean(texto.trim())}
      salvando={gravando}
      rotuloSalvar={linhas ? `Criar ${validas.length} ${validas.length === 1 ? 'arquivo' : 'arquivos'}` : 'Ver prévia'}
      aoEnviar={(evento) => {
        evento.preventDefault();
        if (!linhas) verPrevia();
        else if (!validas.length) setErro('Nenhuma linha pode ser criada. Volte e confira os links.');
        else if (faltaTitulo) setErro('Dê um título a cada link que será criado.');
        else void criar();
      }}
    >
      <div className="grid gap-[18px]">
        {erro && (
          <div role="alert">
            <Faixa tipo="erro">{erro}</Faixa>
          </div>
        )}
        {!linhas ? (
          <>
            <Campo id="lote-links" rotulo="Links do Drive" obrigatorio ajuda={`Até ${LIMITE_DO_LOTE} por vez.`}>
              {(controle) => <Textarea {...controle} rows={6} spellCheck={false} value={texto} onChange={(evento) => setTexto(evento.target.value)} placeholder="https://drive.google.com/file/d/… ; Título do arquivo" />}
            </Campo>
            <div className="grid gap-[18px] md:grid-cols-2">
              <Campo id="lote-tipo" rotulo="Tipo" obrigatorio>
                {(controle) => (
                  <Selecao
                    {...controle}
                    value={tipo}
                    onChange={(evento) => {
                      const novo = evento.target.value as TipoDeArquivo;
                      setTipo(novo);
                      if (!classeTocada) setClasse(classePadraoDoTipo(novo));
                    }}
                  >
                    {TIPOS_DE_ARQUIVO.map((valor) => (
                      <option key={valor} value={valor}>
                        {ROTULOS_TIPO_ARQUIVO[valor]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Campo id="lote-classe" rotulo="Classe" obrigatorio ajuda={DESCRICOES_CLASSE[classe]}>
                {(controle) => (
                  <Selecao
                    {...controle}
                    value={classe}
                    onChange={(evento) => {
                      setClasseTocada(true);
                      setClasse(evento.target.value as ClasseDeInformacao);
                    }}
                  >
                    {CLASSES_DE_INFORMACAO.map((valor) => (
                      <option key={valor} value={valor}>
                        {ROTULOS_CLASSE[valor]}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </div>
            <PilulasMultiplas rotulo="Contexto" obrigatorio valores={contextos} aoMudar={setContextos} opcoes={opcoesDeContexto(dados.produtos)} />
            <Campo id="lote-responsavel" rotulo="Responsável" obrigatorio>
              {(controle) => (
                <Selecao {...controle} value={responsavel} onChange={(evento) => setResponsavel(evento.target.value)}>
                  {internas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome_completo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            {restrita && (
              <label className="flex min-h-11 items-start gap-2.5 text-[13px] font-semibold">
                <input type="checkbox" className="mt-0.5 size-[18px]" checked={confirmada} onChange={(evento) => setConfirmada(evento.target.checked)} />
                Confirmei que as pastas no Drive estão restritas
              </label>
            )}
            <Faixa tipo="info">{AVISO_CLASSE_DRIVE}</Faixa>
          </>
        ) : (
          <>
            <ol aria-label="Links da prévia" className="grid gap-2">
              {linhas.map((linha) => (
                <li key={linha.numero} className="rounded-md border border-line p-3 text-[13px]">
                  <div className="flex items-start gap-2">
                    {linha.problema ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-err" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-ink-soft">
                        Linha {linha.numero}: {linha.link}
                      </p>
                      {linha.problema ? (
                        <p className="mt-1 text-err">
                          Não será criado. {linha.problema}{' '}
                          {linha.duplicado && (
                            <LinkCentral href={`/marketing/arquivos/${linha.duplicado.arquivoId}`} className="inline-flex min-h-11 items-center font-semibold underline md:min-h-0">
                              Abrir o existente
                            </LinkCentral>
                          )}
                        </p>
                      ) : (
                        <Campo id={`lote-titulo-${linha.numero}`} rotulo="Título" obrigatorio className="mt-2">
                          {(controle) => <Input autoComplete="off" {...controle} value={linha.titulo} onChange={(evento) => setLinhas((atuais) => (atuais ?? []).map((item) => (item.numero === linha.numero ? { ...item, titulo: evento.target.value } : item)))} />}
                        </Campo>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="inline-flex min-h-11 items-center justify-self-start text-[13px] font-semibold text-indigo-dk underline md:min-h-0" onClick={() => setLinhas(null)}>
              Voltar e mudar os links
            </button>
          </>
        )}
      </div>
    </JanelaFormulario>
  );
}
