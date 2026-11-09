import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { manuaisPublicados, manualPorSlug } from '@/ajuda/modulos';
import { InicioDoManual } from '@/componentes/ajuda/paginas';

export const dynamicParams = false;

export function generateStaticParams() {
  return manuaisPublicados().map((manual) => ({ modulo: manual.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }): Promise<Metadata> {
  const manual = manualPorSlug((await params).modulo);
  return { title: manual ? `Como usar · ${manual.nome}` : 'Como usar' };
}

export default async function Manual({ params }: { params: Promise<{ modulo: string }> }) {
  const manual = manualPorSlug((await params).modulo);
  if (!manual) notFound();
  return <InicioDoManual manual={manual} />;
}
