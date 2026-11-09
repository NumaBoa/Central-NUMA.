import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { manuaisPublicados, manualPorSlug } from '@/ajuda/modulos';
import { PaginaDoArtigo } from '@/componentes/ajuda/paginas';

export const dynamicParams = false;

export function generateStaticParams() {
  return manuaisPublicados().flatMap((manual) => manual.artigos.map((artigo) => ({ modulo: manual.slug, artigo: artigo.id })));
}

type Parametros = { params: Promise<{ modulo: string; artigo: string }> };

async function encontrar({ params }: Parametros) {
  const { modulo, artigo: id } = await params;
  const manual = manualPorSlug(modulo);
  const artigo = manual?.artigos.find((item) => item.id === id);
  return manual && artigo ? { manual, artigo } : null;
}

export async function generateMetadata(props: Parametros): Promise<Metadata> {
  const achado = await encontrar(props);
  return { title: achado ? `${achado.artigo.titulo} · Como usar` : 'Como usar' };
}

export default async function ArtigoDoManual(props: Parametros) {
  const achado = await encontrar(props);
  if (!achado) notFound();
  return <PaginaDoArtigo manual={achado.manual} artigo={achado.artigo} />;
}
