import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { buildFingerprintFromHeaders, decodeSession, getRedirectPath, isSessionValid, SESSION_COOKIE_NAME } from './auth';
import type { Role, SessionData } from './types';

export async function getServerSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(rawValue);
  const requestHeaders = await headers();
  const fingerprint = buildFingerprintFromHeaders(requestHeaders);

  if (!isSessionValid(session, fingerprint)) {
    return null;
  }

  return session;
}

export async function requireServerSession(allowedRoles: Role[]) {
  const session = await getServerSession();
  if (!session || !allowedRoles.includes(session.role)) {
    redirect('/login?reason=unauthorized');
  }

  return session;
}

export async function redirectIfAuthed() {
  const session = await getServerSession();
  if (session) {
    redirect(getRedirectPath(session.role));
  }
}