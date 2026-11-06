import type { Metadata } from 'next';
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cross Poker',
  description: 'Poker em duplas, pontuado com fichas e multiplicadores. Junte três amigos e jogue no navegador, sem cadastro.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" />

        <link
          rel="preconnect"
          href="https://api.fontshare.com"
        />

        <link
          rel="preconnect"
          href="https://cdn.fontshare.com"
          crossOrigin="anonymous"
        />

        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=boska@400,401,500,501&f[]=satoshi@400,500,700&display=swap"
        />
      </head>

      <body className="min-h-screen flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
