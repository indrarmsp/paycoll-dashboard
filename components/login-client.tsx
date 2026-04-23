"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { warmARDashboardCache, warmMainDashboardCache } from '../lib/sheets';

type LoginMode = 'admin' | 'ar';

type SecurityState = {
  failedCount: number;
  lockUntil: number;
};

const SECURITY_KEY = 'pcLoginSecurity';

const LOGIN_FAIL_LIMIT = 5;
const LOGIN_LOCK_MS = 60_000;

// Reads local lockout state used for brute-force throttling in the UI.
function readSecurityState(): SecurityState {
  if (typeof window === 'undefined') {
    return { failedCount: 0, lockUntil: 0 };
  }

  try {
    const raw = localStorage.getItem(SECURITY_KEY);
    if (!raw) {
      return { failedCount: 0, lockUntil: 0 };
    }

    const parsed = JSON.parse(raw) as Partial<SecurityState>;
    return {
      failedCount: Number(parsed.failedCount) || 0,
      lockUntil: Number(parsed.lockUntil) || 0
    };
  } catch {
    return { failedCount: 0, lockUntil: 0 };
  }
}

function writeSecurityState(state: SecurityState) {
  localStorage.setItem(SECURITY_KEY, JSON.stringify(state));
}

// Resets lockout counters after a successful login.
function clearSecurityState() {
  writeSecurityState({ failedCount: 0, lockUntil: 0 });
}

// Preloads dashboard data and route for smoother redirect after login.
function prewarmAndPrefetch(mode: LoginMode, router: ReturnType<typeof useRouter>) {
  if (mode === 'admin') {
    void warmMainDashboardCache();
    void router.prefetch('/dashboard');
    return;
  }

  void warmARDashboardCache();
  void router.prefetch('/dashboard-ar');
}

// Calculates the next lockout state after a failed attempt.
function buildFailedSecurityState(current: SecurityState, now: number): SecurityState {
  const failedCount = current.failedCount + 1;
  if (failedCount >= LOGIN_FAIL_LIMIT) {
    return { failedCount: 0, lockUntil: now + LOGIN_LOCK_MS };
  }

  return { failedCount, lockUntil: 0 };
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [security, setSecurity] = useState<SecurityState>({ failedCount: 0, lockUntil: 0 });

  const reasonMessage = useMemo(() => {
    const reason = searchParams.get('reason');

    if (reason === 'logged_out') {
      return 'Logout successful. Please sign in again.';
    }

    if (reason === 'unauthorized') {
      return 'Session is invalid or you do not have access to this page.';
    }

    return '';
  }, [searchParams]);

  useEffect(() => {
    setSecurity(readSecurityState());

    if (reasonMessage) {
      setError(reasonMessage);
    }
  }, [reasonMessage, router]);

  useEffect(() => {
    prewarmAndPrefetch(mode, router);
  }, [mode, router]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setInterval(() => {
      const nextSecurity = readSecurityState();
      setSecurity(nextSecurity);

      if (nextSecurity.lockUntil <= Date.now()) {
        writeSecurityState({ failedCount: 0, lockUntil: 0 });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [error]);

  // Validates inputs, checks lockout policy, and calls the login API.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const currentSecurity = readSecurityState();
    const now = Date.now();

    if (currentSecurity.lockUntil > now) {
      const seconds = Math.ceil((currentSecurity.lockUntil - now) / 1000);
      setError(`Too many attempts. Try again in ${seconds}s`);
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError('Please enter username and password');
      return;
    }

    if (trimmedUsername.length > 50 || trimmedPassword.length > 100) {
      setError('Input is too long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode,
          username: trimmedUsername,
          password: trimmedPassword
        })
      });

      const payload = await response.json() as { ok: boolean; message?: string; redirectTo?: string };

      if (!response.ok || !payload.ok) {
        const nextState = buildFailedSecurityState(currentSecurity, now);
        writeSecurityState(nextState);
        setSecurity(nextState);
        setError(nextState.lockUntil ? 'Too many attempts. Try again in 60s' : (payload.message || 'Invalid credentials'));
        return;
      }

      clearSecurityState();
      setError('');
      prewarmAndPrefetch(mode, router);
      router.replace(payload.redirectTo || (mode === 'ar' ? '/dashboard-ar' : '/dashboard'));
      router.refresh();
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 id="loginTitle" className="mb-6 text-center text-2xl font-bold text-slate-800">
          {mode === 'ar' ? 'AR Login' : 'Login'}
        </h1>

        <div className={['mb-4 rounded-lg p-3 text-sm', error ? 'bg-red-50 text-red-600' : 'hidden'].join(' ')}>
          {error}
        </div>

        <form id="loginForm" className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Enter Username"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Enter Password"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={['w-full rounded-lg py-2 font-medium text-white transition-colors', loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'].join(' ')}
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 border-t pt-4 text-center">
          <button
            id="toggleLoginMode"
            type="button"
            onClick={() => {
              setMode((current) => (current === 'admin' ? 'ar' : 'admin'));
              setError('');
            }}
            className="text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            {mode === 'admin' ? 'Switch to AR Login' : 'Switch to Login'}
          </button>
        </div>

        {security.lockUntil > Date.now() ? (
          <p className="mt-3 text-center text-xs text-slate-400">
            Retry in {Math.ceil((security.lockUntil - Date.now()) / 1000)}s
          </p>
        ) : null}
      </div>
    </div>
  );
}