import { NextResponse } from 'next/server';
import { fetchGoogleSheetData, MAIN_SHEET_URL, parseMainRows } from '../../../../lib/sheets';

// Returns dashboard rows, with optional `limit` query for lightweight boot payloads.
export async function GET(request: Request) {
  try {
    if (!MAIN_SHEET_URL) {
      return NextResponse.json(parseMainRows({}));
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');

    const parsedLimit = Number(limit);
    const query = limit && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? `select * limit ${parsedLimit}`
      : 'select *';
    const data = await fetchGoogleSheetData(MAIN_SHEET_URL, { query });
    return NextResponse.json(parseMainRows(data.table || {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return NextResponse.json({ message }, { status: 500 });
  }
}