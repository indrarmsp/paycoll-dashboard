import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { buildFingerprintFromHeaders, decodeSession, getRedirectPath, isSessionValid, SESSION_COOKIE_NAME } from '../../../../lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({} as { source?: string }));
  const source = typeof body.source === 'string' ? body.source : '';
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(rawValue);
  const requestHeaders = await headers();
  const fingerprint = buildFingerprintFromHeaders(requestHeaders);
  const shouldReturnToDashboard = source === '/dashboard-ar' && session?.role === 'admin' && isSessionValid(session, fingerprint);

  if (shouldReturnToDashboard) {
    return NextResponse.json({ ok: true, redirectTo: getRedirectPath('admin') });
  }

  const response = NextResponse.json({ ok: true, redirectTo: '/login?reason=logged_out' });
  response.cookies.set({
    name: 'pc_session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0)
  });

  return response;
}