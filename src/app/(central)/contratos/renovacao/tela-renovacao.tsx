'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AbasContratos } from '@/componentes/f1/abas-modulos';
import { executar } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import { carregarContratos, decidirRenovacao, ROTULOS_RENOVACAO, type LinhaDoContrato } from '@/dominio/contratos';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { somarDias } from '@/dominio/repeticao';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';

const TEXTOS = { renovar: ['Renovar', 'Cria a versão de renovação, em rascunho, com o período seguinte. Ela segue revisão, documento e assinatura.'], nao_renovar: ['Não renovar', 'O contrato termina no fim da vigência. Uma tarefa de comunicação ao cliente, dentro do aviso prévio, vai para o Meu dia.'], renegociar: ['Renegociar', 'A renovação fica em análise. "Renegociar" não tem estado próprio no registro; a decisão e o motivo ficam no histórico.'] } as const;

/** T11.11: data-limite de decisão em 90 dias; a decisão sempre com motivo e quem decidiu. */
export function TelaRenovacao() {
  const consulta = useConsulta(() => carregarContratos());
  const hoje = hojeISO();
  const [decidindo, setDecidindo] = useState<{ linha: LinhaDoContrato; decisao: keyof typeof TEXTOS } | null>(null);
  const dados = consulta.dados;
  const linhas = (dados?.linhas ?? []).filter((linha) => linha.dataLimite && linha.dataLimite <= somarDias(hoje, 90) && linha.vigencia !== 'encerrado' && !linha.encerrado_em).sort((a, b) => (a.dataLimite as string).localeCompare(b.dataLimite as string));
  const contraparte = (id: string) => {
    const item = dados?.contrapartes.find((linha) => linha.id === id);
    return item ? nomeDaContraparte(item) : 'Contraparte removida';
  };
  const colunas: readonly Coluna<LinhaDoContrato>[] = [
    { id: 'contrato', titulo: 'Contrato', essencial: true, celula: (linha) => <LinkCentral className="font-medium underline" href={`/contratos/${linha.id}`}>{linha.codigo} · {linha.titulo}</LinkCentral> },
    { id: 'contraparte', titulo: 'Contraparte', celula: (linha) => contraparte(linha.contraparte_id) },
    { id: 'fim', titulo: 'Fim da vigência', celula: (linha) => (linha.fim ? formatarDiaISO(linha.fim) : '—') },
    { id: 'limite', titulo: 'Decidir até', essencial: true, celula: (linha) => <span className={linha.dataLimite! < hoje ? 'font-semibold text-err' : undefined}>{formatarDiaISO(linha.dataLimite as string)}{linha.dataLimite! < hoje ? ' (passou)' : ''}</span> },
    { id: 'situacao', titulo: 'Renovação', celula: (linha) => <EtiquetaSituacao tipo={linha.renovacao_situacao === 'em_analise' ? 'atencao' : 'neutro'}>{ROTULOS_RENOVACAO[linha.renovacao_situacao]}</EtiquetaSituacao> },
  ];
  const acoes = (linha: LinhaDoContrato) =>
    linha.renovacao_situacao === 'em_analise' || linha.renovacao_situacao === 'nao_se_aplica' ? (
      <span className="flex flex-wrap justify-end gap-1">
        {(Object.keys(TEXTOS) as (keyof typeof TEXTOS)[]).map((decisao) => <Button key={decisao} variante={decisao === 'renovar' ? 'primario' : 'secundario'} tamanho="pequeno" onClick={() => setDecidindo({ linha, decisao })}>{TEXTOS[decisao][0]}</Button>)}
      </span>
    ) : null;
  return (
    <>
      <CabecalhoPagina kicker="Contratos" titulo="Renovação" resumo="A data-limite é o fim da vigência menos o aviso prévio. Renovação não é presumida." />
      <AbasContratos ativa="renovacao" />
      <div className="mt-5">
        {consulta.estado === 'erro' && <EstadoErro aoTentarDeNovo={consulta.recarregar} />}
        <Lista rotulo="Contratos a renovar" linhas={linhas} colunas={colunas} chave={(linha) => linha.id} estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'} acoesDaLinha={acoes} cartaoInterativo cartao={(linha) => <span className="grid gap-1.5"><LinkCentral className="font-semibold underline" href={`/contratos/${linha.id}`}>{linha.codigo} · {linha.titulo}</LinkCentral><span className="text-[13px]">Decidir até {formatarDiaISO(linha.dataLimite as string)}</span>{acoes(linha)}</span>} vazio={<EstadoVazio icone={RefreshCw} titulo="Nada a decidir nos próximos 90 dias." texto="Os contratos com renovação aparecem aqui antes da data-limite do aviso prévio." />} />
      </div>
      <Confirmacao
        aberto={decidindo !== null}
        aoFechar={() => setDecidindo(null)}
        titulo={decidindo ? `${TEXTOS[decidindo.decisao][0]}: ${decidindo.linha.codigo}` : ''}
        texto={decidindo ? TEXTOS[decidindo.decisao][1] : ''}
        rotuloConfirmar={decidindo ? TEXTOS[decidindo.decisao][0] : ''}
        pedirMotivo
        aoConfirmar={(motivo) => {
          const alvo = decidindo;
          setDecidindo(null);
          if (alvo) void executar(() => decidirRenovacao(alvo.linha.id, alvo.decisao, motivo), 'Decisão registrada.');
        }}
      />
    </>
  );
}
