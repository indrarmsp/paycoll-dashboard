import { AppShell } from '../../components/app-shell';
import { DashboardClient } from '../../components/dashboard-client';
import { requireServerSession } from '../../lib/server-auth';
import { getMainDashboardBootstrap } from '../../lib/sheets';

export default async function DashboardPage() {
  const session = await requireServerSession(['admin']);
  const initialData = await getMainDashboardBootstrap();

  return (
    <AppShell
      sidebarTitle="Payment Collective"
      headerTitle="Dashboard"
      avatarLabel="Admin"
      avatarName="Admin"
      navItems={[
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', active: true },
        { href: '/shortcuts', label: 'Shortcuts', icon: 'shortcuts', active: false },
        { href: '/dashboard-ar', label: 'Visit AR', icon: 'ar', active: false }
      ]}
    >
      <DashboardClient username={session.username} initialData={initialData} />
    </AppShell>
  );
}