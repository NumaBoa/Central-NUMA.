'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CircleCheck, CircleOff, Download, Ellipsis, FileUp, Megaphone, ShieldCheck, Target, UserPlus, UsersRound } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { executar, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { EtiquetaDoContexto, EtiquetaDoInscrito, EtiquetaElegibilidade } from '@/componentes/marketing/apoio';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import type { FiltroAtivo } from '@/componentes/padroes/filtros';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { ORIGENS_DE_INSCRITO, type ConsentimentoTexto, type Inscrito, type ListaEspera } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { historicoDaLista } from '@/dominio/historico-m08';
import { adicionarInscrito, carregarListas, confirmarImportacao, contadoresDaLista, textoDaContagem, descadastrar, elegibilidadeDoInscrito, esquemaFormularioInscrito, esquemaNovoTexto, exportarInscritos, filtrarInscritos, FILTROS_INSCRITOS_INICIAIS, FORMULARIO_INSCRITO_VAZIO, inscritosDaLista, inscritosPorOrigem, inscritosPorSemana, marcarConvertido, marcarConvidados, MODELO_DE_IMPORTACAO, mudarSituacaoDaLista, previaDaImportacao, publicarNovoTexto, registrarConsentimento, ROTULOS_ELEGIBILIDADE, ROTULOS_ORIGEM_INSCRITO, ROTULOS_RESULTADO_DA_LINHA, ROTULOS_SITUACAO_INSCRITO, textoVigente, tratamentosDaLista, type DadosDasListas, type FiltrosInscritos, type FormularioInscrito, type PreviaDaImportacao, type ResultadoDaLinha } from '@/dominio/listas-espera';
import { baixarArquivo } from '@/lib/baixar-arquivo';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const CAMINHO = '/marketing/listas';

const versaoDe = (inscrito: Pick<Inscrito, 'consentimento_versao_id'>, textos: readonly ConsentimentoTexto[]) => textos.find((texto) => texto.id === inscrito.consentimento_versao_id)?.versao ?? null;

function DialogoAdicionar({ lista, dados, textos, aoFechar }: { lista: ListaEspera; dados: DadosDasListas; textos: readonly ConsentimentoTexto[]; aoFechar: () => void }) {
  const [valores, setValores] = useState<FormularioInscrito>(FORMULARIO_INSCRITO_VAZIO);
  const [erros, setErros] = useState<Partial<Record<keyof FormularioInscrito, string>>>({});
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<FormularioInscrito>) => setValores((atuais) => ({ ...atuais, ...parcial }));
  const alterado = Object.values(valores).some(Boolean);

  async function confirmar() {
    const conferido = esquemaFormularioInscrito.safeParse(valores);
    if (!conferido.success) {
      setErros(Object.fromEntries(conferido.error.issues.map((problema) => [problema.path[0], problema.message])));
      return;
    }
    setSalvando(true);
    try {
      await adicionarInscrito(lista.id, conferido.data);
      aviso(conferido.data.consentimento_versao_id ? 'Pessoa incluída, apta para marketing.' : 'Pessoa incluída, pendente de consentimento: não recebe marketing.');
      aoFechar();
    } catch (erro) {
      setErros({ email: mensagemDoErro(erro) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo="Adicionar pessoa"
      descricao="Dados pessoais (classe INT). Sem consentimento registrado, a pessoa entra na lista, mas não recebe marketing."
      alterado={alterado}
      rotuloSalvar="Adicionar"
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void confirmar();
      }}
    >
      <div className="grid gap-[18px]">
        <Campo id="inscrito-email" rotulo="E-mail" obrigatorio erro={erros.email}>
          {(controle) => <Input type="email" autoComplete="off" {...controle} value={valores.email} onChange={(evento) => mudar({ email: evento.target.value })} />}
        </Campo>
        <Campo id="inscrito-nome" rotulo="Nome">
          {(controle) => <Input autoComplete="off" {...controle} value={valores.nome} onChange={(evento) => mudar({ nome: evento.target.value })} />}
        </Campo>
        <div className="grid gap-[18px] md:grid-cols-2">
          <Campo id="inscrito-origem" rotulo="Origem">
            {(controle) => (
              <Selecao {...controle} value={valores.origem} onChange={(evento) => mudar({ origem: evento.target.value })}>
                <option value="">Não informada</option>
                {ORIGENS_DE_INSCRITO.map((origem) => (
                  <option key={origem} value={origem}>
                    {ROTULOS_ORIGEM_INSCRITO[origem]}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="inscrito-campanha" rotulo="Campanha">
            {(controle) => (
              <Selecao {...controle} value={valores.campanha_id} onChange={(evento) => mudar({ campanha_id: evento.target.value })}>
                <option value="">Nenhuma</option>
                {dados.campanhas
                  .filter((campanha) => !campanha.arquivado_em)
                  .map((campanha) => (
                    <option key={campanha.id} value={campanha.id}>
                      {campanha.nome}
                    </option>
                  ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="inscrito-versao" rotulo="Versão do texto aceita" erro={erros.consentimento_versao_id}>
            {(controle) => (
              <Selecao {...controle} value={valores.consentimento_versao_id} onChange={(evento) => mudar({ consentimento_versao_id: evento.target.value })}>
                <option value="">Sem consentimento registrado</option>
                {textos.map((texto) => (
                  <option key={texto.id} value={texto.id}>
                    Versão {texto.versao}, desde {formatarDiaISO(texto.vigente_desde)}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="inscrito-data" rotulo="Consentiu em" erro={erros.consentido_em}>
            {(controle) => <EntradaData {...controle} value={valores.consentido_em} onChange={(evento) => mudar({ consentido_em: evento.target.value })} />}
          </Campo>
        </div>
      </div>
    </JanelaFormulario>
  );
}

function DialogoConsentimento({ inscrito, textos, aoFechar }: { inscrito: Inscrito; textos: readonly ConsentimentoTexto[]; aoFechar: () => void }) {
  const hoje = hojeISO();
  const [versao, setVersao] = useState(textoVigente(textos, hoje)?.id ?? '');
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState<string | undefined>();
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao telaCheia>
        <DialogTitle>Registrar consentimento</DialogTitle>
        <DialogDescription className="mt-3 leading-[1.6]">Registre só o que a pessoa de fato aceitou: a versão do texto e a data.</DialogDescription>
        <div className="mt-4 grid gap-4">
          <Campo id="consentimento-versao" rotulo="Versão do texto" obrigatorio erro={erro}>
            {(controle) => (
              <Selecao {...controle} value={versao} onChange={(evento) => setVersao(evento.target.value)}>
                <option value="">Escolha</option>
                {textos.map((texto) => (
                  <option key={texto.id} value={texto.id}>
                    Versão {texto.versao}, desde {formatarDiaISO(texto.vigente_desde)}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="consentimento-data" rotulo="Consentiu em" obrigatorio>
            {(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}
          </Campo>
        </div>
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button
            onClick={() =>
              void registrarConsentimento(inscrito.id, versao, data)
                .then(() => {
                  aviso('Consentimento registrado.');
                  aoFechar();
                })
                .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
            }
          >
            Registrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TONS_DO_RESULTADO: Readonly<Record<ResultadoDaLinha, 'sucesso' | 'info' | 'neutro' | 'erro'>> = { novo: 'sucesso', consentimento: 'info', ja_inscrito: 'neutro', descadastrado: 'neutro', erro: 'erro' };

/** RT-24: prévia com erros por linha; só grava depois de confirmar (CA-08.03 e CA-08.04). */
function DialogoImportar({ lista, dados, textos, inscritos, aoFechar }: { lista: ListaEspera; dados: DadosDasListas; textos: readonly ConsentimentoTexto[]; inscritos: readonly Inscrito[]; aoFechar: () => void }) {
  const [csv, setCsv] = useState('');
  const [previa, setPrevia] = useState<PreviaDaImportacao | null>(null);
  const [gravando, setGravando] = useState(false);
  const aGravar = previa ? previa.resumo.novo + previa.resumo.consentimento : 0;

  function ver() {
    setPrevia(previaDaImportacao(csv, textos, inscritos, dados.campanhas));
  }

  async function confirmar() {
    if (!previa) return;
    setGravando(true);
    try {
      const { novos, consentimentos } = await confirmarImportacao(lista.id, previa);
      aviso(`${novos} ${novos === 1 ? 'pessoa entrou' : 'pessoas entraram'} na lista${consentimentos ? `, e ${consentimentos} ${consentimentos === 1 ? 'teve' : 'tiveram'} o consentimento registrado` : ''}.`);
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setGravando(false);
    }
  }

  return (
    <JanelaFormulario
      larga
      aberto
      aoFechar={aoFechar}
      titulo="Importar inscritos"
      descricao="Colunas obrigatórias: e-mail, versão do consentimento e data do consentimento. Nada é gravado antes de confirmar."
      alterado={Boolean(csv.trim())}
      salvando={gravando}
      rotuloSalvar={!previa || previa.erroGeral ? 'Ver prévia' : `Importar ${aGravar} ${aGravar === 1 ? 'linha' : 'linhas'}`}
      aoEnviar={(evento) => {
        evento.preventDefault();
        if (!previa || previa.erroGeral) ver();
        else if (!aGravar) aviso('Nenhuma linha pode ser importada. Confira os erros.');
        else void confirmar();
      }}
    >
      <div className="grid gap-[18px]">
        {!previa || previa.erroGeral ? (
          <>
            {previa?.erroGeral && (
              <div role="alert">
                <Faixa tipo="erro">{previa.erroGeral}</Faixa>
              </div>
            )}
            <Campo id="importar-arquivo" rotulo="Arquivo CSV" ajuda="O arquivo é lido neste navegador. Não vai para lugar nenhum.">
              {(controle) => (
                <input
                  {...controle}
                  type="file"
                  accept=".csv,text/csv"
                  className="block min-h-11 w-full text-[13px]"
                  onChange={(evento) => {
                    const arquivo = evento.target.files?.[0];
                    if (arquivo) void arquivo.text().then((texto) => { setCsv(texto); setPrevia(null); });
                  }}
                />
              )}
            </Campo>
            <Campo id="importar-texto" rotulo="Ou cole o conteúdo">
              {(controle) => (
                <Textarea
                  {...controle}
                  rows={7}
                  spellCheck={false}
                  placeholder={MODELO_DE_IMPORTACAO}
                  value={csv}
                  onChange={(evento) => {
                    setCsv(evento.target.value);
                    setPrevia(null);
                  }}
                />
              )}
            </Campo>
            <button type="button" className="inline-flex min-h-11 items-center justify-self-start text-[13px] font-semibold text-indigo-dk underline md:min-h-0" onClick={() => baixarArquivo('modelo-inscritos.csv', `﻿${MODELO_DE_IMPORTACAO}`, 'text/csv;charset=utf-8')}>
              Baixar o modelo
            </button>
            <p className="text-[13px] text-ink-soft">
              Versões desta lista: {textos.map((texto) => `v${texto.versao} (desde ${formatarDiaISO(texto.vigente_desde)})`).join(', ')}.
            </p>
          </>
        ) : (
          <>
            <ul aria-label="Resumo da prévia" className="flex flex-wrap gap-1.5">
              {(Object.keys(ROTULOS_RESULTADO_DA_LINHA) as ResultadoDaLinha[])
                .filter((resultado) => previa.resumo[resultado])
                .map((resultado) => (
                  <li key={resultado}>
                    <EtiquetaSituacao tipo={TONS_DO_RESULTADO[resultado]}>
                      {ROTULOS_RESULTADO_DA_LINHA[resultado]}: {previa.resumo[resultado]}
                    </EtiquetaSituacao>
                  </li>
                ))}
            </ul>
            <div className="faixa-rolagem rounded-md border border-line">
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <caption className="sr-only">Prévia da importação, linha a linha</caption>
                <thead>
                  <tr>
                    {['Linha', 'E-mail', 'Resultado', 'Detalhe'].map((coluna) => (
                      <th key={coluna} scope="col" className="bg-mist px-3 py-2 text-left font-semibold whitespace-nowrap text-ink-soft">
                        {coluna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previa.linhas.map((linha) => (
                    <tr key={linha.numero}>
                      <td className="border-t border-line px-3 py-2 tabular-nums">{linha.numero}</td>
                      <td className="border-t border-line px-3 py-2 break-all">{linha.email || '—'}</td>
                      <td className="border-t border-line px-3 py-2 whitespace-nowrap">
                        <EtiquetaSituacao tipo={TONS_DO_RESULTADO[linha.resultado]}>{ROTULOS_RESULTADO_DA_LINHA[linha.resultado]}</EtiquetaSituacao>
                      </td>
                      <td className="min-w-40 border-t border-line px-3 py-2 text-ink-soft">{linha.mensagem ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="inline-flex min-h-11 items-center justify-self-start text-[13px] font-semibold text-indigo-dk underline md:min-h-0" onClick={() => setPrevia(null)}>
              Voltar e mudar o arquivo
            </button>
          </>
        )}
      </div>
    </JanelaFormulario>
  );
}

function Inscritos({ lista, dados, textos, inscritos, somenteLeitura }: { lista: ListaEspera; dados: DadosDasListas; textos: readonly ConsentimentoTexto[]; inscritos: readonly Inscrito[]; somenteLeitura: boolean }) {
  const [filtros, setFiltros] = useState<FiltrosInscritos>(FILTROS_INSCRITOS_INICIAIS);
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(new Set());
  const [consentindo, setConsentindo] = useState<Inscrito | null>(null);
  const [descadastrando, setDescadastrando] = useState<Inscrito | null>(null);
  const linhas = useMemo(() => filtrarInscritos(inscritos, filtros), [inscritos, filtros]);
  const contagem = contadoresDaLista(inscritos);
  const campanhas = dados.campanhas.filter((campanha) => inscritos.some((inscrito) => inscrito.campanha_id === campanha.id));

  const colunas = useMemo<readonly Coluna<Inscrito>[]>(
    () => [
      { id: 'pessoa', titulo: 'Pessoa', fixa: true, essencial: true, ordenar: (a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email, 'pt-BR'), celula: (inscrito) => <span className="grid min-w-44 gap-0.5"><span className="font-medium break-words">{inscrito.nome ?? 'Nome não informado'}</span><span className="text-xs break-all text-ink-soft">{inscrito.email}</span></span> },
      { id: 'origem', titulo: 'Origem', celula: (inscrito) => (inscrito.origem ? ROTULOS_ORIGEM_INSCRITO[inscrito.origem] : '—') },
      { id: 'consentimento', titulo: 'Consentimento', essencial: true, ordenar: (a, b) => (a.consentido_em ?? '').localeCompare(b.consentido_em ?? ''), celula: (inscrito) => (inscrito.consentido_em ? <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(inscrito.consentido_em)} · v{versaoDe(inscrito, textos) ?? '?'}</span> : <span className="text-ink-soft">Não registrado</span>) },
      { id: 'situacao', titulo: 'Situação', essencial: true, celula: (inscrito) => <EtiquetaDoInscrito situacao={inscrito.situacao} /> },
      { id: 'elegibilidade', titulo: 'Elegibilidade', essencial: true, celula: (inscrito) => <span className="block min-w-32 [&>span]:whitespace-normal"><EtiquetaElegibilidade elegibilidade={elegibilidadeDoInscrito(inscrito)} /></span> },
    ],
    [textos],
  );

  const ativos: FiltroAtivo[] = [
    ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_INSCRITO[filtros.situacao as Inscrito['situacao']]}` }] : []),
    ...(filtros.origem ? [{ id: 'origem', rotulo: `Origem: ${ROTULOS_ORIGEM_INSCRITO[filtros.origem as NonNullable<Inscrito['origem']>]}` }] : []),
    ...(filtros.elegibilidade ? [{ id: 'elegibilidade', rotulo: ROTULOS_ELEGIBILIDADE[filtros.elegibilidade as keyof typeof ROTULOS_ELEGIBILIDADE] }] : []),
    ...(filtros.campanha ? [{ id: 'campanha', rotulo: `Campanha: ${dados.campanhas.find((campanha) => campanha.id === filtros.campanha)?.nome ?? ''}` }] : []),
  ];

  const acoesDaLinha = (inscrito: Inscrito) =>
    somenteLeitura || inscrito.situacao === 'descadastrado' ? null : (
      <MenuSobreposto
        titulo="Ações"
        largura={240}
        alinhar="end"
        gatilho={
          <Button variante="icone" tamanho="icone" aria-label={`Ações de ${inscrito.email}`}>
            <Ellipsis aria-hidden />
          </Button>
        }
      >
        {(fechar) => (
          <div className="grid gap-0.5">
            {!inscrito.consentimento_versao_id && (
              <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); setConsentindo(inscrito); }}>
                Registrar consentimento
              </button>
            )}
            {inscrito.situacao !== 'convertido' && (
              <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); void executar(() => marcarConvertido(inscrito.id), 'Marcado como convertido.'); }}>
                Marcar como convertido
              </button>
            )}
            <button type="button" className={cn(CLASSE_LINHA_MENU, 'text-err hover:bg-hover')} onClick={() => { fechar(); setDescadastrando(inscrito); }}>
              Descadastrar
            </button>
          </div>
        )}
      </MenuSobreposto>
    );

  return (
    <div className="grid gap-4">
      <p aria-label="Contagem de inscritos" className="text-[13px] text-ink-soft tabular-nums">
        {textoDaContagem(contagem)}
      </p>
      {contagem.pendentes > 0 && <Faixa tipo="atencao">Sem consentimento registrado, não há comunicação de marketing. Descadastro não é revertido por importação.</Faixa>}
      <FiltrosEmLinha
        filtros={filtros}
        aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
        aoLimpar={() => setFiltros(FILTROS_INSCRITOS_INICIAIS)}
        rotuloBusca="Buscar por nome ou e-mail"
        rotuloAvancados="Mais filtros"
        larguraAvancados={150}
        seletores={[
          seletorDeOpcoes<FiltrosInscritos>({ id: 'situacao', rotulo: 'Situação', icone: CircleCheck, campo: 'situacao', opcoes: paraOpcoes(ROTULOS_SITUACAO_INSCRITO), todos: 'Todas', largura: 140 }),
          seletorDeOpcoes<FiltrosInscritos>({ id: 'origem', rotulo: 'Origem', icone: Target, campo: 'origem', opcoes: paraOpcoes(ROTULOS_ORIGEM_INSCRITO), todos: 'Todas', largura: 130 }),
        ]}
        quantosAvancados={(valor) => [valor.elegibilidade, valor.campanha].filter(Boolean).length}
        avancados={(valor, aoMudar) => (
          <>
            <Campo id="inscritos-elegibilidade" rotulo="Elegibilidade">
              {(controle) => (
                <Selecao {...controle} value={valor.elegibilidade} onChange={(evento) => aoMudar({ elegibilidade: evento.target.value })}>
                  <option value="">Todas</option>
                  {Object.entries(ROTULOS_ELEGIBILIDADE).map(([id, rotulo]) => (
                    <option key={id} value={id}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo id="inscritos-campanha" rotulo="Campanha">
              {(controle) => (
                <Selecao {...controle} value={valor.campanha} onChange={(evento) => aoMudar({ campanha: evento.target.value })}>
                  <option value="">Todas</option>
                  {campanhas.map((campanha) => (
                    <option key={campanha.id} value={campanha.id}>
                      {campanha.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </>
        )}
        ativos={ativos}
        aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
      />
      {selecionados.size > 0 && !somenteLeitura && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-mist p-2.5 text-[13px] font-semibold">
          {selecionados.size === 1 ? '1 selecionada' : `${selecionados.size} selecionadas`}
          <span className="flex flex-wrap gap-2">
            <Button variante="terciario" tamanho="pequeno" onClick={() => setSelecionados(new Set())}>
              Limpar seleção
            </Button>
            <Button
              tamanho="pequeno"
              onClick={() =>
                void marcarConvidados([...selecionados])
                  .then(({ marcados, ignorados }) => {
                    aviso(`${marcados} ${marcados === 1 ? 'marcada' : 'marcadas'} como convidadas${ignorados ? `. ${ignorados} ${ignorados === 1 ? 'ficou' : 'ficaram'} de fora: só entra quem é ativo e tem consentimento` : ''}. Nenhuma mensagem foi enviada.`);
                    setSelecionados(new Set());
                  })
                  .catch((falha: unknown) => aviso(mensagemDoErro(falha)))
              }
            >
              Marcar convidados
            </Button>
          </span>
        </div>
      )}
      <Lista
        rotulo={`Inscritos de ${lista.nome}`}
        linhas={linhas}
        colunas={colunas}
        chave={(inscrito) => inscrito.id}
        selecao={somenteLeitura ? undefined : { selecionados, aoMudar: setSelecionados, rotuloDaLinha: (inscrito) => inscrito.email }}
        acoesDaLinha={acoesDaLinha}
        filtrando={ativos.length > 0 || Boolean(filtros.busca.trim())}
        aoLimparFiltros={() => setFiltros(FILTROS_INSCRITOS_INICIAIS)}
        vazio={<EstadoVazio icone={UsersRound} titulo="Ninguém nesta lista ainda." texto="Adicione uma pessoa ou importe um CSV com as colunas de consentimento." />}
        cartaoInterativo
        cartao={(inscrito) => (
          <span className="grid gap-1.5">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block font-semibold break-words">{inscrito.nome ?? 'Nome não informado'}</span>
                <span className="block text-xs break-all text-ink-soft">{inscrito.email}</span>
              </span>
              {acoesDaLinha(inscrito)}
            </span>
            <span className="flex flex-wrap gap-1">
              <EtiquetaDoInscrito situacao={inscrito.situacao} />
              <EtiquetaElegibilidade elegibilidade={elegibilidadeDoInscrito(inscrito)} />
            </span>
            <span className="text-[13px] text-ink-soft">{inscrito.consentido_em ? `Consentiu em ${formatarDiaISO(inscrito.consentido_em)}, versão ${versaoDe(inscrito, textos) ?? '?'}` : 'Consentimento não registrado'}</span>
          </span>
        )}
      />
      {consentindo && <DialogoConsentimento inscrito={consentindo} textos={textos} aoFechar={() => setConsentindo(null)} />}
      <Confirmacao
        aberto={descadastrando !== null}
        aoFechar={() => setDescadastrando(null)}
        titulo="Descadastrar esta pessoa?"
        texto="É permanente nesta lista: nem a importação nem a inclusão manual trazem de volta."
        rotuloConfirmar="Descadastrar"
        perigo
        aoConfirmar={() => {
          const alvo = descadastrando;
          setDescadastrando(null);
          if (alvo) void executar(() => descadastrar(alvo.id), 'Descadastro registrado.');
        }}
      />
    </div>
  );
}

function Consentimento({ lista, textos, somenteLeitura }: { lista: ListaEspera; textos: readonly ConsentimentoTexto[]; somenteLeitura: boolean }) {
  const [texto, setTexto] = useState('');
  const [desde, setDesde] = useState(hojeISO());
  useAlteracoesPendentes(Boolean(texto.trim()));
  const [erro, setErro] = useState<string | undefined>();
  const ordenados = [...textos].sort((a, b) => b.versao - a.versao);
  const vigente = textoVigente(textos, hojeISO());
  return (
    <div className="grid gap-4">
      <ol aria-label="Versões do texto" className="grid gap-2">
        {ordenados.map((item) => (
          <li key={item.id} className="rounded-md border border-line bg-paper p-3.5 text-[13px]">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              Versão {item.versao}
              {item.id === vigente?.id && <EtiquetaSituacao tipo="sucesso">Vigente</EtiquetaSituacao>}
              <span className="font-normal text-ink-soft">desde {formatarDiaISO(item.vigente_desde)}</span>
            </p>
            <p className="mt-1.5 whitespace-pre-wrap">{item.texto}</p>
          </li>
        ))}
      </ol>
      {!somenteLeitura && (
        <div className="grid gap-3 rounded-md border border-line bg-paper p-3.5">
          <h3>Publicar nova versão</h3>
          <p className="text-[13px] text-ink-soft">Quem aceitou uma versão anterior continua com ela.</p>
          <Campo id="consentimento-novo" rotulo="Novo texto" obrigatorio erro={erro}>
            {(controle) => <Textarea {...controle} value={texto} onChange={(evento) => setTexto(evento.target.value)} />}
          </Campo>
          <Campo id="consentimento-desde" rotulo="Vale desde" obrigatorio>
            {(controle) => <EntradaData {...controle} value={desde} onChange={(evento) => setDesde(evento.target.value)} />}
          </Campo>
          <Button
            variante="secundario"
            className="justify-self-start"
            onClick={() => {
              const conferido = esquemaNovoTexto.safeParse({ texto, vigente_desde: desde });
              if (!conferido.success) return setErro(conferido.error.issues[0]?.message);
              void publicarNovoTexto(lista.id, conferido.data)
                .then((nova) => {
                  aviso(`Versão ${nova.versao} publicada.`);
                  setTexto('');
                  setErro(undefined);
                })
                .catch((falha: unknown) => setErro(mensagemDoErro(falha)));
            }}
          >
            Publicar versão
          </Button>
        </div>
      )}
    </div>
  );
}

/** T08.07: indicadores em tabela, com os mesmos registros da lista. */
function Indicadores({ inscritos }: { inscritos: readonly Inscrito[] }) {
  const porOrigem = inscritosPorOrigem(inscritos);
  const porSemana = inscritosPorSemana(inscritos);
  if (!inscritos.length) return <p className="text-sm text-ink-soft">Sem inscritos, sem indicadores.</p>;
  const Tabela = ({ titulo, cabecalho, linhas }: { titulo: string; cabecalho: string; linhas: readonly (readonly [string, number])[] }) => (
    <section aria-label={titulo} className="rounded-lg border border-line bg-paper p-4">
      <h3 className="mb-2">{titulo}</h3>
      <table className="w-full text-[13px]">
        <thead className="sr-only">
          <tr>
            <th scope="col">{cabecalho}</th>
            <th scope="col">Pessoas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([rotulo, quantidade]) => (
            <tr key={rotulo} className="border-t border-line first:border-t-0">
              <td className="py-1.5">{rotulo}</td>
              <td className="py-1.5 text-right tabular-nums">{quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Tabela titulo="Por origem" cabecalho="Origem" linhas={porOrigem.map(({ origem, quantidade }) => [origem, quantidade] as const)} />
      <Tabela titulo="Por semana" cabecalho="Semana" linhas={porSemana.map(({ semana, quantidade }) => [`Semana de ${formatarDiaISO(semana)}`, quantidade] as const)} />
    </div>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaLista(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T08.07, ficha da lista. Inscritos são dados pessoais (INT). A Central não envia nenhuma mensagem. */
export function FichaLista() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarListas);
  const [adicionando, setAdicionando] = useState(false);
  const [importando, setImportando] = useState(false);

  const voltar = (
    <LinkCentral href={CAMINHO} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Listas de espera
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta lista." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const dados = consulta.dados;
  const lista = dados.listas.find((item) => item.id === id);
  if (!lista) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={UsersRound} titulo="Essa lista não existe mais." texto="Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }
  const textos = dados.textos.filter((texto) => texto.lista_id === lista.id);
  const inscritos = inscritosDaLista(lista.id, dados.inscritos);
  const encerrada = lista.situacao === 'encerrada';
  const tratamentos = tratamentosDaLista(lista, dados.tratamentos);

  function exportar() {
    if (!lista) return;
    void executar(async () => {
      baixarArquivo(`inscritos-${hojeISO()}.csv`, exportarInscritos(lista, inscritos, textos, dados.campanhas), 'text/csv;charset=utf-8');
    }, 'Exportação registrada no histórico.');
  }

  const acoes = (
    <>
      {!encerrada && (
        <>
          <Button onClick={() => setAdicionando(true)}>
            <UserPlus aria-hidden />
            Adicionar pessoa
          </Button>
          <Button variante="secundario" onClick={() => setImportando(true)}>
            <FileUp aria-hidden />
            Importar CSV
          </Button>
        </>
      )}
      <Button variante="secundario" disabled={!inscritos.length} onClick={exportar}>
        <Download aria-hidden />
        Exportar (auditada)
      </Button>
      <MenuSobreposto
        titulo="Mais ações"
        largura={220}
        alinhar="end"
        gatilho={
          <Button variante="icone" tamanho="icone" aria-label="Mais ações da lista">
            <Ellipsis aria-hidden />
          </Button>
        }
      >
        {(fechar) => (
          <button
            type="button"
            className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}
            onClick={() => {
              fechar();
              void executar(() => mudarSituacaoDaLista(lista.id, encerrada ? 'ativa' : 'encerrada'), encerrada ? 'Lista reaberta.' : 'Lista encerrada.');
            }}
          >
            {encerrada ? 'Reabrir a lista' : 'Encerrar a lista'}
          </button>
        )}
      </MenuSobreposto>
    </>
  );

  // No celular, a barra fixa só comporta duas ações (18 §10.4): o resto vai para o menu.
  const acoesCelular = (
    <>
      {!encerrada && (
        <Button onClick={() => setAdicionando(true)}>
          <UserPlus aria-hidden />
          Adicionar
        </Button>
      )}
      <MenuSobreposto
        titulo="Mais ações"
        largura={240}
        alinhar="end"
        gatilho={
          <Button variante="secundario" aria-label="Mais ações da lista">
            <Ellipsis aria-hidden />
            Mais
          </Button>
        }
      >
        {(fechar) => (
          <div className="grid gap-0.5">
            {!encerrada && (
              <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); setImportando(true); }}>
                Importar CSV
              </button>
            )}
            {inscritos.length > 0 && (
              <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); exportar(); }}>
                Exportar (auditada)
              </button>
            )}
            <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); void executar(() => mudarSituacaoDaLista(lista.id, encerrada ? 'ativa' : 'encerrada'), encerrada ? 'Lista reaberta.' : 'Lista encerrada.'); }}>
              {encerrada ? 'Reabrir a lista' : 'Encerrar a lista'}
            </button>
          </div>
        )}
      </MenuSobreposto>
    </>
  );

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        titulo={lista.nome}
        etiquetas={
          <>
            <EtiquetaDoContexto id={lista.produto_id} produtos={dados.produtos} marcas={dados.marcas} />
            {encerrada ? (
              <EtiquetaSituacao tipo="neutro" icone={CircleOff}>
                Encerrada
              </EtiquetaSituacao>
            ) : (
              <EtiquetaSituacao tipo="sucesso">Ativa</EtiquetaSituacao>
            )}
            <EtiquetaSituacao tipo="neutro" icone={ShieldCheck}>
              Dados pessoais: INT
            </EtiquetaSituacao>
          </>
        }
        responsavel={<span>Criada em {formatarData(lista.criado_em)}</span>}
        acoes={acoes}
        acoesCelular={acoesCelular}
        lateral={
          <div className="rounded-lg border border-line bg-paper p-4">
            <h2 className="flex items-center gap-2 text-[17px] leading-6">
              <ShieldCheck className="size-4 shrink-0 text-ink-soft" aria-hidden />
              Inventário de dados
            </h2>
            {tratamentos.length ? (
              <ul className="mt-2 grid gap-1">
                {tratamentos.map((tratamento) => (
                  <li key={tratamento.id}>
                    <LinkCentral href="/legal/privacidade" className="inline-flex min-h-11 items-center underline md:min-h-0">
                      {tratamento.nome}
                    </LinkCentral>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-ink-soft">
                Nenhum tratamento do inventário cobre inscritos deste produto.{' '}
                <LinkCentral href="/legal/privacidade" className="inline-flex min-h-11 items-center underline md:min-h-0">
                  Registrar em Legal e privacidade
                </LinkCentral>
              </p>
            )}
            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
              <Megaphone className="mt-px size-3.5 shrink-0" aria-hidden />
              Esta tela organiza inscritos. Nenhuma mensagem é enviada daqui.
            </p>
          </div>
        }
        abas={[
          { id: 'inscritos', rotulo: 'Inscritos', conteudo: <Inscritos lista={lista} dados={dados} textos={textos} inscritos={inscritos} somenteLeitura={encerrada} /> },
          { id: 'consentimento', rotulo: 'Consentimento', conteudo: <Consentimento lista={lista} textos={textos} somenteLeitura={encerrada} /> },
          { id: 'indicadores', rotulo: 'Indicadores', conteudo: <Indicadores inscritos={inscritos} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={lista.id} /> },
        ]}
      />
      {adicionando && <DialogoAdicionar lista={lista} dados={dados} textos={textos} aoFechar={() => setAdicionando(false)} />}
      {importando && <DialogoImportar lista={lista} dados={dados} textos={textos} inscritos={inscritos} aoFechar={() => setImportando(false)} />}
    </>
  );
}

