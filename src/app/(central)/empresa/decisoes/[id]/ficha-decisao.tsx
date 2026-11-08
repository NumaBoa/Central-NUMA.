'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GitBranchPlus, Gavel } from 'lucide-react';
import { AvisoDeFaseDaEmpresa, VoltarPara } from '@/componentes/empresa/aparencia';
import { FormularioDaDecisao } from '@/componentes/empresa/formularios-reuniao';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { ROTULOS_ASSUNTO_DECISAO } from '@/dominio/decisoes';
import { historicoDoRegistro } from '@/dominio/historico';
import { carregarReunioes, decisaoSubstituida, nomearRegistros, nomeDoContexto, nomesDosDecisores, registrosDaDecisao } from '@/dominio/reunioes';
import { formatarDiaISO } from '@/lib/formatacao';
import { SituacaoDaDecisao } from '../situacao-da-decisao';

function RegistrosAfetados({ id, registros }: { id: string; registros: ReturnType<typeof registrosDaDecisao> }) {
  const chave = registros.map((registro) => registro.id).join();
  const consulta = useConsulta(() => nomearRegistros(registros), [id, chave]);
  if (!consulta.dados?.length) return null;
  return (
    <ul className="grid gap-1">
      {consulta.dados.map((registro) => (
        <li key={`${registro.tipo}:${registro.id}`}>
          {registro.rotulo}:{' '}
          {registro.href ? (
            <LinkCentral href={registro.href} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
              {registro.nome}
            </LinkCentral>
          ) : (
            registro.nome
          )}
        </li>
      ))}
    </ul>
  );
}

function HistoricoDaDecisao({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro('decisao', id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} />
    </div>
  );
}

/** T06.09 e CA-06.06: decisão registrada não tem Editar. A única ação é substituir por outra, que fica ligada a esta. */
export function FichaDaDecisao() {
  const { id } = useParams<{ id: string }>();
  const roteador = useRouter();
  const consulta = useConsulta(carregarReunioes);
  const [substituindo, setSubstituindo] = useState(false);
  const voltar = <VoltarPara href="/empresa/decisoes" rotulo="Decisões" />;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta decisão." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const dados = consulta.dados;
  const decisao = dados.decisoes.find((item) => item.id === id);
  if (!decisao) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Gavel} titulo="Essa decisão não existe mais." texto="Ela pode ter sido removida ao importar um arquivo." />
      </>
    );
  }
  const substituta = dados.decisoes.find((item) => item.id === decisao.substituida_por_id);
  const anterior = decisaoSubstituida(decisao.id, dados.decisoes);
  const reuniao = dados.reunioes.find((item) => item.id === decisao.reuniao_id);
  const area = dados.areas.find((item) => item.id === decisao.area_id);
  const registros = registrosDaDecisao(decisao.id, dados.vinculos);
  const acoes =
    decisao.situacao === 'registrada' ? (
      <Button onClick={() => setSubstituindo(true)}>
        <GitBranchPlus aria-hidden />
        Substituir por nova decisão
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      {voltar}
      <AvisoDeFaseDaEmpresa />
      <Ficha
        tituloDePagina
        codigo={decisao.codigo}
        titulo={decisao.titulo}
        etiquetas={
          <>
            <SituacaoDaDecisao situacao={decisao.situacao} />
            {decisao.assunto !== 'geral' && <EtiquetaLivre>{ROTULOS_ASSUNTO_DECISAO[decisao.assunto]}</EtiquetaLivre>}
          </>
        }
        responsavel={`${formatarDiaISO(decisao.data)} · Decidido por: ${nomesDosDecisores(decisao.id, dados).join(' e ') || 'não informado'}`}
        acoes={acoes}
        acoesCelular={acoes}
        abas={[
          {
            id: 'decisao',
            rotulo: 'Decisão',
            conteudo: (
              <div className="grid gap-3">
                <Faixa tipo="info">Decisões registradas não são editáveis. Uma substituição mantém o vínculo e preserva o histórico.</Faixa>
                {substituta && (
                  <Faixa tipo="atencao">
                    Substituída por{' '}
                    <LinkCentral href={`/empresa/decisoes/${substituta.id}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 md:min-h-0">
                      {substituta.codigo} · {substituta.titulo}
                    </LinkCentral>
                    .
                  </Faixa>
                )}
                <ListaDeDados>
                  <Dado rotulo="Decisão">{decisao.descricao}</Dado>
                  <Dado rotulo="Motivo">{decisao.motivo}</Dado>
                  <Dado rotulo="Alternativas">{decisao.alternativas}</Dado>
                  <Dado rotulo="Impacto">{decisao.impacto}</Dado>
                  <Dado rotulo="Contexto">{nomeDoContexto(decisao.produto_id, dados.produtos)}</Dado>
                  <Dado rotulo="Área">{area?.nome}</Dado>
                  <Dado rotulo="Registros afetados">{registros.length ? <RegistrosAfetados id={decisao.id} registros={registros} /> : null}</Dado>
                  {reuniao && (
                    <Dado rotulo="Reunião">
                      <LinkCentral href={`/empresa/reunioes/${reuniao.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                        {reuniao.codigo} · {reuniao.titulo}
                      </LinkCentral>
                    </Dado>
                  )}
                  {anterior && (
                    <Dado rotulo="Substitui">
                      <LinkCentral href={`/empresa/decisoes/${anterior.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                        {anterior.codigo} · {anterior.titulo}
                      </LinkCentral>
                    </Dado>
                  )}
                </ListaDeDados>
              </div>
            ),
          },
          { id: 'historico', rotulo: 'Histórico', conteudo: <HistoricoDaDecisao id={decisao.id} /> },
        ]}
      />
      {substituindo && <FormularioDaDecisao dados={dados} substitui={decisao} aoFechar={() => setSubstituindo(false)} aoRegistrar={(nova) => roteador.push(`/empresa/decisoes/${nova.id}`)} />}
    </div>
  );
}
