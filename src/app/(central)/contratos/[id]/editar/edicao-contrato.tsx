'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Pencil, Percent, Plus, Save, Trash2, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { AcoesDoFluxo } from '@/componentes/f1/acoes-fluxo';
import { AvisoCatalogoDeExemplo, CaixasDeSelecao, CartaoDePainel, EtapasLaterais, executar, ListaDePendencias, paraOpcoes } from '@/componentes/f1/apoio';
import { carregarTelaDoContrato, type TelaDoContrato } from '@/componentes/f1/dados-contrato';
import { DialogoItem, dadosDoItemExistente, type ItemParaEditar } from '@/componentes/f1/dialogo-item';
import { DialogoTermosDeRepasse } from '@/componentes/f1/dialogo-termos-repasse';
import { textoDosTermos } from '@/dominio/repasses';
import type { ItemContrato } from '@/dados/tipos/contrato';
import { DocumentoRenderizadoVista } from '@/componentes/f1/documento';
import { ListaDeEmissoes } from '@/componentes/f1/emissao';
import { EditorSaas } from '@/componentes/f1/editor-saas';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import type { CondicoesContrato, ContratoVersao, ObrigacaoContratual, RegraPrazo } from '@/dados/tipos/contrato';
import { useConsulta } from '@/dados/use-consulta';
import { ITEM_VAZIO, linhasDosTotais, ROTULOS_PERIODICIDADE_VALOR, totaisDosItens } from '@/dominio/comercial';
import { calcularPrazo, definirSignatarios, errosDasCondicoes, FAMILIAS_F1, removerItemDoContrato, removerObrigacao, removerRegraDePrazo, ROTULOS_DOCUMENTAL, ROTULOS_EVENTO, ROTULOS_FORMA_PAGAMENTO, ROTULOS_PARTE, ROTULOS_RENOVACAO_TIPO, ROTULOS_TIPO_CONTRATO, ROTULOS_UNIDADE, salvarItemDoContrato, salvarObrigacao, salvarPartes, salvarRegraDePrazo, salvarVersao, textoDaRegra, type DadosDasPartes } from '@/dominio/contratos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { entidadesParaVincular, nomeDaEntidade } from '@/dominio/entidades';
import { ROTULOS_FAMILIA } from '@/dominio/modelos';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const ETAPAS = [
  { id: 'partes', rotulo: 'Partes' },
  { id: 'itens', rotulo: 'Itens' },
  { id: 'condicoes', rotulo: 'Condições' },
  { id: 'prazos', rotulo: 'Prazos' },
  { id: 'obrigacoes', rotulo: 'Obrigações' },
  { id: 'documento', rotulo: 'Documento' },
  { id: 'revisao', rotulo: 'Revisão' },
] as const;
type Etapa = (typeof ETAPAS)[number]['id'];

const numeroOuNulo = (texto: string) => (texto.trim() === '' ? null : Number(texto.replace(',', '.')));

export function EdicaoDoContrato() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregarTelaDoContrato(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler o contrato." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados) return <EstadoVazio icone={TriangleAlert} titulo="Contrato não encontrado." texto="Ele pode ter sido removido." acao={<LinkCentral href="/contratos">Voltar</LinkCentral>} />;
  const tela = consulta.dados;
  return (
    <>
      <LinkCentral href={`/contratos/${tela.ficha.contrato.id}`} className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Ficha do contrato
      </LinkCentral>
      {tela.ficha.contrato.saas ? <EditorSaas key={tela.ficha.atual.id} tela={tela} /> : <Assistente key={tela.ficha.atual.id} tela={tela} />}
    </>
  );
}

/** T11.03: etapas navegáveis livremente; cada uma salva o seu pedaço e mostra as pendências dela. */
function Assistente({ tela }: { tela: TelaDoContrato }) {
  const { ficha, documento } = tela;
  const { contrato, atual } = ficha;
  const editavel = atual.situacao === 'em_elaboracao' && atual.fluxo === 'rascunho';
  const original = atual.tipo === 'original' && !contrato.versao_vigente_id;
  const [etapa, setEtapa] = useState<Etapa>('partes');
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get('etapa');
    if (ETAPAS.some((linha) => linha.id === pedida)) setEtapa(pedida as Etapa);
  }, []);
  const partesIniciais: DadosDasPartes = { titulo: contrato.titulo, familia: contrato.familia, tipo: contrato.tipo, entidade_id: contrato.entidade_id, contraparte_id: contrato.contraparte_id, responsavel_id: contrato.responsavel_id, participantes: contrato.participantes };
  const versaoInicial = { vigencia_inicio: atual.vigencia_inicio, vigencia_inicio_evento: atual.vigencia_inicio_evento, vigencia_inicio_evento_nome: atual.vigencia_inicio_evento_nome, vigencia_fim: atual.vigencia_fim, vigencia_duracao_meses: atual.vigencia_duracao_meses, vigencia_indeterminada: atual.vigencia_indeterminada, condicoes: atual.condicoes, modelo_versao_id: atual.modelo_versao_id, representante_contraparte_id: atual.representante_contraparte_id, data_efeito: atual.data_efeito, retroatividade_justificativa: atual.retroatividade_justificativa, resumo_mudancas: atual.resumo_mudancas };
  const [partes, setPartes] = useState(partesIniciais);
  const [versao, setVersao] = useState(versaoInicial);
  useEffect(() => {
    setPartes(partesIniciais);
    setVersao(versaoInicial);
  }, [contrato.versao_registro, atual.versao_registro]); // eslint-disable-line react-hooks/exhaustive-deps -- recomeça do que está gravado
  const alterado = JSON.stringify(partes) !== JSON.stringify(partesIniciais) || JSON.stringify(versao) !== JSON.stringify(versaoInicial);
  useAlteracoesPendentes(alterado);
  const [item, setItem] = useState<ItemParaEditar | { id: null; dados: typeof ITEM_VAZIO } | null>(null);
  const [termos, setTermos] = useState<ItemContrato | null>(null);
  const deParceiro = contrato.familia === 'parceiro';
  const internas = useMemo(() => pessoasDoSeletor(tela.pessoas), [tela.pessoas]);
  const daContraparte = tela.pessoas.filter((pessoa) => pessoa.contraparte_id === contrato.contraparte_id && !pessoa.arquivado_em);
  const nomeDaPessoa = (pessoaId: string | null) => tela.pessoas.find((pessoa) => pessoa.id === pessoaId)?.nome_completo ?? 'Pessoa removida';
  const mudarCondicoes = (parcial: Partial<CondicoesContrato>) => setVersao((atualizada) => ({ ...atualizada, condicoes: { ...atualizada.condicoes, ...parcial } }));
  const errosCondicoes = errosDasCondicoes(versao.condicoes);
  const salvarTudo = async () => {
    if (original && JSON.stringify(partes) !== JSON.stringify(partesIniciais)) await salvarPartes(contrato.id, partes);
    if (JSON.stringify(versao) !== JSON.stringify(versaoInicial)) await salvarVersao(atual.id, versao);
  };
  const pendenciasPorEtapa = Object.fromEntries(ETAPAS.map((linha) => [linha.id, documento.pendencias.filter((pendencia) => pendencia.etapa === linha.id && pendencia.tipo === 'bloqueia').length])) as Record<Etapa, number>;
  const totais = totaisDosItens(ficha.itens);
  const temFinal = tela.documentos.some((documentoEmitido) => documentoEmitido.final);
  const modeloNaoValidado = documento.pendencias.some((pendencia) => pendencia.id === 'modelo-nao-validado');

  const opcoes = (rotulos: Readonly<Record<string, string>>, incluirVazio = 'Escolha') => [
    <option key="" value="">{incluirVazio}</option>,
    ...paraOpcoes(rotulos).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>),
  ];

  const conteudo: Record<Etapa, React.ReactNode> = {
    partes: (
      <div className="grid gap-[18px] md:grid-cols-2">
        {!original && (
          <>
            <Faixa className="md:col-span-2">{atual.tipo === 'renovacao' ? 'Versão de renovação' : 'Aditivo'}: as partes não mudam aqui; trocar uma parte exige um aditivo próprio, com o documento e a assinatura (RN-11.12).</Faixa>
            <Campo id="ad-efeito" rotulo="Data de efeito" obrigatorio>{(controle) => <EntradaData {...controle} disabled={!editavel} value={versao.data_efeito ?? ''} onChange={(evento) => setVersao((v) => ({ ...v, data_efeito: evento.target.value || null }))} />}</Campo>
            <Campo id="ad-retro" rotulo="Justificativa de retroatividade" ajuda="Obrigatória se a data de efeito estiver no passado.">{(controle) => <Input {...controle} disabled={!editavel} value={versao.retroatividade_justificativa ?? ''} onChange={(evento) => setVersao((v) => ({ ...v, retroatividade_justificativa: evento.target.value || null }))} />}</Campo>
            <Campo id="ad-resumo" rotulo="Resumo das mudanças" className="md:col-span-2">{(controle) => <Textarea {...controle} rows={2} disabled={!editavel} value={versao.resumo_mudancas ?? ''} onChange={(evento) => setVersao((v) => ({ ...v, resumo_mudancas: evento.target.value || null }))} />}</Campo>
          </>
        )}
        <Campo id="ctr-familia" rotulo="Família" obrigatorio>{(controle) => <Selecao {...controle} disabled={!editavel || !original} value={partes.familia} onChange={(evento) => setPartes((p) => ({ ...p, familia: evento.target.value as DadosDasPartes['familia'] }))}>{FAMILIAS_F1.map((item) => <option key={item} value={item}>{ROTULOS_FAMILIA[item]}</option>)}</Selecao>}</Campo>
        <Campo id="ctr-tipo" rotulo="Tipo" obrigatorio>{(controle) => <Selecao {...controle} disabled={!editavel || !original} value={partes.tipo} onChange={(evento) => setPartes((p) => ({ ...p, tipo: evento.target.value as DadosDasPartes['tipo'] }))}>{paraOpcoes(ROTULOS_TIPO_CONTRATO).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Selecao>}</Campo>
        <Campo id="ctr-titulo" rotulo="Título" obrigatorio className="md:col-span-2">{(controle) => <Input {...controle} disabled={!editavel || !original} value={partes.titulo} onChange={(evento) => setPartes((p) => ({ ...p, titulo: evento.target.value }))} />}</Campo>
        <Campo id="ctr-entidade" rotulo="Entidade contratante" obrigatorio ajuda="Planejada vale no rascunho (RN-11.02).">{(controle) => <Selecao {...controle} disabled={!editavel || !original} value={partes.entidade_id} onChange={(evento) => setPartes((p) => ({ ...p, entidade_id: evento.target.value }))}>{entidadesParaVincular(tela.entidades).map((item) => <option key={item.id} value={item.id}>{nomeDaEntidade(item)}</option>)}</Selecao>}</Campo>
        <Campo id="ctr-contraparte" rotulo="Contraparte">{(controle) => <Input {...controle} disabled value={(() => { const item = tela.contrapartes.find((linha) => linha.id === contrato.contraparte_id); return item ? nomeDaContraparte(item) : ''; })()} />}</Campo>
        <Campo id="ctr-responsavel" rotulo="Responsável principal" obrigatorio>{(controle) => <SelecaoPessoa {...controle} disabled={!editavel || !original} pessoas={internas} value={partes.responsavel_id} onChange={(evento) => setPartes((p) => ({ ...p, responsavel_id: evento.target.value }))} />}</Campo>
        <Campo id="ctr-classe" rotulo="Classe do documento">{(controle) => <Input {...controle} disabled value="DOC (padrão)" />}</Campo>
        <div className="md:col-span-2">
          <CaixasDeSelecao rotulo="Assinam pela Numa" opcoes={internas.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} valores={ficha.signatarios.filter((linha) => linha.parte === 'numa').map((linha) => linha.pessoa_id)} aoMudar={(valores) => editavel && void executar(() => definirSignatarios(atual.id, 'numa', valores))} />
        </div>
        <div className="md:col-span-2">
          {daContraparte.length ? <CaixasDeSelecao rotulo="Assinam pela contraparte" opcoes={daContraparte.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo }))} valores={ficha.signatarios.filter((linha) => linha.parte === 'contraparte').map((linha) => linha.pessoa_id)} aoMudar={(valores) => editavel && void executar(() => definirSignatarios(atual.id, 'contraparte', valores))} /> : <Faixa acao={<LinkCentral className="underline" href={`/configuracoes/cadastros/contrapartes/${contrato.contraparte_id}`}>Abrir a contraparte</LinkCentral>}>A contraparte não tem pessoas de contato para assinar. Cadastre na ficha dela.</Faixa>}
        </div>
        {contrato.proposta_versao_id && <p className="text-xs text-ink-soft md:col-span-2">Origem: proposta aceita. Valores diferentes dela aparecem sinalizados nos itens.</p>}
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
                    {deParceiro && <Button variante="icone" tamanho="icone" aria-label={`Termos de repasse de ${linha.descricao}`} onClick={() => setTermos(linha)}><Percent aria-hidden /></Button>}
                    <Button variante="icone" tamanho="icone" aria-label={`Editar ${linha.descricao}`} onClick={() => setItem({ id: linha.id, dados: dadosDoItemExistente(linha, linha.desconto), desconto_por: linha.desconto_por, desconto_em: linha.desconto_em })}><Pencil aria-hidden /></Button>
                    <Button variante="icone" tamanho="icone" aria-label={`Tirar ${linha.descricao}`} onClick={() => void executar(() => removerItemDoContrato(linha.id), 'Item retirado.')}><Trash2 aria-hidden /></Button>
                  </span>
                )}
              </div>
              <p className="mt-1 text-ink-soft">{linha.quantidade.toLocaleString('pt-BR')} × {linha.valor_unitario === null ? 'valor vazio' : formatarDinheiro(linha.valor_unitario, contrato.moeda)} · {linha.periodicidade ? ROTULOS_PERIODICIDADE_VALOR[linha.periodicidade] : ''}{linha.valor_total !== null && ` · ${formatarDinheiro(linha.valor_total, contrato.moeda)}`}</p>
              {deParceiro && <p className="mt-1 text-xs" data-termos-de-repasse>Repasse: {textoDosTermos(linha)}</p>}
              {tela.diferencas[linha.id] && <p className="mt-1 text-xs font-semibold text-warn">{tela.diferencas[linha.id]}</p>}
              {(linha.desconto || linha.desconto_percentual) && <p className="mt-1 text-xs">Desconto {linha.desconto_justificativa ? `· ${linha.desconto_justificativa} · por ${nomeDaPessoa(linha.desconto_por)}` : '· sem justificativa'}</p>}
            </li>
          ))}
        </ul>
        {linhasDosTotais(totais).length > 0 && <p className="text-[13px] font-semibold">{linhasDosTotais(totais).join(' · ')}</p>}
        {editavel && (
          <div className="flex flex-wrap gap-2">
            <Button variante="secundario" onClick={() => setItem({ id: null, dados: { ...ITEM_VAZIO } })}><Plus aria-hidden />Adicionar oferta</Button>
            <Button variante="secundario" onClick={() => setItem({ id: null, dados: { ...ITEM_VAZIO, tipo_item: 'sob_medida', periodicidade: 'unica' } })}><Plus aria-hidden />Item sob medida</Button>
          </div>
        )}
      </div>
    ),
    condicoes: (
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="cond-pagamento" rotulo="Forma de pagamento" obrigatorio>{(controle) => <Selecao {...controle} disabled={!editavel} value={versao.condicoes.forma_pagamento ?? ''} onChange={(evento) => mudarCondicoes({ forma_pagamento: (evento.target.value || null) as CondicoesContrato['forma_pagamento'] })}>{opcoes(ROTULOS_FORMA_PAGAMENTO)}</Selecao>}</Campo>
        <Campo id="cond-dia" rotulo="Dia de vencimento" ajuda="De 1 a 28, para os recorrentes.">{(controle) => <Input {...controle} inputMode="numeric" disabled={!editavel} value={versao.condicoes.dia_vencimento ?? ''} onChange={(evento) => mudarCondicoes({ dia_vencimento: numeroOuNulo(evento.target.value) })} />}</Campo>
        <fieldset className="grid gap-2 rounded-md border border-line p-3 md:col-span-2">
          <legend className="px-1 text-[13px] font-semibold">Parcelas dos valores únicos</legend>
          <p className="text-xs text-ink-soft">Sem parcelas, o valor único vence no início. Por evento, o vencimento espera o evento ser registrado (RN-11.13).</p>
          {versao.condicoes.parcelas.map((parcela, indice) => (
            <div key={indice} className="grid gap-2 md:grid-cols-[90px_150px_minmax(0,1fr)_auto]">
              <Input aria-label={`Percentual da parcela ${indice + 1}`} inputMode="decimal" disabled={!editavel} value={parcela.percentual} onChange={(evento) => mudarCondicoes({ parcelas: versao.condicoes.parcelas.map((p, i) => (i === indice ? { ...p, percentual: Number(evento.target.value.replace(',', '.')) || 0 } : p)) })} />
              <Selecao aria-label={`Gatilho da parcela ${indice + 1}`} disabled={!editavel} value={parcela.gatilho} onChange={(evento) => mudarCondicoes({ parcelas: versao.condicoes.parcelas.map((p, i) => (i === indice ? { ...p, gatilho: evento.target.value as 'data' | 'evento' } : p)) })}><option value="evento">Por evento</option><option value="data">Por data</option></Selecao>
              {parcela.gatilho === 'data' ? <EntradaData aria-label={`Data da parcela ${indice + 1}`} disabled={!editavel} value={parcela.data ?? ''} onChange={(evento) => mudarCondicoes({ parcelas: versao.condicoes.parcelas.map((p, i) => (i === indice ? { ...p, data: evento.target.value || null } : p)) })} /> : <Input aria-label={`Evento da parcela ${indice + 1}`} placeholder="Ex.: Aceite, Entrega" disabled={!editavel} value={parcela.evento ?? ''} onChange={(evento) => mudarCondicoes({ parcelas: versao.condicoes.parcelas.map((p, i) => (i === indice ? { ...p, evento: evento.target.value || null } : p)) })} />}
              {editavel && <Button variante="icone" tamanho="icone" aria-label={`Tirar a parcela ${indice + 1}`} onClick={() => mudarCondicoes({ parcelas: versao.condicoes.parcelas.filter((_, i) => i !== indice) })}><Trash2 aria-hidden /></Button>}
            </div>
          ))}
          {editavel && <Button variante="secundario" tamanho="pequeno" className="justify-self-start" onClick={() => mudarCondicoes({ parcelas: [...versao.condicoes.parcelas, { percentual: 50, gatilho: 'evento', data: null, evento: 'Aceite' }] })}><Plus aria-hidden />Incluir parcela</Button>}
        </fieldset>
        <Campo id="cond-multa" rotulo="Multa por atraso (%)">{(controle) => <Input {...controle} inputMode="decimal" disabled={!editavel} value={versao.condicoes.multa_atraso ?? ''} onChange={(evento) => mudarCondicoes({ multa_atraso: numeroOuNulo(evento.target.value) })} />}</Campo>
        <Campo id="cond-juros" rotulo="Juros (% ao mês)">{(controle) => <Input {...controle} inputMode="decimal" disabled={!editavel} value={versao.condicoes.juros_mes ?? ''} onChange={(evento) => mudarCondicoes({ juros_mes: numeroOuNulo(evento.target.value) })} />}</Campo>
        <Campo id="cond-fidelidade" rotulo="Fidelidade (meses)">{(controle) => <Input {...controle} inputMode="numeric" disabled={!editavel} value={versao.condicoes.fidelidade_meses ?? ''} onChange={(evento) => mudarCondicoes({ fidelidade_meses: numeroOuNulo(evento.target.value) })} />}</Campo>
        {Boolean(versao.condicoes.fidelidade_meses) && <Campo id="cond-fid-motivo" rotulo="Motivo da fidelidade" obrigatorio>{(controle) => <Input {...controle} disabled={!editavel} value={versao.condicoes.fidelidade_motivo ?? ''} onChange={(evento) => mudarCondicoes({ fidelidade_motivo: evento.target.value || null })} />}</Campo>}
        <Campo id="cond-multa-rescisoria" rotulo="Multa rescisória">{(controle) => <Input {...controle} disabled={!editavel} value={versao.condicoes.multa_rescisoria ?? ''} onChange={(evento) => mudarCondicoes({ multa_rescisoria: evento.target.value || null })} />}</Campo>
        <Campo id="cond-reajuste" rotulo="Reajuste (índice)" ajuda="Registrado no contrato. O cálculo e a aplicação do reajuste são da F2.">{(controle) => <Input {...controle} disabled={!editavel} value={versao.condicoes.reajuste_indice ?? ''} onChange={(evento) => mudarCondicoes({ reajuste_indice: evento.target.value || null })} />}</Campo>
        <Campo id="cond-renovacao" rotulo="Renovação" obrigatorio ajuda="Não presumida (RN-11.21).">{(controle) => <Selecao {...controle} disabled={!editavel} value={versao.condicoes.renovacao_tipo ?? ''} onChange={(evento) => mudarCondicoes({ renovacao_tipo: (evento.target.value || null) as CondicoesContrato['renovacao_tipo'] })}>{opcoes(ROTULOS_RENOVACAO_TIPO)}</Selecao>}</Campo>
        {versao.condicoes.renovacao_tipo && versao.condicoes.renovacao_tipo !== 'sem_renovacao' && (
          <>
            <Campo id="cond-periodo" rotulo="Período da renovação (meses)" obrigatorio={versao.condicoes.renovacao_tipo === 'automatica'}>{(controle) => <Input {...controle} inputMode="numeric" disabled={!editavel} value={versao.condicoes.renovacao_periodo_meses ?? ''} onChange={(evento) => mudarCondicoes({ renovacao_periodo_meses: numeroOuNulo(evento.target.value) })} />}</Campo>
            <Campo id="cond-aviso" rotulo="Aviso prévio (dias)" ajuda="Define a data-limite de decisão: fim − aviso.">{(controle) => <Input {...controle} inputMode="numeric" disabled={!editavel} value={versao.condicoes.aviso_previo_dias ?? ''} onChange={(evento) => mudarCondicoes({ aviso_previo_dias: numeroOuNulo(evento.target.value) })} />}</Campo>
          </>
        )}
        <Campo id="cond-aceite" rotulo="Critérios de aceite da entrega">{(controle) => <Input {...controle} disabled={!editavel} value={versao.condicoes.aceite_criterios ?? ''} onChange={(evento) => mudarCondicoes({ aceite_criterios: evento.target.value || null })} />}</Campo>
        <Campo id="cond-aceite-prazo" rotulo="Prazo de aceite (dias)">{(controle) => <Input {...controle} inputMode="numeric" disabled={!editavel} value={versao.condicoes.aceite_prazo_dias ?? ''} onChange={(evento) => mudarCondicoes({ aceite_prazo_dias: numeroOuNulo(evento.target.value) })} />}</Campo>
        <p className="text-xs text-ink-soft md:col-span-2">SLA é da F2.</p>
        {errosCondicoes.map((erro) => <Faixa key={erro} tipo="erro" className="md:col-span-2">{erro}</Faixa>)}
      </div>
    ),
    prazos: <AbaPrazos tela={tela} editavel={editavel} versao={versao} aoMudar={(parcial) => setVersao((v) => ({ ...v, ...parcial }))} />,
    obrigacoes: <AbaObrigacoes tela={tela} editavel={editavel} />,
    documento: (
      <div className="grid gap-4">
        <Campo id="ctr-modelo" rotulo="Modelo" obrigatorio ajuda="Modelos desta família, em Legal › Modelos.">{(controle) => <Selecao {...controle} disabled={!editavel} value={versao.modelo_versao_id ?? ''} onChange={(evento) => setVersao((v) => ({ ...v, modelo_versao_id: evento.target.value || null }))}><option value="">{tela.modelosDeContrato.length ? 'Escolha' : 'Nenhum modelo de contrato cadastrado'}</option>{tela.modelosDeContrato.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.rotulo}</option>)}</Selecao>}</Campo>
        {modeloNaoValidado && <Faixa tipo="atencao">Modelo não validado: a emissão final pede confirmação e motivo (RN-09.13).</Faixa>}
        {documento.faltando.length > 0 && <Faixa tipo="atencao">Variáveis obrigatórias vazias: {documento.faltando.join(', ')}.</Faixa>}
        {documento.nos.length ? <DocumentoRenderizadoVista nos={documento.nos} rascunho /> : <p className="text-sm text-ink-soft">Escolha e salve o modelo para ver a prévia.</p>}
      </div>
    ),
    revisao: (
      <div className="grid gap-4">
        {alterado && <Faixa tipo="atencao">Salve antes: a revisão considera o que está gravado.</Faixa>}
        <ListaDePendencias pendencias={documento.pendencias} vazio="Sem pendências." aoIrParaEtapa={(destino) => setEtapa(destino as Etapa)} />
        <AcoesDoFluxo contratoId={contrato.id} versao={atual} pendencias={documento.pendencias} alterado={alterado} temFinal={temFinal} modeloNaoValidado={modeloNaoValidado} />
        <CartaoDePainel titulo="Documentos emitidos"><ListaDeEmissoes documentos={tela.documentos} /></CartaoDePainel>
      </div>
    ),
  };

  return (
    <>
      <CabecalhoPagina
        kicker={`Contratos · ${contrato.codigo} V${atual.numero}`}
        titulo={contrato.titulo}
        resumo={`${ROTULOS_DOCUMENTAL[atual.fluxo]}${atual.tipo !== 'original' ? ` · ${atual.tipo === 'aditivo' ? 'Aditivo' : 'Renovação'}` : ''}`}
        acoes={editavel ? <Button disabled={!alterado || errosCondicoes.length > 0} onClick={() => void executar(salvarTudo, 'Rascunho salvo.')}><Save aria-hidden />Salvar rascunho</Button> : undefined}
      />
      {!editavel && atual.situacao === 'em_elaboracao' && <Faixa className="mt-4">Em {ROTULOS_DOCUMENTAL[atual.fluxo].toLowerCase()}: os dados ficam como estão. Para mudar, devolva para rascunho na etapa Revisão.</Faixa>}
      {atual.situacao !== 'em_elaboracao' && <Faixa className="mt-4">Versão assinada: não muda mais. Para alterar, use Nova versão ou aditivo na ficha.</Faixa>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <EtapasLaterais rotulo="Etapas do contrato" etapas={ETAPAS} ativa={etapa} aoEscolher={setEtapa} pendencias={pendenciasPorEtapa} />
        <CartaoDePainel titulo={ETAPAS.find((linha) => linha.id === etapa)?.rotulo}>{conteudo[etapa]}</CartaoDePainel>
      </div>
      {termos && <DialogoTermosDeRepasse item={termos} aoFechar={() => setTermos(null)} />}
      {item && <DialogoItem produtos={tela.produtos.filter((produto) => !produto.arquivado_em)} item={item} nomeDaPessoa={nomeDaPessoa} aoFechar={() => setItem(null)} aoSalvar={async (valores, itemId) => { await salvarItemDoContrato(atual.id, valores, itemId ?? undefined); aviso(itemId ? 'Item atualizado.' : 'Item adicionado.'); }} />}
    </>
  );
}

type VersaoEditavel = Pick<ContratoVersao, 'vigencia_inicio' | 'vigencia_inicio_evento' | 'vigencia_inicio_evento_nome' | 'vigencia_fim' | 'vigencia_duracao_meses' | 'vigencia_indeterminada'>;

const REGRA_VAZIA: Omit<RegraPrazo, keyof import('@/dados/tipos/controle').Controle | 'versao_id'> = { nome: '', uso: 'entrega', produto_id: null, evento_referencia: 'assinatura', evento_nome: null, data_fixa: null, duracao: null, unidade: 'dias_corridos', excecao_justificativa: null };

function AbaPrazos({ tela, editavel, versao, aoMudar: mudar }: { tela: TelaDoContrato; editavel: boolean; versao: VersaoEditavel; aoMudar: (parcial: Partial<VersaoEditavel>) => void }) {
  const [regra, setRegra] = useState(REGRA_VAZIA);
  const fim = versao.vigencia_indeterminada ? 'indeterminado' : versao.vigencia_fim ? 'data' : 'duracao';
  return (
    <div className="grid gap-5">
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="prazo-inicio-evento" rotulo="Início da vigência" obrigatorio>{(controle) => <Selecao {...controle} disabled={!editavel} value={versao.vigencia_inicio_evento} onChange={(evento) => mudar({ vigencia_inicio_evento: evento.target.value as VersaoEditavel['vigencia_inicio_evento'] })}><option value="assinatura">Na assinatura</option><option value="data_fixa">Em data fixa</option><option value="outro">Em outro evento</option></Selecao>}</Campo>
        {versao.vigencia_inicio_evento === 'data_fixa' && <Campo id="prazo-inicio" rotulo="Data de início" obrigatorio>{(controle) => <EntradaData {...controle} disabled={!editavel} value={versao.vigencia_inicio ?? ''} onChange={(evento) => mudar({ vigencia_inicio: evento.target.value || null })} />}</Campo>}
        {versao.vigencia_inicio_evento === 'outro' && <Campo id="prazo-inicio-nome" rotulo="Nome do evento" obrigatorio>{(controle) => <Input {...controle} disabled={!editavel} value={versao.vigencia_inicio_evento_nome ?? ''} onChange={(evento) => mudar({ vigencia_inicio_evento_nome: evento.target.value || null })} />}</Campo>}
        <Campo id="prazo-fim-tipo" rotulo="Fim da vigência" obrigatorio>{(controle) => <Selecao {...controle} disabled={!editavel} value={fim} onChange={(evento) => mudar(evento.target.value === 'indeterminado' ? { vigencia_indeterminada: true, vigencia_fim: null, vigencia_duracao_meses: null } : evento.target.value === 'data' ? { vigencia_indeterminada: false, vigencia_duracao_meses: null } : { vigencia_indeterminada: false, vigencia_fim: null })}><option value="duracao">Por duração</option><option value="data">Em data</option><option value="indeterminado">Indeterminado</option></Selecao>}</Campo>
        {fim === 'data' && <Campo id="prazo-fim" rotulo="Data de fim">{(controle) => <EntradaData {...controle} disabled={!editavel} value={versao.vigencia_fim ?? ''} onChange={(evento) => mudar({ vigencia_fim: evento.target.value || null })} />}</Campo>}
        {fim === 'duracao' && <Campo id="prazo-duracao" rotulo="Duração (meses)">{(controle) => <Input {...controle} inputMode="numeric" disabled={!editavel} value={versao.vigencia_duracao_meses ?? ''} onChange={(evento) => mudar({ vigencia_duracao_meses: numeroOuNulo(evento.target.value) })} />}</Campo>}
      </div>
      <div className="grid gap-2">
        <h3 className="text-[15px]">Regras de prazo</h3>
        <p className="text-xs text-ink-soft">A data é calculada; sem o evento, fica “Pendente: aguardando…”, nunca estimada. Mudar uma regra depois da assinatura exige aditivo.</p>
        <ul className="grid gap-1.5">
          {tela.ficha.regras.map((linha) => {
            const calculada = calcularPrazo(linha, tela.ficha.eventos, tela.feriados);
            return (
              <li key={linha.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-2 text-[13px]">
                <span><strong>{linha.nome}</strong> · {textoDaRegra(linha)} · {calculada.pendente ? calculada.texto : formatarDiaISO(calculada.data)}</span>
                {editavel && <Button variante="icone" tamanho="icone" aria-label={`Tirar ${linha.nome}`} onClick={() => void executar(() => removerRegraDePrazo(linha.id), 'Prazo retirado.')}><Trash2 aria-hidden /></Button>}
              </li>
            );
          })}
        </ul>
        {editavel && (
          <fieldset className="grid gap-2 rounded-md border border-line p-3 md:grid-cols-2">
            <legend className="px-1 text-[13px] font-semibold">Novo prazo</legend>
            <Input aria-label="Nome do prazo" placeholder="Ex.: Entrega do Kipi" value={regra.nome} onChange={(evento) => setRegra((r) => ({ ...r, nome: evento.target.value }))} />
            <Selecao aria-label="Evento de referência" value={regra.evento_referencia} onChange={(evento) => setRegra((r) => ({ ...r, evento_referencia: evento.target.value as RegraPrazo['evento_referencia'] }))}>{Object.entries(ROTULOS_EVENTO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</Selecao>
            {regra.evento_referencia === 'data_fixa' ? <EntradaData aria-label="Data" value={regra.data_fixa ?? ''} onChange={(evento) => setRegra((r) => ({ ...r, data_fixa: evento.target.value || null }))} /> : (
              <>
                {regra.evento_referencia === 'outro' && <Input aria-label="Nome do evento" placeholder="Nome do evento" value={regra.evento_nome ?? ''} onChange={(evento) => setRegra((r) => ({ ...r, evento_nome: evento.target.value || null }))} />}
                <Input aria-label="Duração" inputMode="numeric" placeholder="Duração" value={regra.duracao ?? ''} onChange={(evento) => setRegra((r) => ({ ...r, duracao: numeroOuNulo(evento.target.value) }))} />
                <Selecao aria-label="Unidade" value={regra.unidade ?? 'dias_corridos'} onChange={(evento) => setRegra((r) => ({ ...r, unidade: evento.target.value as RegraPrazo['unidade'] }))}>{Object.entries(ROTULOS_UNIDADE).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</Selecao>
              </>
            )}
            <Selecao aria-label="Uso" value={regra.uso} onChange={(evento) => setRegra((r) => ({ ...r, uso: evento.target.value as RegraPrazo['uso'] }))}><option value="entrega">Entrega</option><option value="obrigacao">Obrigação</option><option value="pagamento">Pagamento</option><option value="vigencia_inicio">Início da vigência</option><option value="vigencia_fim">Fim da vigência</option></Selecao>
            <Button variante="secundario" className="justify-self-start" onClick={() => void executar(() => salvarRegraDePrazo(tela.ficha.atual.id, regra), 'Prazo incluído.').then((ok) => ok && setRegra(REGRA_VAZIA))}><Plus aria-hidden />Incluir prazo</Button>
          </fieldset>
        )}
      </div>
    </div>
  );
}

const OBRIGACAO_VAZIA = { parte: 'numa' as ObrigacaoContratual['parte'], descricao: '', clausula_ref: null as string | null, prazo_data: null as string | null, regra_prazo_id: null as string | null, responsavel_id: '', criterio: null as string | null, depende_de: [] as string[] };

function AbaObrigacoes({ tela, editavel }: { tela: TelaDoContrato; editavel: boolean }) {
  const [nova, setNova] = useState({ ...OBRIGACAO_VAZIA, responsavel_id: tela.ficha.contrato.responsavel_id });
  const internas = pessoasDoSeletor(tela.pessoas);
  return (
    <div className="grid gap-3">
      <ul className="grid gap-1.5">
        {tela.ficha.obrigacoes.map((linha) => (
          <li key={linha.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-2 text-[13px]">
            <span><strong>{ROTULOS_PARTE[linha.parte]}</strong>: {linha.descricao}{linha.prazo_data ? ` · até ${formatarDiaISO(linha.prazo_data)}` : linha.regra_prazo_id ? ` · ${tela.ficha.regras.find((regra) => regra.id === linha.regra_prazo_id)?.nome ?? 'prazo removido'}` : ''}</span>
            {editavel && <Button variante="icone" tamanho="icone" aria-label={`Tirar ${linha.descricao}`} onClick={() => void executar(() => removerObrigacao(linha.id), 'Obrigação retirada.')}><Trash2 aria-hidden /></Button>}
          </li>
        ))}
      </ul>
      {!tela.ficha.obrigacoes.length && <p className="text-sm text-ink-soft">Nenhuma obrigação.</p>}
      {editavel && (
        <fieldset className="grid gap-2 rounded-md border border-line p-3 md:grid-cols-2">
          <legend className="px-1 text-[13px] font-semibold">Nova obrigação</legend>
          <Selecao aria-label="Parte" value={nova.parte} onChange={(evento) => setNova((o) => ({ ...o, parte: evento.target.value as ObrigacaoContratual['parte'] }))}>{Object.entries(ROTULOS_PARTE).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</Selecao>
          <Input aria-label="Descrição" placeholder="Descrição" value={nova.descricao} onChange={(evento) => setNova((o) => ({ ...o, descricao: evento.target.value }))} />
          <Input aria-label="Cláusula de referência" placeholder="Cláusula de referência" value={nova.clausula_ref ?? ''} onChange={(evento) => setNova((o) => ({ ...o, clausula_ref: evento.target.value || null }))} />
          <Selecao aria-label="Prazo por regra" value={nova.regra_prazo_id ?? ''} onChange={(evento) => setNova((o) => ({ ...o, regra_prazo_id: evento.target.value || null, prazo_data: null }))}><option value="">Prazo por data</option>{tela.ficha.regras.map((regra) => <option key={regra.id} value={regra.id}>{regra.nome}</option>)}</Selecao>
          {!nova.regra_prazo_id && <EntradaData aria-label="Prazo" value={nova.prazo_data ?? ''} onChange={(evento) => setNova((o) => ({ ...o, prazo_data: evento.target.value || null }))} />}
          <SelecaoPessoa aria-label="Responsável interna" pessoas={internas} value={nova.responsavel_id} onChange={(evento) => setNova((o) => ({ ...o, responsavel_id: evento.target.value }))} />
          <Input aria-label="Critério de cumprimento" placeholder="Critério de cumprimento" value={nova.criterio ?? ''} onChange={(evento) => setNova((o) => ({ ...o, criterio: evento.target.value || null }))} />
          {tela.ficha.obrigacoes.length > 0 && <CaixasDeSelecao rotulo="Depende de" opcoes={tela.ficha.obrigacoes.map((linha) => ({ valor: linha.id, rotulo: linha.descricao }))} valores={nova.depende_de} aoMudar={(valores) => setNova((o) => ({ ...o, depende_de: valores }))} />}
          <Button variante="secundario" className="justify-self-start" onClick={() => void executar(() => salvarObrigacao(tela.ficha.atual.id, nova), 'Obrigação incluída.').then((ok) => ok && setNova({ ...OBRIGACAO_VAZIA, responsavel_id: tela.ficha.contrato.responsavel_id }))}><Plus aria-hidden />Incluir obrigação</Button>
        </fieldset>
      )}
    </div>
  );
}
