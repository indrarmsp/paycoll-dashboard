import { NextRequest, NextResponse } from 'next/server';
import { buildFingerprintFromHeaders, createSession, encodeSession, getLoginCredentials, getRedirectPath } from '../../../../lib/auth';
import type { Role } from '../../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { mode?: Role; username?: string; password?: string };
    const mode = body.mode === 'ar' ? 'ar' : 'admin';
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const credentials = getLoginCredentials(mode);

    if (!username || !password) {
      return NextResponse.json({ ok: false, message: 'Please enter username and password' }, { status: 400 });
    }

    if (!credentials.username || !credentials.password) {
      return NextResponse.json({ ok: false, message: 'Login credentials are not configured' }, { status: 500 });
    }

    if (username.length > 50 || password.length > 100) {
      return NextResponse.json({ ok: false, message: 'Input is too long' }, { status: 400 });
    }

    if (username !== credentials.username || password !== credentials.password) {
      return NextResponse.json({ ok: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const fingerprint = buildFingerprintFromHeaders(request.headers);
    const session = createSession(mode, username, fingerprint);
    const response = NextResponse.json({ ok: true, redirectTo: getRedirectPath(mode) });

    response.cookies.set({
      name: 'pc_session',
      value: encodeSession(session),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(session.expiresAt)
    });

    return response;
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to sign in' }, { status: 500 });
  }
}