"use client";

import { LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout(event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) {
    event.preventDefault();

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ source: pathname })
    });

    const payload = await response.json() as { redirectTo?: string };

    if (payload.redirectTo) {
      router.replace(payload.redirectTo);
      router.refresh();
      return;
    }

    router.replace('/login?reason=logged_out');
    router.refresh();
  }

  return (
    <a href="/login" onClick={handleLogout} className={className}>
      <LogOut className="mr-3 h-5 w-5" />
      Logout
    </a>
  );
}