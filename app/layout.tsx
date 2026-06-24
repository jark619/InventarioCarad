import './globals.css';
import { AppHeader } from '@/components/app-header';
import { ServiceWorker } from '@/components/service-worker';

export const metadata = { title: 'SGI Inventario', description: 'Inventario y punto de venta', manifest: '/manifest.webmanifest' };
export const viewport = { themeColor: '#2563eb', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><ServiceWorker /><AppHeader />{children}</body></html>;
}
