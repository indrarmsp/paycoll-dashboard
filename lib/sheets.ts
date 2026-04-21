import type { ARRow, DashboardStats, FilterOptions, MainDashboardPayload, MainRow } from './types';
import { unstable_cache } from 'next/cache';

export const MAIN_SHEET_URL = process.env.MAIN_SHEET_URL?.trim() || '';
export const AR_SHEET_URL = process.env.AR_SHEET_URL?.trim() || '';
export const SHEET_FETCH_TIMEOUT_MS = 30_000;
export const SHEET_CACHE_TTL_MS = 5 * 60 * 1000;
export const MAIN_DASHBOARD_BOOT_LIMIT = 1200;
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

export function readMainDashboardCache() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(MAIN_DASHBOARD_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { savedAt?: number; payload?: MainDashboardPayload };
    if (!parsed.savedAt || !parsed.payload) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SHEET_CACHE_TTL_MS) {
      sessionStorage.removeItem(MAIN_DASHBOARD_CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    return null;
  }
}

export function writeMainDashboardCache(payload: MainDashboardPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(MAIN_DASHBOARD_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      payload
    }));
  } catch {
    sessionStorage.removeItem(MAIN_DASHBOARD_CACHE_KEY);
  }
}

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
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__pcWarmMainDashboardPromise || null;
}

export function readARDashboardCache() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(AR_DASHBOARD_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { savedAt?: number; payload?: ARRow[] };
    if (!parsed.savedAt || !parsed.payload) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SHEET_CACHE_TTL_MS) {
      sessionStorage.removeItem(AR_DASHBOARD_CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    return null;
  }
}

export function writeARDashboardCache(payload: ARRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(AR_DASHBOARD_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      payload
    }));
  } catch {
    sessionStorage.removeItem(AR_DASHBOARD_CACHE_KEY);
  }
}

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

export function getWarmARDashboardPromise() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__pcWarmARDashboardPromise || null;
}

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

export function formatNumber(num: number) {
  return new Intl.NumberFormat('id-ID').format(num);
}

export function parseMainRows(table: NonNullable<GoogleSheetResponse['table']>): MainDashboardPayload {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const columnCount = Array.isArray(table.cols) ? table.cols.length : 0;
  const isProjectedShape = columnCount > 0 && columnCount <= 11;
  const idx = isProjectedShape
    ? {
        snd: 0,
        sndGroup: 1,
        nama: 2,
        alamat: 3,
        datel: 4,
        billCategory: 5,
        saldo: 6,
        umurCustomer: 7,
        noHp: 8,
        email: 9,
        paidL11: 10
      }
    : {
        snd: 4,
        sndGroup: 5,
        nama: 7,
        alamat: 8,
        datel: 10,
        billCategory: 13,
        saldo: 15,
        umurCustomer: 16,
        noHp: 17,
        email: 18,
        paidL11: 20
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