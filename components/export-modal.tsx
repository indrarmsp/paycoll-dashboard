'use client';

import { X } from 'lucide-react';

export type ExportColumnDef = {
  key: string;
  label: string;
};

// Reusable XLSX export modal with column selection and page-only toggle.
export function ExportModal({
  columns,
  selectedColumns,
  onSelectedColumnsChange,
  exportCurrentPageOnly,
  onExportCurrentPageOnlyChange,
  onDownload,
  onClose
}: {
  columns: ExportColumnDef[];
  selectedColumns: string[];
  onSelectedColumnsChange: (next: string[]) => void;
  exportCurrentPageOnly: boolean;
  onExportCurrentPageOnlyChange: (checked: boolean) => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="m-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Download XLSX - Select Columns</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Select the columns you want to export from table data (using active filters).
        </p>
        <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((column) => (
            <label
              key={column.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <input
                type="checkbox"
                checked={selectedColumns.includes(column.key)}
                onChange={(event) => {
                  const { checked } = event.target;
                  onSelectedColumnsChange(
                    checked
                      ? [...selectedColumns, column.key]
                      : selectedColumns.filter((item) => item !== column.key)
                  );
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
            onChange={(event) => onExportCurrentPageOnlyChange(event.target.checked)}
            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>Export current page only</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
