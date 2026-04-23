import Link from 'next/link';
import { ChartLine, Link2, MapPinned, RotateCcw } from 'lucide-react';
import { LogoutButton } from './logout-button';
import type { ReactNode } from 'react';

type NavItem = {
  href: string;
  label: string;
  icon: 'dashboard' | 'shortcuts' | 'ar' | 'update';
  active: boolean;
};

function NavIcon({ icon }: { icon: NavItem['icon'] }) {
  const className = 'w-5 mr-3';

  if (icon === 'shortcuts') {
    return <Link2 className={className} />;
  }

  if (icon === 'ar') {
    return <MapPinned className={className} />;
  }

  if (icon === 'update') {
    return <RotateCcw className={className} />;
  }

  return <ChartLine className={className} />;
}

export function AppShell({
  sidebarTitle,
  headerTitle,
  avatarLabel,
  avatarName,
  navItems,
  children
}: {
  sidebarTitle: string;
  headerTitle: string;
  avatarLabel: string;
  avatarName: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
      <aside className="z-20 flex h-full w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <span className="text-lg font-bold tracking-tight text-slate-800">{sidebarTitle}</span>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center rounded-xl px-4 py-3 font-medium transition-colors',
                item.active ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              ].join(' ')}
            >
              <NavIcon icon={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <LogoutButton className="flex items-center rounded-xl px-4 py-3 font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600" />
        </div>
      </aside>

      <main className="relative flex h-full flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <h1 className="text-2xl font-bold text-slate-800">{headerTitle}</h1>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-brand-500 bg-slate-200 shadow-sm">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=0D8ABC&color=fff`}
                alt={avatarName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-slate-700">{avatarLabel}</p>
            </div>
          </div>
        </header>
        <div className="relative flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}