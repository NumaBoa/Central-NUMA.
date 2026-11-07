'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Handshake, Plus } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasContratos } from '@/componentes/f1/abas-modulos';
import { AvisoCatalogoDeExemplo, executar } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import type { RelacaoAdesao } from '@/dados/tipos/contrato';
import { useConsulta } from '@/dados/use-consulta';
import { criarRelacaoAdesao, encerrarRelacaoAdesao, gerarTermosDeAssinatura } from '@/dominio/contrato-saas';
import { MENSAGEM_CATALOGO_AUSENTE, precoVigente, type CanalDoCatalogo, type OfertaDoCatalogo } from '@/dominio/integracoes/catalogo-comercial';
import { catalogoComercial } from '@/dominio/integracoes/conexoes';
import { ROTULOS_TIPO_DOCUMENTO_LEGAL } from '@/dominio/legal';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

async function carregar() {
  const catalogo = catalogoComercial();
  const [relacoes, produtos, documentos, versoes, contratos, versoesContrato, canais] = await Promise.all([repositorios.relacao_adesao.listar(), repositorios.produto.listar(), repositorios.documento_legal.listar(), repositorios.documento_legal_versao.listar(), repositorios.contrato.listar(), repositorios.contrato_versao.listar(), catalogo.canais()]);
  const ofertas: OfertaDoCatalogo[] = [];
  for (const produto of produtos) ofertas.push(...(await catalogo.ofertasDoProduto(produto.id)));
  const precos = Object.fromEntries(await Promise.all(ofertas.map(async (oferta) => [oferta.id, await catalogo.precosDaOferta(oferta.id)] as const)));
  return { relacoes, produtos, documentos, versoes, canais, ofertas, precos, excecoes: contratos.filter((contrato) => contrato.familia === 'adesao_condicao_especial').map((contrato) => ({ contrato, produto: versoesContrato.find((versao) => versao.contrato_id === contrato.id)?.dados_saas?.produto_id ?? null })) };
}
type Dados = Awaited<ReturnType<typeof carregar>>;

function NovaRelacao({ dados, aoFechar }: { dados: Dados; aoFechar: () => void }) {
  const [produto, setProduto] = useState(dados.produtos[0]?.id ?? '');
  const [oferta, setOferta] = useState('');
  const [canal, setCanal] = useState('');
  const [inicio, setInicio] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setOferta(''), [produto]);
  const ofertas = dados.ofertas.filter((linha) => linha.produto_id === produto && linha.formalizacao !== 'contrato_negociado');
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Nova relação de adesão" descricao="Uma por oferta, termos e canal. Sem contrato por assinante (RN-11.25)." rotuloSalvar="Criar relação" aoEnviar={(evento) => { evento.preventDefault(); void criarRelacaoAdesao({ produtoId: produto, ofertaId: oferta, canalId: canal, inicio }).then(() => { aviso('Relação de adesão criada.'); aoFechar(); }, (problema: unknown) => setErro(mensagemDoErro(problema))); }}>
      <div className="grid gap-[18px]">
        {catalogoComercial().estado === 'ausente' && <Faixa tipo="atencao">{MENSAGEM_CATALOGO_AUSENTE}</Faixa>}
        <Campo id="ads-produto" rotulo="Produto" obrigatorio>{(controle) => <Selecao {...controle} value={produto} onChange={(evento) => setProduto(evento.target.value)}>{dados.produtos.map((linha) => <option key={linha.id} value={linha.id}>{linha.nome}</option>)}</Selecao>}</Campo>
        <Campo id="ads-oferta" rotulo="Oferta" obrigatorio>{(controle) => <Selecao {...controle} value={oferta} onChange={(evento) => setOferta(evento.target.value)}><option value="">{ofertas.length ? 'Escolha' : 'Nenhuma oferta de adesão no catálogo'}</option>{ofertas.map((linha) => <option key={linha.id} value={linha.id} disabled={linha.situacao !== 'aprovada'}>{linha.nome}{linha.situacao !== 'aprovada' ? ' (não aprovada)' : ''}</option>)}</Selecao>}</Campo>
        <Campo id="ads-canal" rotulo="Canal" obrigatorio>{(controle) => <Selecao {...controle} value={canal} onChange={(evento) => setCanal(evento.target.value)}><option value="">Escolha</option>{dados.canais.map((linha: CanalDoCatalogo) => <option key={linha.id} value={linha.id}>{linha.nome}</option>)}</Selecao>}</Campo>
        <Campo id="ads-inicio" rotulo="Início" obrigatorio>{(controle) => <EntradaData {...controle} value={inicio} onChange={(evento) => setInicio(evento.target.value)} />}</Campo>
        <p className="text-xs text-ink-soft">Exige Termos de Assinatura (ou Termos de Uso com seção de assinatura) Publicados para o produto.</p>
        {erro && <MensagemErro>{erro}</MensagemErro>}
      </div>
    </JanelaFormulario>
  );
}

/** T11.13: relações agregadas. Assinantes e receita vêm da receita por canal (T05.12), que ainda não existe. */
export function TelaAdesoes() {
  const roteador = useRouter();
  const consulta = useConsulta(carregar);
  const dados = consulta.dados;
  const [nova, setNova] = useState(false);
  const [termos, setTermos] = useState('');
  const [encerrando, setEncerrando] = useState<RelacaoAdesao | null>(null);
  const nomeProduto = (id: string) => dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido';
  const versaoDosTermos = (documentoId: string) => {
    const documento = dados?.documentos.find((linha) => linha.id === documentoId);
    const vigente = dados?.versoes.find((linha) => linha.id === documento?.versao_vigente_id);
    return documento ? `${ROTULOS_TIPO_DOCUMENTO_LEGAL[documento.tipo]} V${vigente?.numero ?? '?'}` : 'Documento removido';
  };
  const colunas: readonly Coluna<RelacaoAdesao>[] = [
    { id: 'codigo', titulo: 'Relação', essencial: true, celula: (linha) => <span className="font-medium">{linha.codigo}</span> },
    { id: 'produto', titulo: 'Produto', essencial: true, celula: (linha) => nomeProduto(linha.produto_id) },
    { id: 'oferta', titulo: 'Oferta', celula: (linha) => dados?.ofertas.find((oferta) => oferta.id === linha.oferta_id)?.nome ?? 'Fora do catálogo' },
    { id: 'canal', titulo: 'Canal', celula: (linha) => dados?.canais.find((canal) => canal.id === linha.canal_id)?.nome ?? 'Fora do catálogo' },
    { id: 'termos', titulo: 'Termos vigentes', celula: (linha) => versaoDosTermos(linha.documento_legal_id) },
    { id: 'preco', titulo: 'Preço vigente', celula: (linha) => { const preco = precoVigente(dados?.precos[linha.oferta_id] ?? [], { canalId: linha.canal_id, periodicidade: null, naData: hojeISO() }); return preco?.valor !== null && preco?.valor !== undefined ? formatarDinheiro(preco.valor, preco.moeda) : 'Não definido'; } },
    { id: 'assinantes', titulo: 'Assinantes e receita', celula: () => <span className="text-ink-soft">Depende de T05.12</span> },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => <EtiquetaSituacao tipo={linha.situacao === 'ativa' ? 'sucesso' : 'neutro'}>{linha.situacao === 'ativa' ? 'Ativa' : `Encerrada em ${formatarDiaISO(linha.encerrada_em as string)}`}</EtiquetaSituacao> },
  ];
  return (
    <>
      <CabecalhoPagina
        kicker="Contratos"
        titulo="Adesão padrão"
        resumo="Assinantes que aceitam os termos online, agregados por oferta, termos e canal."
        acoes={<Button disabled={!dados} onClick={() => setNova(true)}><Plus aria-hidden />Nova relação</Button>}
      />
      <AbasContratos ativa="adesoes" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro aoTentarDeNovo={consulta.recarregar} />}
        <AvisoCatalogoDeExemplo />
        <Faixa>Assinantes ativos e receita líquida por mês vêm da receita por canal (M05, T05.12), que ainda não foi construída. Até lá, a relação registra oferta, termos, canal e preço.</Faixa>
        {dados && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper p-4">
            <Campo id="termos-produto" rotulo="Gerar os Termos de Assinatura públicos" ajuda="Sem contraparte, com aceite eletrônico. Vão para Documentos legais em rascunho, para validação e publicação.">
              {(controle) => <Selecao {...controle} value={termos} onChange={(evento) => setTermos(evento.target.value)}><option value="">Escolha o produto</option>{dados.produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}</Selecao>}
            </Campo>
            <Button variante="secundario" disabled={!termos} onClick={() => void executar(async () => { const { documentoId, vazias } = await gerarTermosDeAssinatura(termos, idDaPessoaAtual() ?? ''); aviso(`Termos gerados em rascunho${vazias.length ? `, com ${vazias.length} variáveis a conferir` : ''}.`); roteador.push(`/legal/documentos/${documentoId}`); })}>
              <FileText aria-hidden />
              Gerar termos
            </Button>
          </div>
        )}
        <Lista rotulo="Relações de adesão" linhas={dados?.relacoes ?? []} colunas={colunas} chave={(linha) => linha.id} estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'} acoesDaLinha={(linha) => (linha.situacao === 'ativa' ? <Button variante="terciario" tamanho="pequeno" onClick={() => setEncerrando(linha)}>Encerrar</Button> : null)} cartaoInterativo cartao={(linha) => <span className="grid gap-1"><span className="font-semibold">{linha.codigo} · {nomeProduto(linha.produto_id)}</span><span className="text-[13px] text-ink-soft">{versaoDosTermos(linha.documento_legal_id)}</span></span>} vazio={<EstadoVazio icone={Handshake} titulo="Nenhuma relação de adesão." texto="Crie uma por oferta e canal quando os Termos de Assinatura do produto estiverem publicados." />} />
        {dados && dados.excecoes.length > 0 && (
          <div className="rounded-lg border border-line bg-paper p-4 text-[13px]">
            <p className="texto-rotulo">Exceções individuais (adesão com condição especial)</p>
            <ul className="mt-2 grid gap-1">{dados.excecoes.map(({ contrato, produto }) => <li key={contrato.id}><LinkCentral className="underline" href={`/contratos/${contrato.id}`}>{contrato.codigo} · {contrato.titulo}</LinkCentral>{produto ? ` · ${nomeProduto(produto)}` : ''}</li>)}</ul>
          </div>
        )}
      </div>
      {nova && dados && <NovaRelacao dados={dados} aoFechar={() => setNova(false)} />}
      <Confirmacao aberto={encerrando !== null} aoFechar={() => setEncerrando(null)} titulo="Encerrar esta relação de adesão?" texto="Ela continua consultável. Novas adesões nesta oferta e canal pedem uma relação nova." rotuloConfirmar="Encerrar" pedirMotivo aoConfirmar={(motivo) => { const alvo = encerrando; setEncerrando(null); if (alvo) void executar(() => encerrarRelacaoAdesao(alvo.id, hojeISO(), motivo), 'Relação encerrada.'); }} />
    </>
  );
}
