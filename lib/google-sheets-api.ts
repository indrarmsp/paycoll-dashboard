import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface SheetRow {
  [key: string]: unknown;
}

export interface SheetData {
  headers: string[];
  rows: SheetRow[];
}

type HorizontalAlignment = 'LEFT' | 'CENTER' | 'RIGHT';

export interface AppendSheetOptions {
  format?: {
    horizontalAlignment?: HorizontalAlignment;
    allBorders?: boolean;
    numberColumnsByAliases?: string[][];
    rightAlignColumnsByAliases?: string[][];
  };
}

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
};

async function readServiceAccountFromFile() {
  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!configuredPath) {
    return null;
  }

  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);

  const content = await readFile(resolvedPath, 'utf8');
  const parsed = JSON.parse(content) as ServiceAccountJson;

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('Service account JSON is missing required fields');
  }

  return {
    email: parsed.client_email.trim(),
    privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    projectId: parsed.project_id.trim()
  };
}

// Initializes the Google Sheets client using service-account credentials.
export async function initializeGoogleSheetsAPI() {
  const envEmail = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL?.trim() || '';
  const envPrivateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  const envProjectId = process.env.GOOGLE_SHEETS_PROJECT_ID?.trim() || '';

  let email = envEmail;
  let privateKey = envPrivateKey;
  let projectId = envProjectId;

  if (!email || !privateKey || !projectId) {
    const fromFile = await readServiceAccountFromFile().catch(() => null);
    if (fromFile) {
      email = fromFile.email;
      privateKey = fromFile.privateKey;
      projectId = fromFile.projectId;
    }
  }

  if (!email || !privateKey || !projectId) {
    throw new Error(
      'Google Sheets API credentials not configured. Set GOOGLE_SHEETS_* vars or GOOGLE_APPLICATION_CREDENTIALS in .env.local'
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

// Fetches the full visible range from a sheet and maps rows by header names.
export async function fetchSheetData(spreadsheetId: string, sheetName: string): Promise<SheetData> {
  try {
    const sheets = await initializeGoogleSheetsAPI();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:ZZ`
    });

    const values = response.data.values || [];
    if (!values.length) {
      return { headers: [], rows: [] };
    }

    const headers = values[0] as string[];
    const rows: SheetRow[] = values.slice(1).map((row: unknown[]) => {
      const mappedRow: SheetRow = {};
      headers.forEach((header, index) => {
        mappedRow[header] = row[index] ?? '';
      });
      return mappedRow;
    });

    return { headers, rows };
  } catch (error) {
    throw new Error(`Failed to fetch sheet data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getSheetIdByName(spreadsheetId: string, sheetName: string) {
  const sheets = await initializeGoogleSheetsAPI();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))'
  });

  const matchedSheet = metadata.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
  const sheetId = matchedSheet?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  return sheetId;
}

function resolveColumnIndexesByAliases(headers: string[], aliasGroups: string[][]) {
  const indexes = new Set<number>();
  for (const aliases of aliasGroups) {
    const matchedHeader = findHeaderByAliases(headers, aliases);
    if (!matchedHeader) {
      continue;
    }

    const index = headers.indexOf(matchedHeader);
    if (index >= 0) {
      indexes.add(index);
    }
  }

  return Array.from(indexes);
}

async function applyAppendFormatting(params: {
  spreadsheetId: string;
  sheetName: string;
  headers: string[];
  startRowIndex: number;
  endRowIndex: number;
  options: NonNullable<AppendSheetOptions['format']>;
}) {
  const { spreadsheetId, sheetName, headers, startRowIndex, endRowIndex, options } = params;
  const {
    horizontalAlignment,
    allBorders,
    numberColumnsByAliases = [],
    rightAlignColumnsByAliases = []
  } = options;

  if (startRowIndex >= endRowIndex || !headers.length) {
    return;
  }

  const sheetId = await getSheetIdByName(spreadsheetId, sheetName);
  const requests: Array<Record<string, unknown>> = [];
  const fullRange = {
    sheetId,
    startRowIndex,
    endRowIndex,
    startColumnIndex: 0,
    endColumnIndex: headers.length
  };

  if (horizontalAlignment) {
    requests.push({
      repeatCell: {
        range: fullRange,
        cell: {
          userEnteredFormat: {
            horizontalAlignment
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment'
      }
    });
  }

  if (allBorders) {
    const solidBorder = {
      style: 'SOLID',
      color: { red: 0, green: 0, blue: 0 }
    };

    requests.push({
      updateBorders: {
        range: fullRange,
        top: solidBorder,
        bottom: solidBorder,
        left: solidBorder,
        right: solidBorder,
        innerHorizontal: solidBorder,
        innerVertical: solidBorder
      }
    });
  }

  const numberColumnIndexes = resolveColumnIndexesByAliases(headers, numberColumnsByAliases);
  for (const columnIndex of numberColumnIndexes) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex,
          endRowIndex,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'NUMBER',
              pattern: '0'
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    });
  }

  const rightAlignColumnIndexes = resolveColumnIndexesByAliases(headers, rightAlignColumnsByAliases);
  for (const columnIndex of rightAlignColumnIndexes) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex,
          endRowIndex,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'RIGHT'
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment'
      }
    });
  }

  if (!requests.length) {
    return;
  }

  const sheets = await initializeGoogleSheetsAPI();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

function parseUpdatedRangeRows(updatedRange: string | null | undefined) {
  if (!updatedRange) {
    return null;
  }

  const rangePart = updatedRange.split('!')[1] || '';
  const match = rangePart.match(/[A-Z]+(\d+):[A-Z]+(\d+)/i);
  if (!match) {
    return null;
  }

  const startRow = Number(match[1]);
  const endRow = Number(match[2]);
  if (!Number.isFinite(startRow) || !Number.isFinite(endRow) || startRow <= 0 || endRow <= 0) {
    return null;
  }

  return {
    startRowIndex: startRow - 1,
    endRowIndex: endRow
  };
}

// Appends rows using the target sheet header order to keep columns aligned.
export async function appendToSheet(
  spreadsheetId: string,
  sheetName: string,
  rows: SheetRow[],
  options?: AppendSheetOptions
): Promise<void> {
  try {
    if (!rows.length) {
      return;
    }

    const sheets = await initializeGoogleSheetsAPI();
    const existingData = await fetchSheetData(spreadsheetId, sheetName);
    const { headers } = existingData;

    if (!headers.length) {
      throw new Error('Sheet has no headers');
    }

    const startRowIndex = existingData.rows.length + 1;
    const endRowIndex = startRowIndex + rows.length;
    const values: unknown[][] = rows.map((row) => headers.map((header) => row[header] ?? ''));

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:ZZ`,
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    const updatedRows = parseUpdatedRangeRows(appendResponse.data.updates?.updatedRange);

    if (options?.format) {
      await applyAppendFormatting({
        spreadsheetId,
        sheetName,
        headers,
        startRowIndex: updatedRows?.startRowIndex ?? startRowIndex,
        endRowIndex: updatedRows?.endRowIndex ?? endRowIndex,
        options: options.format
      });
    }
  } catch (error) {
    throw new Error(`Failed to append to sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function normalizeHeaderName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeCell(value: unknown) {
  return String(value ?? '').trim();
}

function isRowEmpty(row: SheetRow) {
  return Object.values(row).every((value) => normalizeCell(value) === '');
}

// Finds the first header that matches one of the provided aliases.
export function findHeaderByAliases(headers: string[], aliases: string[]) {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeaderName(alias)));
  const exactMatch = headers.find((header) => aliasSet.has(normalizeHeaderName(header))) || null;
  if (exactMatch) {
    return exactMatch;
  }

  // Fallback: tolerate suffix/prefix variations like "input_date_wib".
  const normalizedAliases = Array.from(aliasSet);
  return headers.find((header) => {
    const normalizedHeader = normalizeHeaderName(header);
    return normalizedAliases.some((alias) => normalizedHeader.includes(alias) || alias.includes(normalizedHeader));
  }) || null;
}

// Parses common date and datetime formats used by both PRQ and VISEEPRO sheets.
export function parseFlexibleDateTime(value: unknown) {
  const raw = normalizeCell(value);
  if (!raw) {
    return null;
  }

  const normalized = raw.replace('T', ' ');
  const [datePart = '', timeRaw = ''] = normalized.split(' ');
  const timePart = timeRaw.replace(/-/g, ':');

  const isoMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const [hh = '00', mm = '00', ss = '00'] = timePart.split(':');
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2})[:\-](\d{2})(?:[:\-](\d{2}))?)?$/);
  if (slashMatch) {
    const [, day, month, year, hh = '00', mm = '00', ss = '00'] = slashMatch;   
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function sameDateOnly(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getLastNonEmptyRow(rows: SheetRow[]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (!isRowEmpty(rows[index])) {
      return rows[index];
    }
  }

  return null;
}

function rowsEqualByHeaders(left: SheetRow, right: SheetRow, headers: string[]) {
  return headers.every((header) => normalizeCell(left[header]) === normalizeCell(right[header]));
}

function detectDescendingOrderByDate(rows: SheetRow[], dateHeader: string) {
  const firstDate = parseFlexibleDateTime(rows[0]?.[dateHeader]);
  const lastDate = parseFlexibleDateTime(rows[rows.length - 1]?.[dateHeader]);
  if (!firstDate || !lastDate) {
    return false;
  }

  return firstDate.getTime() > lastDate.getTime();
}

function getRowsAfterMatch(rows: SheetRow[], matchIndex: number, isDescending: boolean) {
  return isDescending ? rows.slice(0, matchIndex) : rows.slice(matchIndex + 1);
}

function buildHeaderPairs(sourceHeaders: string[], targetHeaders: string[], aliases: string[]) {
  const sourceHeader = findHeaderByAliases(sourceHeaders, aliases);
  const targetHeader = findHeaderByAliases(targetHeaders, aliases);

  if (!sourceHeader || !targetHeader) {
    return null;
  }

  return { sourceHeader, targetHeader };
}

// Returns source rows that appear after the last matched target row.
export function findIncrementalRowsFromLastMatch(params: {
  sourceRows: SheetRow[];
  targetRows: SheetRow[];
  sourceHeaders: string[];
  targetHeaders: string[];
  dateAliases?: string[];
}) {
  const {
    sourceRows,
    targetRows,
    sourceHeaders,
    targetHeaders,
    dateAliases = ['inputdate', 'input_date', 'input date', 'date', 'tanggal']
  } = params;

  if (!sourceRows.length) {
    return { rowsToAppend: [] as SheetRow[], strategy: 'empty-source' as const };
  }

  if (!targetRows.length) {
    return { rowsToAppend: sourceRows, strategy: 'target-empty' as const };
  }

  const lastTargetRow = getLastNonEmptyRow(targetRows);
  if (!lastTargetRow) {
    return { rowsToAppend: sourceRows, strategy: 'target-empty' as const };
  }

  const datePair = buildHeaderPairs(sourceHeaders, targetHeaders, dateAliases);
  const sndPair = buildHeaderPairs(sourceHeaders, targetHeaders, ['snd', 'no snd', 'sndgroup', 'snd_group']);
  const namePair = buildHeaderPairs(sourceHeaders, targetHeaders, ['nama', 'name', 'customername']);
  const pairedHeaders = [datePair, sndPair, namePair].filter((pair) => !!pair);

  const isDescending = datePair
    ? detectDescendingOrderByDate(sourceRows, datePair.sourceHeader)
    : false;

  if (pairedHeaders.length) {
    for (let index = sourceRows.length - 1; index >= 0; index -= 1) {
      const isMatch = pairedHeaders.every((pair) => {
        if (!pair) {
          return true;
        }

        return normalizeCell(sourceRows[index][pair.sourceHeader]) === normalizeCell(lastTargetRow[pair.targetHeader]);
      });

      if (isMatch) {
        return {
          rowsToAppend: getRowsAfterMatch(sourceRows, index, isDescending),
          strategy: 'keyed-last-row' as const
        };
      }
    }
  }

  const comparableHeaders = targetHeaders.filter((header) => sourceHeaders.includes(header));
  if (comparableHeaders.length) {
    for (let index = sourceRows.length - 1; index >= 0; index -= 1) {
      if (rowsEqualByHeaders(sourceRows[index], lastTargetRow, comparableHeaders)) {
        return {
          rowsToAppend: getRowsAfterMatch(sourceRows, index, isDescending),
          strategy: 'exact-last-row' as const
        };
      }
    }
  }

  const sourceDateHeader = datePair?.sourceHeader || findHeaderByAliases(sourceHeaders, dateAliases);
  const targetDateHeader = datePair?.targetHeader || findHeaderByAliases(targetHeaders, dateAliases);

  if (!sourceDateHeader || !targetDateHeader) {
    return { rowsToAppend: [], strategy: 'no-match' as const };
  }

  const lastDate = parseFlexibleDateTime(lastTargetRow[targetDateHeader]);
  if (!lastDate) {
    return { rowsToAppend: [], strategy: 'no-match' as const };
  }

  for (let index = sourceRows.length - 1; index >= 0; index -= 1) {
    const sourceDate = parseFlexibleDateTime(sourceRows[index][sourceDateHeader]);
    if (sourceDate && sameDateOnly(sourceDate, lastDate)) {
      return {
        rowsToAppend: getRowsAfterMatch(sourceRows, index, isDescending),
        strategy: 'date-fallback' as const
      };
    }
  }

  return { rowsToAppend: [], strategy: 'no-match' as const };
}

// Returns only incoming rows with timestamp strictly greater than the latest existing one.
export function filterRowsByGreaterTimestamp(params: {
  incomingRows: SheetRow[];
  existingRows: SheetRow[];
  incomingHeaders: string[];
  existingHeaders: string[];
  timestampAliases?: string[];
}) {
  const {
    incomingRows,
    existingRows,
    incomingHeaders,
    existingHeaders,
    timestampAliases = [
      'inputdate',
      'input_date',
      'input date',
      'visit activity date',
      'visit date',
      'activity date',
      'billing payment date',
      'payment date',
      'datetime',
      'date time',
      'timestamp',
      'tanggal',
      'tanggalinput',
      'tglinput',
      'jam',
      'waktu'
    ]
  } = params;

  if (!incomingRows.length) {
    return { rowsToAppend: [] as SheetRow[], strategy: 'empty-incoming' as const };
  }

  if (!existingRows.length) {
    return { rowsToAppend: incomingRows, strategy: 'existing-empty' as const };
  }

  const incomingTimestampHeader = findHeaderByAliases(incomingHeaders, timestampAliases);
  const existingTimestampHeader = findHeaderByAliases(existingHeaders, timestampAliases);

  if (!incomingTimestampHeader || !existingTimestampHeader) {
    return { rowsToAppend: [], strategy: 'missing-timestamp-column' as const };
  }

  let latestExisting: Date | null = null;
  for (const row of existingRows) {
    const parsed = parseFlexibleDateTime(row[existingTimestampHeader]);
    if (!parsed) {
      continue;
    }

    if (!latestExisting || parsed.getTime() > latestExisting.getTime()) {
      latestExisting = parsed;
    }
  }

  if (!latestExisting) {
    return { rowsToAppend: incomingRows, strategy: 'existing-no-valid-timestamp' as const };
  }

  const rowsToAppend = incomingRows.filter((row) => {
    const parsed = parseFlexibleDateTime(row[incomingTimestampHeader]);
    return !!parsed && parsed.getTime() > latestExisting.getTime();
  });

  return { rowsToAppend, strategy: 'timestamp-gt' as const };
}
