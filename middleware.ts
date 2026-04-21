import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildFingerprintFromHeaders, decodeSession, getRedirectPath, isSessionValid, SESSION_COOKIE_NAME } from './lib/auth';

const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/logout', '/api/sheets/main', '/api/sheets/ar']);
const PROTECTED_PREFIXES = ['/dashboard', '/shortcuts', '/dashboard-ar'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    PUBLIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const rawSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(rawSession);
  const fingerprint = buildFingerprintFromHeaders(request.headers);
  const isValid = isSessionValid(session, fingerprint);

  if (pathname === '/login') {
    if (isValid && session) {
      return NextResponse.redirect(new URL(getRedirectPath(session.role), request.url));
    }

    return NextResponse.next();
  }

  if (pathname === '/') {
    if (isValid && session) {
      return NextResponse.redirect(new URL(getRedirectPath(session.role), request.url));
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isValid || !session) {
      return NextResponse.redirect(new URL('/login?reason=unauthorized', request.url));
    }

    if (pathname === '/shortcuts' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login?reason=unauthorized', request.url));
    }

    if (pathname === '/dashboard' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login?reason=unauthorized', request.url));
    }

    if (pathname === '/dashboard-ar' && session.role !== 'ar' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login?reason=unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};