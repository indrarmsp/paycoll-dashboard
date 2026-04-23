import { NextResponse } from 'next/server';
import { AR_SHEET_URL, getARDashboardBootstrap } from '../../../../lib/sheets';

// Returns AR visit rows from the cached bootstrap source.
export async function GET() {
  try {
    if (!AR_SHEET_URL) {
      return NextResponse.json({ rows: [] });
    }

    const rows = await getARDashboardBootstrap();
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch AR data';
    return NextResponse.json({ message }, { status: 500 });
  }
}