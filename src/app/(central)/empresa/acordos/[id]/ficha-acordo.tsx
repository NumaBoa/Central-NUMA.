'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Clock3, ExternalLink, FilePlus2, FileSignature, FileText, Pencil, Send, Undo2, X } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { AbaArquivosDoRegistro } from '@/componentes/empresa/aba-arquivos';
import { AvisoDeFaseDaEmpresa, SituacaoDaVersaoDoAcordo, VoltarPara } from '@/componentes/empresa/aparencia';
import { FormularioDoAcordo } from '@/componentes/empresa/formulario-acordo';
import { MenuDeAcoes } from '@/componentes/empresa/menu-de-acoes';
import { useFormulario } from '@/componentes/empresa/use-formulario';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Avatar } from '@/componentes/padroes/pessoa';
import { CartaoDaFicha } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { Acordo, AcordoVersao } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { camposDoResumo, cancelarVersao, carregarAcordos, confirmarAssinatura, diferencasEntreVersoes, enviarParaRevisao, errosDoArquivoAssinado, novaVersao, pedirAssinaturas, pendenciasDaVigencia, registrarArquivoAssinado, ROTULOS_TIPO_ACORDO, tornarVigente, versaoAtual, versaoEditavel, versaoEmAndamento, versoesDoAcordo, voltarParaRevisao, type DadosDosAcordos } from '@/dominio/acordos';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { historicoDoAcordo } from '@/dominio/historico';
import { nomeDaPessoa, sociasAtivas, textoDaParticipacao } from '@/dominio/sociedade';
import { hojeISO } from '@/lib/datas';
import { formatarDataHora, formatarDiaISO } from '@/lib/formatacao';

const NOTA_DA_ETAPA_LOCAL = 'Cada sócia confirma “Li e assinei esta versão” no próprio login. Na etapa local, a confirmação é simulada pela pessoa escolhida em “Você é”: não é autenticação nem assinatura eletrônica.';

async function executar(acao: () => Promise<unknown>, mensagem: string) {
  try {
    await acao();
    aviso(mensagem);
  } catch (erro) {
    aviso(mensagemDoErro(erro));
  }
}

function LinkDoArquivo({ url, rotulo }: { url: string; rotulo: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-1.5 text-[13px] underline underline-offset-2 md:min-h-0 [&_svg]:size-[14px] [&_svg]:shrink-0">
      <ExternalLink aria-hidden />
      <span className="truncate">{rotulo}</span>
    </a>
  );
}

function JanelaDoArquivoAssinado({ versao, aoFechar }: { versao: AcordoVersao; aoFechar: () => void }) {
  const hoje = hojeISO();
  const f = useFormulario({
    prefixo: 'assinado',
    inicial: () => ({ arquivo_url: versao.arquivo_url ?? '', data_assinatura: versao.data_assinatura ?? '' }),
    validar: (valores) => errosDoArquivoAssinado(valores, hoje),
    salvar: (valores) => registrarArquivoAssinado(versao.id, valores, hoje),
    mensagem: 'Arquivo e data registrados.',
    aoSalvar: aoFechar,
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Arquivo assinado" descricao={`O documento assinado da V${versao.numero}, no Drive da Numa.`} alterado={f.alterado} aoEnviar={f.enviar} salvando={f.salvando} erros={f.lista}>
      <div className="grid gap-4">
        <Campo rotulo="Link do arquivo assinado" obrigatorio {...f.campo('arquivo_url')}>
          {(controle) => <EntradaLinkDrive link={f.valores.arquivo_url} {...controle} {...f.entrada('arquivo_url')} />}
        </Campo>
        <Campo rotulo="Data de assinatura" obrigatorio {...f.campo('data_assinatura')}>
          {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('data_assinatura')} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function AbaDoResumo({ acordo, versao, dados }: { acordo: Acordo; versao: AcordoVersao; dados: DadosDosAcordos }) {
  return (
    <div className="grid gap-3">
      {versao.situacao !== 'vigente' && <Faixa tipo="atencao">O que está nesta versão ainda não vale como acordo vigente.</Faixa>}
      <ListaDeDados>
        <Dado rotulo="Tipo">{ROTULOS_TIPO_ACORDO[acordo.tipo]}</Dado>
        {camposDoResumo(versao, dados).map(({ campo, rotulo, valor }) => (
          <Dado key={campo} rotulo={rotulo}>
            {valor}
          </Dado>
        ))}
      </ListaDeDados>
    </div>
  );
}

function AbaDasVersoes({ acordo, dados }: { acordo: Acordo; dados: DadosDosAcordos }) {
  const versoes = versoesDoAcordo(acordo.id, dados.versoes);
  return (
    <div className="grid gap-3">
      <Faixa tipo="info">Só uma versão pode ser vigente. As anteriores ficam preservadas, para consulta.</Faixa>
      <ol className="grid gap-2.5">
        {versoes.map((versao, indice) => {
          const anterior = versoes[indice + 1];
          const diferencas = anterior ? diferencasEntreVersoes(anterior, versao, dados) : [];
          return (
            <li key={versao.id} className="rounded-lg border border-line bg-paper p-4 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">V{versao.numero}</span>
                <SituacaoDaVersaoDoAcordo situacao={versao.situacao} />
                {versao.data_assinatura && <span className="text-ink-soft">Assinada em {formatarDiaISO(versao.data_assinatura)}</span>}
              </div>
              {versao.arquivo_url && (
                <p className="mt-1.5">
                  <LinkDoArquivo url={versao.arquivo_url} rotulo="Arquivo assinado" />
                </p>
              )}
              {versao.cancelada_motivo && <p className="mt-1.5 text-ink-soft">Motivo do cancelamento: {versao.cancelada_motivo}</p>}
              {anterior &&
                (diferencas.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">
                      {diferencas.length === 1 ? '1 diferença' : `${diferencas.length} diferenças`} em relação à V{anterior.numero}
                    </summary>
                    <ul className="mt-1.5 grid gap-1.5">
                      {diferencas.map(({ campo, antes, depois }) => (
                        <li key={campo}>
                          <span className="font-medium">{campo}:</span> de {antes} para {depois}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="mt-2 text-ink-soft">Sem diferenças em relação à V{anterior.numero}.</p>
                ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AbaDasAssinaturas({ acordo, versao, dados, aoRegistrarArquivo }: { acordo: Acordo; versao: AcordoVersao; dados: DadosDosAcordos; aoRegistrarArquivo: () => void }) {
  const { pessoa } = useCentral();
  const hoje = hojeISO();
  const [confirmando, setConfirmando] = useState(false);
  const [vigorando, setVigorando] = useState(false);
  const assinaturas = dados.assinaturas.filter((assinatura) => assinatura.versao_id === versao.id);
  const ativas = sociasAtivas(dados.socias, hoje);
  const aguardando = versao.situacao === 'aguardando_assinaturas';
  const pendencias = aguardando ? pendenciasDaVigencia({ acordo, versao, assinaturas, socias: dados.socias, pessoas: dados.pessoas, hoje }) : [];
  const euSouSocia = ativas.some((socia) => socia.pessoa_id === pessoa.id);
  const jaConfirmei = assinaturas.some((assinatura) => assinatura.pessoa_id === pessoa.id);
  const faltaOutra = ativas.find((socia) => socia.pessoa_id !== pessoa.id && !assinaturas.some((assinatura) => assinatura.pessoa_id === socia.pessoa_id));
  const anteriorVigente = versoesDoAcordo(acordo.id, dados.versoes).find((item) => item.situacao === 'vigente');

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {ativas.map((socia) => {
          const nome = nomeDaPessoa(dados.pessoas, socia.pessoa_id);
          const assinatura = assinaturas.find((linha) => linha.pessoa_id === socia.pessoa_id);
          return (
            <li key={socia.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper p-3.5">
              <Avatar nome={nome} className="size-9 text-[13px]" />
              <span className="min-w-0 flex-1 text-[13px]">
                <span className="block font-semibold">{nome}</span>
                <span className="block text-ink-soft tabular-nums">{textoDaParticipacao(socia.participacao)} de participação</span>
              </span>
              {assinatura ? (
                <EtiquetaSituacao tipo="sucesso">Confirmou em {formatarDataHora(assinatura.confirmado_em)}</EtiquetaSituacao>
              ) : (
                <EtiquetaSituacao tipo="atencao" icone={Clock3}>
                  Pendente
                </EtiquetaSituacao>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3.5 text-[13px]">
        <span className="min-w-0">
          {versao.arquivo_url ? <LinkDoArquivo url={versao.arquivo_url} rotulo="Arquivo assinado" /> : <span className="text-ink-soft">Arquivo assinado ainda não registrado</span>}
          <span className="block text-ink-soft">Data de assinatura: {versao.data_assinatura ? formatarDiaISO(versao.data_assinatura) : 'não informada'}</span>
        </span>
        {aguardando && (
          <Button variante="secundario" tamanho="pequeno" onClick={aoRegistrarArquivo}>
            {versao.arquivo_url ? 'Corrigir arquivo e data' : 'Registrar arquivo e data'}
          </Button>
        )}
      </div>

      {!aguardando && versaoEmAndamento(versao) && <Faixa tipo="info">As confirmações começam quando a versão for para assinatura.</Faixa>}
      {pendencias.length > 0 && (
        <Faixa tipo="atencao">
          <span className="font-semibold">Para tornar esta versão vigente:</span> {pendencias.join(' ')}
        </Faixa>
      )}

      {aguardando && (
        <div className="flex flex-wrap items-center gap-2.5">
          {euSouSocia && !jaConfirmei && (
            <Button onClick={() => setConfirmando(true)}>
              <FileSignature aria-hidden />
              Confirmar: li e assinei
            </Button>
          )}
          {jaConfirmei && faltaOutra && <p className="text-[13px] text-ink-soft">Você, {pessoa.nome}, não pode confirmar em nome de {nomeDaPessoa(dados.pessoas, faltaOutra.pessoa_id)}.</p>}
          <Button variante={pendencias.length ? 'secundario' : 'primario'} disabled={pendencias.length > 0} onClick={() => setVigorando(true)}>
            <CheckCircle2 aria-hidden />
            Tornar vigente
          </Button>
        </div>
      )}
      <Faixa tipo="info">{NOTA_DA_ETAPA_LOCAL}</Faixa>

      <Confirmacao
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo={`Confirmar a V${versao.numero}?`}
        texto={
          <>
            “Li e assinei esta versão”, como {pessoa.nome}. {NOTA_DA_ETAPA_LOCAL}
          </>
        }
        rotuloConfirmar="Confirmar"
        aoConfirmar={() => {
          setConfirmando(false);
          void executar(() => confirmarAssinatura(versao.id, pessoa.id, hoje), 'Confirmação registrada.');
        }}
      />
      <Confirmacao
        aberto={vigorando}
        aoFechar={() => setVigorando(false)}
        titulo={`Tornar a V${versao.numero} vigente?`}
        texto={anteriorVigente ? `A V${anteriorVigente.numero} fica Substituída, sem ser apagada.` : 'Este acordo passa a valer a partir daqui.'}
        rotuloConfirmar="Tornar vigente"
        aoConfirmar={() => {
          setVigorando(false);
          void executar(() => tornarVigente(versao.id, hoje), 'Versão vigente.');
        }}
      />
    </div>
  );
}

/** T06.03: a ficha, com as abas da especificação (LEIA-ME do M06). O conteúdo assinado não muda: quem muda é a versão. */
export function FichaDoAcordo() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarAcordos);
  const [editando, setEditando] = useState(false);
  const [arquivo, setArquivo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [voltando, setVoltando] = useState(false);
  const voltar = <VoltarPara href="/empresa/acordos" rotulo="Acordos" />;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler este acordo." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const dados = consulta.dados;
  const acordo = dados.acordos.find((item) => item.id === id);
  const versao = acordo ? versaoAtual(acordo.id, dados.versoes) : undefined;
  if (!acordo || !versao) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={FileText} titulo="Esse acordo não existe mais." texto="Ele pode ter sido removido ao importar um arquivo." />
      </>
    );
  }

  const editavel = versaoEditavel(versao);
  const principal = (() => {
    if (versao.situacao === 'rascunho') {
      return (
        <Button onClick={() => void executar(() => enviarParaRevisao(versao.id), 'Enviado para revisão.')}>
          <Send aria-hidden />
          Enviar para revisão
        </Button>
      );
    }
    if (versao.situacao === 'em_revisao') {
      return (
        <Button onClick={() => void executar(() => pedirAssinaturas(versao.id), 'Aguardando as assinaturas.')}>
          <FileSignature aria-hidden />
          Pedir assinaturas
        </Button>
      );
    }
    if (versao.situacao === 'aguardando_assinaturas') return null;
    return (
      <Button onClick={() => void executar(() => novaVersao(acordo.id), 'Nova versão criada em rascunho.')}>
        <FilePlus2 aria-hidden />
        Nova versão
      </Button>
    );
  })();
  const acoesDoMenu = [
    ...(versao.situacao === 'aguardando_assinaturas' ? [{ rotulo: 'Voltar para revisão', icone: Undo2, aoClicar: () => setVoltando(true) }] : []),
    ...(versaoEmAndamento(versao) ? [{ rotulo: `Cancelar a V${versao.numero}`, icone: X, aoClicar: () => setCancelando(true), perigo: true }] : []),
  ];
  const acoes = (
    <>
      {principal}
      {editavel && (
        <Button variante="secundario" onClick={() => setEditando(true)}>
          <Pencil aria-hidden />
          Editar resumo
        </Button>
      )}
      <MenuDeAcoes rotulo="Mais ações do acordo" acoes={acoesDoMenu} />
    </>
  );

  const assinaturasDaVersao = dados.assinaturas.filter((assinatura) => assinatura.versao_id === versao.id);
  const arquivosDasVersoes = versoesDoAcordo(acordo.id, dados.versoes).filter((item) => item.arquivo_url);

  return (
    <div className="space-y-4">
      {voltar}
      <AvisoDeFaseDaEmpresa />
      <Ficha
        tituloDePagina
        codigo={acordo.codigo}
        titulo={acordo.titulo}
        etiquetas={
          <>
            <EtiquetaLivre>V{versao.numero}</EtiquetaLivre>
            <SituacaoDaVersaoDoAcordo situacao={versao.situacao} />
          </>
        }
        acoes={acoes}
        acoesCelular={acoes}
        lateral={
          <>
            <CartaoDaFicha titulo="Documento da versão">
              {versao.arquivo_url ? <LinkDoArquivo url={versao.arquivo_url} rotulo={`V${versao.numero} · arquivo assinado`} /> : <p className="text-ink-soft">Ainda sem arquivo assinado.</p>}
            </CartaoDaFicha>
            <CartaoDaFicha titulo="Confirmações">
              <ul className="grid gap-1.5">
                {sociasAtivas(dados.socias).map((socia) => {
                  const confirmou = assinaturasDaVersao.some((assinatura) => assinatura.pessoa_id === socia.pessoa_id);
                  return (
                    <li key={socia.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{nomeDaPessoa(dados.pessoas, socia.pessoa_id)}</span>
                      <span className={confirmou ? 'shrink-0 font-medium text-ok' : 'shrink-0 text-ink-soft'}>{confirmou ? 'Confirmou' : 'Pendente'}</span>
                    </li>
                  );
                })}
              </ul>
            </CartaoDaFicha>
          </>
        }
        abas={[
          { id: 'resumo', rotulo: 'Resumo estruturado', conteudo: <AbaDoResumo acordo={acordo} versao={versao} dados={dados} /> },
          { id: 'versoes', rotulo: 'Versões', conteudo: <AbaDasVersoes acordo={acordo} dados={dados} /> },
          { id: 'assinaturas', rotulo: 'Assinaturas', conteudo: <AbaDasAssinaturas acordo={acordo} versao={versao} dados={dados} aoRegistrarArquivo={() => setArquivo(true)} /> },
          {
            id: 'arquivos',
            rotulo: 'Arquivos',
            conteudo: (
              <AbaArquivosDoRegistro
                tipo="acordo_societario"
                id={acordo.id}
                extra={
                  arquivosDasVersoes.length > 0 && (
                    <ul className="grid gap-1">
                      {arquivosDasVersoes.map((item) => (
                        <li key={item.id}>
                          <LinkDoArquivo url={item.arquivo_url as string} rotulo={`V${item.numero} · arquivo assinado`} />
                        </li>
                      ))}
                    </ul>
                  )
                }
              />
            ),
          },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('acordo_societario', acordo.id)} dependencia={acordo.id} vazio="As atividades ligadas a este acordo aparecem aqui." /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <HistoricoDoAcordo id={acordo.id} /> },
        ]}
      />

      {editando && <FormularioDoAcordo dados={dados} acordo={acordo} versao={versao} aoFechar={() => setEditando(false)} />}
      {arquivo && <JanelaDoArquivoAssinado versao={versao} aoFechar={() => setArquivo(false)} />}
      <Confirmacao
        aberto={cancelando}
        aoFechar={() => setCancelando(false)}
        titulo={`Cancelar a V${versao.numero}?`}
        texto="A versão fica no histórico, como cancelada."
        rotuloConfirmar="Cancelar versão"
        rotuloCancelar="Voltar"
        perigo
        pedirMotivo
        aoConfirmar={(motivo) => {
          setCancelando(false);
          void executar(() => cancelarVersao(versao.id, motivo), 'Versão cancelada.');
        }}
      />
      <Confirmacao
        aberto={voltando}
        aoFechar={() => setVoltando(false)}
        titulo="Voltar para revisão?"
        texto="As confirmações, o arquivo e a data desta versão saem, porque o conteúdo pode mudar. O histórico guarda o que havia."
        rotuloConfirmar="Voltar para revisão"
        perigo
        pedirMotivo
        aoConfirmar={(motivo) => {
          setVoltando(false);
          void executar(() => voltarParaRevisao(versao.id, motivo), 'A versão voltou para revisão.');
        }}
      />
    </div>
  );
}

function HistoricoDoAcordo({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoAcordo(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}
