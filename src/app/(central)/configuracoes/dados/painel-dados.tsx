'use client';

import { useRef, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react';
import { Database, FlaskConical, History, Timer } from 'lucide-react';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoErro } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { Indicador } from '@/componentes/padroes/indicador';
import { Previa } from '@/componentes/padroes/previa';
import { Secao } from '@/componentes/padroes/secao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/componentes/ui/dialog';
import { Skeleton } from '@/componentes/ui/skeleton';
import { mensagemDoErro } from '@/dados/erros';
import { assinarMeta, lerMeta, metaDoServidor } from '@/dados/meta';
import { nuvemConfigurada } from '@/dados/nuvem/config';
import { useConsulta, type ResultadoConsulta } from '@/dados/use-consulta';
import { backupAtrasado } from '@/dominio/backup';
import { analisarArquivo, contagensAtuais, exportarTudo, importarComCopia, limparExemplos, restaurarExemplos, resumoDosDados, type AnaliseDoArquivo, type ResumoDosDados } from '@/dominio/dados';
import { historicoRecente } from '@/dominio/historico';
import { executarRotinas, mensagemDasRotinas } from '@/dominio/rotinas';
import { baixarArquivo } from '@/lib/baixar-arquivo';
import { formatarData, formatarDataHora, formatarHora, formatarNumero, formatarTamanho } from '@/lib/formatacao';

const LINHAS_DO_HISTORICO = 10;

/** No Supabase, os dados são da Numa inteira, e não deste navegador. */
const NA_NUVEM = nuvemConfigurada();
const ONDE = NA_NUVEM ? 'da Central' : 'deste navegador';

function LinhaAcao({ titulo, texto, children }: { titulo: string; texto: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3.5 border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between md:gap-5">
      <div className="min-w-0">
        <h3>{titulo}</h3>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-[1.45] text-ink-soft">{texto}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Resumo({ resumo }: { resumo: ResultadoConsulta<ResumoDosDados> & { recarregar: () => void } }) {
  if (resumo.estado === 'carregando') {
    return (
      <div role="status" aria-label="Carregando" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3.5">
        <Skeleton className="col-span-2 h-[116px] md:col-span-1" />
        <Skeleton className="h-[116px]" />
        <Skeleton className="h-[116px]" />
      </div>
    );
  }
  if (resumo.estado === 'erro') {
    return <EstadoErro titulo={`Não deu para ler os dados ${ONDE}.`} texto={NA_NUVEM ? 'Eles podem estar danificados. Importe um backup, logo abaixo.' : 'Eles podem estar danificados. Importe um backup ou restaure os exemplos, logo abaixo.'} aoTentarDeNovo={resumo.recarregar} />;
  }

  const { registros, exemplos, usoEmCaracteres, ultimoBackup } = resumo.dados;
  return (
    <div className={NA_NUVEM ? 'grid grid-cols-2 gap-2.5 md:gap-3.5' : 'grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3.5'}>
      <Indicador
        className={NA_NUVEM ? undefined : 'col-span-2 md:col-span-1'}
        titulo="Último backup"
        valor={ultimoBackup ? formatarData(ultimoBackup.em) : 'Nenhum'}
        contexto={ultimoBackup ? `às ${formatarHora(ultimoBackup.em)}${ultimoBackup.por ? `, por ${ultimoBackup.por}` : ''}` : 'Exporte a primeira cópia.'}
        situacao={backupAtrasado(ultimoBackup?.em ?? null) && <EtiquetaSituacao tipo="atencao">Há mais de 8 dias</EtiquetaSituacao>}
      />
      <Indicador titulo="Registros" valor={formatarNumero(registros)} contexto={exemplos ? `${formatarNumero(exemplos)} de exemplo` : 'Nenhum de exemplo'} />
      {!NA_NUVEM && <Indicador titulo="Armazenamento" valor={formatarTamanho(usoEmCaracteres)} contexto="de cerca de 5 MB" />}
    </div>
  );
}

/** Configurações › Dados (02 §0.3): substitui T02.11 nesta etapa. */
export function PainelDados() {
  const resumo = useConsulta(resumoDosDados);
  const historico = useConsulta(() => historicoRecente(LINHAS_DO_HISTORICO));
  const { ultima_rotina_em: ultimaRotina } = useSyncExternalStore(assinarMeta, lerMeta, metaDoServidor);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);
  const [confirmando, setConfirmando] = useState<'restaurar' | 'limpar' | null>(null);
  const [analise, setAnalise] = useState<AnaliseDoArquivo | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const exemplos = resumo.dados?.exemplos ?? 0;

  /** Toda ação mostra o erro em português, e os dados continuam como estavam (RT-18). */
  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    try {
      await acao();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  const exportar = () =>
    executar(async () => {
      const { nome, conteudo } = await exportarTudo();
      baixarArquivo(nome, conteudo);
      aviso('Cópia baixada. Salve no Drive da Numa, em Backups/Central.');
    });

  async function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ''; // para o mesmo arquivo poder ser escolhido de novo
    if (!arquivo) return;
    await executar(async () => {
      setAnalise(analisarArquivo(await arquivo.text(), contagensAtuais()));
    });
  }

  const importar = () => {
    if (!analise?.ok) return;
    const { arquivo } = analise;
    setAnalise(null);
    void executar(async () => {
      const { registros, comCopia } = await importarComCopia(arquivo, (copia) => baixarArquivo(copia.nome, copia.conteudo));
      aviso(`Dados importados: ${formatarNumero(registros)} ${registros === 1 ? 'registro' : 'registros'}.${comCopia ? ' A cópia do que havia antes foi baixada.' : ''}`);
    });
  };

  const restaurar = () => {
    setConfirmando(null);
    void executar(async () => {
      await restaurarExemplos();
      aviso('Dados de exemplo restaurados.');
    });
  };

  const limpar = () => {
    setConfirmando(null);
    void executar(async () => {
      const removidos = await limparExemplos();
      aviso(`Dados de exemplo removidos: ${formatarNumero(removidos)} ${removidos === 1 ? 'registro' : 'registros'}.`);
    });
  };

  const rodarRotinas = () =>
    executar(async () => {
      aviso(mensagemDasRotinas(await executarRotinas({ manual: true })));
    });

  return (
    <div className="mt-7 grid max-w-[880px] grid-cols-1 gap-4 md:gap-5">
      {NA_NUVEM ? (
        <Faixa>Os dados ficam no servidor da Central e são os mesmos para todas as pessoas com acesso, no computador e no celular.</Faixa>
      ) : (
        <Faixa tipo="atencao">
          Os dados ficam só neste navegador, nesta máquina. Limpar o navegador apaga tudo, e celular e computador têm dados separados. Por isso, nesta etapa a Central ainda não é o registro oficial da Numa.
        </Faixa>
      )}

      <Resumo resumo={resumo} />

      <Secao icone={Database} titulo="Cópia dos dados" descricao="Leve os dados para outro navegador ou guarde no Drive.">
        <LinhaAcao titulo="Exportar tudo" texto={`Baixa um arquivo JSON com todos os dados ${ONDE}. Salve no Drive da Numa, em Backups/Central.`}>
          <Button onClick={exportar} disabled={ocupado}>
            Exportar tudo
          </Button>
        </LinhaAcao>
        <LinhaAcao titulo="Importar um arquivo" texto={`Mostra o que há no arquivo antes de qualquer mudança. Ao confirmar, a Central baixa uma cópia do que há hoje e substitui os dados ${ONDE}${NA_NUVEM ? ', para todas as pessoas' : ''}.`}>
          <Button variante="secundario" onClick={() => entradaDeArquivo.current?.click()} disabled={ocupado}>
            Escolher arquivo
          </Button>
          <input ref={entradaDeArquivo} type="file" accept=".json,application/json" aria-label="Arquivo para importar" className="sr-only" tabIndex={-1} onChange={aoEscolherArquivo} />
        </LinhaAcao>
      </Secao>

      <Secao icone={FlaskConical} titulo="Dados de exemplo" descricao="Para testar à vontade, sem medo de errar.">
        {/* No servidor, apagar tudo apagaria o trabalho de todas as pessoas: só limpar continua. */}
        {!NA_NUVEM && (
          <LinhaAcao titulo="Restaurar exemplos" texto="Volta tudo ao início, como na primeira abertura.">
            <Button variante="secundario" onClick={() => setConfirmando('restaurar')} disabled={ocupado}>
              Restaurar exemplos
            </Button>
          </LinhaAcao>
        )}
        <LinhaAcao titulo="Limpar exemplos" texto={exemplos ? 'Remove só os registros fictícios. O que vocês cadastraram continua aqui.' : `Não há registros de exemplo ${NA_NUVEM ? 'na Central' : 'neste navegador'}.`}>
          <Button variante="secundario" onClick={() => setConfirmando('limpar')} disabled={ocupado || !exemplos}>
            Limpar exemplos
          </Button>
        </LinhaAcao>
      </Secao>

      <Secao icone={Timer} titulo="Rotinas do dia" descricao="O que a Central confere sozinha ao abrir, uma vez por dia.">
        <LinhaAcao
          titulo="Rodar rotinas agora"
          texto={`${ultimaRotina ? `Última execução: ${formatarDataHora(ultimaRotina)}.` : `Ainda não rodaram ${NA_NUVEM ? 'na Central' : 'neste navegador'}.`} Os alertas chegam junto com o Meu dia.`}
        >
          <Button variante="secundario" onClick={rodarRotinas} disabled={ocupado}>
            Rodar rotinas agora
          </Button>
        </LinhaAcao>
      </Secao>

      <Secao icone={History} titulo="Histórico" descricao="As últimas ações: quem fez o quê, e quando.">
        <ListaHistorico consulta={historico} />
      </Secao>

      <Confirmacao
        aberto={confirmando === 'restaurar'}
        aoFechar={() => setConfirmando(null)}
        titulo="Restaurar os dados de exemplo?"
        texto="Isso apaga tudo o que foi cadastrado neste navegador, inclusive o histórico. Se quiser guardar o que há hoje, exporte antes."
        rotuloConfirmar="Restaurar exemplos"
        perigo
        aoConfirmar={restaurar}
      />
      <Confirmacao
        aberto={confirmando === 'limpar'}
        aoFechar={() => setConfirmando(null)}
        titulo="Limpar os dados de exemplo?"
        texto={`${formatarNumero(exemplos)} ${exemplos === 1 ? 'registro de exemplo será removido' : 'registros de exemplo serão removidos'}. O que vocês cadastraram continua aqui.`}
        rotuloConfirmar="Limpar exemplos"
        perigo
        aoConfirmar={limpar}
      />

      {analise?.ok && (
        <Previa
          aberto
          aoFechar={() => setAnalise(null)}
          titulo="Importar este arquivo?"
          texto={`Isso substitui tudo o que está neste navegador.${analise.copiaPossivel ? ' Antes, a Central baixa uma cópia do que há hoje.' : ''} Arquivo exportado em ${formatarDataHora(analise.arquivo.exportado_em)}${analise.arquivo.exportado_por ? `, por ${analise.arquivo.exportado_por.nome}` : ''}.`}
          colunas={['Dados', 'Neste navegador', 'No arquivo']}
          linhas={analise.previa.filter((linha) => linha.neste !== 0 || linha.noArquivo !== 0).map((linha) => [linha.rotulo, linha.neste === null ? 'Danificado' : formatarNumero(linha.neste), formatarNumero(linha.noArquivo)])}
          avisos={analise.avisos}
          rotuloConfirmar={analise.copiaPossivel ? 'Baixar cópia e substituir' : 'Substituir os dados'}
          aoConfirmar={importar}
        />
      )}
      {analise && !analise.ok && (
        <Dialog open onOpenChange={(aberto) => !aberto && setAnalise(null)}>
          <DialogContent>
            <DialogTitle className="pr-12">Não deu para usar este arquivo.</DialogTitle>
            <p className="mt-3 text-sm text-ink-soft">Nada foi alterado. Confira o arquivo e tente de novo.</p>
            <ul className="mt-3 grid list-disc gap-1 pl-5 text-[13px] text-err">
              {analise.erros.map((erro) => (
                <li key={erro}>{erro}</li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
