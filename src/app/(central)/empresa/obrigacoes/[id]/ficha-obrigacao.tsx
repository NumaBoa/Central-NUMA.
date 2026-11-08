'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarClock, CalendarPlus, CheckCircle2, ExternalLink, Pencil, RotateCcw } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { AvisoDeFaseDaEmpresa, SituacaoDaObrigacao, VoltarPara } from '@/componentes/empresa/aparencia';
import { FormularioDaObrigacao } from '@/componentes/empresa/formulario-obrigacao';
import { useFormulario } from '@/componentes/empresa/use-formulario';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { ObrigacaoOcorrencia } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { CAMINHO_DA_ATIVIDADE, ROTULOS_SITUACAO_ATIVIDADE } from '@/dominio/atividades';
import { historicoDaObrigacao } from '@/dominio/historico';
import { adicionarOcorrencia, alertaDaOcorrencia, carregarObrigacoes, errosDoCumprimento, formularioCumprimentoVazio, NOTA_PAGAMENTO, ocorrenciasDaObrigacao, proximoVencimento, reabrirOcorrencia, registrarCumprimento, ROTULOS_PERIODICIDADE_OBRIGACAO, titulosParaOcorrencia, type DadosDasObrigacoes } from '@/dominio/obrigacoes';
import { nomeDaPessoa } from '@/dominio/sociedade';
import { ROTULOS_SITUACAO_TITULO } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

function JanelaDoCumprimento({ ocorrencia, dados, aoFechar }: { ocorrencia: ObrigacaoOcorrencia; dados: DadosDasObrigacoes; aoFechar: () => void }) {
  const hoje = hojeISO();
  const f = useFormulario({
    prefixo: 'cumprimento',
    inicial: () => formularioCumprimentoVazio(ocorrencia, hoje),
    validar: (valores) => errosDoCumprimento(valores, hoje),
    salvar: (valores) => registrarCumprimento(ocorrencia.id, valores, hoje),
    textos: (valores) => [valores.observacao],
    mensagem: 'Cumprimento registrado.',
    aoSalvar: aoFechar,
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Registrar cumprimento" descricao={`Ocorrência com vencimento em ${formatarDiaISO(ocorrencia.vencimento)}.`} alterado={f.alterado} aoEnviar={f.enviar} rotuloSalvar="Registrar" salvando={f.salvando} erros={f.lista}>
      <div className="grid gap-4">
        <Campo rotulo="Cumprida em" obrigatorio {...f.campo('cumprida_em')}>
          {(controle) => <EntradaData max={hoje} {...controle} {...f.entrada('cumprida_em')} />}
        </Campo>
        <Campo rotulo="Comprovante" obrigatorio ajuda="Protocolo, recibo ou declaração, no Drive da Numa." {...f.campo('comprovante_url')}>
          {(controle) => <EntradaLinkDrive link={f.valores.comprovante_url} {...controle} {...f.entrada('comprovante_url')} />}
        </Campo>
        <Campo rotulo="Título vinculado" ajuda="Vincular não paga o título: o pagamento é a baixa, em Financeiro." {...f.campo('titulo_id')}>
          {(controle) => (
            <Selecao {...controle} {...f.entrada('titulo_id')}>
              <option value="">Nenhum</option>
              {titulosParaOcorrencia(dados.titulos).map((titulo) => (
                <option key={titulo.id} value={titulo.id}>
                  {titulo.codigo} · {titulo.descricao}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Observação" {...f.campo('observacao')}>
          {(controle) => <Input autoComplete="off" {...controle} {...f.entrada('observacao')} />}
        </Campo>
        {f.avisoDeCredencial}
      </div>
    </JanelaFormulario>
  );
}

function JanelaDaOcorrenciaManual({ obrigacaoId, aoFechar }: { obrigacaoId: string; aoFechar: () => void }) {
  const f = useFormulario({
    prefixo: 'ocorrencia',
    inicial: () => ({ vencimento: '' }),
    validar: ({ vencimento }): Record<string, string> => (vencimento ? {} : { vencimento: 'Informe o vencimento.' }),
    salvar: async ({ vencimento }) => {
      await adicionarOcorrencia(obrigacaoId, vencimento);
    },
    mensagem: 'Ocorrência adicionada.',
    aoSalvar: aoFechar,
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Próxima ocorrência" alterado={f.alterado} aoEnviar={f.enviar} salvando={f.salvando} erros={f.lista}>
      <Campo rotulo="Vencimento" obrigatorio {...f.campo('vencimento')}>
        {(controle) => <EntradaData {...controle} {...f.entrada('vencimento')} />}
      </Campo>
    </JanelaFormulario>
  );
}

function CartaoDaOcorrencia({ ocorrencia, dados, aoCumprir, aoReabrir }: { ocorrencia: ObrigacaoOcorrencia; dados: DadosDasObrigacoes; aoCumprir: () => void; aoReabrir: () => void }) {
  const hoje = hojeISO();
  const titulo = dados.titulos.find((linha) => linha.id === ocorrencia.titulo_id);
  const alerta = alertaDaOcorrencia(ocorrencia.id, dados.alertas);
  const atrasada = !ocorrencia.cumprida_em && ocorrencia.vencimento < hoje;
  return (
    <li className="grid gap-2 rounded-lg border border-line bg-paper p-4 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Vence em {formatarDiaISO(ocorrencia.vencimento)}</span>
          {ocorrencia.cumprida_em ? <EtiquetaSituacao tipo="sucesso">Cumprida em {formatarDiaISO(ocorrencia.cumprida_em)}</EtiquetaSituacao> : atrasada ? <EtiquetaSituacao tipo="erro">Atrasada</EtiquetaSituacao> : <EtiquetaSituacao tipo="atencao">Em aberto</EtiquetaSituacao>}
        </div>
        {ocorrencia.cumprida_em ? (
          <Button variante="terciario" tamanho="pequeno" onClick={aoReabrir}>
            <RotateCcw aria-hidden />
            Reabrir
          </Button>
        ) : (
          <Button tamanho="pequeno" onClick={aoCumprir}>
            <CheckCircle2 aria-hidden />
            Registrar cumprimento
          </Button>
        )}
      </div>
      {ocorrencia.comprovante_url && (
        <a href={ocorrencia.comprovante_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 justify-self-start underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
          <ExternalLink aria-hidden />
          Comprovante
        </a>
      )}
      {titulo && (
        <LinkCentral href={`/financeiro/${titulo.id}`} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
          <ExternalLink aria-hidden />
          {titulo.situacao === 'quitado' ? 'Ver título pago' : 'Ver título'}: {titulo.codigo} · {formatarDinheiro(titulo.valor, titulo.moeda)} · {ROTULOS_SITUACAO_TITULO[titulo.situacao]}
        </LinkCentral>
      )}
      {alerta && (
        <LinkCentral href={CAMINHO_DA_ATIVIDADE(alerta.id)} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-ink-soft underline underline-offset-2 md:min-h-0">
          Alerta no Meu dia: {ROTULOS_SITUACAO_ATIVIDADE[alerta.situacao]}
        </LinkCentral>
      )}
      {!ocorrencia.cumprida_em && alerta?.situacao === 'concluida' && alerta.concluida_por && <Faixa tipo="info">O alerta foi concluído no Meu dia, mas a ocorrência continua em aberto até o registro do cumprimento.</Faixa>}
      {ocorrencia.observacao && <p className="break-words text-ink-soft">{ocorrencia.observacao}</p>}
    </li>
  );
}

function HistoricoDaObrigacao({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaObrigacao(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T06.08: a obrigação, as ocorrências e o cumprimento de cada uma. */
export function FichaDaObrigacao() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarObrigacoes);
  const [editando, setEditando] = useState(false);
  const [cumprindo, setCumprindo] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const voltar = <VoltarPara href="/empresa/obrigacoes" rotulo="Obrigações corporativas" />;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta obrigação." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const dados = consulta.dados;
  const obrigacao = dados.obrigacoes.find((item) => item.id === id);
  if (!obrigacao) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={CalendarClock} titulo="Essa obrigação não existe mais." texto="Ela pode ter sido removida ao importar um arquivo." />
      </>
    );
  }
  const ocorrencias = ocorrenciasDaObrigacao(obrigacao.id, dados.ocorrencias);
  const proximo = proximoVencimento(obrigacao, ocorrencias);
  const entidade = dados.entidades.find((item) => item.id === obrigacao.entidade_id);
  const categoria = dados.categorias.find((item) => item.id === obrigacao.categoria_id);
  const emCumprimento = ocorrencias.find((item) => item.id === cumprindo);
  const acoes = (
    <>
      <Button variante="secundario" onClick={() => setEditando(true)}>
        <Pencil aria-hidden />
        Editar
      </Button>
      {obrigacao.periodicidade === 'outra' && obrigacao.situacao === 'ativa' && (
        <Button variante="secundario" onClick={() => setManual(true)}>
          <CalendarPlus aria-hidden />
          Próxima ocorrência
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {voltar}
      <AvisoDeFaseDaEmpresa fase="f1" tela="Obrigações" />
      <Ficha
        tituloDePagina
        titulo={obrigacao.nome}
        etiquetas={<SituacaoDaObrigacao situacao={obrigacao.situacao} />}
        responsavel={`Responsável: ${nomeDaPessoa(dados.pessoas, obrigacao.responsavel_id)}`}
        acoes={acoes}
        acoesCelular={acoes}
        abas={[
          {
            id: 'ocorrencias',
            rotulo: `Ocorrências (${ocorrencias.length})`,
            conteudo: (
              <div className="grid gap-3">
                <Faixa tipo="info">{NOTA_PAGAMENTO}</Faixa>
                {ocorrencias.length ? (
                  <ul className="grid gap-2.5">
                    {ocorrencias.map((ocorrencia) => (
                      <CartaoDaOcorrencia key={ocorrencia.id} ocorrencia={ocorrencia} dados={dados} aoCumprir={() => setCumprindo(ocorrencia.id)} aoReabrir={() => setReabrindo(ocorrencia.id)} />
                    ))}
                  </ul>
                ) : (
                  <EstadoVazio icone={CalendarClock} titulo="Nenhuma ocorrência ainda." texto={obrigacao.situacao === 'ativa' ? 'A ocorrência nasce quando o vencimento entra na antecedência.' : 'Só uma obrigação Ativa gera ocorrências.'} />
                )}
              </div>
            ),
          },
          {
            id: 'dados',
            rotulo: 'Dados',
            conteudo: (
              <ListaDeDados>
                <Dado rotulo="Entidade">{entidade?.nome}</Dado>
                <Dado rotulo="Órgão">{obrigacao.orgao}</Dado>
                <Dado rotulo="Descrição">{obrigacao.descricao}</Dado>
                <Dado rotulo="Periodicidade">{ROTULOS_PERIODICIDADE_OBRIGACAO[obrigacao.periodicidade]}</Dado>
                <Dado rotulo="Próximo vencimento">{proximo ? formatarDiaISO(proximo) : 'Nenhum'}</Dado>
                <Dado rotulo="Antecedência do alerta">{`${obrigacao.antecedencia_dias} ${obrigacao.antecedencia_dias === 1 ? 'dia' : 'dias'}`}</Dado>
                <Dado rotulo="Gera título previsto">{obrigacao.gera_titulo ? 'Sim' : 'Não'}</Dado>
                {obrigacao.gera_titulo && <Dado rotulo="Categoria">{categoria?.nome}</Dado>}
                {obrigacao.gera_titulo && <Dado rotulo="Valor estimado">{obrigacao.valor_estimado === null ? null : formatarDinheiro(obrigacao.valor_estimado, 'BRL')}</Dado>}
              </ListaDeDados>
            ),
          },
          { id: 'historico', rotulo: 'Histórico', conteudo: <HistoricoDaObrigacao id={obrigacao.id} /> },
        ]}
      />
      {editando && <FormularioDaObrigacao dados={dados} obrigacao={obrigacao} aoFechar={() => setEditando(false)} />}
      {emCumprimento && <JanelaDoCumprimento ocorrencia={emCumprimento} dados={dados} aoFechar={() => setCumprindo(null)} />}
      {manual && <JanelaDaOcorrenciaManual obrigacaoId={obrigacao.id} aoFechar={() => setManual(false)} />}
      <Confirmacao
        aberto={Boolean(reabrindo)}
        aoFechar={() => setReabrindo(null)}
        titulo="Reabrir esta ocorrência?"
        texto="O comprovante sai, e o alerta volta ao Meu dia. O histórico guarda o que havia."
        rotuloConfirmar="Reabrir"
        pedirMotivo
        aoConfirmar={(motivo) => {
          const alvo = reabrindo as string;
          setReabrindo(null);
          void reabrirOcorrencia(alvo, motivo).then(() => aviso('Ocorrência reaberta.'), (erro: unknown) => aviso(mensagemDoErro(erro)));
        }}
      />
    </div>
  );
}
