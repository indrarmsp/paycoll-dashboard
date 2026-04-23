import { AppShell } from '../../components/app-shell';
import { DashboardClient } from '../../components/dashboard-client';
import { buildAdminNavItems } from '../../lib/nav-items';
import { requireServerSession } from '../../lib/server-auth';
import { getMainDashboardBootstrap } from '../../lib/sheets';

export default async function DashboardPage() {
  await requireServerSession(['admin']);
  const initialData = await getMainDashboardBootstrap();

  return (
    <AppShell
      sidebarTitle="Payment Collective"
      headerTitle="Dashboard"
      avatarLabel="Admin"
      avatarName="Admin"
      navItems={buildAdminNavItems('dashboard')}
    >
      <DashboardClient initialData={initialData} />
    </AppShell>
  );
}