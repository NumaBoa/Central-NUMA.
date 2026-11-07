'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, Check, CopyPlus, FileSignature, Pencil, Plus, Save, Send, Trash2, TriangleAlert, Undo2, X } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { AvisoCatalogoDeExemplo, CaixasDeSelecao, CartaoDePainel, EtapasLaterais, executar, ListaDePendencias, paraOpcoes } from '@/componentes/f1/apoio';
import { DialogoItem, dadosDoItemExistente, type ItemParaEditar } from '@/componentes/f1/dialogo-item';
import { DocumentoRenderizadoVista } from '@/componentes/f1/documento';
import { BotoesDeEmissao, ListaDeEmissoes } from '@/componentes/f1/emissao';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { PropostaVersao } from '@/dados/tipos/comercial';
import { useConsulta } from '@/dados/use-consulta';
import { bloqueiaEmissao, carregarProposta, emitirProposta, ITEM_VAZIO, linhasDosTotais, montarDocumentoDaProposta, novaVersaoDaProposta, reabrirValidade, registrarAceite, registrarEnvio, registrarRecusa, removerItemDaProposta, ROTULOS_CONCLUSAO_VIABILIDADE, ROTULOS_FORMA_ACEITE, ROTULOS_PERIODICIDADE_VALOR, ROTULOS_SITUACAO_VERSAO, salvarItemDaProposta, salvarVersaoDaProposta, totaisDosItens, type CabecalhoDaVersao } from '@/dominio/comercial';
import { converterPropostaEmContrato, familiaSugerida, ROTULOS_TIPO_CONTRATO } from '@/dominio/contratos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { documentosDoRegistro } from '@/dominio/documentos-emitidos';
import { entidadesParaVincular, nomeDaEntidade } from '@/dominio/entidades';
import { ROTULOS_FAMILIA } from '@/dominio/modelos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const ETAPAS = [
  { id: 'cabecalho', rotulo: 'Identificação' },
  { id: 'itens', rotulo: 'Itens' },
  { id: 'escopo', rotulo: 'Escopo' },
  { id: 'condicoes', rotulo: 'Condições' },
  { id: 'revisao', rotulo: 'Revisão' },
] as const;
type Etapa = (typeof ETAPAS)[number]['id'];

const TIPOS: Readonly<Record<PropostaVersao['situacao'], TipoSituacao>> = { rascunho: 'neutro', pronta: 'info', enviada: 'atencao', aceita: 'sucesso', recusada: 'erro', expirada: 'erro', substituida: 'neutro' };

async function carregar(id: string) {
  const ficha = await carregarProposta(id);
  if (!ficha) return null;
  const [documento, entidades, modelos, versoesModelo, pessoas, produtosOportunidade, produtos, documentos, contratos] = await Promise.all([montarDocumentoDaProposta(ficha), repositorios.entidade.listar({ incluirArquivados: true }), repositorios.modelo_documento.listar(), repositorios.modelo_versao.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.oportunidade_produto.listar({ onde: { oportunidade_id: ficha.oportunidade.id } }), repositorios.produto.listar(), documentosDoRegistro(ficha.atual.id), repositorios.contrato.listar()]);
  const modelosDeProposta = modelos.filter((modelo) => modelo.tipo_documento === 'proposta').flatMap((modelo) => versoesModelo.filter((versao) => versao.modelo_id === modelo.id && versao.situacao !== 'obsoleta').map((versao) => ({ id: versao.id, rotulo: `${modelo.nome} v${versao.rotulo_versao}${versao.situacao === 'validada' ? '' : ' (não validado)'}` })));
  return { ficha, documento, entidades, modelosDeProposta, pessoas, produtos: produtos.filter((produto) => produtosOportunidade.some((ligacao) => ligacao.produto_id === produto.id)), todosProdutos: produtos, documentos, contrato: contratos.find((contrato) => contrato.proposta_versao_id && contrato.proposta_versao_id === ficha.proposta.versao_aceita_id) ?? null };
}
type Dados = NonNullable<Awaited<ReturnType<typeof carregar>>>;

const cabecalhoDe = (versao: PropostaVersao): CabecalhoDaVersao => ({ entidade_id: versao.entidade_id, modelo_versao_id: versao.modelo_versao_id, contatos: versao.contatos, validade: versao.validade, escopo_incluido: versao.escopo_incluido, escopo_excluido: versao.escopo_excluido, premissas: versao.premissas, dependencias: versao.dependencias, condicoes: versao.condicoes });

function DialogoEnvio({ versaoId, aoFechar }: { versaoId: string; aoFechar: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [canal, setCanal] = useState('E-mail');
  const [para, setPara] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Registrar envio" rotuloSalvar="Registrar envio" aoEnviar={(evento) => { evento.preventDefault(); void registrarEnvio(versaoId, { data, canal, para, evidencia }).then(() => { aviso('Envio registrado.'); aoFechar(); }, (problema: unknown) => setErro(mensagemDoErro(problema))); }}>
      <div className="grid gap-[18px]">
        <Campo id="envio-data" rotulo="Data" obrigatorio>{(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}</Campo>
        <Campo id="envio-canal" rotulo="Canal" obrigatorio ajuda="E-mail, WhatsApp, reunião.">{(controle) => <Input {...controle} autoComplete="off" value={canal} onChange={(evento) => setCanal(evento.target.value)} />}</Campo>
        <Campo id="envio-para" rotulo="Para quem" obrigatorio>{(controle) => <Input {...controle} autoComplete="off" value={para} onChange={(evento) => setPara(evento.target.value)} />}</Campo>
        <Campo id="envio-evidencia" rotulo="Evidência (link do Drive)">{(controle) => <EntradaLinkDrive {...controle} link={evidencia} value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} />}</Campo>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

function DialogoAceite({ versao, aoFechar }: { versao: PropostaVersao; aoFechar: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState<NonNullable<PropostaVersao['aceite_forma']> | ''>('');
  const [evidencia, setEvidencia] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo={`Registrar aceite da V${versao.numero}`} descricao="O aceite não é a assinatura do contrato (RN-10.12)." rotuloSalvar="Registrar aceite" aoEnviar={(evento) => { evento.preventDefault(); void registrarAceite(versao.id, { data, forma, evidencia }).then(() => { aviso('Aceite registrado. A oportunidade pode ir para Ganha.'); aoFechar(); }, (problema: unknown) => setErro(mensagemDoErro(problema))); }}>
      <div className="grid gap-[18px]">
        <Campo id="aceite-data" rotulo="Data" obrigatorio>{(controle) => <EntradaData {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}</Campo>
        <Campo id="aceite-forma" rotulo="Forma" obrigatorio>
          {(controle) => (
            <Selecao {...controle} value={forma} onChange={(evento) => setForma(evento.target.value as typeof forma)}>
              <option value="">Escolha</option>
              {paraOpcoes(ROTULOS_FORMA_ACEITE).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id="aceite-evidencia" rotulo="Evidência (link do Drive)" obrigatorio>{(controle) => <EntradaLinkDrive {...controle} link={evidencia} value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} />}</Campo>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

function DialogoConverter({ dados, aoFechar }: { dados: Dados; aoFechar: () => void }) {
  const roteador = useRouter();
  const { ficha } = dados;
  const sugestao = familiaSugerida(ficha.oportunidade.tipo);
  const aceita = ficha.versoes.find((versao) => versao.id === ficha.proposta.versao_aceita_id);
  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo="Converter em contrato"
      descricao="Cria o contrato em Rascunho e abre na revisão. A proposta fica vinculada."
      rotuloSalvar={dados.contrato ? 'Abrir o contrato' : 'Criar contrato'}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void converterPropostaEmContrato(ficha.proposta.id).then(
          ({ contrato, criado }) => {
            aviso(criado ? 'Contrato criado em rascunho.' : 'Este aceite já virou contrato: abrindo o existente.');
            roteador.push(`/contratos/${contrato.id}/editar?etapa=revisao`);
          },
          (problema: unknown) => aviso(mensagemDoErro(problema)),
        );
      }}
    >
      <div className="grid gap-3 text-[13px]">
        {dados.contrato && <Faixa>Esta versão aceita já virou o contrato {dados.contrato.codigo}. Converter de novo abre o mesmo contrato (RN-10.13).</Faixa>}
        <p>
          <strong>Família sugerida:</strong> {ROTULOS_FAMILIA[sugestao.familia]} · {ROTULOS_TIPO_CONTRATO[sugestao.tipo]}
        </p>
        <p>
          <strong>Será copiado da V{aceita?.numero}:</strong> partes, {ficha.itens.length} {ficha.itens.length === 1 ? 'item' : 'itens'} com valores e descontos, contato principal, reajuste e as condições combinadas (como texto, para conferir).
        </p>
        <p className="text-ink-soft">Prazos, vigência e obrigações são definidos no contrato. Nada é assinado aqui.</p>
      </div>
    </JanelaFormulario>
  );
}

/** T10.05 a T10.08: editor em etapas, prévia e emissão, envio, aceite ou recusa e conversão. */
export function EditorProposta() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregar(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler a proposta." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados) return <EstadoVazio icone={TriangleAlert} titulo="Proposta não encontrada." texto="Ela pode ter sido removida." acao={<LinkCentral href="/comercial/propostas">Voltar às propostas</LinkCentral>} />;
  return <Editor key={consulta.dados.ficha.atual.id} dados={consulta.dados} />;
}

function Editor({ dados }: { dados: Dados }) {
  const { ficha, documento } = dados;
  const versao = ficha.atual;
  const editavel = versao.situacao === 'rascunho';
  const [etapa, setEtapa] = useState<Etapa>('cabecalho');
  const [cabecalho, setCabecalho] = useState<CabecalhoDaVersao>(cabecalhoDe(versao));
  const [item, setItem] = useState<ItemParaEditar | { id: null; dados: typeof ITEM_VAZIO } | null>(null);
  const [janela, setJanela] = useState<'' | 'envio' | 'aceite' | 'converter' | 'recusa' | 'reabrir' | 'remover'>('');
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [novaValidade, setNovaValidade] = useState('');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('etapa') === 'revisao') setEtapa('revisao');
  }, []);
  // Salvou ou mudou em outra aba: recomeça do que está gravado.
  useEffect(() => setCabecalho(cabecalhoDe(versao)), [versao.versao_registro]); // eslint-disable-line react-hooks/exhaustive-deps -- só quando a versão gravada muda
  const alterado = JSON.stringify(cabecalho) !== JSON.stringify(cabecalhoDe(versao));
  useAlteracoesPendentes(alterado);
  const totais = useMemo(() => totaisDosItens(ficha.itens), [ficha.itens]);
  const contatos = dados.pessoas.filter((pessoa) => pessoa.contraparte_id === ficha.proposta.contraparte_id && !pessoa.arquivado_em);
  const nomeDaPessoa = (pessoaId: string | null) => dados.pessoas.find((pessoa) => pessoa.id === pessoaId)?.nome_completo ?? 'Pessoa removida';
  const pendenciasPorEtapa = Object.fromEntries(ETAPAS.map((linha) => [linha.id, documento.pendencias.filter((pendencia) => pendencia.etapa === linha.id && pendencia.tipo === 'bloqueia').length])) as Record<Etapa, number>;
  const mudar = (parcial: Partial<CabecalhoDaVersao>) => setCabecalho((atual) => ({ ...atual, ...parcial }));
  const mudarCondicoes = (parcial: Partial<CabecalhoDaVersao['condicoes']>) => setCabecalho((atual) => ({ ...atual, condicoes: { ...atual.condicoes, ...parcial } }));
  const salvar = () => executar(() => salvarVersaoDaProposta(versao.id, cabecalho), 'Rascunho salvo.');
  const campoTexto = (idCampo: string, rotulo: string, valor: string | null, aoMudar: (texto: string | null) => void, ajuda?: string) => (
    <Campo id={idCampo} rotulo={rotulo} ajuda={ajuda}>
      {(controle) => <Textarea {...controle} rows={3} disabled={!editavel} value={valor ?? ''} onChange={(evento) => aoMudar(evento.target.value || null)} />}
    </Campo>
  );

  const conteudo: Record<Etapa, React.ReactNode> = {
    cabecalho: (
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="prop-contraparte" rotulo="Contraparte">{(controle) => <Input {...controle} disabled value={ficha.contraparte ? nomeDaContraparte(ficha.contraparte) : ''} />}</Campo>
        <Campo id="prop-entidade" rotulo="Entidade emissora" obrigatorio ajuda="Planejada vale no rascunho; o final exige Ativa.">
          {(controle) => (
            <Selecao {...controle} disabled={!editavel} value={cabecalho.entidade_id ?? ''} onChange={(evento) => mudar({ entidade_id: evento.target.value || null })}>
              <option value="">Escolha</option>
              {entidadesParaVincular(dados.entidades).map((entidade) => <option key={entidade.id} value={entidade.id}>{nomeDaEntidade(entidade)}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id="prop-modelo" rotulo="Modelo de documento" obrigatorio ajuda="Modelos do tipo Proposta, em Legal › Modelos.">
          {(controle) => (
            <Selecao {...controle} disabled={!editavel} value={cabecalho.modelo_versao_id ?? ''} onChange={(evento) => mudar({ modelo_versao_id: evento.target.value || null })}>
              <option value="">{dados.modelosDeProposta.length ? 'Escolha' : 'Nenhum modelo de proposta cadastrado'}</option>
              {dados.modelosDeProposta.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.rotulo}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id="prop-validade" rotulo="Validade" obrigatorio ajuda="Padrão de 15 dias (D22), em Configurações.">
          {(controle) => <EntradaData {...controle} disabled={!editavel} value={cabecalho.validade} onChange={(evento) => mudar({ validade: evento.target.value })} />}
        </Campo>
        {contatos.length > 0 && <CaixasDeSelecao rotulo="Contatos destinatários" opcoes={contatos.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} valores={cabecalho.contatos} aoMudar={(valores) => editavel && mudar({ contatos: valores })} />}
      </div>
    ),
    itens: (
      <div className="grid gap-3">
        <AvisoCatalogoDeExemplo />
        {!ficha.itens.length && <p className="text-sm text-ink-soft">Nenhum item ainda.</p>}
        <ul className="grid gap-2">
          {ficha.itens.map((linha) => (
            <li key={linha.id} className="rounded-md border border-line bg-paper p-3.5 text-[13px]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-semibold">{linha.descricao}</span>
                {editavel && (
                  <span className="flex">
                    <Button variante="icone" tamanho="icone" aria-label={`Editar ${linha.descricao}`} onClick={() => setItem({ id: linha.id, dados: dadosDoItemExistente(linha, linha.desconto_valor), desconto_por: linha.desconto_por, desconto_em: linha.desconto_em })}><Pencil aria-hidden /></Button>
                    <Button variante="icone" tamanho="icone" aria-label={`Tirar ${linha.descricao}`} onClick={() => setRemovendo(linha.id)}><Trash2 aria-hidden /></Button>
                  </span>
                )}
              </div>
              <p className="mt-1 text-ink-soft">
                {linha.quantidade.toLocaleString('pt-BR')} × {linha.valor_unitario === null ? 'preço não definido' : formatarDinheiro(linha.valor_unitario, 'BRL')} · {linha.periodicidade ? ROTULOS_PERIODICIDADE_VALOR[linha.periodicidade] : ''}
                {linha.valor_total !== null && ` · ${formatarDinheiro(linha.valor_total, 'BRL')}`}
              </p>
              {(linha.desconto_percentual || linha.desconto_valor) && <p className="mt-1 text-xs">Desconto de {linha.desconto_percentual ? `${linha.desconto_percentual}%` : formatarDinheiro(linha.desconto_valor as number, 'BRL')} {linha.desconto_justificativa ? `· ${linha.desconto_justificativa} · por ${nomeDaPessoa(linha.desconto_por)} em ${formatarDiaISO(linha.desconto_em as string)}` : '· sem justificativa'}</p>}
              {linha.recurso_planejado && <p className="mt-1 text-xs">Inclui {linha.recurso_planejado}, previsto para {linha.recurso_previsto_para ? formatarDiaISO(linha.recurso_previsto_para) : '(sem data)'}</p>}
            </li>
          ))}
        </ul>
        {editavel && (
          <div className="flex flex-wrap gap-2">
            <Button variante="secundario" onClick={() => setItem({ id: null, dados: { ...ITEM_VAZIO, produto_id: dados.produtos[0]?.id ?? '' } })}><Plus aria-hidden />Adicionar oferta</Button>
            <Button variante="secundario" onClick={() => setItem({ id: null, dados: { ...ITEM_VAZIO, tipo_item: 'sob_medida', periodicidade: 'unica' } })}><Plus aria-hidden />Item sob medida</Button>
          </div>
        )}
      </div>
    ),
    escopo: (
      <div className="grid gap-[18px] md:grid-cols-2">
        {campoTexto('prop-incluido', 'Incluído', cabecalho.escopo_incluido, (texto) => mudar({ escopo_incluido: texto }), 'Texto da proposta: não muda a oferta.')}
        {campoTexto('prop-excluido', 'Excluído', cabecalho.escopo_excluido, (texto) => mudar({ escopo_excluido: texto }))}
        {campoTexto('prop-premissas', 'Premissas', cabecalho.premissas, (texto) => mudar({ premissas: texto }))}
        {campoTexto('prop-dependencias', 'Dependências do cliente', cabecalho.dependencias, (texto) => mudar({ dependencias: texto }))}
        <p className="text-xs text-ink-soft md:col-span-2">Recursos previstos entram pelo item, com a data (RN-10.07).</p>
      </div>
    ),
    condicoes: (
      <div className="grid gap-[18px] md:grid-cols-2">
        {campoTexto('prop-pagamento', 'Forma de pagamento', cabecalho.condicoes.forma_pagamento, (texto) => mudarCondicoes({ forma_pagamento: texto }))}
        {campoTexto('prop-vencimentos', 'Vencimentos', cabecalho.condicoes.vencimentos, (texto) => mudarCondicoes({ vencimentos: texto }), 'Ex.: implantação 50% no aceite e 50% na entrega.')}
        <Campo id="prop-reajuste" rotulo="Reajuste (índice)">{(controle) => <Input {...controle} disabled={!editavel} value={cabecalho.condicoes.reajuste_indice ?? ''} onChange={(evento) => mudarCondicoes({ reajuste_indice: evento.target.value || null })} />}</Campo>
        <Campo id="prop-reajuste-meses" rotulo="Reajuste a cada (meses)">{(controle) => <Input {...controle} inputMode="numeric" disabled={!editavel} value={cabecalho.condicoes.reajuste_periodicidade_meses ?? ''} onChange={(evento) => mudarCondicoes({ reajuste_periodicidade_meses: /^\d+$/.test(evento.target.value) ? Number(evento.target.value) : null })} />}</Campo>
        {campoTexto('prop-entrega', 'Prazo de entrega', cabecalho.condicoes.prazo_entrega, (texto) => mudarCondicoes({ prazo_entrega: texto }), 'Fixo ou relativo, como "30 dias úteis após a assinatura".')}
        {campoTexto('prop-observacoes', 'Observações', cabecalho.condicoes.observacoes, (texto) => mudarCondicoes({ observacoes: texto }))}
      </div>
    ),
    revisao: (
      <div className="grid gap-4">
        {alterado && <Faixa tipo="atencao">Salve o rascunho para a revisão considerar as últimas mudanças.</Faixa>}
        <ListaDePendencias pendencias={documento.pendencias} vazio="Sem pendências: pronta para emitir o final." aoIrParaEtapa={(destino) => setEtapa(destino as Etapa)} />
        {ficha.viabilidade && <Faixa>Viabilidade: {ROTULOS_CONCLUSAO_VIABILIDADE[ficha.viabilidade.conclusao]}.</Faixa>}
        {(editavel || versao.situacao === 'pronta') && <BotoesDeEmissao podeFinal={!bloqueiaEmissao(documento.pendencias) && !alterado} motivoSemFinal={alterado ? 'Salve o rascunho antes.' : bloqueiaEmissao(documento.pendencias) ? 'Resolva as pendências que bloqueiam a emissão final.' : null} modeloNaoValidado={documento.modeloNaoValidado} aoEmitir={(final, opcoes) => emitirProposta(ficha.proposta.id, final, opcoes)} />}
        {documento.nos.length > 0 ? <DocumentoRenderizadoVista nos={documento.nos} rascunho={versao.situacao === 'rascunho'} /> : <p className="text-sm text-ink-soft">Escolha o modelo para ver a prévia.</p>}
      </div>
    ),
  };

  const acoesDaSituacao = (
    <>
      {editavel && <Button variante="secundario" disabled={!alterado} onClick={() => void salvar()}><Save aria-hidden />Salvar rascunho</Button>}
      {versao.situacao === 'pronta' && (
        <>
          <Button variante="secundario" onClick={() => void executar(async () => (await import('@/dominio/comercial')).voltarParaRascunho(versao.id), 'Voltou para rascunho.')}><Undo2 aria-hidden />Voltar a rascunho</Button>
          <Button onClick={() => setJanela('envio')}><Send aria-hidden />Registrar envio</Button>
        </>
      )}
      {versao.situacao === 'enviada' && (
        <>
          <Button variante="secundario" onClick={() => setJanela('recusa')}><X aria-hidden />Registrar recusa</Button>
          <Button onClick={() => setJanela('aceite')}><Check aria-hidden />Registrar aceite</Button>
        </>
      )}
      {versao.situacao === 'expirada' && <Button onClick={() => setJanela('reabrir')}><CalendarClock aria-hidden />Reabrir validade</Button>}
      {!ficha.proposta.versao_aceita_id && ['enviada', 'recusada', 'expirada', 'pronta'].includes(versao.situacao) && <Button variante="secundario" onClick={() => void executar(() => novaVersaoDaProposta(ficha.proposta.id), 'Nova versão em rascunho.')}><CopyPlus aria-hidden />Nova versão</Button>}
      {ficha.proposta.versao_aceita_id && <Button onClick={() => setJanela('converter')}><FileSignature aria-hidden />{dados.contrato ? 'Abrir contrato' : 'Converter em contrato'}</Button>}
    </>
  );

  return (
    <>
      <LinkCentral href={`/comercial/oportunidades/${ficha.oportunidade.id}`} className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        {ficha.oportunidade.titulo}
      </LinkCentral>
      <CabecalhoPagina
        kicker={`Comercial · ${ficha.proposta.codigo}`}
        titulo={`Proposta para ${ficha.contraparte ? nomeDaContraparte(ficha.contraparte) : 'contraparte removida'}`}
        resumo={<span className="flex flex-wrap items-center gap-2">V{versao.numero} <EtiquetaSituacao tipo={TIPOS[versao.situacao]}>{ROTULOS_SITUACAO_VERSAO[versao.situacao]}</EtiquetaSituacao> Válida até {formatarDiaISO(versao.validade)}</span>}
        acoes={acoesDaSituacao}
      />
      {!editavel && <Faixa className="mt-4">{versao.situacao === 'aceita' ? `Aceita em ${formatarDiaISO(versao.aceite_em as string)} (${ROTULOS_FORMA_ACEITE[versao.aceite_forma as keyof typeof ROTULOS_FORMA_ACEITE]}). O aceite não é a assinatura do contrato.` : versao.situacao === 'recusada' ? `Recusada: ${versao.recusa_motivo}` : 'Esta versão não muda mais. Para alterar, crie uma nova versão (RN-10.11).'}</Faixa>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <EtapasLaterais rotulo="Etapas da proposta" etapas={ETAPAS} ativa={etapa} aoEscolher={setEtapa} pendencias={pendenciasPorEtapa} />
        <CartaoDePainel titulo={ETAPAS.find((linha) => linha.id === etapa)?.rotulo}>{conteudo[etapa]}</CartaoDePainel>
        <aside className="grid content-start gap-4">
          <CartaoDePainel titulo="Valores da proposta">
            {linhasDosTotais(totais).length ? (
              <ul className="grid gap-1.5 text-[13px]">
                {linhasDosTotais(totais).map((linha) => <li key={linha} className="font-semibold">{linha}</li>)}
                {totais.anualEquivalente !== null && <li className="text-ink-soft">Anual equivalente (referência, sem os únicos): {formatarDinheiro(totais.anualEquivalente, 'BRL')}</li>}
              </ul>
            ) : <p className="text-[13px] text-ink-soft">Sem itens com valor.</p>}
          </CartaoDePainel>
          <CartaoDePainel titulo="Versões">
            <ul className="grid gap-1 text-[13px]">
              {ficha.versoes.map((linha) => <li key={linha.id} className="flex flex-wrap items-center gap-2">V{linha.numero} <EtiquetaSituacao tipo={TIPOS[linha.situacao]}>{ROTULOS_SITUACAO_VERSAO[linha.situacao]}</EtiquetaSituacao></li>)}
            </ul>
          </CartaoDePainel>
          <CartaoDePainel titulo="Documentos emitidos"><ListaDeEmissoes documentos={dados.documentos} /></CartaoDePainel>
        </aside>
      </div>
      {item && <DialogoItem produtos={item.dados.tipo_item === 'oferta' ? dados.produtos : dados.todosProdutos} item={item} nomeDaPessoa={nomeDaPessoa} aoFechar={() => setItem(null)} aoSalvar={async (valores, itemId) => { await salvarItemDaProposta(versao.id, valores, itemId ?? undefined); aviso(itemId ? 'Item atualizado.' : 'Item adicionado.'); }} />}
      {janela === 'envio' && <DialogoEnvio versaoId={versao.id} aoFechar={() => setJanela('')} />}
      {janela === 'aceite' && <DialogoAceite versao={versao} aoFechar={() => setJanela('')} />}
      {janela === 'converter' && <DialogoConverter dados={dados} aoFechar={() => setJanela('')} />}
      <Confirmacao aberto={janela === 'recusa'} aoFechar={() => setJanela('')} titulo="Registrar recusa?" texto="A versão fica Recusada. A oportunidade continua aberta para uma nova versão, ou pode ser marcada como perdida." rotuloConfirmar="Registrar recusa" pedirMotivo aoConfirmar={(motivo) => { setJanela(''); void executar(() => registrarRecusa(versao.id, motivo), 'Recusa registrada.'); }} />
      <Confirmacao aberto={removendo !== null} aoFechar={() => setRemovendo(null)} titulo="Tirar este item?" texto="Ele sai desta versão em rascunho." rotuloConfirmar="Tirar item" perigo aoConfirmar={() => { const alvo = removendo; setRemovendo(null); if (alvo) void executar(() => removerItemDaProposta(alvo), 'Item retirado.'); }} />
      <JanelaFormulario aberto={janela === 'reabrir'} aoFechar={() => setJanela('')} titulo="Reabrir validade" rotuloSalvar="Reabrir" aoEnviar={(evento) => { evento.preventDefault(); const motivo = (evento.currentTarget.elements.namedItem('motivo') as HTMLTextAreaElement).value; void executar(() => reabrirValidade(versao.id, novaValidade, motivo), 'Validade reaberta.').then((ok) => ok && setJanela('')); }}>
        <div className="grid gap-[18px]">
          <Campo id="reabrir-validade" rotulo="Nova validade" obrigatorio>{(controle) => <EntradaData {...controle} value={novaValidade} onChange={(evento) => setNovaValidade(evento.target.value)} />}</Campo>
          <Campo id="reabrir-motivo" rotulo="Motivo" obrigatorio>{(controle) => <Textarea {...controle} name="motivo" rows={3} />}</Campo>
        </div>
      </JanelaFormulario>
    </>
  );
}
