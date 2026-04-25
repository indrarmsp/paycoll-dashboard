import type { ARRow, DashboardStats, FilterOptions, MainDashboardPayload, MainRow } from './types';
import { unstable_cache } from 'next/cache';

export const MAIN_SHEET_URL = process.env.MAIN_SHEET_URL?.trim() || '';
export const AR_SHEET_URL = process.env.AR_SHEET_URL?.trim() || '';
export const SHEET_FETCH_TIMEOUT_MS = 30_000;
export const SHEET_CACHE_TTL_MS = 5 * 60 * 1000;
export const DASHBOARD_AUTO_SYNC_INTERVAL_MS = (() => {
  const rawValue = Number(process.env.NEXT_PUBLIC_DASHBOARD_SYNC_INTERVAL_MS || '60000');
  if (!Number.isFinite(rawValue)) {
    return 60_000;
  }

  return Math.max(15_000, rawValue);
})();
export const MAIN_DASHBOARD_BOOT_LIMIT = 1200;
export const DASHBOARD_DATA_UPDATED_EVENT = 'pc-dashboard-data-updated';
const MAIN_DASHBOARD_CACHE_KEY = 'pcMainDashboardCache';
const AR_DASHBOARD_CACHE_KEY = 'pcARDashboardCache';
const MAIN_DASHBOARD_BOOT_QUERY = `select * limit ${MAIN_DASHBOARD_BOOT_LIMIT}`;

declare global {
  interface Window {
    __pcWarmMainDashboardPromise?: Promise<MainDashboardPayload | null>;
    __pcWarmARDashboardPromise?: Promise<ARRow[] | null>;
  }
}

type GoogleSheetResponse = {
  table?: {
    cols?: Array<Record<string, unknown>>;
    rows?: Array<{ c?: Array<{ v?: unknown } | null> }>;
  };
};

// Builds a Google Visualization API request URL with optional query override.
export function buildSheetRequestUrl(url: string, query?: string) {
  if (!url) {
    return '';
  }

  if (!query) {
    return url;
  }

  const requestUrl = new URL(url);
  requestUrl.searchParams.set('tq', query);
  return requestUrl.toString();
}

// Extracts and parses JSON payload from Google Visualization wrapper response.
export function parseGoogleSheetResponse(text: string): GoogleSheetResponse {
  const marker = 'google.visualization.Query.setResponse('; 
  const start = text.indexOf(marker);

  if (start === -1) {
    throw new Error('Google Sheet response format mismatch');
  }

  const payloadStart = start + marker.length;
  const payloadEnd = text.lastIndexOf(');');

  if (payloadEnd === -1 || payloadEnd <= payloadStart) {
    throw new Error('Google Sheet response payload is invalid');
  }

  return JSON.parse(text.slice(payloadStart, payloadEnd)) as GoogleSheetResponse;
}

// Fetches sheet data with timeout support and optional no-store refresh.
export async function fetchGoogleSheetData(url: string, options?: { query?: string; timeoutMs?: number; forceRefresh?: boolean }) {
  if (!url) {
    return { table: { cols: [], rows: [] } };
  }

  const requestUrl = buildSheetRequestUrl(url, options?.query);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (controller && (options?.timeoutMs ?? SHEET_FETCH_TIMEOUT_MS) > 0) {
    timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? SHEET_FETCH_TIMEOUT_MS);
  }

  try {
    const response = await fetch(requestUrl, {
      cache: options?.forceRefresh ? 'no-store' : 'no-cache',
      signal: controller?.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const text = await response.text();
    return parseGoogleSheetResponse(text);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// Generic sessionStorage cache reader with TTL check.
function readSessionCache<T>(cacheKey: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { savedAt?: number; payload?: T };
    if (!parsed.savedAt || !parsed.payload) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SHEET_CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.payload;
  } catch {
    return null;
  }
}

// Generic sessionStorage cache writer with timestamp metadata.
function writeSessionCache<T>(cacheKey: string, payload: T) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    sessionStorage.removeItem(cacheKey);
  }
}

// Reads cached main dashboard data from sessionStorage when still fresh.
export function readMainDashboardCache() {
  return readSessionCache<MainDashboardPayload>(MAIN_DASHBOARD_CACHE_KEY);
}

// Stores main dashboard payload in sessionStorage with timestamp metadata.
export function writeMainDashboardCache(payload: MainDashboardPayload) {
  writeSessionCache(MAIN_DASHBOARD_CACHE_KEY, payload);
}


// Warms main dashboard cache by prefetching API once per page lifecycle.
export function warmMainDashboardCache() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.__pcWarmMainDashboardPromise) {
    return window.__pcWarmMainDashboardPromise;
  }

  window.__pcWarmMainDashboardPromise = fetch('/api/sheets/main', {
    cache: 'no-store'
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const payload = await response.json() as MainDashboardPayload;
      if (!payload.rows?.length) {
        return null;
      }

      writeMainDashboardCache(payload);
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      window.__pcWarmMainDashboardPromise = undefined;
    });

  return window.__pcWarmMainDashboardPromise;
}

export function getWarmMainDashboardPromise() {
  // Returns in-flight warmup promise so callers can avoid duplicate fetches.
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__pcWarmMainDashboardPromise || null;
}

// Reads cached AR dashboard rows from sessionStorage when still fresh.
export function readARDashboardCache() {
  return readSessionCache<ARRow[]>(AR_DASHBOARD_CACHE_KEY);
}

// Stores AR dashboard payload in sessionStorage with timestamp metadata.
export function writeARDashboardCache(payload: ARRow[]) {
  writeSessionCache(AR_DASHBOARD_CACHE_KEY, payload);
}


// Warms AR dashboard cache by prefetching API once per page lifecycle.
export function warmARDashboardCache() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.__pcWarmARDashboardPromise) {
    return window.__pcWarmARDashboardPromise;
  }

  window.__pcWarmARDashboardPromise = fetch('/api/sheets/ar', {
    cache: 'no-store'
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const payload = await response.json() as { rows?: ARRow[] };
      const rows = payload.rows || [];
      if (!rows.length) {
        return null;
      }

      writeARDashboardCache(rows);
      return rows;
    })
    .catch(() => null)
    .finally(() => {
      window.__pcWarmARDashboardPromise = undefined;
    });

  return window.__pcWarmARDashboardPromise;
}

// Server-side bootstrap payload for the main dashboard route.
export const getMainDashboardBootstrap = unstable_cache(
  async () => {
    if (!MAIN_SHEET_URL) {
      return parseMainRows({});
    }

    const data = await fetchGoogleSheetData(MAIN_SHEET_URL, {
      query: MAIN_DASHBOARD_BOOT_QUERY,
      timeoutMs: SHEET_FETCH_TIMEOUT_MS,
      forceRefresh: false
    });

    return parseMainRows(data.table || {});
  },
  ['main-dashboard-bootstrap'],
  { revalidate: 300 }
);

// Server-side bootstrap payload for the AR dashboard route.
export const getARDashboardBootstrap = unstable_cache(
  async () => {
    if (!AR_SHEET_URL) {
      return parseARRows({});
    }

    const data = await fetchGoogleSheetData(AR_SHEET_URL, {
      timeoutMs: SHEET_FETCH_TIMEOUT_MS,
      forceRefresh: false
    });

    return parseARRows(data.table || {});
  },
  ['ar-dashboard-bootstrap'],
  { revalidate: 300 }
);

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

export function formatCurrency(num: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num);
}

// Formats numbers with locale separators for table/card display.
export function formatNumber(num: number) {
  return new Intl.NumberFormat('id-ID').format(num);
}

// Maps raw main sheet rows into typed dashboard rows, filters, and chart stats.
export function parseMainRows(table: NonNullable<GoogleSheetResponse['table']>): MainDashboardPayload {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const columns = Array.isArray(table.cols) ? table.cols : [];
  const normalizedColumnIndex = new Map<string, number>();

  columns.forEach((column, index) => {
    const rawLabel = String(column?.label ?? column?.id ?? '').trim().toLowerCase();
    const rawId = String(column?.id ?? '').trim().toLowerCase();

    if (rawLabel) {
      normalizedColumnIndex.set(rawLabel, index);
      normalizedColumnIndex.set(rawLabel.replace(/[^a-z0-9]+/g, ''), index);
    }

    if (rawId) {
      normalizedColumnIndex.set(rawId, index);
      normalizedColumnIndex.set(rawId.replace(/[^a-z0-9]+/g, ''), index);
    }
  });

  const resolveIndex = (aliases: string[], fallbackIndex: number) => {
    for (const alias of aliases) {
      const normalizedAlias = alias.trim().toLowerCase();
      const compactAlias = normalizedAlias.replace(/[^a-z0-9]+/g, '');
      const resolved = normalizedColumnIndex.get(normalizedAlias) ?? normalizedColumnIndex.get(compactAlias);

      if (resolved != null) {
        return resolved;
      }
    }

    return fallbackIndex;
  };

  const idx = {
    snd: resolveIndex(['snd', 'no snd'], 4),
    sndGroup: resolveIndex(['snd group', 'sndgroup', 'snd_group'], 5),
    nama: resolveIndex(['nama', 'name', 'customer name'], 7),
    alamat: resolveIndex(['alamat', 'address'], 8),
    datel: resolveIndex(['datel'], 10),
    billCategory: resolveIndex(['bill category', 'billcategory'], 13),
    saldo: resolveIndex(['saldo'], 15),
    umurCustomer: resolveIndex(['umur customer', 'umur_customer', 'umurcustomer'], 16),
    noHp: resolveIndex(['no hp', 'nohp', 'phone', 'phone number'], 17),
    email: resolveIndex(['email'], 18),
    paidL11: resolveIndex(['paid l11', 'paidl11', 'paid status', 'status'], 20)
  };

  const parsedRows: MainRow[] = [];
  const datelSet = new Set<string>();
  const categorySet = new Set<string>();
  const umurSet = new Set<string>();
  const categoryStats: Record<string, number> = {};
  let paidCount = 0;
  let unpaidCount = 0;

  for (const row of rows) {
    const cells = row?.c || [];
    const getVal = (index: number) => {
      const cell = cells[index];
      return cell && cell.v != null ? cell.v : '';
    };

    let sndGroup = normalizeText(getVal(idx.sndGroup));
    if (sndGroup.toLowerCase() === 'null') {
      sndGroup = '';
    }

    const snd = normalizeText(getVal(idx.snd));
    const nama = normalizeText(getVal(idx.nama));
    const datel = normalizeText(getVal(idx.datel));
    const billCategory = normalizeText(getVal(idx.billCategory));
    const saldo = Number.parseFloat(String(getVal(idx.saldo))) || 0;
    const umurCustomer = normalizeText(getVal(idx.umurCustomer));
    const paidL11 = normalizeText(getVal(idx.paidL11));
    const paidStatus = paidL11.toUpperCase() || 'UNPAID';

    parsedRows.push({
      snd,
      sndGroup,
      nama,
      alamat: String(getVal(idx.alamat)),
      datel,
      billCategory,
      saldo,
      umurCustomer,
      noHp: String(getVal(idx.noHp)),
      email: String(getVal(idx.email)),
      paidL11,
      _sndLower: snd.toLowerCase(),
      _namaLower: nama.toLowerCase(),
      _paidStatus: paidStatus
    });

    if (datel) {
      datelSet.add(datel);
    }

    if (billCategory) {
      categorySet.add(billCategory);
    }

    if (umurCustomer) {
      umurSet.add(umurCustomer);
    }

    const categoryKey = billCategory || 'Unknown';
    categoryStats[categoryKey] = (categoryStats[categoryKey] || 0) + saldo;

    if (paidStatus === 'PAID') {
      paidCount += 1;
    } else {
      unpaidCount += 1;
    }
  }

  const sortByLabel = (a: string, b: string) => a.localeCompare(b);

  const filterOptions: FilterOptions = {
    datel: Array.from(datelSet).sort(sortByLabel),
    billCategory: Array.from(categorySet).sort(sortByLabel),
    umurCustomer: Array.from(umurSet).sort(sortByLabel)
  };

  const stats: DashboardStats = {
    categoryStats,
    paidCount,
    unpaidCount
  };

  return {
    rows: parsedRows,
    filterOptions,
    stats
  };
}

// Maps raw AR sheet rows into typed AR table rows with normalized coordinates.
export function parseARRows(table: NonNullable<GoogleSheetResponse['table']>): ARRow[] {
  const rows = Array.isArray(table.rows) ? table.rows : [];

  function fixCoord(value: unknown, maxValue: number) {
    let number = Number.parseFloat(String(value ?? '').replace(/,/g, '.'));
    if (!number || Number.isNaN(number)) {
      return 0;
    }

    while (Math.abs(number) > maxValue && number !== 0) {
      number /= 10;
    }

    return number;
  }

  return rows
    .map((row) => {
      const cells = row?.c || [];
      const getVal = (index: number) => (cells[index] && cells[index]?.v != null ? cells[index]?.v : '');

      return {
        idAgent: String(getVal(8)),
        namaAgent: String(getVal(10)),
        snd: String(getVal(3)),
        namaPerusahaan: String(getVal(4)),
        witel: String(getVal(6)),
        address: String(getVal(34)),
        latitude: fixCoord(getVal(39), 90),
        longitude: fixCoord(getVal(40), 180)
      } satisfies ARRow;
    })
    .filter((item) => item.idAgent || item.namaAgent);
}