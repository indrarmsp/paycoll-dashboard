import { NextResponse } from 'next/server';
import { AR_SHEET_URL, fetchGoogleSheetData, getARDashboardBootstrap, parseARRows } from '../../../../lib/sheets';

// Returns AR visit rows from the cached bootstrap source.
export async function GET(request: Request) {
  try {
    if (!AR_SHEET_URL) {
      return NextResponse.json({ rows: [] });
    }

    const { searchParams } = new URL(request.url);
    const shouldRefresh = searchParams.get('refresh') === '1';

    const rows = shouldRefresh
      ? parseARRows((await fetchGoogleSheetData(AR_SHEET_URL, { forceRefresh: true })).table || {})
      : await getARDashboardBootstrap();

    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch AR data';
    return NextResponse.json({ message }, { status: 500 });
  }
}