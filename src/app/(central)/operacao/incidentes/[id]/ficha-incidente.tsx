'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CircleCheck, Pencil, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { CartaoDePainel, executar } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbaArquivosDoRegistro } from '@/componentes/operacao/abas-comuns';
import { JanelaIncidente } from '@/componentes/operacao/formulario-incidente';
import { SituacaoDaSolicitacao } from '@/componentes/operacao/situacoes';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { carregarIncidente, duracaoDoIncidente, encerrarIncidente, historicoDoIncidente, PENDENCIA_SEGURANCA, removerIncidente, ROTULOS_IMPACTO } from '@/dominio/incidentes';
import { vincularIncidente } from '@/dominio/suporte';
import { diaEHoraNoFuso, instanteNoFuso } from '@/lib/datas';
import { formatarDataHora } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

type Dados = NonNullable<Awaited<ReturnType<typeof carregarIncidente>>>;

/** T12.05, ficha: o incidente, a comunicação e as solicitações vinculadas. */
export function FichaIncidente() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregarIncidente(id), [id]);
  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler o incidente." aoTentarDeNovo={consulta.recarregar} />;
  if (!consulta.dados) return <EstadoVazio icone={TriangleAlert} titulo="Incidente não encontrado." texto="Ele pode ter sido removido." acao={<LinkCentral href="/operacao/incidentes">Voltar</LinkCentral>} />;
  return <Conteudo dados={consulta.dados} aoMudar={consulta.recarregar} />;
}

function Conteudo({ dados, aoMudar }: { dados: Dados; aoMudar: () => void }) {
  const roteador = useRouter();
  const { pessoa } = useCentral();
  const { incidente } = dados;
  const [janela, setJanela] = useState<'' | 'editar' | 'encerrar' | 'vincular' | 'remover'>('');
  const agora = new Date().toISOString();
  const produto = dados.produtos.find((linha) => linha.id === incidente.produto_id);
  const nome = (id: string) => dados.pessoas.find((linha) => linha.id === id)?.nome_completo ?? 'Pessoa removida';
  const fechar = () => setJanela('');
  const depois = () => {
    fechar();
    aoMudar();
  };
  const acaoPrincipal = incidente.fim ? <Button variante="secundario" onClick={() => setJanela('editar')}><Pencil aria-hidden />Editar</Button> : <Button onClick={() => setJanela('encerrar')}><CircleCheck aria-hidden />Encerrar incidente</Button>;
  const maisAcoes = (
    <MenuSobreposto titulo="Mais ações" largura={260} alinhar="end" gatilho={<Button variante="secundario" aria-label="Mais ações do incidente">Mais ações</Button>}>
      {(fecharMenu) => {
        const item = (rotulo: string, acao: () => void, perigo = false) => (
          <button key={rotulo} type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover', perigo && 'text-err')} onClick={() => { fecharMenu(); acao(); }}>
            {rotulo}
          </button>
        );
        return (
          <div className="grid gap-0.5">
            {!incidente.fim && item('Editar', () => setJanela('editar'))}
            {item('Vincular solicitação', () => setJanela('vincular'))}
            {item('Remover incidente', () => setJanela('remover'), true)}
          </div>
        );
      }}
    </MenuSobreposto>
  );
  return (
    <>
      <LinkCentral href="/operacao/incidentes" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Incidentes
      </LinkCentral>
      <Ficha
        tituloDePagina
        codigo={incidente.codigo}
        titulo={incidente.titulo}
        etiquetas={<><EtiquetaSituacao tipo={incidente.fim ? 'sucesso' : 'erro'}>{incidente.fim ? 'Encerrado' : 'Em andamento'}</EtiquetaSituacao><EtiquetaLivre>Impacto {ROTULOS_IMPACTO[incidente.impacto].toLowerCase()}</EtiquetaLivre>{produto && <EtiquetaLivre>{produto.nome}</EtiquetaLivre>}</>}
        responsavel={<>Responsável: {nome(incidente.responsavel_id)}</>}
        acoes={<>{maisAcoes}{acaoPrincipal}</>}
        acoesCelular={<>{maisAcoes}{acaoPrincipal}</>}
        lateral={
          <CartaoDePainel titulo="Comunicação aos clientes">
            <ListaDeDados>
              <Dado rotulo="Comunicado">{incidente.comunicado ? 'Sim' : 'Não'}</Dado>
              {incidente.comunicado && <Dado rotulo="Quando">{incidente.comunicado_em ? formatarDataHora(incidente.comunicado_em) : null}</Dado>}
              {incidente.comunicado && <Dado rotulo="Canal">{incidente.canal}</Dado>}
            </ListaDeDados>
          </CartaoDePainel>
        }
        abas={[
          {
            id: 'resumo',
            rotulo: 'Resumo',
            conteudo: (
              <div className="grid gap-3">
                {incidente.envolve_dados_pessoais && <Faixa tipo="atencao">{PENDENCIA_SEGURANCA}</Faixa>}
                <CartaoDePainel titulo="O que aconteceu">
                  <ListaDeDados>
                    <Dado rotulo="Início">{formatarDataHora(incidente.inicio)}</Dado>
                    <Dado rotulo="Fim">{incidente.fim ? formatarDataHora(incidente.fim) : 'Em andamento'}</Dado>
                    <Dado rotulo="Duração">{duracaoDoIncidente(incidente, agora)}</Dado>
                    <Dado rotulo="Causa">{incidente.causa}</Dado>
                    <Dado rotulo="Ações">{incidente.acoes}</Dado>
                    <Dado rotulo="Envolve dados pessoais">{incidente.envolve_dados_pessoais === null ? null : incidente.envolve_dados_pessoais ? 'Sim' : 'Não'}</Dado>
                  </ListaDeDados>
                </CartaoDePainel>
              </div>
            ),
          },
          {
            id: 'solicitacoes',
            rotulo: 'Solicitações',
            conteudo: (
              <div className="grid gap-3">
                <Button variante="secundario" className="justify-self-start" onClick={() => setJanela('vincular')}>Vincular solicitação</Button>
                {dados.vinculadas.length ? (
                  <ul aria-label="Solicitações vinculadas" className="grid gap-2">
                    {dados.vinculadas.map((linha) => (
                      <li key={linha.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-4 py-3">
                        <LinkCentral href={`/operacao/suporte/${linha.id}`} className="inline-flex min-h-11 items-center font-medium underline md:min-h-0">{linha.codigo} · {linha.titulo}</LinkCentral>
                        <span className="flex items-center gap-2">
                          <SituacaoDaSolicitacao situacao={linha.situacao} />
                          <Button variante="terciario" tamanho="pequeno" onClick={async () => { if (await executar(() => vincularIncidente(linha.id, null), 'Vínculo tirado.')) aoMudar(); }}>Tirar</Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-soft">Nenhuma solicitação vinculada. Os pedidos de suporte sobre esta queda podem apontar para ela.</p>
                )}
              </div>
            ),
          },
          { id: 'arquivos', rotulo: 'Arquivos', conteudo: <AbaArquivosDoRegistro tipo="incidente_disponibilidade" id={incidente.id} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={incidente.id} /> },
        ]}
      />
      {janela === 'editar' && <JanelaIncidente incidente={incidente} produtos={dados.produtos} pessoas={dados.pessoas} responsavelInicial={pessoa.id} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'encerrar' && <JanelaEncerrar id={incidente.id} aoFechar={fechar} aoSalvar={depois} />}
      {janela === 'vincular' && <JanelaVincular dados={dados} aoFechar={fechar} aoSalvar={depois} />}
      <Confirmacao aberto={janela === 'remover'} aoFechar={fechar} titulo="Remover o incidente?" texto="Ele sai da disponibilidade do mês e fica no histórico. Use só para registro feito por engano." rotuloConfirmar="Remover incidente" perigo pedirMotivo mensagemSemMotivo="Remover exige motivo." aoConfirmar={async (motivo) => { if (await executar(() => removerIncidente(incidente.id, motivo), 'Incidente removido.')) roteador.push('/operacao/incidentes'); }} />
    </>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoIncidente(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

function JanelaEncerrar({ id, aoFechar, aoSalvar }: { id: string; aoFechar: () => void; aoSalvar: () => void }) {
  const agora = diaEHoraNoFuso(new Date().toISOString());
  const [dia, setDia] = useState(agora.dia);
  const [hora, setHora] = useState(agora.hora);
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await encerrarIncidente(id, instanteNoFuso(dia, hora));
      aviso('Incidente encerrado.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Encerrar o incidente" descricao="Quando o produto voltou ao normal." aoEnviar={enviar} salvando={salvando} rotuloSalvar="Encerrar">
      <div className="grid grid-cols-2 gap-3">
        <Campo id="inc-encerrar-dia" rotulo="Dia" obrigatorio>
          {(controle) => <EntradaData {...controle} max={agora.dia} value={dia} onChange={(evento) => setDia(evento.target.value)} />}
        </Campo>
        <Campo id="inc-encerrar-hora" rotulo="Hora" obrigatorio>
          {(controle) => <input {...controle} type="time" className="campo" value={hora} onChange={(evento) => setHora(evento.target.value)} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

function JanelaVincular({ dados, aoFechar, aoSalvar }: { dados: Dados; aoFechar: () => void; aoSalvar: () => void }) {
  const [solicitacaoId, setSolicitacaoId] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!solicitacaoId) {
      aoFechar();
      return;
    }
    setSalvando(true);
    try {
      await vincularIncidente(solicitacaoId, dados.incidente.id);
      aviso('Solicitação vinculada.');
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Vincular solicitação" descricao="As solicitações do mesmo produto, sem outro incidente." aoEnviar={enviar} salvando={salvando} rotuloSalvar="Vincular">
      {dados.disponiveis.length ? (
        <Campo id="inc-solicitacao" rotulo="Solicitação">
          {(controle) => (
            <Selecao {...controle} value={solicitacaoId} onChange={(evento) => setSolicitacaoId(evento.target.value)}>
              <option value="">Escolha</option>
              {dados.disponiveis.map((linha) => <option key={linha.id} value={linha.id}>{linha.codigo} · {linha.titulo}</option>)}
            </Selecao>
          )}
        </Campo>
      ) : (
        <p className="text-[13px] text-ink-soft">Nenhuma solicitação deste produto para vincular.</p>
      )}
    </JanelaFormulario>
  );
}
