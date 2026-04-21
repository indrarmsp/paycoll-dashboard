import { AppShell } from '../../components/app-shell';
import { ShortcutsClient } from '../../components/shortcuts-client';
import { requireServerSession } from '../../lib/server-auth';

export default async function ShortcutsPage() {
  await requireServerSession(['admin']);

  return (
    <AppShell
      sidebarTitle="Payment Collective"
      headerTitle="Shortcuts"
      avatarLabel="Admin"
      avatarName="Admin"
      navItems={[
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', active: false },
        { href: '/shortcuts', label: 'Shortcuts', icon: 'shortcuts', active: true },
        { href: '/dashboard-ar', label: 'Visit AR', icon: 'ar', active: false }
      ]}
    >
      <ShortcutsClient />
    </AppShell>
  );
}