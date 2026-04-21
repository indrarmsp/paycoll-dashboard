import { NextResponse } from 'next/server';
import { fetchGoogleSheetData, MAIN_SHEET_URL, parseMainRows } from '../../../../lib/sheets';

export async function GET(request: Request) {
  try {
    if (!MAIN_SHEET_URL) {
      return NextResponse.json(parseMainRows({}));
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');

    if (!limit) {
      const data = await fetchGoogleSheetData(MAIN_SHEET_URL, {
        query: 'select *'
      });
      return NextResponse.json(parseMainRows(data.table || {}));
    }

    const query = `select * limit ${Number(limit)}`;
    const data = await fetchGoogleSheetData(MAIN_SHEET_URL, { query });
    return NextResponse.json(parseMainRows(data.table || {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return NextResponse.json({ message }, { status: 500 });
  }
}