import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import {
  fetchSheetData,
  appendToSheet,
  filterRowsByGreaterTimestamp,
  findHeaderByAliases,
  type SheetRow
} from '../../../../../lib/google-sheets-api';
import { resolveSpreadsheetId } from '../../../../../lib/spreadsheet-utils';


function normalizeHeaderName(value: unknown) {
  return String(value ?? '').trim();
}

function isDateLikeHeader(header: string) {
  const key = normalizeKey(header);
  const dateKeys = [
    'inputdate',
    'datetime',
    'timestamp',
    'visitactivitydate',
    'visitdate',
    'activitydate',
    'billingpaymentdate',
    'paymentdate',
    'tanggal',
    'waktu',
    'jam'
  ];

  return dateKeys.some((dateKey) => key.includes(dateKey) || dateKey.includes(key));
}

function normalizeXlsxCellValue(header: string, value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  // ExcelJS returns Date objects for date cells
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // Handle numeric dates (Excel serial number format) for date-like headers
  if (typeof value === 'number' && isDateLikeHeader(header)) {
    // Excel serial date starts from 1900-01-01
    const excelEpoch = new Date(1900, 0, 1).getTime();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch + (value - 1) * millisecondsPerDay);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  return value;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getHeaderAliases(header: string) {
  const key = normalizeKey(header);

  if (key === 'inputdate' || key === 'datetime' || key === 'timestamp') {
    return [
      'input date',
      'input_date',
      'datetime',
      'timestamp',
      'visit activity date',
      'visit date',
      'activity date',
      'billing payment date',
      'payment date',
      'tanggal',
      'tanggal input',
      'tgl input',
      'waktu',
      'jam'
    ];
  }

  return [header];
}

function parseNumericValue(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }

  // First attempt: keep scientific notation intact (e.g. 1.31252103341E+11).
  const compact = raw.replace(/\s+/g, '');
  const scientificCandidate = compact.replace(/,/g, '');
  const directParsed = Number(scientificCandidate);
  if (Number.isFinite(directParsed)) {
    return directParsed;
  }

  // Fallback: normalize locale-style separators for plain numeric text.
  const normalized = compact
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,(?=\d{3}(?:\D|$))/g, '')
    .replace(/,/g, '.');

  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
    return '';
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : '';
}

function sanitizeViseeproRows(rows: SheetRow[], existingHeaders: string[]) {
  if (!rows.length) {
    return rows;
  }

  const sndHeader = findHeaderByAliases(existingHeaders, ['snd']);
  const employeesHeader = findHeaderByAliases(existingHeaders, ['employees total', 'employee total', 'jumlah karyawan']);
  if (!sndHeader && !employeesHeader) {
    return rows;
  }

  return rows.map((row) => {
    const mapped = { ...row };
    if (sndHeader) {
      const numericSnd = parseNumericValue(row[sndHeader]);
      if (numericSnd !== '') {
        mapped[sndHeader] = numericSnd;
      }
    }

    if (employeesHeader) {
      mapped[employeesHeader] = parseNumericValue(row[employeesHeader]);
    }

    return mapped;
  });
}

function remapRowsToExistingHeaders(rows: SheetRow[], existingHeaders: string[]) {
  if (!rows.length || !existingHeaders.length) {
    return rows;
  }

  const incomingHeaders = Object.keys(rows[0]);
  const incomingByNormalized = new Map(incomingHeaders.map((header) => [normalizeKey(header), header]));

  const headerMap = new Map<string, string>();
  for (const existingHeader of existingHeaders) {
    const direct = incomingByNormalized.get(normalizeKey(existingHeader));
    if (direct) {
      headerMap.set(existingHeader, direct);
      continue;
    }

    const aliases = getHeaderAliases(existingHeader);
    const hasCustomAliases = aliases.some((alias) => normalizeKey(alias) !== normalizeKey(existingHeader));
    if (hasCustomAliases) {
      const aliasMatch = findHeaderByAliases(incomingHeaders, aliases);
      if (aliasMatch) {
        headerMap.set(existingHeader, aliasMatch);
      }
    }
  }

  return rows.map((row) => {
    const mapped: SheetRow = { ...row };
    for (const [targetHeader, sourceHeader] of headerMap.entries()) {
      const sourceValue = row[sourceHeader];
      const targetValue = row[targetHeader];
      if ((targetValue === undefined || String(targetValue ?? '').trim() === '') && sourceValue !== undefined) {
        mapped[targetHeader] = sourceValue;
      }
    }
    return mapped;
  });
}

function parseXlsxRows(worksheet: any): SheetRow[] {
  const rows: SheetRow[] = [];
  
  // Collect all rows with their cell values
  const rawRows: (string | number | null | undefined)[][] = [];
  
  worksheet.eachRow((row: any, rowNumber: number) => {
    const cells: (string | number | null | undefined)[] = [];
    row.eachCell((cell: any, colNumber: number) => {
      cells[colNumber - 1] = cell.value;
    });
    rawRows.push(cells);
  });

  if (!rawRows.length) {
    return [];
  }

  const aliases = [
    'inputdate',
    'input_date',
    'input date',
    'datetime',
    'date time',
    'timestamp',
    'tanggal',
    'tanggalinput',
    'tglinput',
    'jam',
    'waktu',
    'snd',
    'nama',
    'name'
  ];

  let headerIndex = 0;
  let bestScore = -1;

  for (let index = 0; index < Math.min(rawRows.length, 20); index += 1) {
    const candidate = rawRows[index].map((cell) => normalizeHeaderName(cell)).filter(Boolean);
    if (!candidate.length) {
      continue;
    }

    let score = candidate.length;
    if (findHeaderByAliases(candidate, aliases)) {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  }

  const headers = rawRows[headerIndex].map((cell) => normalizeHeaderName(cell));
  const normalizedHeaders = headers.map((header, index) => header || `column_${index + 1}`);

  return rawRows
    .slice(headerIndex + 1)
    .map((row) => {
      const mapped: SheetRow = {};
      normalizedHeaders.forEach((header, index) => {
        mapped[header] = normalizeXlsxCellValue(header, row[index] ?? '');
      });
      return mapped;
    })
    .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
}

// Updates VISEEPRO by appending only uploaded rows with a newer timestamp.
export async function POST(request: Request) {
  try {
    const viseoproSheetId = resolveSpreadsheetId(process.env.VISEEPRO_SHEET_ID, process.env.VISEEPRO_SHEET_URL);

    if (!viseoproSheetId) {
      return NextResponse.json(
        {
          error: 'Sheet ID not configured',
          message: 'Please set VISEEPRO_SHEET_ID (or VISEEPRO_SHEET_URL) in .env.local'
        },
        { status: 400 }
      );
    }

    // Parse the uploaded file from the multipart form payload.
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Keep the endpoint limited to spreadsheet uploads.
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'Only .xlsx and .xls files are supported' }, { status: 400 });
    }

    // Read the workbook in memory and use the first sheet as the import source.
    const buffer = await file.arrayBuffer();
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);

    // Get the first sheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: 'File has no sheets' }, { status: 400 });
    }

    const fileData = parseXlsxRows(worksheet);

    if (fileData.length === 0) {
      return NextResponse.json(
        { message: 'File is empty', synced: 0 },
        { status: 200 }
      );
    }

    // Compare uploaded rows with the latest timestamp already stored in VISEEPRO.
    const existingData = await fetchSheetData(viseoproSheetId, 'VISEEPRO');

    const remappedFileData = remapRowsToExistingHeaders(fileData, existingData.headers);

    const { rowsToAppend, strategy } = filterRowsByGreaterTimestamp({
      incomingRows: remappedFileData,
      existingRows: existingData.rows,
      incomingHeaders: Object.keys(remappedFileData[0] || {}),
      existingHeaders: existingData.headers
    });

    if (!rowsToAppend.length) {
      return NextResponse.json(
        { message: 'No new records to add', synced: 0, strategy },
        { status: 200 }
      );
    }

    const sanitizedRowsToAppend = sanitizeViseeproRows(rowsToAppend, existingData.headers);

    // Append only newer rows so repeated uploads stay idempotent.
    await appendToSheet(viseoproSheetId, 'VISEEPRO', sanitizedRowsToAppend, {
      format: {
        numberColumnsByAliases: [['snd']],
        horizontalAlignment: 'LEFT',
        rightAlignColumnsByAliases: [
          ['snd'],
          ['activity id'],
          ['ncli'],
          ['regional'],
          ['id agent'],
          ['latitude'],
          ['longitude', 'longtitude']
        ]
      }
    });

    return NextResponse.json(
      {
        message: 'Upload completed successfully',
        synced: rowsToAppend.length,
        uploadTotal: remappedFileData.length,
        existingTotal: existingData.rows.length,
        strategy
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Upload Viseepro error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    if (message.includes('not a native Google Spreadsheet')) {
      return NextResponse.json(
        {
          error: 'Invalid target spreadsheet',
          message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Upload failed',
        message
      },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};
