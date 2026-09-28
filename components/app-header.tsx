'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SessionStatus } from '@/components/session-status';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type Role = Database['public']['Enums']['app_role'];
type NavigationItem = { href: string; label: string; roles?: Role[] };

const navigation: NavigationItem[] = [
  { href: '/', label: 'Inicio', roles: ['admin', 'inventory', 'cashier'] },
  { href: '/inventory', label: 'Inventario', roles: ['admin', 'inventory'] },
  { href: '/pos', label: 'Caja', roles: ['admin', 'cashier'] },
  { href: '/reports', label: 'Reportes', roles: ['admin', 'inventory'] },
  { href: '/promotions', label: 'Promociones', roles: ['admin'] },
  { href: '/stores', label: 'Tiendas', roles: ['admin'] },
  { href: '/team', label: 'Colaboradores', roles: ['admin'] },
  { href: '/profile', label: 'Mi perfil', roles: ['admin', 'inventory', 'cashier'] },
];

export function AppHeader() {
  const pathname = usePathname();
  const [hasPlan, setHasPlan] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const client = supabase();
    let active = true;
    let requestId = 0;

    const clearAccess = () => {
      requestId += 1;
      setHasPlan(false);
      setRole(null);
      setMenuOpen(false);
    };

    const loadAccess = async () => {
      const currentRequest = ++requestId;
      const { data: { user } } = await client.auth.getUser();
      if (!active || currentRequest !== requestId) return;
      if (!user) {
        clearAccess();
        return;
      }

      const { data } = await client.from('profiles').select('role,tenants(subscription_status)').eq('id', user.id).single() as { data: { role: Role | null; tenants: { subscription_status?: string } | null } | null };
      if (!active || currentRequest !== requestId) return;
      setHasPlan(data?.tenants?.subscription_status === 'active');
      setRole(data?.role ?? null);
    };

    void loadAccess();
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        clearAccess();
        return;
      }
      void loadAccess();
    });

    return () => {
      active = false;
      requestId += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const activeLink = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);
  const visibleNavigation = navigation.filter(item => {
    if (!role) return false;
    return item.roles?.includes(role) ?? false;
  });

  return <header className="border-b border-slate-200 bg-white shadow-sm shadow-slate-200/40">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:flex-nowrap sm:gap-3 sm:px-5">
      <Link href="/" className="flex shrink-0 items-center gap-2 font-bold text-slate-950">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-sm text-white">SG</span>
        <span className="hidden sm:block">SGI Inventario</span>
      </Link>

      {hasPlan && <>
        <nav className="hidden items-center gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium lg:flex" aria-label="Navegación principal">
          {visibleNavigation.map(item => <NavigationLink key={item.href} href={item.href} label={item.label} active={activeLink(item.href)} />)}
        </nav>
        <button type="button" className="order-3 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:order-none sm:w-auto lg:hidden" aria-controls="mobile-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
      </>}

      <div className="ml-auto flex items-center gap-3">
        {!hasPlan && <Link href="/pricing" className="hidden text-sm text-slate-600 hover:text-blue-600 sm:block">Planes</Link>}
        <SessionStatus />
      </div>
    </div>

    {hasPlan && menuOpen && <nav id="mobile-navigation" className="border-t border-slate-100 px-5 py-3 lg:hidden" aria-label="Navegación móvil">
      <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
        {visibleNavigation.map(item => <NavigationLink key={item.href} href={item.href} label={item.label} active={activeLink(item.href)} mobile />)}
      </div>
    </nav>}
  </header>;
}

function NavigationLink({ href, label, active, mobile = false }: { href: string; label: string; active: boolean; mobile?: boolean }) {
  return <Link href={href} className={`rounded-lg px-3 py-2 transition ${mobile ? 'text-sm' : ''} ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-950'}`}>{label}</Link>;
}
