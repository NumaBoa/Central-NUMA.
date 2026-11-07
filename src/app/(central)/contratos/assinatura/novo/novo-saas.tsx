'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { SeletorContraparte } from '@/componentes/campos/seletor-contraparte';
import { useNovaContraparte } from '@/componentes/contrapartes/nova-contraparte';
import { CartaoDePainel } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import { useConsulta } from '@/dados/use-consulta';
import { criarContratoSaas } from '@/dominio/contrato-saas';
import { entidadesParaVincular, nomeDaEntidade } from '@/dominio/entidades';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';

async function carregar() {
  const [entidades, contrapartes, pessoas] = await Promise.all([repositorios.entidade.listar(), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.pessoa.listar()]);
  return { entidades, contrapartes, pessoas };
}

/**
 * T11.14, início: família, partes e título. Assinante do site usa os Termos de Assinatura (D-CTR-05); o
 * contrato individual é para condição especial e cliente negociado.
 */
export function NovoContratoSaas() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const { abrirNovaContraparte } = useNovaContraparte();
  const consulta = useConsulta(carregar);
  const [familia, setFamilia] = useState<'adesao_condicao_especial' | 'cliente_negociado'>('adesao_condicao_especial');
  const [titulo, setTitulo] = useState('');
  const [entidade, setEntidade] = useState('');
  const [contraparte, setContraparte] = useState(parametros.get('contraparte') ?? '');
  const [responsavel, setResponsavel] = useState(idDaPessoaAtual() ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const dados = consulta.dados;
  if (!dados) return <EstadoCarregando />;
  const padrao = dados.entidades.find((item) => item.entidade_padrao)?.id ?? '';
  const criar = async () => {
    setErro(null);
    if (!titulo.trim()) return setErro('Informe o título.');
    if (!contraparte) return setErro('Escolha a contraparte.');
    try {
      const contrato = await criarContratoSaas({ titulo, familia, entidadeId: entidade || padrao, contraparteId: contraparte, responsavelId: responsavel });
      aviso('Contrato de assinatura criado em rascunho.');
      roteador.push(`/contratos/${contrato.id}/editar`);
    } catch (problema) {
      setErro(mensagemDoErro(problema));
    }
  };
  return (
    <>
      <LinkCentral href="/contratos" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden />
        Contratos
      </LinkCentral>
      <CabecalhoPagina kicker="Contratos" titulo="Novo contrato de assinatura" resumo="Sobre o modelo único MOD-SAAS-LIC: o texto jurídico não se edita aqui." />
      <CartaoDePainel className="mt-5 max-w-3xl">
        <Faixa tipo="atencao" className="mb-4">MOD-SAAS-LIC v2.0 está em Rascunho para validação jurídica. Dá para preparar o contrato; o final pede confirmação e motivo enquanto o modelo não for validado.</Faixa>
        <div className="grid gap-[18px] md:grid-cols-2">
          <Campo id="saas-familia" rotulo="Família" obrigatorio ajuda="Assinante comum do site não gera contrato individual: usa os Termos de Assinatura.">
            {(controle) => (
              <Selecao {...controle} value={familia} onChange={(evento) => setFamilia(evento.target.value as typeof familia)}>
                <option value="adesao_condicao_especial">Adesão com condição especial</option>
                <option value="cliente_negociado">Cliente negociado</option>
              </Selecao>
            )}
          </Campo>
          <Campo id="saas-titulo" rotulo="Título" obrigatorio>{(controle) => <Input {...controle} autoComplete="off" value={titulo} onChange={(evento) => setTitulo(evento.target.value)} />}</Campo>
          <Campo id="saas-entidade" rotulo="Entidade licenciante" obrigatorio ajuda="Pessoa jurídica Ativa, ou Sócias pessoas físicas completas, para o final.">
            {(controle) => (
              <Selecao {...controle} value={entidade || padrao} onChange={(evento) => setEntidade(evento.target.value)}>
                {entidadesParaVincular(dados.entidades).map((item) => <option key={item.id} value={item.id}>{nomeDaEntidade(item)}</option>)}
              </Selecao>
            )}
          </Campo>
          <Campo id="saas-contraparte" rotulo="Contraparte" obrigatorio ajuda="Documento, endereço e e-mail são exigidos para o final.">
            {(controle) => <SeletorContraparte {...controle} valor={contraparte} aoMudar={setContraparte} contrapartes={dados.contrapartes} aoCriar={() => abrirNovaContraparte()} />}
          </Campo>
          <Campo id="saas-responsavel" rotulo="Responsável" obrigatorio>{(controle) => <SelecaoPessoa {...controle} pessoas={pessoasDoSeletor(dados.pessoas)} value={responsavel} onChange={(evento) => setResponsavel(evento.target.value)} />}</Campo>
        </div>
        {erro && <MensagemErro className="mt-3">{erro}</MensagemErro>}
        <Button className="mt-5" onClick={() => void criar()}>Criar rascunho</Button>
      </CartaoDePainel>
    </>
  );
}
