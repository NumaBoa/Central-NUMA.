'use client';

import { useState } from 'react';
import { Building2, Check, ExternalLink, Landmark, Plus } from 'lucide-react';
import { FormularioConta } from '@/app/(central)/configuracoes/cadastros/contas/formulario-conta';
import { FormularioDaEntidade } from '@/app/(central)/configuracoes/cadastros/entidades/tela-entidades';
import { Selecao } from '@/componentes/campos/selecao';
import { MolduraDaEmpresa, SituacaoDaEntidadeDaEmpresa, SituacaoDaObrigacao, SituacaoDoItem } from '@/componentes/empresa/aparencia';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { CartaoDaFicha } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { useConsulta } from '@/dados/use-consulta';
import { estadoDoItem } from '@/dominio/constituicao';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { ROTULOS_TIPO_CONTA } from '@/dominio/contas';
import { ROTULOS_DOCUMENTAL } from '@/dominio/contratos';
import { enderecoEmLinha } from '@/dominio/endereco';
import { carregarEntidadeDaEmpresa, entidadeInicial, pendenciasParaAtivar } from '@/dominio/entidade-empresa';
import { formatarDocumentoDaEntidade, nomeDaEntidade, representantesDaEntidade, ROTULOS_TIPO_ENTIDADE } from '@/dominio/entidades';
import { nomeDaPessoa } from '@/dominio/sociedade';
import { formatarDiaISO } from '@/lib/formatacao';

const A_DEFINIR = <span className="text-ink-soft">A definir</span>;

/** T06.07: atalho para a ficha da entidade (T02.05), com as abas a mais. O cadastro é um só. */
export function TelaEntidadeDaEmpresa() {
  const consulta = useConsulta(carregarEntidadeDaEmpresa);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [novaConta, setNovaConta] = useState(false);

  const moldura = (conteudo: React.ReactNode, acoes?: React.ReactNode) => (
    <MolduraDaEmpresa ativa="entidade" titulo="Entidade" resumo="A entidade da Numa, com o que está em nome dela." acoes={acoes}>
      {conteudo}
    </MolduraDaEmpresa>
  );

  if (consulta.estado === 'carregando') return moldura(<EstadoCarregando />);
  if (consulta.estado === 'erro') return moldura(<EstadoErro titulo="Não deu para ler a entidade." aoTentarDeNovo={consulta.recarregar} />);

  const dados = consulta.dados;
  const vivas = dados.cadastro.entidades.filter((item) => !item.arquivado_em);
  const entidade = vivas.find((item) => item.id === escolhida) ?? entidadeInicial(vivas);
  if (!entidade) {
    return moldura(<EstadoVazio icone={Building2} titulo="Nenhuma entidade cadastrada." texto="Cadastre em Configurações › Cadastros base › Entidades." />);
  }

  const representantes = representantesDaEntidade(entidade.id, dados.cadastro.representantes);
  const faltam = pendenciasParaAtivar(entidade, representantes);
  const completa = entidade.situacao === 'ativa';
  const contador = dados.cadastro.contrapartes.find((item) => item.id === entidade.contador_id);
  const itemDoCnpj = dados.itens.find((item) => item.chave === 'cnpj');
  const ehPj = entidade.tipo_pessoa === 'pj';
  const padrao = entidade.entidade_padrao;
  const ativosDaNuma = dados.ativos.filter((ativo) => ativo.titular_atual_tipo === 'numa');
  const ferramentasDaNuma = dados.ferramentas.filter((ferramenta) => ferramenta.titular_atual_tipo === 'numa' && ferramenta.situacao !== 'cancelada');
  const contratos = dados.contratos.filter((contrato) => contrato.entidade_id === entidade.id && contrato.situacao_documental === 'assinado');
  const obrigacoes = dados.obrigacoes.filter((obrigacao) => obrigacao.entidade_id === entidade.id);
  const contas = dados.contas.contas.filter((conta) => conta.titular_entidade_id === entidade.id && !conta.arquivado_em);

  return moldura(
    <>
      <Faixa tipo="info">
        Cadastro compartilhado com{' '}
        <LinkCentral href="/configuracoes/cadastros/entidades" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
          Configurações › Entidades
        </LinkCentral>
        : não há um segundo cadastro.
      </Faixa>
      {vivas.length > 1 && (
        <div className="max-w-sm">
          <label htmlFor="entidade-escolhida" className="mb-[7px] block texto-rotulo">
            Entidade
          </label>
          <Selecao id="entidade-escolhida" value={entidade.id} onChange={(evento) => setEscolhida(evento.target.value)}>
            {vivas.map((item) => (
              <option key={item.id} value={item.id}>
                {nomeDaEntidade(item)}
              </option>
            ))}
          </Selecao>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[20px] leading-7 break-words">{nomeDaEntidade(entidade)}</h2>
        <SituacaoDaEntidadeDaEmpresa situacao={entidade.situacao} />
      </div>
      <Tabs defaultValue="cadastro" className="min-w-0">
        <TabsList aria-label={`Seções de ${nomeDaEntidade(entidade)}`}>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="ativos">Ativos sob titularidade</TabsTrigger>
          <TabsTrigger value="contratos">Contratos assinados</TabsTrigger>
          <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>
          <TabsTrigger value="contas">Contas financeiras</TabsTrigger>
        </TabsList>
        <TabsContent value="cadastro" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <ListaDeDados>
              <Dado rotulo="Nome ou razão social">{entidade.nome}</Dado>
              <Dado rotulo="Nome de referência">{entidade.nome_fantasia}</Dado>
              <Dado rotulo="Tipo de pessoa">{ROTULOS_TIPO_ENTIDADE[entidade.tipo_pessoa]}</Dado>
              <Dado rotulo={entidade.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ'}>{entidade.documento ? formatarDocumentoDaEntidade(entidade.tipo_pessoa, entidade.documento) : null}</Dado>
              <Dado rotulo="Tipo societário">{entidade.natureza_juridica ?? A_DEFINIR}</Dado>
              <Dado rotulo="Regime tributário">{entidade.regime_tributario ?? A_DEFINIR}</Dado>
              <Dado rotulo="Contador">{contador ? nomeDaContraparte(contador) : <span className="text-ink-soft">Não escolhido</span>}</Dado>
              <Dado rotulo="Endereço">{enderecoEmLinha(entidade.endereco)}</Dado>
              <Dado rotulo="Representantes">{representantes.length ? representantes.map((id) => nomeDaPessoa(dados.cadastro.pessoas, id)).join(', ') : A_DEFINIR}</Dado>
              <Dado rotulo="Data de abertura">{entidade.data_abertura ? formatarDiaISO(entidade.data_abertura) : null}</Dado>
            </ListaDeDados>
            <CartaoDaFicha titulo={completa ? 'Situação' : 'Para ativar'}>
              {completa ? (
                <p className="text-[13px]">Entidade Ativa: pode ser usada para emissão final.</p>
              ) : (
                <ul className="grid gap-2 text-[13px]">
                  {faltam.map(({ rotulo, feito }) => (
                    <li key={rotulo} className="flex items-center justify-between gap-2">
                      <span>{rotulo}</span>
                      <span className={feito ? 'inline-flex items-center gap-1 font-medium text-ok [&_svg]:size-3.5' : 'font-medium text-warn'}>
                        {feito && <Check aria-hidden />}
                        {feito ? 'Preenchido' : 'Pendente'}
                      </span>
                    </li>
                  ))}
                  {ehPj && itemDoCnpj && (
                    <li className="grid gap-1 border-t border-line pt-2">
                      <span className="flex items-center justify-between gap-2">
                        <span>Evidência do CNPJ</span>
                        <SituacaoDoItem estado={estadoDoItem(itemDoCnpj, dados.itens)} />
                      </span>
                      <LinkCentral href={`/empresa/constituicao?item=${itemDoCnpj.id}`} className="inline-flex min-h-11 items-center gap-1 underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
                        Ver Constituição
                        <ExternalLink aria-hidden />
                      </LinkCentral>
                    </li>
                  )}
                </ul>
              )}
              <Button variante={completa ? 'secundario' : 'primario'} className="mt-3 w-full" onClick={() => setEditando(true)}>
                {completa ? 'Editar cadastro' : 'Completar cadastro'}
              </Button>
            </CartaoDaFicha>
          </div>
          <p className="mt-3 text-[13px] text-ink-soft">Produtos, clientes e rascunhos continuam disponíveis. A emissão final exige a entidade Ativa e os dados necessários.</p>
        </TabsContent>
        <TabsContent value="ativos" className="mt-4">
          {padrao && ativosDaNuma.length + ferramentasDaNuma.length > 0 ? (
            <ul className="grid gap-1 rounded-lg border border-line bg-paper p-4 text-[13px]">
              {ativosDaNuma.map((ativo) => (
                <li key={ativo.id}>
                  <LinkCentral href={`/ferramentas/ativos/${ativo.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {ativo.identificador}
                  </LinkCentral>
                </li>
              ))}
              {ferramentasDaNuma.map((ferramenta) => (
                <li key={ferramenta.id}>
                  <LinkCentral href={`/ferramentas/${ferramenta.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {ferramenta.nome}
                  </LinkCentral>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVazio icone={Building2} titulo="Nada em nome desta entidade ainda." texto="O que está para vir aparece em Ativos a transferir." acao={<LinkCentral href="/empresa/ativos" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">Ver Ativos a transferir</LinkCentral>} />
          )}
        </TabsContent>
        <TabsContent value="contratos" className="mt-4">
          {contratos.length ? (
            <ul className="grid gap-1 rounded-lg border border-line bg-paper p-4 text-[13px]">
              {contratos.map((contrato) => (
                <li key={contrato.id} className="flex flex-wrap items-center justify-between gap-2">
                  <LinkCentral href={`/contratos/${contrato.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {contrato.codigo} · {contrato.titulo}
                  </LinkCentral>
                  <span className="text-ink-soft">{ROTULOS_DOCUMENTAL[contrato.situacao_documental]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVazio icone={Building2} titulo="Nenhum contrato assinado." texto="Os contratos assinados por esta entidade aparecem aqui." />
          )}
        </TabsContent>
        <TabsContent value="obrigacoes" className="mt-4">
          {obrigacoes.length ? (
            <ul className="grid gap-1 rounded-lg border border-line bg-paper p-4 text-[13px]">
              {obrigacoes.map((obrigacao) => (
                <li key={obrigacao.id} className="flex flex-wrap items-center justify-between gap-2">
                  <LinkCentral href={`/empresa/obrigacoes/${obrigacao.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {obrigacao.nome}
                  </LinkCentral>
                  <SituacaoDaObrigacao situacao={obrigacao.situacao} />
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVazio icone={Building2} titulo="Nenhuma obrigação cadastrada." texto="O cadastro é definido com o contador." acao={<LinkCentral href="/empresa/obrigacoes" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">Abrir Obrigações</LinkCentral>} />
          )}
        </TabsContent>
        <TabsContent value="contas" className="mt-4">
          <div className="grid gap-3">
            {contas.length ? (
              <ul className="grid gap-1 rounded-lg border border-line bg-paper p-4 text-[13px]">
                {contas.map((conta) => (
                  <li key={conta.id} className="flex flex-wrap items-center justify-between gap-2">
                    <LinkCentral href={`/financeiro/contas/${conta.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                      {conta.nome}
                    </LinkCentral>
                    <span className="text-ink-soft">{ROTULOS_TIPO_CONTA[conta.tipo]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EstadoVazio icone={Landmark} titulo="Nenhuma conta em nome desta entidade." texto="A conta bancária da PJ entra aqui, depois do CNPJ." />
            )}
            <Button variante="secundario" className="justify-self-start" onClick={() => setNovaConta(true)}>
              <Plus aria-hidden />
              Nova conta
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      <FormularioDaEntidade aberto={editando} aoFechar={() => setEditando(false)} entidade={entidade} dados={dados.cadastro} />
      {novaConta && <FormularioConta aberto aoFechar={() => setNovaConta(false)} conta={null} dados={dados.contas} />}
    </>,
  );
}
