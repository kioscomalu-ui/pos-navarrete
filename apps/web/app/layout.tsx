import type { Metadata, Viewport } from 'next';
import { Chivo, Chivo_Mono } from 'next/font/google';
import './globals.css';
import { APP, EMPRESA } from '@pos/shared/constants/empresa';
import { RegistrarSW } from '@/components/RegistrarSW';

// Chivo y Chivo Mono son de Omnibus-Type, fundidora argentina.
// Chivo se diseñó para señalética de alta legibilidad, que es
// exactamente el problema de una pantalla de caja.
const chivo = Chivo({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--fuente-ui',
  display: 'swap',
});

const chivoMono = Chivo_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--fuente-num',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: APP.nombre,
    template: `%s · ${APP.nombreCorto}`,
  },
  description: `Sistema de gestión de ventas de ${EMPRESA.razonSocial}`,
  manifest: '/manifest.json',
  applicationName: APP.nombreCorto,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP.nombreCorto,
  },
  // Evita que iOS convierta los importes en enlaces telefónicos
  formatDetection: {
    telephone: false,
  },
  // El sistema es interno: no tiene por qué aparecer en buscadores
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#16332B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Sin zoom accidental al tocar un campo numérico
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es-AR"
      className={`${chivo.variable} ${chivoMono.variable}`}
    >
      <body className="bg-papel text-verde-esmalte antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}