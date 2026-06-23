import './globals.css';
import { ServiceWorker } from '@/components/service-worker';

export const metadata = { title: 'SGI Inventario', description: 'Inventario y punto de venta', manifest: '/manifest.webmanifest' };
export const viewport = { themeColor: '#4f46e5', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><ServiceWorker />{children}</body></html>;
}
