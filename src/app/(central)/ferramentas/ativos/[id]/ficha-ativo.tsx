'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArchiveRestore, ArrowLeft, ArrowRightLeft, Ellipsis, ExternalLink, Globe, Pencil, Plus, Trash2 } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { Campo } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { EtiquetaCritica, SituacaoDaTransferencia, TextoDoVencimento } from '@/componentes/ferramentas/etiquetas-ferramentas';
import { FormularioDeAtivo } from '@/componentes/ferramentas/formulario-ativo';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaContexto, EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { adicionarLinkDoAtivo, arquivarAtivo, carregarAtivos, esquemaRegistrarTransferencia, formularioTransferenciaVazio, linksDoAtivo, registrarTransferencia, removerLinkDoAtivo, restaurarAtivo, ROTULOS_TIPO_ATIVO, type DadosDosAtivos, type FormularioTransferencia } from '@/dominio/ativos';
import { ID_INSTITUCIONAL } from '@/dominio/contextos';
import { tintaDaCor } from '@/dominio/cores';
import { historicoDoAtivo } from '@/dominio/historico';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { ROTULOS_TITULAR, textoDoTitular } from '@/dominio/titularidade';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO } from '@/lib/formatacao';

const CAMINHO = '/ferramentas/ativos';

function Resumo({ ativo, dados }: { ativo: AtivoDigital; dados: DadosDosAtivos }) {
  const ferramenta = dados.ferramentas.find((item) => item.id === ativo.ferramenta_id);
  const assinatura = dados.assinaturas.find((item) => item.id === ativo.assinatura_id);
  return (
    <ListaDeDados>
      <Dado rotulo="Tipo">{ROTULOS_TIPO_ATIVO[ativo.tipo]}</Dado>
      <Dado rotulo="Ferramenta ou plataforma">
        {ferramenta && (
          <LinkCentral href={`/ferramentas/${ferramenta.id}`} className="inline-flex min-h-11 items-center underline md:min-h-0">
            {ferramenta.nome}
          </LinkCentral>
        )}
      </Dado>
      <Dado rotulo="Assinatura relacionada">{assinatura && `${dados.ferramentas.find((item) => item.id === assinatura.ferramenta_id)?.nome ?? 'Ferramenta removida'}${assinatura.plano ? ` · ${assinatura.plano}` : ''}`}</Dado>
      <Dado rotulo="Titular atual">{textoDoTitular(ativo, dados.pessoas)}</Dado>
      <Dado rotulo="Titular desejado">{ativo.titular_desejado}</Dado>
      <Dado rotulo="Requisito para transferir">{ativo.requisito_transferencia}</Dado>
      {ativo.transferencia_situacao === 'concluida' && (
        <>
          <Dado rotulo="Transferido em">{ativo.transferido_em && formatarDiaISO(ativo.transferido_em)}</Dado>
          <Dado rotulo="Evidência">
            {ativo.evidencia_transferencia_url && (
              <a href={ativo.evidencia_transferencia_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 underline md:min-h-0 [&_svg]:size-[14px]">
                <ExternalLink aria-hidden />
                Abrir a evidência
              </a>
            )}
          </Dado>
        </>
      )}
      <Dado rotulo="Data de registro">{ativo.registrado_em && formatarDiaISO(ativo.registrado_em)}</Dado>
      <Dado rotulo="Vencimento">{ativo.vencimento && <TextoDoVencimento vencimento={ativo.vencimento} hoje={hojeISO()} />}</Dado>
      <Dado rotulo="Renovação automática">{ativo.renovacao_automatica === null ? null : ativo.renovacao_automatica ? 'Sim' : 'Não'}</Dado>
      <Dado rotulo="Observações">{ativo.observacoes}</Dado>
    </ListaDeDados>
  );
}

function AbaArquivos({ id, somenteLeitura }: { id: string; somenteLeitura: boolean }) {
  const consulta = useConsulta(() => linksDoAtivo(id), [id]);
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    try {
      await adicionarLinkDoAtivo(id, link);
      setLink('');
      setErro(null);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <div className="grid gap-4">
      {consulta.dados?.length ? (
        <ul className="grid gap-1">
          {consulta.dados.map((anexo) => (
            <li key={anexo.id} className="flex items-center justify-between gap-2 text-[13px]">
              <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-1.5 underline underline-offset-2 md:min-h-0 [&_svg]:size-[14px] [&_svg]:shrink-0">
                <ExternalLink aria-hidden />
                <span className="truncate">{anexo.titulo}</span>
              </a>
              {!somenteLeitura && (
                <Button variante="icone" tamanho="icone" aria-label={`Tirar ${anexo.titulo}`} onClick={() => void removerLinkDoAtivo(anexo.id).catch((falha: unknown) => aviso(mensagemDoErro(falha)))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Nenhum link por enquanto.</p>
      )}
      {!somenteLeitura && (
        <Campo id="ativo-link" rotulo="Link do Drive" erro={erro ?? undefined}>
          {(controle) => (
            <div className="grid gap-2">
              <EntradaLinkDrive
                link={link}
                {...controle}
                value={link}
                onChange={(evento) => setLink(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault();
                    void adicionar();
                  }
                }}
              />
              <Button variante="secundario" tamanho="pequeno" className="justify-self-start" onClick={() => void adicionar()}>
                <Plus aria-hidden />
                Adicionar link
              </Button>
            </div>
          )}
        </Campo>
      )}
    </div>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoAtivo(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T04.05: data, novo titular, evidência e observação. A evidência é obrigatória (CA-04.07). */
function DialogoDeTransferencia({ ativo, dados, aoFechar }: { ativo: AtivoDigital; dados: DadosDosAtivos; aoFechar: () => void }) {
  const [valores, setValores] = useState<FormularioTransferencia>(() => formularioTransferenciaVazio());
  const [erros, setErros] = useState<Partial<Record<keyof FormularioTransferencia, string>>>({});
  const socias = pessoasDoSeletor(dados.pessoas).filter((pessoa) => pessoa.eh_socia);
  const mudar = (parcial: Partial<FormularioTransferencia>) => setValores((atuais) => ({ ...atuais, ...parcial }));

  async function confirmar() {
    const conferido = esquemaRegistrarTransferencia.safeParse(valores);
    if (!conferido.success) {
      setErros(Object.fromEntries(conferido.error.issues.map((problema) => [problema.path[0], problema.message])));
      return;
    }
    try {
      await registrarTransferencia(ativo.id, conferido.data);
      aviso('Transferência registrada.');
      aoFechar();
    } catch (falha) {
      aviso(mensagemDoErro(falha));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Registrar a transferência de {ativo.identificador}</DialogTitle>
        <DialogDescription className="mt-3 leading-[1.6]">O titular atual muda, a situação fica “Concluída” e o histórico guarda o que havia.</DialogDescription>
        <div className="mt-4 grid gap-4">
          <Campo id="transferencia-data" rotulo="Data" obrigatorio erro={erros.data}>
            {(controle) => <Input type="date" {...controle} value={valores.data} onChange={(evento) => mudar({ data: evento.target.value })} />}
          </Campo>
          <Pilulas rotulo="Novo titular" obrigatorio valor={valores.titular_tipo} aoMudar={(valor) => mudar({ titular_tipo: valor as FormularioTransferencia['titular_tipo'] })} opcoes={Object.entries(ROTULOS_TITULAR).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          {valores.titular_tipo === 'pessoa_fisica' && (
            <Campo id="transferencia-pessoa" rotulo="Sócia titular" obrigatorio erro={erros.titular_pessoa_id}>
              {(controle) => (
                <Selecao {...controle} value={valores.titular_pessoa_id} onChange={(evento) => mudar({ titular_pessoa_id: evento.target.value })}>
                  <option value="">Escolha uma pessoa</option>
                  {socias.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome_completo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          {valores.titular_tipo === 'terceiro' && (
            <Campo id="transferencia-texto" rotulo="Para quem" obrigatorio erro={erros.titular_texto}>
              {(controle) => <Input autoComplete="off" {...controle} value={valores.titular_texto} onChange={(evento) => mudar({ titular_texto: evento.target.value })} />}
            </Campo>
          )}
          <Campo id="transferencia-evidencia" rotulo="Evidência" obrigatorio erro={erros.evidencia} ajuda="Link do Drive para o comprovante da transferência.">
            {(controle) => <EntradaLinkDrive link={valores.evidencia} {...controle} value={valores.evidencia} onChange={(evento) => mudar({ evidencia: evento.target.value })} />}
          </Campo>
          <Campo id="transferencia-observacao" rotulo="Observação">
            {(controle) => <Textarea {...controle} value={valores.observacao} onChange={(evento) => mudar({ observacao: evento.target.value })} />}
          </Campo>
        </div>
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button onClick={() => void confirmar()}>Registrar transferência</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** T04.05: ficha do ativo (P2). A aba Acessos entra na F2 (D14). */
export function FichaAtivo() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarAtivos);
  const [editando, setEditando] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  const voltar = (
    <LinkCentral href={CAMINHO} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Ativos digitais
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler este ativo." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const dados = consulta.dados;
  const ativo = dados.ativos.find((item) => item.id === id);
  if (!ativo) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Globe} titulo="Esse ativo não existe mais." texto="Ele pode ter sido removido ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const arquivado = Boolean(ativo.arquivado_em);
  const produto = dados.produtos.find((item) => item.id === ativo.produto_id);
  const marca = produto ? dados.marcas.find((item) => item.id === produto.marca_id) : dados.marcas.find((item) => item.institucional);
  const responsavel = dados.pessoas.find((pessoa) => pessoa.id === ativo.responsavel_id)?.nome_completo ?? 'Pessoa removida';
  const podeTransferir = !arquivado && ativo.transferencia_situacao !== 'nao_necessaria' && ativo.transferencia_situacao !== 'concluida';

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const acoes = arquivado ? null : (
    <>
      <Button onClick={() => setEditando(true)}>
        <Pencil aria-hidden />
        Editar
      </Button>
      {podeTransferir && (
        <Button variante="secundario" onClick={() => setTransferindo(true)}>
          <ArrowRightLeft aria-hidden />
          Registrar transferência
        </Button>
      )}
      <MenuSobreposto
        titulo="Mais ações"
        largura={220}
        alinhar="end"
        gatilho={
          <Button variante="icone" tamanho="icone" aria-label="Mais ações do ativo">
            <Ellipsis aria-hidden />
          </Button>
        }
      >
        {(fechar) => (
          <ul className="grid gap-0.5">
            <li>
              <button
                type="button"
                className={`${CLASSE_LINHA_MENU} hover:bg-hover md:min-h-9 md:py-1.5`}
                onClick={() => {
                  fechar();
                  setArquivando(true);
                }}
              >
                Arquivar
              </button>
            </li>
          </ul>
        )}
      </MenuSobreposto>
    </>
  );

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        codigo={ativo.codigo}
        titulo={ativo.identificador}
        etiquetas={
          <>
            <SituacaoDaTransferencia situacao={ativo.transferencia_situacao} />
            {ativo.critico && <EtiquetaCritica rotulo="Crítico" />}
            <EtiquetaLivre>{ROTULOS_TIPO_ATIVO[ativo.tipo]}</EtiquetaLivre>
            {marca && <EtiquetaContexto contexto={{ id: ativo.produto_id ?? ID_INSTITUCIONAL, nome: produto?.nome ?? 'Numa', cor: marca.cor_hex, tinta: tintaDaCor(marca.cor_hex) }} />}
          </>
        }
        responsavel={
          <span className="inline-flex items-center gap-2">
            Responsável: <NomeDaPessoa nome={responsavel} className="text-ink" />
          </span>
        }
        acoes={acoes}
        acoesCelular={acoes}
        arquivado={
          arquivado
            ? {
                texto: `Este ativo foi arquivado em ${formatarData(ativo.arquivado_em as string)}.`,
                acao: (
                  <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => restaurarAtivo(ativo.id), 'Ativo restaurado.')}>
                    <ArchiveRestore aria-hidden />
                    Restaurar
                  </Button>
                ),
              }
            : undefined
        }
        abas={[
          { id: 'resumo', rotulo: 'Resumo', conteudo: <Resumo ativo={ativo} dados={dados} /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('ativo_digital', ativo.id)} dependencia={ativo.id} vazio="Vincule uma atividade a este ativo, pelo painel da atividade." /> },
          { id: 'arquivos', rotulo: 'Arquivos', conteudo: <AbaArquivos id={ativo.id} somenteLeitura={arquivado} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={ativo.id} /> },
        ]}
      />
      <FormularioDeAtivo aberto={editando} aoFechar={() => setEditando(false)} dados={dados} ativo={ativo} />
      {transferindo && <DialogoDeTransferencia ativo={ativo} dados={dados} aoFechar={() => setTransferindo(false)} />}
      <Confirmacao
        aberto={arquivando}
        aoFechar={() => setArquivando(false)}
        titulo={`Arquivar ${ativo.identificador}?`}
        texto="Ele sai das listas. Dá para restaurar depois."
        rotuloConfirmar="Arquivar ativo"
        perigo
        aoConfirmar={() => {
          setArquivando(false);
          void executar(() => arquivarAtivo(ativo.id), 'Ativo arquivado.');
        }}
      />
    </>
  );
}
