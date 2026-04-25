import { AppShell } from '../../components/app-shell';
import { ShortcutsClient } from '../../components/shortcuts-client';
import { buildAdminNavItems } from '../../lib/nav-items';
import { requireServerSession } from '../../lib/server-auth';

export default async function ShortcutsPage() {
  await requireServerSession(['admin']);

  return (
    <AppShell
      sidebarTitle="Payment Collective"
      headerTitle="Shortcuts"
      avatarLabel="Admin"
      avatarName="Admin"
      navItems={buildAdminNavItems('shortcuts')}
    >
      <ShortcutsClient />
    </AppShell>
  );
}