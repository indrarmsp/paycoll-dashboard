import type { Role } from './types';

// Builds the standard admin sidebar order with a single active tab.
export function buildAdminNavItems(active: 'dashboard' | 'update' | 'shortcuts' | 'ar') {
  return [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' as const, active: active === 'dashboard' },
    { href: '/update', label: 'Update', icon: 'update' as const, active: active === 'update' },
    { href: '/shortcuts', label: 'Shortcuts', icon: 'shortcuts' as const, active: active === 'shortcuts' },
    { href: '/dashboard-ar', label: 'Visit AR', icon: 'ar' as const, active: active === 'ar' }
  ];
}

// AR users only see Visit AR, while admin keeps the full menu.
export function buildDashboardArNavItems(role: Role) {
  if (role === 'admin') {
    return buildAdminNavItems('ar');
  }

  return [{ href: '/dashboard-ar', label: 'Visit AR', icon: 'ar' as const, active: true }];
}
