'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { repositorios } from '@/dados/repositorios';
import type { DadosSaas, EntidadeLicenciante } from '@/dados/tipos/contrato';
import { useConsulta } from '@/dados/use-consulta';
import { catalogoDoContrato, errosDosLimites, montarDocumentoSaas, padroesAlterados, salvarDadosSaas, type CatalogoDoContrato } from '@/dominio/contrato-saas';
import { definirSignatarios, ROTULOS_DOCUMENTAL } from '@/dominio/contratos';
import { MENSAGEM_CATALOGO_AUSENTE, precoVigente, textoDoLimite, type OfertaDoCatalogo, type PrecoDoCatalogo } from '@/dominio/integracoes/catalogo-comercial';
import { catalogoComercial } from '@/dominio/integracoes/conexoes';
import type { NoDocumento } from '@/dominio/modelo-texto';
import type { Pendencia } from '@/dominio/pendencias';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { AcoesDoFluxo } from './acoes-fluxo';
import { AvisoCatalogoDeExemplo, CaixasDeSelecao, CartaoDePainel, EtapasLaterais, executar, ListaDePendencias } from './apoio';
import type { TelaDoContrato } from './dados-contrato';
import { DocumentoRenderizadoVista } from './documento';
import { ListaDeEmissoes } from './emissao';

const ETAPAS = [
  { id: 'produto', rotulo: 'Produto e partes' },
  { id: 'plano', rotulo: 'Plano e preço' },
  { id: 'condicoes', rotulo: 'Condições' },
  { id: 'assinatura', rotulo: 'Assinatura' },
  { id: 'revisao', rotulo: 'Revisão e emissão' },
] as const;
type Etapa = (typeof ETAPAS)[number]['id'];

/** A variável vazia leva à etapa onde ela se resolve (19 §5). */
function etapaDaVariavel(nome: string): Etapa {
  if (nome.startsWith('produto.') || nome.startsWith('entidade') || nome.startsWith('contraparte') || nome.startsWith('organizacao')) return 'produto';
  if (nome.startsWith('oferta') || /^contrato\.(valor|total|adicionais|condicao_especial|modalidades|canal|gateway|periodicidade)/.test(nome)) return 'plano';
  if (/^contrato\.(forma_assinatura|plataforma|signatarios|testemunha|local)/.test(nome)) return 'assinatura';
  return 'condicoes';
}

type Catalogo = { ofertas: readonly OfertaDoCatalogo[]; precos: Record<string, readonly PrecoDoCatalogo[]>; produtosValidados: Record<string, string | null> };

async function carregarCatalogo(produtos: readonly string[], produtoId: string | null): Promise<Catalogo> {
  const catalogo = catalogoComercial();
  const produtosValidados: Record<string, string | null> = {};
  for (const id of produtos) {
    const validada = await catalogo.configuracaoValidada(id);
    const recente = validada ? null : await catalogo.configuracaoMaisRecente(id);
    produtosValidados[id] = validada ? null : recente ? `Configuração contratual em ${recente.situacao === 'rascunho' ? 'rascunho' : 'validação'}` : 'Sem configuração contratual (T07.10)';
  }
  const ofertas = produtoId ? await catalogo.ofertasDoProduto(produtoId) : [];
  const precos: Record<string, readonly PrecoDoCatalogo[]> = {};
  for (const oferta of ofertas) precos[oferta.id] = await catalogo.precosDaOferta(oferta.id);
  return { ofertas, precos, produtosValidados };
}

/** T11.14: etapas à esquerda e a prévia ao vivo à direita, com as variáveis vazias realçadas e clicáveis. */
export function EditorSaas({ tela }: { tela: TelaDoContrato }) {
  const { ficha, documento } = tela;
  const { contrato, atual } = ficha;
  const salvo = atual.dados_saas as DadosSaas;
  const editavel = atual.situacao === 'em_elaboracao' && atual.fluxo === 'rascunho';
  const hoje = hojeISO();
  const [etapa, setEtapa] = useState<Etapa>('produto');
  const [dados, setDados] = useState<DadosSaas>(salvo);
  const [representante, setRepresentante] = useState(atual.representante_contraparte_id ?? '');
  const [previa, setPrevia] = useState<{ nos: NoDocumento[]; pendencias: Pendencia[]; catalogo: CatalogoDoContrato | null }>({ nos: documento.nos, pendencias: documento.pendencias, catalogo: null });
  useEffect(() => {
    setDados(salvo);
    setRepresentante(atual.representante_contraparte_id ?? '');
  }, [atual.versao_registro]); // eslint-disable-line react-hooks/exhaustive-deps -- recomeça do que está gravado
  const alterado = JSON.stringify(dados) !== JSON.stringify(salvo) || representante !== (atual.representante_contraparte_id ?? '');
  useAlteracoesPendentes(alterado);
  const mudar = (parcial: Partial<DadosSaas>) => setDados((atualizado) => ({ ...atualizado, ...parcial }));

  const produtos = useMemo(() => tela.produtos.filter((produto) => !produto.arquivado_em), [tela.produtos]);
  const consultaCatalogo = useConsulta(() => carregarCatalogo(produtos.map((produto) => produto.id), dados.produto_id), [dados.produto_id]);
  const catalogo = consultaCatalogo.dados;
  const licenciantes = useConsulta(() => repositorios.entidade_licenciante.listar({ onde: { entidade_id: contrato.entidade_id } }), [contrato.entidade_id]).dados ?? ([] as EntidadeLicenciante[]);

  // Prévia ao vivo: o mesmo cálculo da emissão, com o que está na tela.
  useEffect(() => {
    let atualDaVez = true;
    const temporizador = setTimeout(() => {
      void Promise.all([montarDocumentoSaas({ ...ficha, atual: { ...atual, dados_saas: dados, representante_contraparte_id: representante || null } }, hoje), catalogoDoContrato(dados, hoje)]).then(([montado, lido]) => {
        if (atualDaVez) setPrevia({ nos: montado.nos, pendencias: montado.pendencias, catalogo: lido });
      });
    }, 250);
    return () => {
      atualDaVez = false;
      clearTimeout(temporizador);
    };
  }, [dados, representante, ficha, atual, hoje]);

  const limites = errosDosLimites(dados, { contrapartePj: ficha.contraparte?.tipo_pessoa === 'pj', hoje });
  const pendenciasPorEtapa = Object.fromEntries(ETAPAS.map((linha) => [linha.id, previa.pendencias.filter((pendencia) => pendencia.etapa === linha.id && pendencia.tipo === 'bloqueia').length])) as Record<Etapa, number>;
  const planos = (catalogo?.ofertas ?? []).filter((oferta) => oferta.tipo === 'assinatura');
  const plano = planos.find((oferta) => oferta.id === dados.oferta_id);
  const periodicidades = (['mensal', 'anual'] as const).filter((periodicidade) => (catalogo?.precos[dados.oferta_id ?? ''] ?? []).some((preco) => preco.situacao === 'aprovada' && preco.periodicidade === periodicidade));
  const canais = useConsulta(() => catalogoComercial().canais(), []).dados ?? [];
  const preco = previa.catalogo?.preco ?? null;
  const configuracao = previa.catalogo?.configuracao ?? null;
  const daContraparte = tela.pessoas.filter((pessoa) => pessoa.contraparte_id === contrato.contraparte_id && !pessoa.arquivado_em);
  const signatarios = ficha.signatarios.filter((linha) => linha.parte === 'numa').map((linha) => linha.pessoa_id);
  const temFinal = tela.documentos.some((documentoEmitido) => documentoEmitido.final);
  const modeloNaoValidado = previa.pendencias.some((pendencia) => pendencia.id === 'modelo-saas');
  const numero = (texto: string) => (texto.trim() === '' ? null : Number(texto.replace(',', '.')));
  const campoNumero = (id: string, rotulo: string, campo: keyof DadosSaas, ajuda?: string) => (
    <Campo id={`saas-${id}`} rotulo={rotulo} ajuda={ajuda} erro={limites[campo]}>
      {(controle) => <Input {...controle} inputMode="decimal" disabled={!editavel} value={(dados[campo] as number | null) ?? ''} onChange={(evento) => mudar({ [campo]: numero(evento.target.value) } as Partial<DadosSaas>)} />}
    </Campo>
  );
  const salvar = () => executar(() => salvarDadosSaas(contrato.id, dados, { representante: representante || null }), 'Rascunho salvo.');

  const conteudo: Record<Etapa, React.ReactNode> = {
    produto: (
      <div className="grid gap-[18px]">
        <Campo id="saas-produto" rotulo="Produto" obrigatorio ajuda="Só produtos com configuração contratual Validada emitem o final. Os demais aparecem com o motivo.">
          {(controle) => (
            <Selecao {...controle} disabled={!editavel} value={dados.produto_id ?? ''} onChange={(evento) => mudar({ produto_id: evento.target.value || null, oferta_id: null, adicionais: [], modalidades: [] })}>
              <option value="">Escolha</option>
              {produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}{catalogo?.produtosValidados[produto.id] ? ` (${catalogo.produtosValidados[produto.id]})` : ''}</option>)}
            </Selecao>
          )}
        </Campo>
        <Faixa tipo="atencao">MOD-SAAS-LIC v2.0, em Rascunho para validação jurídica. O texto não se edita aqui; a emissão final pede confirmação e motivo enquanto ele não for validado.</Faixa>
        {catalogoComercial().estado === 'ausente' && <Faixa tipo="atencao">{MENSAGEM_CATALOGO_AUSENTE}</Faixa>}
        <AvisoCatalogoDeExemplo />
        {licenciantes.length > 0 && (
          <div className="rounded-md bg-linen p-3 text-[13px]">
            <p className="texto-rotulo">Proporção de responsabilidade, sem solidariedade (D-CTR-01)</p>
            <ul className="mt-1">{licenciantes.map((socia) => <li key={socia.id}>{socia.nome_civil ?? 'Sócia sem nome civil'}: {socia.responsabilidade_pct === null ? 'não informada' : `${socia.responsabilidade_pct.toLocaleString('pt-BR')}%`}</li>)}</ul>
            <p className="mt-1 text-xs text-ink-soft">Vem do cadastro da entidade, definida no acordo de sócias.</p>
          </div>
        )}
        {ficha.contraparte?.tipo_pessoa === 'pj' && (
          <Campo id="saas-representante" rotulo="Representante da contraparte" obrigatorio>
            {(controle) => (
              <Selecao {...controle} disabled={!editavel} value={representante} onChange={(evento) => setRepresentante(evento.target.value)}>
                <option value="">{daContraparte.length ? 'Escolha' : 'Cadastre uma pessoa na contraparte'}</option>
                {daContraparte.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome_completo}</option>)}
              </Selecao>
            )}
          </Campo>
        )}
      </div>
    ),
    plano: (
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="saas-plano" rotulo="Plano" obrigatorio ajuda="Ofertas Aprovadas do tipo Assinatura. Gratuidade não gera contrato.">
          {(controle) => (
            <Selecao {...controle} disabled={!editavel || !dados.produto_id} value={dados.oferta_id ?? ''} onChange={(evento) => mudar({ oferta_id: evento.target.value || null, adicionais: [], teste_dias: planos.find((oferta) => oferta.id === evento.target.value)?.teste_dias ?? dados.teste_dias })}>
              <option value="">{dados.produto_id ? (planos.length ? 'Escolha' : 'Sem planos no catálogo') : 'Escolha o produto antes'}</option>
              {planos.map((oferta) => <option key={oferta.id} value={oferta.id} disabled={oferta.situacao !== 'aprovada'}>{oferta.nome}{oferta.situacao !== 'aprovada' ? ' (não aprovada)' : ''}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id="saas-periodicidade" rotulo="Periodicidade" obrigatorio>
          {(controle) => (
            <Selecao {...controle} disabled={!editavel} value={dados.periodicidade ?? ''} onChange={(evento) => mudar({ periodicidade: (evento.target.value || null) as DadosSaas['periodicidade'] })}>
              <option value="">Escolha</option>
              {periodicidades.map((periodicidade) => <option key={periodicidade} value={periodicidade}>{periodicidade === 'anual' ? 'Anual' : 'Mensal'}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id="saas-canal" rotulo="Canal de cobrança" obrigatorio>
          {(controle) => (
            <Selecao {...controle} disabled={!editavel} value={dados.canal_id ?? ''} onChange={(evento) => mudar({ canal_id: evento.target.value || null })}>
              <option value="">Escolha</option>
              {canais.filter((canal) => canal.situacao === 'ativa').map((canal) => <option key={canal.id} value={canal.id}>{canal.nome}</option>)}
            </Selecao>
          )}
        </Campo>
        <div className="rounded-md bg-linen p-3 text-[13px]">
          <p className="texto-rotulo">Valor</p>
          <p className="mt-1 font-semibold">{preco?.valor !== null && preco?.valor !== undefined ? `${formatarDinheiro(preco.valor, preco.moeda)} por ${dados.periodicidade === 'anual' ? 'ano' : 'mês'}` : 'Não definido'}</p>
          <p className="text-xs text-ink-soft">{preco ? `Versão de preço ${preco.versao}${preco.valido_de ? `, válida desde ${formatarDiaISO(preco.valido_de)}` : ''}. Não se digita (RN-11.31).` : 'Vem da versão de preço Aprovada para o plano, o canal e a periodicidade.'}</p>
        </div>
        {plano && plano.adicionais_ids.length > 0 && (
          <fieldset className="grid gap-2 rounded-md border border-line p-3 md:col-span-2">
            <legend className="px-1 text-[13px] font-semibold">Adicionais</legend>
            {plano.adicionais_ids.map((adicionalId) => {
              const adicional = catalogo?.ofertas.find((oferta) => oferta.id === adicionalId);
              const atualAdicional = dados.adicionais.find((linha) => linha.oferta_id === adicionalId);
              const precoAdicional = precoVigente(catalogo?.precos[adicionalId] ?? [], { canalId: dados.canal_id, periodicidade: dados.periodicidade, naData: dados.data_inicio ?? hoje });
              return (
                <label key={adicionalId} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="min-w-40 font-medium">{adicional?.nome ?? 'Adicional fora do catálogo'}</span>
                  <Input aria-label={`Quantidade de ${adicional?.nome ?? 'adicional'}`} inputMode="numeric" className="w-24" disabled={!editavel} value={atualAdicional?.quantidade ?? ''} onChange={(evento) => { const quantidade = Number(evento.target.value); mudar({ adicionais: [...dados.adicionais.filter((linha) => linha.oferta_id !== adicionalId), ...(quantidade > 0 ? [{ oferta_id: adicionalId, quantidade }] : [])] }); }} />
                  <span className="text-ink-soft">{precoAdicional?.valor !== null && precoAdicional?.valor !== undefined ? formatarDinheiro(precoAdicional.valor, precoAdicional.moeda) : 'sem preço aprovado'}</span>
                </label>
              );
            })}
          </fieldset>
        )}
        <fieldset className="grid gap-2 rounded-md border border-line p-3 md:col-span-2">
          <legend className="px-1 text-[13px] font-semibold">Condição especial</legend>
          <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" disabled={!editavel} checked={Boolean(dados.condicao_especial)} onChange={(evento) => mudar({ condicao_especial: evento.target.checked ? { valor: null, duracao_meses: null, motivo: null } : null })} />
            Ligar condição especial
          </label>
          {dados.condicao_especial && (
            <div className="grid gap-2 md:grid-cols-3">
              <Input aria-label="Valor especial" inputMode="decimal" placeholder="Valor" disabled={!editavel} value={dados.condicao_especial.valor ?? ''} onChange={(evento) => mudar({ condicao_especial: { ...dados.condicao_especial!, valor: numero(evento.target.value) } })} />
              <Input aria-label="Duração em meses" inputMode="numeric" placeholder="Meses" disabled={!editavel} value={dados.condicao_especial.duracao_meses ?? ''} onChange={(evento) => mudar({ condicao_especial: { ...dados.condicao_especial!, duracao_meses: numero(evento.target.value) } })} />
              <Input aria-label="Motivo da condição especial" placeholder="Motivo" disabled={!editavel} value={dados.condicao_especial.motivo ?? ''} onChange={(evento) => mudar({ condicao_especial: { ...dados.condicao_especial!, motivo: evento.target.value || null } })} />
              <p className="text-xs text-ink-soft md:col-span-3">Sem limite de desconto: exige valor, duração e motivo. Quem registrou e quando ficam no item do contrato.</p>
              {limites.condicao_especial && <p className="text-xs text-err md:col-span-3">{limites.condicao_especial}</p>}
            </div>
          )}
        </fieldset>
        <div className="md:col-span-2">
          <CaixasDeSelecao rotulo="Modalidades de acesso" obrigatorio opcoes={(configuracao?.modalidades ?? []).map((modalidade) => ({ valor: modalidade, rotulo: modalidade }))} valores={dados.modalidades} aoMudar={(valores) => editavel && mudar({ modalidades: valores })} />
          {!configuracao && <p className="mt-1 text-xs text-ink-soft">As modalidades vêm da configuração contratual validada do produto.</p>}
        </div>
        {plano && (
          <div className="md:col-span-2">
            <p className="texto-rotulo">Recursos e limites, como sairão no Anexo I</p>
            <ul className="mt-1 grid gap-0.5 text-[13px]">{plano.recursos.map((recurso) => <li key={recurso.id}>{recurso.nome}: {recurso.incluido ? (recurso.limite.tipo === 'nao_informado' ? <span className="font-semibold text-err">limite não informado</span> : textoDoLimite(recurso.limite)) : 'Não incluído'}</li>)}</ul>
          </div>
        )}
      </div>
    ),
    condicoes: (
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="saas-inicio" rotulo="Data de início" obrigatorio>{(controle) => <EntradaData {...controle} disabled={!editavel} value={dados.data_inicio ?? ''} onChange={(evento) => mudar({ data_inicio: evento.target.value || null })} />}</Campo>
        {dados.data_inicio && dados.data_inicio < hoje && <Campo id="saas-inicio-just" rotulo="Justificativa do início no passado" obrigatorio erro={limites.data_inicio_justificativa}>{(controle) => <Input {...controle} disabled={!editavel} value={dados.data_inicio_justificativa ?? ''} onChange={(evento) => mudar({ data_inicio_justificativa: evento.target.value || null })} />}</Campo>}
        <Campo id="saas-forma" rotulo="Forma de pagamento" obrigatorio>{(controle) => <Input {...controle} disabled={!editavel} value={dados.forma_pagamento_texto ?? ''} onChange={(evento) => mudar({ forma_pagamento_texto: evento.target.value || null })} />}</Campo>
        {campoNumero('dia', 'Dia de vencimento', 'dia_vencimento', 'Vazio: na data de renovação de cada Período. De 1 a 28.')}
        {campoNumero('teste', 'Teste gratuito (dias)', 'teste_dias', 'De 0 a 30.')}
        {campoNumero('garantia', 'Garantia (dias)', 'garantia_dias', 'Pelo menos 7 (CDC, art. 49).')}
        {campoNumero('multa', 'Multa por atraso (%)', 'multa_atraso_pct', 'Até 2% (CDC, art. 52, §1º).')}
        {campoNumero('juros', 'Juros (% ao mês)', 'juros_mes_pct', 'Até 1% ao mês.')}
        {campoNumero('suspensao', 'Suspensão após atraso de (dias)', 'suspensao_dias_atraso')}
        {campoNumero('aviso-suspensao', 'Aviso antes de suspender (dias)', 'aviso_suspensao_dias')}
        {campoNumero('cancelamento', 'Cancelamento por atraso após (dias)', 'cancelamento_dias_atraso')}
        <Campo id="saas-indice" rotulo="Índice de reajuste" obrigatorio>{(controle) => <Input {...controle} disabled={!editavel} value={dados.reajuste_indice ?? ''} onChange={(evento) => mudar({ reajuste_indice: evento.target.value || null })} />}</Campo>
        {campoNumero('aviso-reajuste', 'Aviso de reajuste (dias)', 'reajuste_aviso_dias', 'Pelo menos 30.')}
        {dados.periodicidade === 'anual' && <Faixa tipo="atencao" className="md:col-span-2">Plano anual: pagamento único e antecipado, sem devolução depois da garantia (D-CTR-04). Sai em destaque no Quadro-resumo e na cláusula 18.3. Não há outra regra a escolher.</Faixa>}
        {campoNumero('fidelidade', 'Fidelidade (meses)', 'fidelidade_meses', 'Opcional. Só com motivo.')}
        {Boolean(dados.fidelidade_meses) && (
          <>
            <Campo id="saas-fid-motivo" rotulo="Motivo da fidelidade" obrigatorio erro={limites.fidelidade_motivo}>{(controle) => <Input {...controle} disabled={!editavel} value={dados.fidelidade_motivo ?? ''} onChange={(evento) => mudar({ fidelidade_motivo: evento.target.value || null })} />}</Campo>
            <Campo id="saas-fid-multa" rotulo="Multa rescisória" obrigatorio erro={limites.multa_rescisoria_texto}>{(controle) => <Input {...controle} disabled={!editavel} value={dados.multa_rescisoria_texto ?? ''} onChange={(evento) => mudar({ multa_rescisoria_texto: evento.target.value || null })} />}</Campo>
          </>
        )}
        {ficha.contraparte?.tipo_pessoa === 'pj' && (
          <fieldset className="grid gap-2 rounded-md border border-line p-3 md:col-span-2">
            <legend className="px-1 text-[13px] font-semibold">Limite de responsabilidade</legend>
            <label className="flex min-h-11 items-center gap-2 text-[13px]"><input type="checkbox" disabled={!editavel} checked={dados.relacao_nao_consumo} onChange={(evento) => mudar({ relacao_nao_consumo: evento.target.checked })} />Relação que não é de consumo</label>
            {campoNumero('limite', 'Limite (meses pagos)', 'limite_responsabilidade_meses')}
            {Boolean(dados.limite_responsabilidade_meses) && <Campo id="saas-limite-just" rotulo="Justificativa" obrigatorio erro={limites.limite_responsabilidade_justificativa}>{(controle) => <Input {...controle} disabled={!editavel} value={dados.limite_responsabilidade_justificativa ?? ''} onChange={(evento) => mudar({ limite_responsabilidade_justificativa: evento.target.value || null })} />}</Campo>}
          </fieldset>
        )}
        <Campo id="saas-foro" rotulo="Foro (cidade/UF)" obrigatorio>{(controle) => <Input {...controle} disabled={!editavel} value={dados.foro ?? ''} onChange={(evento) => mudar({ foro: evento.target.value || null })} />}</Campo>
        {padroesAlterados(dados).length > 0 && <Campo id="saas-justificativas" rotulo="Justificativa das mudanças nos padrões" obrigatorio className="md:col-span-2" ajuda="Aparece na revisão.">{(controle) => <Textarea {...controle} rows={2} disabled={!editavel} value={dados.justificativas_padrao ?? ''} onChange={(evento) => mudar({ justificativas_padrao: evento.target.value || null })} />}</Campo>}
      </div>
    ),
    assinatura: (
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="saas-forma-assinatura" rotulo="Forma de assinatura" obrigatorio ajuda="Aceite eletrônico é só para os Termos públicos.">{(controle) => <Selecao {...controle} disabled={!editavel} value={dados.forma_assinatura ?? ''} onChange={(evento) => mudar({ forma_assinatura: (evento.target.value || null) as DadosSaas['forma_assinatura'] })}><option value="Eletrônica">Eletrônica</option><option value="Manuscrita">Manuscrita</option></Selecao>}</Campo>
        {dados.forma_assinatura === 'Eletrônica' && <Campo id="saas-plataforma" rotulo="Plataforma de assinatura" obrigatorio erro={limites.plataforma_assinatura} ajuda="Até a F3, informada como texto. O envio e a assinatura são registrados à mão (D25).">{(controle) => <Input {...controle} disabled={!editavel} value={dados.plataforma_assinatura ?? ''} onChange={(evento) => mudar({ plataforma_assinatura: evento.target.value || null })} />}</Campo>}
        {dados.forma_assinatura === 'Manuscrita' && (
          <>
            <Campo id="saas-local" rotulo="Local de assinatura" obrigatorio>{(controle) => <Input {...controle} disabled={!editavel} value={dados.local ?? ''} onChange={(evento) => mudar({ local: evento.target.value || null })} />}</Campo>
            <Input aria-label="Testemunha 1, nome" placeholder="Testemunha 1: nome" disabled={!editavel} value={dados.testemunha1_nome ?? ''} onChange={(evento) => mudar({ testemunha1_nome: evento.target.value || null })} />
            <Input aria-label="Testemunha 1, CPF" placeholder="Testemunha 1: CPF" disabled={!editavel} value={dados.testemunha1_cpf ?? ''} onChange={(evento) => mudar({ testemunha1_cpf: evento.target.value || null })} />
            <Input aria-label="Testemunha 2, nome" placeholder="Testemunha 2: nome" disabled={!editavel} value={dados.testemunha2_nome ?? ''} onChange={(evento) => mudar({ testemunha2_nome: evento.target.value || null })} />
            <Input aria-label="Testemunha 2, CPF" placeholder="Testemunha 2: CPF" disabled={!editavel} value={dados.testemunha2_cpf ?? ''} onChange={(evento) => mudar({ testemunha2_cpf: evento.target.value || null })} />
            {limites.testemunha1_nome && <p className="text-xs text-err md:col-span-2">{limites.testemunha1_nome}</p>}
          </>
        )}
        <div className="md:col-span-2">
          <CaixasDeSelecao rotulo="Signatários pela Numa" obrigatorio opcoes={(licenciantes.length ? licenciantes.map((socia) => ({ valor: socia.pessoa_id, rotulo: socia.nome_civil ?? 'Sócia' })) : tela.pessoas.filter((pessoa) => pessoa.tipo === 'interna').map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo })))} valores={signatarios} aoMudar={(valores) => editavel && void executar(() => definirSignatarios(atual.id, 'numa', valores))} />
        </div>
      </div>
    ),
    revisao: (
      <div className="grid gap-4">
        {alterado && <Faixa tipo="atencao">Salve antes: a revisão e a emissão usam o que está gravado.</Faixa>}
        <ListaDePendencias pendencias={previa.pendencias} vazio="Sem pendências." aoIrParaEtapa={(destino) => setEtapa(destino as Etapa)} />
        {salvo.justificativas_padrao && <Faixa>Padrões alterados: {salvo.justificativas_padrao}</Faixa>}
        <AcoesDoFluxo contratoId={contrato.id} versao={atual} pendencias={documento.pendencias} alterado={alterado} temFinal={temFinal} modeloNaoValidado={modeloNaoValidado} />
        <CartaoDePainel titulo="Documentos emitidos"><ListaDeEmissoes documentos={tela.documentos} /></CartaoDePainel>
      </div>
    ),
  };

  return (
    <>
      <CabecalhoPagina kicker={`Contrato de assinatura · ${contrato.codigo} V${atual.numero}`} titulo={contrato.titulo} resumo={ROTULOS_DOCUMENTAL[atual.fluxo]} acoes={editavel ? <Button disabled={!alterado} onClick={() => void salvar()}><Save aria-hidden />Salvar rascunho</Button> : undefined} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
        <EtapasLaterais rotulo="Etapas do contrato de assinatura" etapas={ETAPAS} ativa={etapa} aoEscolher={setEtapa} pendencias={pendenciasPorEtapa} />
        <CartaoDePainel titulo={ETAPAS.find((linha) => linha.id === etapa)?.rotulo}>{conteudo[etapa]}</CartaoDePainel>
        <section aria-label="Prévia do documento" className="min-w-0">
          <p className="mb-2 text-xs text-ink-soft">Prévia ao vivo. Clique numa variável vazia para ir ao campo.</p>
          <div className="max-h-[80vh] overflow-y-auto">
            <DocumentoRenderizadoVista nos={previa.nos} rascunho aoClicarVariavel={(nome) => setEtapa(etapaDaVariavel(nome))} />
          </div>
        </section>
      </div>
    </>
  );
}
