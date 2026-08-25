import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import SessionProvider from '@/components/shared/SessionProvider';
import AccessibilityProvider from '@/components/shared/AccessibilityProvider';
import { LangProvider } from '@/lib/i18n';
import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600', '700'] });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'EduVision — Smart Academic Intelligence Platform | SIH 2026',
  description: 'Clean, intelligent academic dashboard for student learning, attendance tracking, and institutional insights.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'EduVision' },
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" data-scroll-behavior="smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EduVision" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.className} bg-[var(--ev-bg)] text-[var(--ev-text)] min-h-screen antialiased selection:bg-[#4F46E5]/10 selection:text-[#0F172A]`}>
        <SessionProvider>
          <LangProvider>
            <AccessibilityProvider />
            <ServiceWorkerRegistrar />
            {children}
          </LangProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
