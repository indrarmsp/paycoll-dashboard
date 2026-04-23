import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '../../../../lib/auth';

// Clears the session cookie and always redirects clients to the login page.
export async function POST() {

  const response = NextResponse.json({ ok: true, redirectTo: '/login?reason=logged_out' });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0)
  });

  return response;
}