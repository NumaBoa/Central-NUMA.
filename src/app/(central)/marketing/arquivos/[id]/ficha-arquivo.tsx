'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArchiveRestore, ArrowLeft, Ellipsis, ExternalLink, Files, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EtiquetasDoRegistro } from '@/componentes/campos/etiquetas';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { executar } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { BotaoAbrirNoDrive, BotaoCopiarLink, copiarLink, EtiquetaClasse, EtiquetaDireitos, EtiquetaDoContexto, IconeDoTipo, SeletorDeRegistro } from '@/componentes/marketing/apoio';
import { FormularioDeArquivo } from '@/componentes/marketing/formulario-arquivo';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Arquivo } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { arquivarArquivo, carregarBiblioteca, contextosDoArquivo, desvincularArquivo, esquemaNovaVersao, lerVinculo, registrarNovaVersao, restaurarArquivo, ROTULOS_FINALIDADE, ROTULOS_TIPO_ARQUIVO, vincularArquivo, type DadosDaBiblioteca } from '@/dominio/biblioteca';
import { AVISO_CLASSE_DRIVE, classeRestrita, DESCRICOES_CLASSE } from '@/dominio/classes';
import { historicoDoArquivo } from '@/dominio/historico-m08';
import { carregarRegistrosVinculaveis, REGISTROS_DO_ARQUIVO } from '@/dominio/vinculos-arquivo';
import { hojeISO } from '@/lib/datas';
import { formatarData, formatarDiaISO } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

const CAMINHO = '/marketing';
const nomeDe = (id: string | null, dados: DadosDaBiblioteca) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Sistema';

function Detalhes({ arquivo, dados }: { arquivo: Arquivo; dados: DadosDaBiblioteca }) {
  const etiquetas = dados.etiquetasDosArquivos.get(arquivo.id) ?? [];
  return (
    <div className="grid gap-4">
      <ListaDeDados>
        <Dado rotulo="Descrição">{arquivo.descricao}</Dado>
        <Dado rotulo="Origem ou autor">{arquivo.origem_autor}</Dado>
        <Dado rotulo="Etiquetas">{etiquetas.length ? <EtiquetasDoRegistro ids={etiquetas} etiquetas={dados.etiquetas} /> : null}</Dado>
        <Dado rotulo="Direitos de uso">{arquivo.direitos_uso}</Dado>
        <Dado rotulo="Validade dos direitos">
          {arquivo.direitos_validade ? (
            <span className="flex flex-wrap items-center gap-2">
              {formatarDiaISO(arquivo.direitos_validade)}
              <EtiquetaDireitos arquivo={arquivo} hoje={hojeISO()} />
            </span>
          ) : null}
        </Dado>
        <Dado rotulo="Classe na Central">{DESCRICOES_CLASSE[arquivo.classe]}</Dado>
        {classeRestrita(arquivo.classe) && <Dado rotulo="Pasta restrita">{arquivo.pasta_restrita_confirmada ? 'Confirmada por quem cadastrou' : null}</Dado>}
      </ListaDeDados>
      {arquivo.tipo === 'apresentacao' && (
        <ListaDeDados>
          <Dado rotulo="Finalidade">{arquivo.finalidade && ROTULOS_FINALIDADE[arquivo.finalidade]}</Dado>
          <Dado rotulo="Público">{arquivo.publico}</Dado>
          <Dado rotulo="Data de uso">{arquivo.data_uso && formatarDiaISO(arquivo.data_uso)}</Dado>
          <Dado rotulo="Contém preços">{arquivo.contem_precos === null ? null : arquivo.contem_precos ? `Sim, de ${arquivo.precos_data ? formatarDiaISO(arquivo.precos_data) : 'data não informada'}` : 'Não'}</Dado>
          <Dado rotulo="Contém dados FIN">{arquivo.contem_fin ? 'Sim' : 'Não'}</Dado>
        </ListaDeDados>
      )}
      <Faixa tipo="info">{AVISO_CLASSE_DRIVE}</Faixa>
    </div>
  );
}

function Versoes({ arquivo, dados, aoPedirNova }: { arquivo: Arquivo; dados: DadosDaBiblioteca; aoPedirNova: () => void }) {
  const versoes = dados.versoes.filter((versao) => versao.arquivo_id === arquivo.id).sort((a, b) => b.versao - a.versao);
  return (
    <div className="grid gap-3">
      <ol aria-label="Versões" className="grid gap-2">
        {versoes.map((versao) => (
          <li key={versao.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper p-3.5 text-[13px]">
            <span className="min-w-0">
              <span className="font-semibold">Versão {versao.versao}</span>
              {versao.versao === arquivo.versao_atual && <span className="ml-2 rounded-pill bg-mist px-2 py-0.5 text-xs font-semibold text-ink-soft">Atual</span>}
              <span className="mt-0.5 block text-xs text-ink-soft">
                {formatarData(versao.criado_em)} · {nomeDe(versao.criado_por, dados)}
              </span>
              {versao.nota && <span className="mt-1 block break-words">{versao.nota}</span>}
            </span>
            <a href={versao.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 underline md:min-h-0 [&_svg]:size-[14px]">
              <ExternalLink aria-hidden />
              Abrir esta versão
            </a>
          </li>
        ))}
      </ol>
      {!arquivo.arquivado_em && (
        <Button variante="secundario" className="justify-self-start" onClick={aoPedirNova}>
          <Plus aria-hidden />
          Nova versão
        </Button>
      )}
    </div>
  );
}

function Vinculos({ arquivo, dados, somenteLeitura }: { arquivo: Arquivo; dados: DadosDaBiblioteca; somenteLeitura: boolean }) {
  const registros = useConsulta(carregarRegistrosVinculaveis);
  const [escolhido, setEscolhido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const meus = dados.vinculos.filter((vinculo) => vinculo.arquivo_id === arquivo.id);
  const nomeDoRegistro = (tipo: string, id: string) => registros.dados?.find((registro) => registro.tipo === tipo && registro.id === id)?.nome ?? 'Registro arquivado ou removido';

  async function vincular() {
    const alvo = lerVinculo(escolhido);
    if (!alvo) return setErro('Escolha o registro.');
    try {
      await vincularArquivo(arquivo.id, alvo.tipo, alvo.id);
      setEscolhido('');
      setErro(null);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-[13px] text-ink-soft">Um arquivo, vários vínculos. O arquivo não é copiado.</p>
      {meus.length ? (
        <ul aria-label="Vínculos" className="grid gap-2">
          {meus.map((vinculo) => {
            const registro = REGISTROS_DO_ARQUIVO[vinculo.registro_tipo];
            return (
              <li key={vinculo.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper p-3 text-[13px]">
                <span className="min-w-0">
                  <span className="font-semibold">{registro?.rotulo ?? vinculo.registro_tipo}</span>
                  {' · '}
                  {registro ? (
                    <LinkCentral href={registro.href(vinculo.registro_id)} className="inline-flex min-h-11 items-center underline md:min-h-0">
                      {nomeDoRegistro(vinculo.registro_tipo, vinculo.registro_id)}
                    </LinkCentral>
                  ) : (
                    nomeDoRegistro(vinculo.registro_tipo, vinculo.registro_id)
                  )}
                </span>
                {!somenteLeitura && (
                  <Button variante="icone" tamanho="icone" aria-label={`Tirar o vínculo com ${nomeDoRegistro(vinculo.registro_tipo, vinculo.registro_id)}`} onClick={() => void executar(() => desvincularArquivo(vinculo.id), 'Vínculo retirado. O arquivo continua na biblioteca.')}>
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Ainda não está vinculado a nenhum registro.</p>
      )}
      {!somenteLeitura && (
        <div className="grid gap-3 rounded-md border border-line bg-paper p-3.5">
          <SeletorDeRegistro id="ficha-vinculo" registros={registros.dados ?? []} valor={escolhido} aoMudar={setEscolhido} />
          {erro && <p className="text-xs text-err">{erro}</p>}
          <Button variante="secundario" tamanho="pequeno" className="justify-self-start" disabled={!escolhido} onClick={() => void vincular()}>
            <Link2 aria-hidden />
            Vincular
          </Button>
        </div>
      )}
    </div>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoArquivo(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** RN-08.04: novo link, nota; a anterior continua consultável. */
function DialogoNovaVersao({ arquivo, aoFechar }: { arquivo: Arquivo; aoFechar: () => void }) {
  const [link, setLink] = useState('');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState<string | undefined>();

  async function confirmar() {
    const conferido = esquemaNovaVersao.safeParse({ link, nota });
    if (!conferido.success) return setErro(conferido.error.issues[0]?.message);
    const certo = await registrarNovaVersao(arquivo.id, conferido.data)
      .then(() => true)
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        return false;
      });
    if (certo) aoFechar();
  }

  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo={`Nova versão de ${arquivo.titulo}`}
      descricao={`A versão ${arquivo.versao_atual} continua guardada, com o link dela.`}
      alterado={Boolean(link.trim() || nota.trim())}
      rotuloSalvar="Registrar versão"
      aoEnviar={(evento) => {
        evento.preventDefault();
        void confirmar();
      }}
    >
      <div className="grid gap-4">
        <Campo id="versao-link" rotulo="Link do novo arquivo" obrigatorio erro={erro}>
          {(controle) => <EntradaLinkDrive link={link} {...controle} value={link} onChange={(evento) => setLink(evento.target.value)} />}
        </Campo>
        <Campo id="versao-nota" rotulo="O que mudou">
          {(controle) => <Textarea {...controle} value={nota} onChange={(evento) => setNota(evento.target.value)} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

/** T08.02 (P2). Sem filtros de lista: é a ficha de um item. */
export function FichaArquivo() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarBiblioteca);
  const [editando, setEditando] = useState(false);
  const [novaVersao, setNovaVersao] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  const voltar = (
    <LinkCentral href={CAMINHO} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Biblioteca
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler este arquivo." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const dados = consulta.dados;
  const arquivo = dados.arquivos.find((item) => item.id === id);
  if (!arquivo) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Files} titulo="Esse arquivo não está mais na biblioteca." texto="Ele pode ter sido removido ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const arquivado = Boolean(arquivo.arquivado_em);
  const acoes = (
    <>
      <BotaoAbrirNoDrive link={arquivo.url_atual} />
      <BotaoCopiarLink link={arquivo.url_atual} />
      {!arquivado && (
        <>
          <Button variante="secundario" onClick={() => setEditando(true)}>
            <Pencil aria-hidden />
            Editar
          </Button>
          <MenuSobreposto
            titulo="Mais ações"
            largura={220}
            alinhar="end"
            gatilho={
              <Button variante="icone" tamanho="icone" aria-label="Mais ações do arquivo">
                <Ellipsis aria-hidden />
              </Button>
            }
          >
            {(fechar) => (
              <ul className="grid gap-0.5">
                <li>
                  <button
                    type="button"
                    className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')}
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
      )}
    </>
  );

  // No celular, a barra fixa só comporta duas ações (18 §10.4): o resto vai para o menu.
  const acoesCelular = (
    <>
      <BotaoAbrirNoDrive link={arquivo.url_atual} />
      <MenuSobreposto
        titulo="Mais ações"
        largura={220}
        alinhar="end"
        gatilho={
          <Button variante="secundario" aria-label="Mais ações do arquivo">
            <Ellipsis aria-hidden />
            Mais
          </Button>
        }
      >
        {(fechar) => (
          <ul className="grid gap-0.5">
            <li>
              <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); void copiarLink(arquivo.url_atual); }}>
                Copiar link
              </button>
            </li>
            {!arquivado && (
              <>
                <li>
                  <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); setEditando(true); }}>
                    Editar
                  </button>
                </li>
                <li>
                  <button type="button" className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover')} onClick={() => { fechar(); setArquivando(true); }}>
                    Arquivar
                  </button>
                </li>
              </>
            )}
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
        codigo={arquivo.codigo}
        titulo={arquivo.titulo}
        etiquetas={
          <>
            <EtiquetaLivre>{ROTULOS_TIPO_ARQUIVO[arquivo.tipo]}</EtiquetaLivre>
            {contextosDoArquivo(arquivo.id, dados.contextos).map((contexto) => (
              <EtiquetaDoContexto key={contexto} id={contexto} produtos={dados.produtos} marcas={dados.marcas} />
            ))}
            <EtiquetaClasse classe={arquivo.classe} />
            <EtiquetaLivre>v{arquivo.versao_atual}</EtiquetaLivre>
            <EtiquetaDireitos arquivo={arquivo} hoje={hojeISO()} />
          </>
        }
        responsavel={
          <span className="inline-flex items-center gap-2">
            Responsável: <NomeDaPessoa nome={nomeDe(arquivo.responsavel_id, dados)} className="text-ink" />
          </span>
        }
        acoes={acoes}
        acoesCelular={acoesCelular}
        arquivado={
          arquivado
            ? {
                texto: `Este arquivo foi arquivado em ${formatarData(arquivo.arquivado_em as string)}.`,
                acao: (
                  <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => restaurarArquivo(arquivo.id), 'Arquivo restaurado.')}>
                    <ArchiveRestore aria-hidden />
                    Restaurar
                  </Button>
                ),
              }
            : undefined
        }
        lateral={
          <div className="rounded-lg border border-line bg-paper p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-mist text-ink-soft">
                <IconeDoTipo tipo={arquivo.tipo} className="size-6" />
              </span>
              <div>
                <h2 className="text-[17px] leading-6">Arquivo no Drive</h2>
                <p className="text-xs text-ink-soft">Versão atual: v{arquivo.versao_atual}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Atualizado em {formatarData(arquivo.atualizado_em)} por {nomeDe(arquivo.atualizado_por, dados)}.
            </p>
            {!arquivado && (
              <Button className="mt-3 w-full" onClick={() => setNovaVersao(true)}>
                <Plus aria-hidden />
                Nova versão
              </Button>
            )}
          </div>
        }
        abas={[
          { id: 'detalhes', rotulo: 'Detalhes', conteudo: <Detalhes arquivo={arquivo} dados={dados} /> },
          { id: 'versoes', rotulo: 'Versões', conteudo: <Versoes arquivo={arquivo} dados={dados} aoPedirNova={() => setNovaVersao(true)} /> },
          { id: 'vinculos', rotulo: 'Vínculos', conteudo: <Vinculos arquivo={arquivo} dados={dados} somenteLeitura={arquivado} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={arquivo.id} /> },
        ]}
      />
      <FormularioDeArquivo aberto={editando} aoFechar={() => setEditando(false)} dados={dados} arquivo={arquivo} />
      {novaVersao && <DialogoNovaVersao arquivo={arquivo} aoFechar={() => setNovaVersao(false)} />}
      <Confirmacao
        aberto={arquivando}
        aoFechar={() => setArquivando(false)}
        titulo={`Arquivar ${arquivo.titulo}?`}
        texto="Ele sai da biblioteca e das buscas. O arquivo no Drive não muda, e dá para restaurar depois."
        rotuloConfirmar="Arquivar"
        perigo
        aoConfirmar={() => {
          setArquivando(false);
          void executar(() => arquivarArquivo(arquivo.id), 'Arquivo arquivado.');
        }}
      />
    </>
  );
}
