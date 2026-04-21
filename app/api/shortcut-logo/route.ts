import { NextResponse } from 'next/server';
import { normalizeShortcutUrl } from '../../../lib/shortcuts';

type IconCandidate = {
  href: string;
  score: number;
};

function extractCandidates(html: string, baseUrl: string) {
  const candidates: IconCandidate[] = [];
  const patterns = [
    /<link[^>]+rel=["'][^"']*(?:apple-touch-icon|shortcut icon|icon)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*(?:apple-touch-icon|shortcut icon|icon)[^"']*["'][^>]*>/gi,
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const rawHref = match[1];
      if (!rawHref || rawHref.startsWith('data:')) {
        continue;
      }

      const lower = match[0].toLowerCase();
      let score = 0;

      if (lower.includes('apple-touch-icon')) {
        score += 200;
      }

      if (lower.includes('icon')) {
        score += 50;
      }

      if (lower.includes('shortcut icon')) {
        score += 25;
      }

      const sizeMatch = lower.match(/sizes=["']([^"']+)["']/);
      if (sizeMatch) {
        const sizes = sizeMatch[1].split(/\s+/);
        const maxSize = sizes.reduce((largest, entry) => {
          const [width, height] = entry.split('x').map((part) => Number.parseInt(part, 10));
          if (!Number.isFinite(width) || !Number.isFinite(height)) {
            return largest;
          }

          return Math.max(largest, width, height);
        }, 0);

        score += maxSize;
      }

      if (/\.svg(?:\?|#|$)/i.test(rawHref)) {
        score += 1000;
      }

      if (/\.png(?:\?|#|$)/i.test(rawHref)) {
        score += 120;
      }

      if (/\.ico(?:\?|#|$)/i.test(rawHref)) {
        score += 30;
      }

      if (/(16x16|32x32)/i.test(lower)) {
        score -= 200;
      }

      try {
        candidates.push({ href: new URL(rawHref, baseUrl).toString(), score });
      } catch {
        // Ignore invalid URLs.
      }
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; PaymentCollectiveBot/1.0)'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.text();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get('url') || '';
    const normalizedUrl = normalizeShortcutUrl(rawUrl);

    if (!normalizedUrl) {
      return new NextResponse(null, { status: 400 });
    }

    const parsedUrl = new URL(normalizedUrl);
    const origin = parsedUrl.origin;

    let candidates: IconCandidate[] = [
      { href: `${origin}/favicon.svg`, score: 900 },
      { href: `${origin}/apple-touch-icon.png`, score: 800 },
      { href: `${origin}/apple-touch-icon-precomposed.png`, score: 790 },
      { href: `${origin}/favicon.png`, score: 500 },
      { href: `${origin}/favicon.ico`, score: 400 }
    ];

    try {
      const html = await fetchText(origin);
      candidates = [...extractCandidates(html, origin), ...candidates];
    } catch {
      // Ignore HTML fetch errors and fall back to direct icon paths.
    }

    const uniqueCandidates = candidates
      .sort((left, right) => right.score - left.score)
      .filter((candidate, index, list) => list.findIndex((item) => item.href === candidate.href) === index);

    for (const candidate of uniqueCandidates) {
      try {
        const iconResponse = await fetch(candidate.href, {
          redirect: 'follow',
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; PaymentCollectiveBot/1.0)'
          }
        });

        if (!iconResponse.ok) {
          continue;
        }

        const contentType = iconResponse.headers.get('content-type') || '';
        const buffer = await iconResponse.arrayBuffer();

        if (buffer.byteLength < 256) {
          continue;
        }

        if ((contentType.includes('image/png') || contentType.includes('image/x-icon') || contentType.includes('image/vnd.microsoft.icon')) && buffer.byteLength < 4096) {
          continue;
        }

        return new NextResponse(Buffer.from(buffer), {
          headers: {
            'content-type': contentType || 'image/png',
            'cache-control': 'public, max-age=86400, s-maxage=86400'
          }
        });
      } catch {
        // Try the next candidate.
      }
    }

    return NextResponse.json({ message: 'No usable logo found' }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve shortcut logo';
    return NextResponse.json({ message }, { status: 500 });
  }
}