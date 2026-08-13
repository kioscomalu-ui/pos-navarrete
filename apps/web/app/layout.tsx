import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP, EMPRESA } from '@pos/shared/constants/empresa';
import { RegistrarSW } from '@/components/RegistrarSW';

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
    statusBarStyle: 'default',
    title: APP.nombreCorto,
  },
  formatDetection: {
    telephone: false,
  },
  // No queremos que el sistema quede indexado
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#171717',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}