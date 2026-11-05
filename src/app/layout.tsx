import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { CentralProvider } from '@/componentes/layout/central-provider';
import { Estrutura } from '@/componentes/layout/estrutura';
import './globals.css';
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
export const metadata: Metadata = { title: 'Central Numa · Numa boa, tudo em ordem.', description: 'O espaço da Numa para organizar a empresa, os produtos e o dia a dia.', icons: { icon: '/icon.svg' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F8F6F2' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body className={`${bricolage.variable} ${instrument.variable}`}><CentralProvider><Estrutura>{children}</Estrutura></CentralProvider></body></html>; }
