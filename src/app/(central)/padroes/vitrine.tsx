'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ClipboardList, Component, FileText, FormInput, MessageSquare, MoreHorizontal, Plus, ShieldAlert, Sun, Tags } from 'lucide-react';
import { z } from 'zod';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio, EstadoVazioFiltro } from '@/componentes/padroes/estados';
import { EmBreve, EtiquetaContexto, EtiquetaLivre, EtiquetaPrioridade, EtiquetaSituacao, type Prioridade, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { BarraFiltros } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Pessoa } from '@/componentes/padroes/pessoa';
import { Secao } from '@/componentes/padroes/secao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import type { Contexto } from '@/dominio/contextos';

/** Só para demonstrar os padrões: os contextos de verdade vêm dos dados (T02.04). */
const CONTEXTOS: readonly [Contexto, ...Contexto[]] = [
  { id: 'consolidada', nome: 'Numa consolidada', cor: 'var(--c-numa)', tinta: 'var(--t-numa)' },
  { id: 'institucional', nome: 'Numa institucional', cor: 'var(--c-numa)', tinta: 'var(--t-numa)' },
  { id: 'urb', nome: 'Sobrevivência Urbana', curto: 'S. Urbana', cor: 'var(--c-urb)', tinta: 'var(--t-urb)' },
  { id: 'kipi', nome: 'Kipi', cor: 'var(--c-kipi)', tinta: 'var(--t-kipi)' },
  { id: 'zupi', nome: 'Zupi', cor: 'var(--c-zupi)', tinta: 'var(--t-zupi)' },
  { id: 'zarpa', nome: 'Zarpa', provisorio: true, cor: 'var(--c-zarpa)', tinta: 'var(--t-zarpa)' },
  { id: 'mimo', nome: 'Mimo', provisorio: true, cor: 'var(--c-mimo)', tinta: 'var(--t-mimo)' },
];
const acharContexto = (id: string): Contexto => CONTEXTOS.find((contexto) => contexto.id === id) ?? CONTEXTOS[0];

type AtividadeExemplo = {
  codigo: string;
  titulo: string;
  responsavel: string;
  contexto: string;
  prazo: string;
  situacao: { tipo: TipoSituacao; rotulo: string };
  prioridade: Prioridade;
  grupo: 'atrasadas' | 'hoje' | 'proximas';
};

const ATIVIDADES: readonly AtividadeExemplo[] = [
  { codigo: 'ATV-2026-0042', titulo: 'Renovar domínio kipi.com.br', responsavel: 'Camila Lima', contexto: 'kipi', prazo: 'Atrasada há 2 dias', situacao: { tipo: 'erro', rotulo: 'Atrasada' }, prioridade: 'alta', grupo: 'atrasadas' },
  { codigo: 'ATV-2026-0043', titulo: 'Lançar despesas e comprovantes da semana', responsavel: 'Kimberly Grebe', contexto: 'institucional', prazo: 'Hoje', situacao: { tipo: 'atencao', rotulo: 'Vence hoje' }, prioridade: 'normal', grupo: 'hoje' },
  { codigo: 'ATV-2026-0044', titulo: 'Exportar backup da Central e salvar no Drive', responsavel: 'Camila Lima', contexto: 'institucional', prazo: 'Em 3 dias', situacao: { tipo: 'info', rotulo: 'Em andamento' }, prioridade: 'normal', grupo: 'proximas' },
  { codigo: 'ATV-2026-0045', titulo: 'Decidir sobre o fim do teste da Figma', responsavel: 'Kimberly Grebe', contexto: 'consolidada', prazo: 'Em 5 dias', situacao: { tipo: 'neutro', rotulo: 'A fazer' }, prioridade: 'urgente', grupo: 'proximas' },
  { codigo: 'ATV-2026-0046', titulo: 'Revisar a ordem da fila do Zupi', responsavel: 'Camila Lima', contexto: 'zupi', prazo: 'Sem prazo', situacao: { tipo: 'neutro', rotulo: 'A fazer' }, prioridade: 'baixa', grupo: 'proximas' },
];

const COLUNAS: readonly Coluna<AtividadeExemplo>[] = [
  { id: 'titulo', titulo: 'Título', essencial: true, ordenar: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'), celula: (l) => <span className="font-semibold">{l.titulo}</span> },
  { id: 'codigo', titulo: 'Código', celula: (l) => <span className="whitespace-nowrap text-ink-soft tabular-nums">{l.codigo}</span> },
  { id: 'responsavel', titulo: 'Responsável', essencial: true, ordenar: (a, b) => a.responsavel.localeCompare(b.responsavel, 'pt-BR'), celula: (l) => <Pessoa nome={l.responsavel} /> },
  { id: 'contexto', titulo: 'Contexto', celula: (l) => <EtiquetaContexto contexto={acharContexto(l.contexto)} /> },
  { id: 'prazo', titulo: 'Prazo', celula: (l) => <span className="whitespace-nowrap">{l.prazo}</span> },
  { id: 'prioridade', titulo: 'Prioridade', celula: (l) => <EtiquetaPrioridade prioridade={l.prioridade} /> },
  { id: 'situacao', titulo: 'Situação', essencial: true, celula: (l) => <EtiquetaSituacao tipo={l.situacao.tipo}>{l.situacao.rotulo}</EtiquetaSituacao> },
];

function CartaoAtividade({ atividade }: { atividade: AtividadeExemplo }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">{atividade.titulo}</span>
        <EtiquetaPrioridade prioridade={atividade.prioridade} />
      </div>
      <div className="text-[13px] leading-[18px] text-ink-soft tabular-nums">
        {atividade.codigo} · {atividade.prazo}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <EtiquetaContexto contexto={acharContexto(atividade.contexto)} />
        <EtiquetaSituacao tipo={atividade.situacao.tipo}>{atividade.situacao.rotulo}</EtiquetaSituacao>
      </div>
      <Pessoa nome={atividade.responsavel} className="text-[13px]" />
    </div>
  );
}

function DemoLista() {
  const [estado, setEstado] = useState<'pronto' | 'carregando' | 'erro' | 'vazio'>('pronto');
  const [busca, setBusca] = useState('');
  const [rapido, setRapido] = useState('todas');
  const [contexto, setContexto] = useState('');

  const filtradas = useMemo(() => {
    if (estado === 'vazio') return [];
    const termo = busca.trim().toLowerCase();
    return ATIVIDADES.filter(
      (a) =>
        (rapido === 'todas' || a.grupo === rapido) &&
        (!contexto || a.contexto === contexto) &&
        (!termo || `${a.titulo} ${a.codigo} ${a.responsavel}`.toLowerCase().includes(termo)),
    );
  }, [estado, busca, rapido, contexto]);

  const nomeContexto = CONTEXTOS.find((c) => c.id === contexto)?.nome;
  const limpar = () => {
    setBusca('');
    setRapido('todas');
    setContexto('');
  };

  return (
    <>
      <Pilulas
        rotulo="Ver a lista"
        valor={estado}
        aoMudar={(valor) => setEstado(valor as typeof estado)}
        opcoes={[
          { valor: 'pronto', rotulo: 'Com dados' },
          { valor: 'vazio', rotulo: 'Vazia' },
          { valor: 'carregando', rotulo: 'Carregando' },
          { valor: 'erro', rotulo: 'Com erro' },
        ]}
        className="mb-5"
      />
      <BarraFiltros
        busca={busca}
        aoBuscar={setBusca}
        rotuloBusca="Buscar por título, código ou pessoa"
        rapidos={[
          { id: 'todas', rotulo: 'Todas', contador: ATIVIDADES.length },
          { id: 'atrasadas', rotulo: 'Atrasadas', contador: ATIVIDADES.filter((a) => a.grupo === 'atrasadas').length },
          { id: 'hoje', rotulo: 'Hoje', contador: ATIVIDADES.filter((a) => a.grupo === 'hoje').length },
          { id: 'proximas', rotulo: 'Próximas', contador: ATIVIDADES.filter((a) => a.grupo === 'proximas').length },
        ]}
        rapidoAtivo={rapido}
        aoEscolherRapido={setRapido}
        ativos={nomeContexto ? [{ id: 'contexto', rotulo: nomeContexto }] : []}
        aoRemoverAtivo={() => setContexto('')}
        aoLimpar={limpar}
        filtrosDetalhados={
          <div className="px-1 pb-3 md:px-3">
            <label htmlFor="filtro-contexto" className="mb-[7px] block texto-rotulo">
              Contexto
            </label>
            <Selecao id="filtro-contexto" value={contexto} onChange={(evento) => setContexto(evento.target.value)}>
              <option value="">Todos</option>
              {CONTEXTOS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </div>
        }
      />
      <div className="mt-4">
        <Lista
          rotulo="Atividades de exemplo"
          linhas={filtradas}
          colunas={COLUNAS}
          chave={(l) => l.codigo}
          cartao={(l) => <CartaoAtividade atividade={l} />}
          aoAbrir={(l) => aviso(`Abriria a ficha de ${l.codigo}.`)}
          acoesDaLinha={(l) => (
            <Button variante="icone" tamanho="icone" aria-label={`Ações de ${l.codigo}`} onClick={() => aviso('As ações da linha ficam neste menu.')}>
              <MoreHorizontal aria-hidden />
            </Button>
          )}
          estado={estado === 'vazio' ? 'pronto' : estado}
          aoTentarDeNovo={() => setEstado('pronto')}
          filtrando={estado !== 'vazio' && (Boolean(busca.trim()) || rapido !== 'todas' || Boolean(contexto))}
          aoLimparFiltros={limpar}
          vazio={
            <EstadoVazio
              icone={Sun}
              titulo="Tudo em dia por aqui."
              texto="Que tal registrar o que vem pela frente?"
              acao={
                <Button onClick={() => setEstado('pronto')}>
                  <Plus aria-hidden />
                  Nova atividade
                </Button>
              }
            />
          }
        />
      </div>
    </>
  );
}

function DemoFicha() {
  return (
    <Ficha
      codigo="ATV-2026-0042"
      titulo="Renovar domínio kipi.com.br"
      etiquetas={
        <>
          <EtiquetaSituacao tipo="erro">Atrasada há 2 dias</EtiquetaSituacao>
          <EtiquetaContexto contexto={acharContexto('kipi')} />
          <EtiquetaPrioridade prioridade="alta" />
        </>
      }
      responsavel={<Pessoa nome="Camila Lima" />}
      acoes={
        <>
          <Button variante="secundario" onClick={() => aviso('Abriria o formulário de edição.')}>
            Editar
          </Button>
          <Button onClick={() => aviso('Atividade concluída.', { acao: { rotulo: 'Desfazer', aoClicar: () => aviso('Conclusão desfeita.') } })}>Concluir</Button>
        </>
      }
      abas={[
        { id: 'resumo', rotulo: 'Resumo', conteudo: <p className="text-ink-soft">Renovar antes do vencimento para o aplicativo não sair do ar.</p> },
        { id: 'atividades', rotulo: 'Atividades', conteudo: <p className="text-ink-soft">As atividades vinculadas aparecem aqui.</p> },
        { id: 'arquivos', rotulo: 'Arquivos', conteudo: <p className="text-ink-soft">Os links do Drive aparecem aqui.</p> },
        {
          id: 'historico',
          rotulo: 'Histórico',
          conteudo: <p className="text-ink-soft">Kimberly Grebe alterou Vencimento de 10/11 para 15/11 — 04/11/2026 14:32</p>,
        },
      ]}
      lateral={
        <>
          <div className="rounded-md border border-line bg-linen p-4">
            <h3 className="mb-1">Vínculos</h3>
            <p className="text-ink-soft">Ativo digital: kipi.com.br</p>
          </div>
          <div className="rounded-md border border-line bg-linen p-4">
            <h3 className="mb-1">Próximos eventos</h3>
            <p className="text-ink-soft">Vencimento do domínio</p>
          </div>
        </>
      }
    />
  );
}

const esquemaTarefa = z.object({
  titulo: z.string().trim().min(1, 'Informe o título da tarefa.').max(140, 'Use até 140 caracteres.'),
  responsavel: z.string().min(1, 'Escolha a responsável.'),
  prazo: z.string(),
  contexto: z.string(),
  descricao: z.string(),
});
type Tarefa = z.infer<typeof esquemaTarefa>;

const TAREFA_VAZIA: Tarefa = { titulo: '', responsavel: 'Kimberly Grebe', prazo: 'sem-prazo', contexto: 'institucional', descricao: '' };

function DemoFormulario() {
  const [aberto, setAberto] = useState(false);
  const { register, handleSubmit, control, reset, setFocus, formState } = useForm<Tarefa>({ resolver: zodResolver(esquemaTarefa), defaultValues: TAREFA_VAZIA });
  const { errors, isDirty } = formState;
  // O reset limpa o registro dos campos: o foco volta para o título só depois da nova renderização.
  const [proximaTarefa, setProximaTarefa] = useState(0);
  useEffect(() => {
    if (proximaTarefa) setFocus('titulo');
  }, [proximaTarefa, setFocus]);
  const listaErros: ErroDeCampo[] = errors.titulo?.message ? [{ campoId: 'exemplo-titulo', mensagem: errors.titulo.message }] : [];

  function fechar() {
    reset(TAREFA_VAZIA);
    setAberto(false);
  }

  const salvar = handleSubmit(
    () => {
      fechar();
      aviso('Tarefa salva só neste exemplo. Nada foi gravado.');
    },
    () => setFocus('titulo'),
  );

  const salvarEOutro = () =>
    void handleSubmit(
      (dados) => {
        reset({ ...TAREFA_VAZIA, responsavel: dados.responsavel, contexto: dados.contexto });
        aviso('Tarefa salva só neste exemplo. Preencha a próxima.');
        setProximaTarefa((atual) => atual + 1);
      },
      () => setFocus('titulo'),
    )();

  return (
    <>
      <p className="mb-4 text-sm text-ink-soft">Painel à direita no computador; no celular, tela inteira com as ações fixas embaixo. Tente salvar sem título e fechar com algo preenchido.</p>
      <Button onClick={() => setAberto(true)}>
        <Plus aria-hidden />
        Nova tarefa
      </Button>
      <PainelFormulario
        aberto={aberto}
        aoFechar={fechar}
        titulo="Nova tarefa"
        descricao="Exemplo do padrão de formulário."
        alterado={isDirty}
        aoEnviar={salvar}
        aoSalvarEOutro={salvarEOutro}
        erros={listaErros}
      >
        <div className="grid grid-cols-1 gap-[18px]">
          <Campo id="exemplo-titulo" rotulo="Título" obrigatorio erro={errors.titulo?.message} ajuda="Até 140 caracteres.">
            {(controle) => <Input {...controle} {...register('titulo')} />}
          </Campo>
          <Controller
            control={control}
            name="responsavel"
            render={({ field }) => (
              <Pilulas
                rotulo="Responsável"
                obrigatorio
                valor={field.value}
                aoMudar={field.onChange}
                opcoes={[
                  { valor: 'Kimberly Grebe', rotulo: 'Kimberly Grebe' },
                  { valor: 'Camila Lima', rotulo: 'Camila Lima' },
                ]}
              />
            )}
          />
          <Controller
            control={control}
            name="prazo"
            render={({ field }) => (
              <Pilulas
                rotulo="Prazo"
                valor={field.value}
                aoMudar={field.onChange}
                opcoes={[
                  { valor: 'hoje', rotulo: 'Hoje' },
                  { valor: 'amanha', rotulo: 'Amanhã' },
                  { valor: 'semana', rotulo: 'Esta semana' },
                  { valor: 'sem-prazo', rotulo: 'Sem prazo' },
                ]}
              />
            )}
          />
          <Campo rotulo="Contexto">
            {(controle) => (
              <Selecao {...controle} {...register('contexto')}>
                {CONTEXTOS.filter((c) => c.id !== 'consolidada').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Descrição">{(controle) => <Textarea {...controle} {...register('descricao')} />}</Campo>
        </div>
      </PainelFormulario>
    </>
  );
}

function DemoConfirmacoes() {
  const [aberta, setAberta] = useState<'simples' | 'motivo' | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variante="secundario" onClick={() => setAberta('simples')}>
          Cancelar a ferramenta
        </Button>
        <Button variante="secundario" onClick={() => setAberta('motivo')}>
          Arquivar com motivo
        </Button>
      </div>
      <Confirmacao
        aberto={aberta === 'simples'}
        aoFechar={() => setAberta(null)}
        titulo="Cancelar a ferramenta?"
        texto="As 3 cobranças futuras serão canceladas. Pagamentos anteriores continuam no histórico."
        rotuloConfirmar="Cancelar ferramenta"
        perigo
        aoConfirmar={() => {
          setAberta(null);
          aviso('Ferramenta cancelada só neste exemplo.');
        }}
      />
      <Confirmacao
        aberto={aberta === 'motivo'}
        aoFechar={() => setAberta(null)}
        titulo="Arquivar o registro?"
        texto="Ele deixa de aparecer nas listas, mas nada se perde: dá para restaurar depois."
        rotuloConfirmar="Arquivar registro"
        pedirMotivo
        aoConfirmar={(motivo) => {
          setAberta(null);
          aviso(`Arquivado só neste exemplo. Motivo: ${motivo}`);
        }}
      />
    </>
  );
}

export function Vitrine() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:gap-5">
      <Secao icone={ClipboardList} titulo="Lista" descricao="Tabela no computador, com colunas essenciais no tablet e cartões no celular.">
        <DemoLista />
      </Secao>
      <Secao icone={FileText} titulo="Ficha" descricao="Cabeçalho, abas em pílula e coluna lateral.">
        <DemoFicha />
      </Secao>
      <Secao icone={FormInput} titulo="Formulário" descricao="Validação junto ao campo e resumo no topo.">
        <DemoFormulario />
      </Secao>
      <Secao icone={ShieldAlert} titulo="Confirmação" descricao="Título com o verbo, consequências e motivo quando a regra exigir.">
        <DemoConfirmacoes />
      </Secao>
      <Secao icone={MessageSquare} titulo="Avisos" descricao="Mensagem curta que some em 5 segundos e faixas na página.">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variante="secundario" onClick={() => aviso('Despesa registrada.', { acao: { rotulo: 'Abrir', aoClicar: () => aviso('Abriria a despesa.') } })}>
            Mostrar aviso
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Faixa>O calendário considera feriados nacionais, estaduais e municipais.</Faixa>
          <Faixa tipo="sucesso">Tudo em ordem por aqui.</Faixa>
          <Faixa tipo="atencao">Exporte uma cópia toda semana e salve no Drive da Numa.</Faixa>
          <Faixa tipo="erro">Não deu para salvar agora. Seus dados continuam aqui; tente de novo.</Faixa>
        </div>
      </Secao>
      <Secao icone={Component} titulo="Estados" descricao="Vazio, vazio por filtro, carregando e erro.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EstadoVazio icone={Sun} titulo="Tudo em dia por aqui." texto="Que tal registrar o que vem pela frente?" comMarcaDagua acao={<Button>Adicionar</Button>} />
          <EstadoVazioFiltro aoLimpar={() => aviso('Limparia os filtros.')} />
          <EstadoCarregando linhas={3} />
          <EstadoErro aoTentarDeNovo={() => aviso('Tentaria de novo.')} />
        </div>
      </Secao>
      <Secao icone={Tags} titulo="Etiquetas e botões" descricao="Situação sempre com texto, ícone e cor.">
        <div className="flex flex-wrap items-center gap-2">
          <EtiquetaSituacao tipo="sucesso">Quitado</EtiquetaSituacao>
          <EtiquetaSituacao tipo="atencao">Vence em 3 dias</EtiquetaSituacao>
          <EtiquetaSituacao tipo="erro">Bloqueada</EtiquetaSituacao>
          <EtiquetaSituacao tipo="info">Em andamento</EtiquetaSituacao>
          <EtiquetaSituacao tipo="neutro">Rascunho</EtiquetaSituacao>
          <EtiquetaPrioridade prioridade="urgente" />
          <EtiquetaPrioridade prioridade="alta" />
          <EtiquetaLivre>etiqueta livre</EtiquetaLivre>
          <EmBreve />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CONTEXTOS.map((c) => (
            <EtiquetaContexto key={c.id} contexto={c} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button>Primário</Button>
          <Button variante="secundario">Secundário</Button>
          <Button variante="terciario">Terciário</Button>
          <Button variante="perigo">Perigo</Button>
          <Button carregando>Salvando</Button>
          <Button disabled>Desativado</Button>
        </div>
      </Secao>
    </div>
  );
}
