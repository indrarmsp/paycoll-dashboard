"use client";

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, LoaderCircle, X } from 'lucide-react';
import type { ARRow } from '../lib/types';
import { getVisiblePageNumbers } from '../lib/pagination';
import { DASHBOARD_AUTO_SYNC_INTERVAL_MS, DASHBOARD_DATA_UPDATED_EVENT, formatNumber, readARDashboardCache, writeARDashboardCache } from '../lib/sheets';

type ExportColumn = {
  key: keyof ARRow;
  label: string;
  getValue: (row: ARRow) => string | number;
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'idAgent', label: 'ID Agent', getValue: (row) => row.idAgent },
  { key: 'namaAgent', label: 'Agent Name', getValue: (row) => row.namaAgent },
  { key: 'snd', label: 'SND', getValue: (row) => row.snd },
  { key: 'namaPerusahaan', label: 'Company Name', getValue: (row) => row.namaPerusahaan },
  { key: 'witel', label: 'Witel', getValue: (row) => row.witel },
  { key: 'address', label: 'Address', getValue: (row) => row.address },
  { key: 'latitude', label: 'Latitude', getValue: (row) => row.latitude },
  { key: 'longitude', label: 'Longitude', getValue: (row) => row.longitude }
];

type DashboardARClientProps = {
  initialData?: ARRow[] | null;
};

function getExportColumns(selectedExportColumns: string[]) {
  return EXPORT_COLUMNS.filter((column) => selectedExportColumns.includes(String(column.key)));
}

function buildExportFilename(currentPage: number, exportCurrentPageOnly: boolean) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  const suffix = exportCurrentPageOnly ? `_page${currentPage}` : '';
  return `visit_ar_${stamp}${suffix}.xlsx`;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function DashboardARClient({ initialData }: DashboardARClientProps) {
  const [rows, setRows] = useState<ARRow[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [detailModal, setDetailModal] = useState<{ label: string; value: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCurrentPageOnly, setExportCurrentPageOnly] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(EXPORT_COLUMNS.map((column) => String(column.key)));

  function applyRows(nextRows: ARRow[]) {
    setRows(nextRows);
    writeARDashboardCache(nextRows);
    setLoading(false);
  }

  async function refreshArRows() {
    try {
      const nextRows = await fetchArRows(true);
      applyRows(nextRows);
    } catch {
      // Keep current rows if refresh fails.
    }
  }

  async function fetchArRows(refresh = false) {
    const response = await fetch(refresh ? '/api/sheets/ar?refresh=1' : '/api/sheets/ar', {
      cache: refresh ? 'no-store' : 'default'
    });
    const payload = await response.json() as { rows?: ARRow[]; message?: string };

    if (!response.ok) {
      throw new Error(payload.message || 'Failed to load AR data');
    }

    return payload.rows || [];
  }

  useEffect(() => {
    const cachedRows = readARDashboardCache();
    if (cachedRows?.length) {
      applyRows(cachedRows);
      void refreshArRows();
      return;
    }

    if (initialData?.length) {
      applyRows(initialData);
      void refreshArRows();
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const nextRows = await fetchArRows();

        if (!cancelled && nextRows.length) {
          applyRows(nextRows);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(toErrorMessage(loadError, 'Failed to load AR data'));
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  useEffect(() => {
    function handleDashboardUpdate() {
      void refreshArRows();
    }

    function handleStorageUpdate(event: StorageEvent) {
      if (event.key === 'pcDashboardDataVersion') {
        void refreshArRows();
      }
    }

    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, handleDashboardUpdate as EventListener);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, handleDashboardUpdate as EventListener);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let syncing = false;

    async function syncArIfVisible() {
      if (cancelled || syncing || typeof document === 'undefined') {
        return;
      }

      if (document.visibilityState !== 'visible') {
        return;
      }

      syncing = true;
      try {
        await refreshArRows();
      } catch {
        // Keep existing data when a polling request fails.
      } finally {
        syncing = false;
      }
    }

    const intervalId = window.setInterval(syncArIfVisible, DASHBOARD_AUTO_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const agentOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.namaAgent).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (agentFilter === 'ALL') {
      return rows;
    }

    return rows.filter((row) => row.namaAgent === agentFilter);
  }, [agentFilter, rows]);

  const maxPage = Math.max(1, Math.ceil(filteredRows.length / limit));
  const currentPage = Math.min(page, maxPage);
  const startIndex = (currentPage - 1) * limit;
  const pageRows = filteredRows.slice(startIndex, startIndex + limit);

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  useEffect(() => {
    setPage(1);
  }, [agentFilter, limit]);

  function openExportModal() {
    setSelectedExportColumns(EXPORT_COLUMNS.map((column) => String(column.key)));
    setExportCurrentPageOnly(false);
    setExportOpen(true);
  }

  function closeExportModal() {
    setExportOpen(false);
  }

  function openDetailModal(label: string, value: string) {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    setDetailModal({ label, value: normalized });
  }

  function handleDownload() {
    const selectedColumns = getExportColumns(selectedExportColumns);

    if (!selectedColumns.length) {
      window.alert('Select at least 1 column to export.');
      return;
    }

    const rowsForExport = exportCurrentPageOnly ? pageRows : filteredRows;

    if (!rowsForExport.length) {
      window.alert('No data available to export with the current filters.');
      return;
    }

    const exportRows = rowsForExport.map((row) => {
      const record: Record<string, string | number> = {};
      selectedColumns.forEach((column) => {
        record[column.label] = column.getValue(row);
      });
      return record;
    });

    const filename = buildExportFilename(currentPage, exportCurrentPageOnly);

    // Call export API
    fetch('/api/export/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        sheetName: 'Visit AR',
        data: exportRows
      })
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        window.alert(`Export failed: ${error.message}`);
      });

    closeExportModal();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-center text-slate-500">
        <div>
          <LoaderCircle className="mx-auto mb-3 h-10 w-10 animate-spin text-brand-500" />
          <p className="font-medium text-slate-700">Please wait a moment</p>
          <p className="mt-1 text-sm text-slate-500">We are loading your AR dashboard data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 text-rose-600 shadow-sm">
        <h2 className="text-lg font-semibold text-rose-700">Visit data failed to load</h2>
        <p className="text-sm text-rose-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-7xl">
      <div className="mb-5 flex w-full flex-wrap items-center justify-end gap-3">
        <button
          id="openExportARModal"
          type="button"
          onClick={openExportModal}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <Download className="mr-1 inline-block h-4 w-4" />
          Download XLSX
        </button>

        <select
          id="arFilter"
          value={agentFilter}
          onChange={(event) => setAgentFilter(event.target.value)}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="ALL">All AR Names</option>
          {agentOptions.map((agent) => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>

        <select
          id="arPageSizeSelect"
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="10">10 / page</option>
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
      </div>

      <div id="content" className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center">
          <h2 className="text-lg font-semibold text-slate-800">Visit AR List</h2>
        </div>

        <div className="relative w-full overflow-auto">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 shadow-sm">
              <tr>
                <th className="border-b border-slate-200 px-4 py-4 text-center">ID Agent</th>
                <th className="border-b border-slate-200 px-4 py-4">Agent Name</th>
                <th className="border-b border-slate-200 px-4 py-4">SND</th>
                <th className="border-b border-slate-200 px-4 py-4">Company Name</th>
                <th className="border-b border-slate-200 px-4 py-4">Witel</th>
                <th className="border-b border-slate-200 px-4 py-4">Address</th>
                <th className="border-b border-slate-200 px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody id="arTableBody" className="divide-y divide-slate-100 bg-white">
              {pageRows.map((row, index) => {
                const mapTarget = row.address?.trim() || '';
                const mapUrl = mapTarget
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapTarget)}`
                  : '';

                return (
                  <tr key={`${row.idAgent}-${index}`} className={index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-50'}>
                    <td className="border-b border-slate-100 px-4 py-3 text-center font-medium text-slate-600">{row.idAgent}</td>
                    <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-800">
                      <button
                        type="button"
                        onClick={() => openDetailModal('Agent Name', row.namaAgent)}
                        className="block w-full truncate text-left hover:text-brand-600"
                      >
                        {row.namaAgent}
                      </button>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                      <span className="block w-full truncate text-left">{row.snd || '-'}</span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                      <button
                        type="button"
                        onClick={() => openDetailModal('Company Name', row.namaPerusahaan)}
                        className="block w-full truncate text-left hover:text-brand-600"
                      >
                        {row.namaPerusahaan || '-'}
                      </button>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                      <span className="block w-full truncate text-left">{row.witel || '-'}</span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                      <button
                        type="button"
                        onClick={() => openDetailModal('Address', row.address)}
                        className="block w-full truncate text-left hover:text-brand-600"
                      >
                        {row.address || '-'}
                      </button>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-center">
                      {mapUrl ? (
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-[72px] items-center justify-center rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200">
                          Maps
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pageRows.length === 0 ? (
            <div id="arEmptyState" className="flex flex-col items-center justify-center bg-white py-12 text-center text-slate-500">
              <p>No matching records found.</p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-700">{formatNumber(filteredRows.length === 0 ? 0 : (currentPage - 1) * limit + 1)}</span> to <span className="font-semibold text-slate-700">{formatNumber(Math.min(currentPage * limit, filteredRows.length))}</span> of <span className="font-semibold text-slate-700">{formatNumber(filteredRows.length)}</span> entries
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="arPrevBtn"
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="mr-1 inline-block h-4 w-4" />
              Previous
            </button>
            <div id="arPageNumbers" className="flex space-x-1">
              {getVisiblePageNumbers(currentPage, maxPage).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={[
                    'min-w-[32px] h-8 px-2 rounded text-sm font-medium transition-colors',
                    item === currentPage ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30' : 'bg-white border text-slate-600 hover:bg-slate-50'
                  ].join(' ')}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              id="arNextBtn"
              type="button"
              onClick={() => setPage((current) => Math.min(maxPage, current + 1))}
              disabled={currentPage === maxPage}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="ml-1 inline-block h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {detailModal ? (
        <div id="addressModal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setDetailModal(null);
          }
        }}>
          <div className="m-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{detailModal.label} Details</h3>
              <button type="button" onClick={() => setDetailModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p id="fullAddressText" className="leading-relaxed text-slate-700">{detailModal.value}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setDetailModal(null)} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeExportModal();
          }
        }}>
          <div className="m-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Download XLSX - Select Columns</h3>
              <button type="button" onClick={closeExportModal} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">Select the columns you want to export from table data (using active filters).</p>
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {EXPORT_COLUMNS.map((column) => (
                <label key={String(column.key)} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={selectedExportColumns.includes(String(column.key))}
                    onChange={(event) => {
                      const { checked } = event.target;
                      setSelectedExportColumns((current) => (
                        checked
                          ? [...current, String(column.key)]
                          : current.filter((item) => item !== String(column.key))
                      ));
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={exportCurrentPageOnly}
                onChange={(event) => setExportCurrentPageOnly(event.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Export current page only</span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeExportModal} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
                Cancel
              </button>
              <button type="button" onClick={handleDownload} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                Download
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}