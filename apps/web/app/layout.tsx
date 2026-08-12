import type { Metadata } from 'next';
import './globals.css';
import { APP } from '@pos/shared/constants/empresa';

export const metadata: Metadata = {
  title: APP.nombre,
  description: 'Sistema de gestión de ventas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}