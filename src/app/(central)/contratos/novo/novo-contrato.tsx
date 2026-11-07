'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { SeletorContraparte } from '@/componentes/campos/seletor-contraparte';
import { useNovaContraparte } from '@/componentes/contrapartes/nova-contraparte';
import { CartaoDePainel } from '@/componentes/f1/apoio';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import type { Contrato } from '@/dados/tipos/contrato';
import { useConsulta } from '@/dados/use-consulta';
import { criarContrato, FAMILIAS_F1, ROTULOS_TIPO_CONTRATO } from '@/dominio/contratos';
import { entidadesParaVincular, nomeDaEntidade } from '@/dominio/entidades';
import { ROTULOS_FAMILIA } from '@/dominio/modelos';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';

async function carregar() {
  const [entidades, contrapartes, pessoas] = await Promise.all([repositorios.entidade.listar(), repositorios.contraparte.listar({ incluirArquivados: true }), repositorios.pessoa.listar()]);
  return { entidades, contrapartes, pessoas };
}

/** T11.03, partes: o mínimo para nascer o rascunho. O restante segue no assistente, que salva a qualquer momento. */
export function NovoContrato() {
  const roteador = useRouter();
  const { abrirNovaContraparte } = useNovaContraparte();
  const consulta = useConsulta(carregar);
  const dados = consulta.dados;
  const padrao = dados?.entidades.find((entidade) => entidade.entidade_padrao)?.id ?? '';
  const [familia, setFamilia] = useState<Contrato['familia']>('cliente_negociado');
  const [tipo, setTipo] = useState<Contrato['tipo']>('prestacao_servico');
  const [titulo, setTitulo] = useState('');
  const [entidade, setEntidade] = useState('');
  const [contraparte, setContraparte] = useState('');
  const [responsavel, setResponsavel] = useState(idDaPessoaAtual() ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const pessoas = useMemo(() => pessoasDoSeletor(dados?.pessoas ?? []), [dados]);
  useAlteracoesPendentes(Boolean(titulo || contraparte));
  if (!dados) return <EstadoCarregando />;
  const saas = (familia === 'cliente_negociado' || familia === 'adesao_condicao_especial') && tipo === 'assinatura';
  const criar = async () => {
    setErro(null);
    if (!contraparte) return setErro('Escolha a contraparte.');
    if (!(entidade || padrao)) return setErro('Escolha a entidade contratante.');
    try {
      const contrato = await criarContrato({ titulo, familia, tipo, entidade_id: entidade || padrao, contraparte_id: contraparte, responsavel_id: responsavel, participantes: [] });
      aviso('Contrato criado em rascunho.');
      roteador.push(`/contratos/${contrato.id}/editar?etapa=itens`);
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
      <CabecalhoPagina kicker="Contratos" titulo="Novo contrato" resumo="Família parceiro, com repasse, é da F2. Societário fica em Empresa." />
      <CartaoDePainel className="mt-5 max-w-3xl">
        <div className="grid gap-[18px] md:grid-cols-2">
          <Campo id="novo-familia" rotulo="Família" obrigatorio>
            {(controle) => (
              <Selecao {...controle} value={familia} onChange={(evento) => setFamilia(evento.target.value as Contrato['familia'])}>
                {FAMILIAS_F1.map((item) => <option key={item} value={item}>{ROTULOS_FAMILIA[item]}</option>)}
              </Selecao>
            )}
          </Campo>
          <Campo id="novo-tipo" rotulo="Tipo" obrigatorio>
            {(controle) => (
              <Selecao {...controle} value={tipo} onChange={(evento) => setTipo(evento.target.value as Contrato['tipo'])}>
                {Object.entries(ROTULOS_TIPO_CONTRATO).filter(([valor]) => valor !== 'parceria' || familia === 'institucional').map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </Selecao>
            )}
          </Campo>
          {saas && (
            <Faixa className="md:col-span-2" acao={<LinkCentral className="underline" href={`/contratos/assinatura/novo${contraparte ? `?contraparte=${contraparte}` : ''}`}>Usar o modelo de assinatura</LinkCentral>}>
              Assinatura de produto usa o modelo único MOD-SAAS-LIC (T11.14), sem editar o texto jurídico.
            </Faixa>
          )}
          <Campo id="novo-titulo" rotulo="Título" obrigatorio className="md:col-span-2">
            {(controle) => <Input {...controle} autoComplete="off" value={titulo} onChange={(evento) => setTitulo(evento.target.value)} />}
          </Campo>
          <Campo id="novo-entidade" rotulo="Entidade contratante" obrigatorio ajuda="Planejada vale no rascunho; o final exige Ativa.">
            {(controle) => (
              <Selecao {...controle} value={entidade || padrao} onChange={(evento) => setEntidade(evento.target.value)}>
                <option value="">Escolha</option>
                {entidadesParaVincular(dados.entidades).map((item) => <option key={item.id} value={item.id}>{nomeDaEntidade(item)}</option>)}
              </Selecao>
            )}
          </Campo>
          <Campo id="novo-contraparte" rotulo="Contraparte" obrigatorio>
            {(controle) => <SeletorContraparte {...controle} valor={contraparte} aoMudar={setContraparte} contrapartes={dados.contrapartes} aoCriar={() => abrirNovaContraparte()} />}
          </Campo>
          <Campo id="novo-responsavel" rotulo="Responsável principal" obrigatorio>
            {(controle) => <SelecaoPessoa {...controle} pessoas={pessoas} value={responsavel} onChange={(evento) => setResponsavel(evento.target.value)} />}
          </Campo>
        </div>
        {erro && <MensagemErro className="mt-3">{erro}</MensagemErro>}
        <Button className="mt-5" onClick={() => void criar()}>
          Criar rascunho
        </Button>
      </CartaoDePainel>
    </>
  );
}
