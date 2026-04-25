// Extracts the spreadsheet ID from a full Google Sheets URL.
export function getSheetIdFromUrl(url: string | undefined) {
  if (!url) {
    return '';
  }

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || '';
}

// Resolves a spreadsheet ID from either a direct value or a URL fallback.
export function resolveSpreadsheetId(primaryValue: string | undefined, fallbackUrl?: string) {
  const trimmed = primaryValue?.trim() || '';
  if (trimmed) {
    return getSheetIdFromUrl(trimmed) || trimmed;
  }

  return getSheetIdFromUrl(fallbackUrl);
}
