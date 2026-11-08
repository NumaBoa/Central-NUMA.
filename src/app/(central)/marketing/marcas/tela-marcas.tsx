'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { AtSign, CircleAlert, CircleCheck, ExternalLink, Palette, Pencil, Plus, Stamp, Trash2, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { AbasDoFormulario, AbasMarketing, EtiquetaClasse, IconeDoTipo, KICKER_MARKETING } from '@/componentes/marketing/apoio';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Marca } from '@/dados/tipos/marca';
import type { Arquivo, MarcaIdentidade } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { ROTULOS_TRANSFERENCIA } from '@/dominio/ativos';
import { arquivosDaMarca, avaliarContraste, carregarIdentidades, esquemaFormularioIdentidade, formularioDaIdentidade, redesDaMarca, salvarIdentidade, TIPOS_DE_APLICACAO, TIPOS_DE_LOGO, type DadosDasMarcas, type FormularioIdentidade } from '@/dominio/identidade-marcas';
import { formatarNumero } from '@/lib/formatacao';
import { cn } from '@/lib/utils';

/** Paleta sem texto: mostra a cor sempre com nome e hex, nunca só a cor (CA-18.07). */
function Paleta({ identidade }: { identidade: MarcaIdentidade }) {
  return (
    <ul aria-label="Paleta" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {identidade.paleta.map((cor) => (
        <li key={`${cor.nome}${cor.hex}`} className="overflow-hidden rounded-md border border-line bg-paper">
          <span className="block h-16 border-b border-line" style={{ backgroundColor: cor.hex }} aria-hidden />
          <span className="grid gap-0.5 p-2.5 text-xs">
            <span className="font-semibold">{cor.nome}</span>
            <span className="text-ink-soft tabular-nums">{cor.hex}</span>
            {cor.uso && <span className="text-ink-soft">{cor.uso}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** T08.04: validação de contraste para combinações de texto e fundo. */
function ConferirContraste({ identidade }: { identidade: MarcaIdentidade }) {
  const [texto, setTexto] = useState(identidade.paleta.find((cor) => cor.nome === 'Espresso')?.hex ?? identidade.paleta[0]?.hex ?? '#000000');
  const [fundo, setFundo] = useState(identidade.paleta.find((cor) => cor.nome === 'Linho')?.hex ?? identidade.paleta[1]?.hex ?? '#FFFFFF');
  const resultado = avaliarContraste(texto, fundo);
  const tipo = resultado.nivel === 'suficiente' ? 'sucesso' : resultado.nivel === 'so_texto_grande' ? 'atencao' : 'erro';
  const Icone = resultado.nivel === 'suficiente' ? CircleCheck : resultado.nivel === 'so_texto_grande' ? TriangleAlert : CircleAlert;
  const opcoes = identidade.paleta.map((cor) => (
    <option key={`${cor.nome}${cor.hex}`} value={cor.hex}>
      {cor.nome}
    </option>
  ));
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-paper p-4 md:grid-cols-2">
      <div className="grid content-start gap-3">
        <h3>Conferir contraste</h3>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="contraste-texto" rotulo="Texto">
            {(controle) => (
              <Selecao {...controle} value={texto} onChange={(evento) => setTexto(evento.target.value)}>
                {opcoes}
              </Selecao>
            )}
          </Campo>
          <Campo id="contraste-fundo" rotulo="Fundo">
            {(controle) => (
              <Selecao {...controle} value={fundo} onChange={(evento) => setFundo(evento.target.value)}>
                {opcoes}
              </Selecao>
            )}
          </Campo>
        </div>
        <div aria-live="polite" className="[&>span]:whitespace-normal">
          <EtiquetaSituacao tipo={tipo} icone={Icone}>
            {resultado.rotulo} ({formatarNumero(Math.round(resultado.razao * 10) / 10)}:1)
          </EtiquetaSituacao>
        </div>
      </div>
      <div className="rounded-md border border-line p-4" style={{ backgroundColor: fundo, color: texto }}>
        <p className="text-[17px] font-semibold">Exemplo de aplicação</p>
        <p className="mt-1 text-sm">Texto de apoio com estas duas cores.</p>
      </div>
    </div>
  );
}

function TextoOuVazio({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <p className="text-[13px] text-ink-soft">{rotulo}</p>
      <div className="mt-0.5 text-sm break-words">{children || <span className="text-ink-soft">Não informado</span>}</div>
    </div>
  );
}

const lista = (itens: readonly string[]) =>
  itens.length ? (
    <ul className="list-disc pl-4">
      {itens.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : null;

function ArquivosDaMarca({ arquivos, vazio }: { arquivos: readonly Arquivo[]; vazio: string }) {
  if (!arquivos.length) {
    return (
      <p className="text-sm text-ink-soft">
        {vazio}{' '}
        <LinkCentral href="/marketing?novo=1" className="inline-flex min-h-11 items-center underline md:min-h-0">
          Adicionar à biblioteca
        </LinkCentral>
      </p>
    );
  }
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {arquivos.map((arquivo) => (
        <li key={arquivo.id} className="flex items-center gap-3 rounded-md border border-line bg-paper p-3 text-[13px]">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-mist text-ink-soft">
            <IconeDoTipo tipo={arquivo.tipo} className="size-5" />
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <LinkCentral href={`/marketing/arquivos/${arquivo.id}`} className="font-semibold break-words hover:underline">
              {arquivo.titulo}
            </LinkCentral>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
              v{arquivo.versao_atual} <EtiquetaClasse classe={arquivo.classe} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function IdentidadeDaMarca({ marca, identidade, dados }: { marca: Marca; identidade: MarcaIdentidade | null; dados: DadosDasMarcas }) {
  const [editando, setEditando] = useState(false);
  const logos = useMemo(() => arquivosDaMarca(marca, TIPOS_DE_LOGO, dados), [marca, dados]);
  const aplicacoes = useMemo(() => arquivosDaMarca(marca, TIPOS_DE_APLICACAO, dados), [marca, dados]);
  const redes = useMemo(() => redesDaMarca(marca, dados), [marca, dados]);
  return (
    <section aria-label={`Identidade de ${marca.nome}`} className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="size-3.5 rounded-full" style={{ backgroundColor: marca.cor_hex }} aria-hidden />
          <h2>{marca.institucional ? `${marca.nome} institucional` : marca.nome}</h2>
          {marca.provisorio && <span className="rounded-pill bg-mist px-2 py-0.5 text-xs font-semibold text-ink-soft">Nome provisório</span>}
        </div>
        <Button onClick={() => setEditando(true)}>
          <Pencil aria-hidden />
          Editar identidade
        </Button>
      </div>
      {!identidade && <Faixa className="mt-4">A identidade desta marca ainda não foi preenchida. A cor vem do cadastro de marcas.</Faixa>}
      <Tabs defaultValue="essencia" className="mt-4">
        <TabsList aria-label={`Seções da identidade de ${marca.nome}`}>
          <TabsTrigger value="essencia">Essência</TabsTrigger>
          <TabsTrigger value="cores">Cores</TabsTrigger>
          <TabsTrigger value="tipografia">Tipografia</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="aplicacoes">Aplicações</TabsTrigger>
          <TabsTrigger value="redes">Redes e handles</TabsTrigger>
        </TabsList>
        <TabsContent value="essencia" className="mt-4">
          <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
            <TextoOuVazio rotulo="Proposta">{identidade?.proposta}</TextoOuVazio>
            <TextoOuVazio rotulo="Público">{identidade?.publico}</TextoOuVazio>
            <TextoOuVazio rotulo="Personalidade">{identidade?.personalidade}</TextoOuVazio>
            <TextoOuVazio rotulo="Tom de voz: faça">{lista(identidade?.tom_faca ?? [])}</TextoOuVazio>
            <TextoOuVazio rotulo="Tom de voz: não faça">{lista(identidade?.tom_nao_faca ?? [])}</TextoOuVazio>
            <TextoOuVazio rotulo="Frases-chave">{lista(identidade?.frases ?? [])}</TextoOuVazio>
            <TextoOuVazio rotulo="Manual completo">
              {identidade?.manual_url && (
                <a href={identidade.manual_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 underline md:min-h-0 [&_svg]:size-[14px]">
                  <ExternalLink aria-hidden />
                  Abrir o manual no Drive
                </a>
              )}
            </TextoOuVazio>
          </div>
        </TabsContent>
        <TabsContent value="cores" className="mt-4 grid gap-4">
          {identidade?.paleta.length ? (
            <>
              <Paleta identidade={identidade} />
              <ConferirContraste key={marca.id} identidade={identidade} />
            </>
          ) : (
            <EstadoVazio icone={Palette} titulo="Nenhuma cor na paleta." texto="Acrescente as cores da marca para conferir o contraste." />
          )}
        </TabsContent>
        <TabsContent value="tipografia" className="mt-4">
          {identidade?.tipografia.length ? (
            <ul className="grid gap-2">
              {identidade.tipografia.map((fonte) => (
                <li key={fonte.fonte} className="rounded-md border border-line bg-paper p-3.5 text-[13px]">
                  <p className="font-semibold">{fonte.fonte}</p>
                  {fonte.pesos && <p className="text-ink-soft">Pesos: {fonte.pesos}</p>}
                  {fonte.uso && <p className="mt-1">{fonte.uso}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nenhuma fonte cadastrada.</p>
          )}
        </TabsContent>
        <TabsContent value="logos" className="mt-4 grid gap-3">
          <ArquivosDaMarca arquivos={logos} vazio="Nenhum logo na biblioteca para esta marca." />
          <p className="flex items-start gap-2 text-xs text-ink-soft">
            <Stamp className="mt-px size-3.5 shrink-0" aria-hidden />
            Logos e aplicações são os mesmos itens da biblioteca: nada é duplicado.
          </p>
        </TabsContent>
        <TabsContent value="aplicacoes" className="mt-4">
          <ArquivosDaMarca arquivos={aplicacoes} vazio="Nenhuma imagem, vídeo ou print na biblioteca para esta marca." />
        </TabsContent>
        <TabsContent value="redes" className="mt-4 grid gap-3">
          {redes.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {redes.map((ativo) => (
                <li key={ativo.id} className="flex items-center gap-3 rounded-md border border-line bg-paper p-3 text-[13px]">
                  <AtSign className="size-5 shrink-0 text-ink-soft" aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <LinkCentral href={`/ferramentas/ativos/${ativo.id}`} className="font-semibold break-words hover:underline">
                      {ativo.identificador}
                    </LinkCentral>
                    <span className="text-xs text-ink-soft">Transferência: {ROTULOS_TRANSFERENCIA[ativo.transferencia_situacao]}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">
              Nenhum perfil de rede social cadastrado para esta marca.{' '}
              <LinkCentral href="/ferramentas/ativos" className="inline-flex min-h-11 items-center underline md:min-h-0">
                Cadastrar em Ativos digitais
              </LinkCentral>
            </p>
          )}
        </TabsContent>
      </Tabs>
      {editando && <FormularioDaIdentidade marca={marca} identidade={identidade} aoFechar={() => setEditando(false)} />}
    </section>
  );
}

type AbaDaEdicao = 'essencia' | 'cores' | 'tipografia';

function FormularioDaIdentidade({ marca, identidade, aoFechar }: { marca: Marca; identidade: MarcaIdentidade | null; aoFechar: () => void }) {
  const inicial = useMemo(() => formularioDaIdentidade(identidade), [identidade]);
  const { register, handleSubmit, control, reset, formState } = useForm<FormularioIdentidade>({ resolver: zodResolver(esquemaFormularioIdentidade), defaultValues: inicial, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const cores = useFieldArray({ control, name: 'paleta' });
  const fontes = useFieldArray({ control, name: 'tipografia' });
  const [aba, setAba] = useState<AbaDaEdicao>('essencia');

  useEffect(() => reset(inicial), [inicial, reset]);

  const enviar = handleSubmit(
    async (formulario) => {
      try {
        await salvarIdentidade(marca.id, formulario);
        aviso('Identidade salva.');
        aoFechar();
      } catch (erro) {
        aviso(mensagemDoErro(erro));
      }
    },
    (falhas) => setAba(falhas.manual_url ? 'essencia' : falhas.paleta ? 'cores' : falhas.tipografia ? 'tipografia' : 'essencia'),
  );

  return (
    <JanelaFormulario larga aberto aoFechar={aoFechar} titulo={`Editar identidade de ${marca.nome}`} alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} salvando={isSubmitting}>
      <AbasDoFormulario
        rotulo="Seções da identidade"
        ativa={aba}
        aoMudar={setAba}
        abas={[
          {
            id: 'essencia',
            rotulo: 'Essência',
            erros: errors.manual_url ? 1 : 0,
            conteudo: (
              <>
                <Campo id="identidade-proposta" rotulo="Proposta">
                  {(controle) => <Textarea {...controle} {...register('proposta')} />}
                </Campo>
                <Campo id="identidade-publico" rotulo="Público">
                  {(controle) => <Input autoComplete="off" {...controle} {...register('publico')} />}
                </Campo>
                <Campo id="identidade-personalidade" rotulo="Personalidade">
                  {(controle) => <Textarea {...controle} {...register('personalidade')} />}
                </Campo>
                <div className="grid gap-[18px] md:grid-cols-2">
                  <Campo id="identidade-faca" rotulo="Tom de voz: faça" ajuda="Um item por linha.">
                    {(controle) => <Textarea {...controle} {...register('tom_faca')} />}
                  </Campo>
                  <Campo id="identidade-nao-faca" rotulo="Tom de voz: não faça" ajuda="Um item por linha.">
                    {(controle) => <Textarea {...controle} {...register('tom_nao_faca')} />}
                  </Campo>
                </div>
                <Campo id="identidade-frases" rotulo="Frases-chave" ajuda="Uma por linha.">
                  {(controle) => <Textarea {...controle} {...register('frases')} />}
                </Campo>
                <Controller
                  control={control}
                  name="manual_url"
                  render={({ field }) => (
                    <Campo id="identidade-manual" rotulo="Manual completo no Drive" erro={errors.manual_url?.message}>
                      {(controle) => <EntradaLinkDrive link={field.value ?? ''} {...controle} {...field} />}
                    </Campo>
                  )}
                />
              </>
            ),
          },
          {
            id: 'cores',
            rotulo: 'Cores',
            erros: errors.paleta ? 1 : 0,
            conteudo: (
              <>
                {cores.fields.map((campo, indice) => (
                  <fieldset key={campo.id} className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-[1fr_130px_1.4fr_auto] md:items-end">
                    <legend className="sr-only">Cor {indice + 1}</legend>
                    <Campo id={`cor-nome-${indice}`} rotulo="Nome" erro={errors.paleta?.[indice]?.nome?.message}>
                      {(controle) => <Input autoComplete="off" {...controle} {...register(`paleta.${indice}.nome`)} />}
                    </Campo>
                    <Campo id={`cor-hex-${indice}`} rotulo="Hex" erro={errors.paleta?.[indice]?.hex?.message}>
                      {(controle) => <Input autoComplete="off" spellCheck={false} {...controle} {...register(`paleta.${indice}.hex`)} />}
                    </Campo>
                    <Campo id={`cor-uso-${indice}`} rotulo="Uso">
                      {(controle) => <Input autoComplete="off" {...controle} {...register(`paleta.${indice}.uso`)} />}
                    </Campo>
                    <Button variante="icone" tamanho="icone" aria-label={`Tirar a cor ${indice + 1}`} onClick={() => cores.remove(indice)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </fieldset>
                ))}
                <Button variante="secundario" className="justify-self-start" onClick={() => cores.append({ nome: '', hex: marca.cor_hex, uso: '' })}>
                  <Plus aria-hidden />
                  Acrescentar cor
                </Button>
              </>
            ),
          },
          {
            id: 'tipografia',
            rotulo: 'Tipografia',
            erros: errors.tipografia ? 1 : 0,
            conteudo: (
              <>
                {fontes.fields.map((campo, indice) => (
                  <fieldset key={campo.id} className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-[1fr_130px_1.4fr_auto] md:items-end">
                    <legend className="sr-only">Fonte {indice + 1}</legend>
                    <Campo id={`fonte-nome-${indice}`} rotulo="Fonte" erro={errors.tipografia?.[indice]?.fonte?.message}>
                      {(controle) => <Input autoComplete="off" {...controle} {...register(`tipografia.${indice}.fonte`)} />}
                    </Campo>
                    <Campo id={`fonte-pesos-${indice}`} rotulo="Pesos">
                      {(controle) => <Input autoComplete="off" {...controle} {...register(`tipografia.${indice}.pesos`)} />}
                    </Campo>
                    <Campo id={`fonte-uso-${indice}`} rotulo="Uso">
                      {(controle) => <Input autoComplete="off" {...controle} {...register(`tipografia.${indice}.uso`)} />}
                    </Campo>
                    <Button variante="icone" tamanho="icone" aria-label={`Tirar a fonte ${indice + 1}`} onClick={() => fontes.remove(indice)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </fieldset>
                ))}
                <Button variante="secundario" className="justify-self-start" onClick={() => fontes.append({ fonte: '', pesos: '', uso: '' })}>
                  <Plus aria-hidden />
                  Acrescentar fonte
                </Button>
              </>
            ),
          },
        ]}
      />
    </JanelaFormulario>
  );
}

/** T08.04: uma página por marca, sobre o cadastro único de T02.04. */
export function TelaMarcas() {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const consulta = useConsulta(carregarIdentidades);
  const dados = consulta.dados;
  const escolhida = parametros.get('marca');

  const cabecalho = <CabecalhoPagina kicker={KICKER_MARKETING} titulo="Identidade das marcas" resumo="Uma referência clara para cada marca. Marcas e produtos são cadastrados em Configurações." />;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        {cabecalho}
        <AbasMarketing ativa="marcas" />
        <EstadoErro className="mt-5" titulo="Não deu para ler as marcas." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const marcas = [...dados.marcas].sort((a, b) => Number(b.institucional) - Number(a.institucional) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const marca = marcas.find((item) => item.id === escolhida) ?? marcas[0];

  return (
    <div>
      {cabecalho}
      <AbasMarketing ativa="marcas" />
      {!marca ? (
        <EstadoVazio className="mt-5" icone={Palette} titulo="Nenhuma marca cadastrada." texto="Cadastre em Configurações › Marcas e produtos." />
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Marcas" className="faixa-rolagem flex gap-1.5 lg:grid lg:content-start lg:gap-1">
            {marcas.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={item.id === marca.id ? 'page' : undefined}
                onClick={() => roteador.replace(`/marketing/marcas?marca=${item.id}`, { scroll: false })}
                className={cn('inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill px-3.5 text-left text-[13px] font-semibold lg:rounded-md', item.id === marca.id ? 'bg-active text-ink' : 'text-ink-soft hover:bg-hover')}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor_hex }} aria-hidden />
                {item.nome}
              </button>
            ))}
          </nav>
          <IdentidadeDaMarca key={marca.id} marca={marca} identidade={dados.identidades.find((item) => item.marca_id === marca.id) ?? null} dados={dados} />
        </div>
      )}
    </div>
  );
}
