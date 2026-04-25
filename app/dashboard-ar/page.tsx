import { AppShell } from '../../components/app-shell';
import { DashboardARClient } from '../../components/dashboard-ar-client';
import { buildDashboardArNavItems } from '../../lib/nav-items';
import { requireServerSession } from '../../lib/server-auth';
import { getARDashboardBootstrap } from '../../lib/sheets';

export default async function DashboardARPage() {
  const session = await requireServerSession(['admin', 'ar']);
  const initialData = await getARDashboardBootstrap();

  return (
    <AppShell
      sidebarTitle="AR Dashboard"
      headerTitle="Visit Data"
      avatarLabel={session.role === 'ar' ? 'AR' : 'Admin'}
      avatarName={session.role === 'ar' ? 'Agent AR' : 'Admin'}
      navItems={buildDashboardArNavItems(session.role)}
    >
      <DashboardARClient initialData={initialData} />
    </AppShell>
  );
}