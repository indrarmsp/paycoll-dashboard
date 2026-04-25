import { redirect } from 'next/navigation';
import { getServerSession } from '../lib/server-auth';

export default async function HomePage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  redirect(session.role === 'ar' ? '/dashboard-ar' : '/dashboard');
}