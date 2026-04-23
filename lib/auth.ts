import type { Role, SessionData } from './types';

export const SESSION_COOKIE_NAME = 'pc_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Reads and trims credentials from environment variables.
function readEnvValue(name: string) {
  return process.env[name]?.trim() || '';
}

// Maps a role to the corresponding login credentials.
export function getLoginCredentials(role: Role) {
  const prefix = role === 'ar' ? 'PC_AR' : 'PC_ADMIN';
  return {
    username: readEnvValue(`${prefix}_USERNAME`),
    password: readEnvValue(`${prefix}_PASSWORD`)
  };
}

// Creates a lightweight device fingerprint from stable headers.
export function buildFingerprint(userAgent = '', acceptLanguage = '', platform = '') {
  const source = [userAgent, acceptLanguage, platform].join('|');
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }

  return String(hash);
}

export function buildFingerprintFromHeaders(headers: Headers | Record<string, string | null | undefined>) {
  const getHeader = (name: string) => {
    if (headers instanceof Headers) {
      return headers.get(name) || '';
    }

    return String(headers[name.toLowerCase()] || headers[name] || '');
  };

  return buildFingerprint(
    getHeader('user-agent'),
    getHeader('accept-language'),
    getHeader('sec-ch-ua-platform')
  );
}

// Creates a short-lived session payload after successful login.
export function createSession(role: Role, username: string, fingerprint: string): SessionData {
  const issuedAt = Date.now();
  return {
    role,
    username,
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_MS,
    fingerprint
  };
}

// Encodes the session object into a cookie-safe string.
export function encodeSession(session: SessionData) {
  return encodeURIComponent(JSON.stringify(session));
}

// Decodes and validates the session structure from the cookie value.
export function decodeSession(rawValue: string | undefined | null): SessionData | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<SessionData>;
    if (!parsed || (parsed.role !== 'admin' && parsed.role !== 'ar')) {
      return null;
    }

    if (!parsed.username || !parsed.fingerprint || !parsed.expiresAt) {
      return null;
    }

    return {
      role: parsed.role,
      username: String(parsed.username),
      issuedAt: Number(parsed.issuedAt) || 0,
      expiresAt: Number(parsed.expiresAt) || 0,
      fingerprint: String(parsed.fingerprint)
    };
  } catch {
    return null;
  }
}

// Validates session ownership and expiration against current request fingerprint.
export function isSessionValid(session: SessionData | null, fingerprint: string) {
  if (!session) {
    return false;
  }

  if (session.fingerprint !== fingerprint) {
    return false;
  }

  return Date.now() < session.expiresAt;
}

// Resolves default post-login route by role.
export function getRedirectPath(role: Role) {
  return role === 'ar' ? '/dashboard-ar' : '/dashboard';
}