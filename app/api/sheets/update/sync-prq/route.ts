import { NextResponse } from 'next/server';
  fetchSheetData,
  appendToSheet,
  findHeaderByAliases,
  findIncrementalRowsFromLastMatch
} from '../../../../../lib/google-sheets-api';

type SheetRow = Record<string, unknown>;

function getSheetIdFromUrl(url: string | undefined) {
  if (!url) {
    return '';
  }

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || '';
}

function normalizeCell(value: unknown) {
  return String(value ?? '').trim();
}

function remapCollectionRowsToReportPRQ(rows: SheetRow[], reportHeaders: string[]) {
  if (!rows.length || !reportHeaders.length) {
    return rows;
  }

  const noInetHeader = findHeaderByAliases(reportHeaders, ['no inet', 'no internet', 'nomor internet']);
  if (!noInetHeader) {
    return rows;
  }

  return rows.map((row) => {
    const mapped = { ...row };
    const sourceHeader = findHeaderByAliases(Object.keys(row), ['nomor internet', 'no internet', 'no inet']);
    if (!sourceHeader) {
      return mapped;
    }

    if (!normalizeCell(mapped[noInetHeader])) {
      mapped[noInetHeader] = row[sourceHeader];
    }

    return mapped;
  });
}

// Syncs the Report PRQ sheet by appending only Collection rows that come after the last matched row.
export async function POST() {
  try {
    const pritiDataSheetId = process.env.PRITI_DATA_SHEET_ID?.trim() || getSheetIdFromUrl(process.env.COLLECTION_SHEET_URL);
    const reportPRQSheetId = process.env.REPORT_PRQ_SHEET_ID?.trim() || getSheetIdFromUrl(process.env.REPORT_PRQ_SHEET_URL);

    if (!pritiDataSheetId || !reportPRQSheetId) {
      return NextResponse.json(
        {
          error: 'Sheet IDs not configured',
          message: 'Please set PRITI_DATA_SHEET_ID and REPORT_PRQ_SHEET_ID in .env.local'
        },
        { status: 400 }
      );
    }

    // Read both sheets once so the incremental matcher can compare them in memory.
    const pritiData = await fetchSheetData(pritiDataSheetId, 'Collection');
    const reportPRQData = await fetchSheetData(reportPRQSheetId, 'Report PRQ');

    if (pritiData.rows.length === 0) {
      return NextResponse.json(
        { message: 'No data found in PRITI DATA (Collection sheet)' },
        { status: 200 }
      );
    }

    const { rowsToAppend, strategy } = findIncrementalRowsFromLastMatch({
      sourceRows: pritiData.rows,
      targetRows: reportPRQData.rows,
      sourceHeaders: pritiData.headers,
      targetHeaders: reportPRQData.headers,
      dateAliases: ['inputdate', 'input_date', 'input date', 'tanggal', 'date']
    });

    if (!rowsToAppend.length) {
      return NextResponse.json(
        { message: 'No new records to sync', synced: 0, strategy },
        { status: 200 }
      );
    }

    const rowsForReportPRQ = remapCollectionRowsToReportPRQ(rowsToAppend, reportPRQData.headers);

    // Append only the rows that were not already represented in Report PRQ.
    await appendToSheet(reportPRQSheetId, 'Report PRQ', rowsForReportPRQ, {
      format: {
        horizontalAlignment: 'LEFT',
        allBorders: true
      }
    });

    return NextResponse.json(
      {
        message: 'Sync completed successfully',
        synced: rowsToAppend.length,
        sourceTotal: pritiData.rows.length,
        reportTotal: reportPRQData.rows.length,
        strategy
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Sync PRQ error:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
