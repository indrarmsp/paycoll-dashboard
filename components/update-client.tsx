'use client';

import { useState, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle,
  FileUp,
  LoaderCircle,
  RefreshCw
} from 'lucide-react';
import { DASHBOARD_DATA_UPDATED_EVENT } from '../lib/sheets';
import { toErrorMessage } from '../lib/export-utils';

type UpdateStatus = 'idle' | 'loading' | 'success' | 'error';

interface UpdateResponse {
  message: string;
  synced?: number;
  total?: number;
  strategy?: string;
  error?: string;
}


// Builds the short success message shown in the card footer.
function buildSuccessMessage(message: string, synced?: number, suffix = 'records') {
  return `✓ ${message}${synced ? ` (${synced} ${suffix})` : ''}`;
}

function withStrategy(message: string, strategy?: string) {
  if (!strategy) {
    return message;
  }

  return `${message} [${strategy}]`;
}

// Shared fetch helper for JSON endpoints.
async function postJson<T>(url: string, body?: BodyInit) {
  const response = await fetch(url, {
    method: 'POST',
    headers: body ? undefined : { 'Content-Type': 'application/json' },
    body
  });

  return {
    ok: response.ok,
    data: (await response.json()) as T
  };
}

function broadcastDashboardUpdate(source: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const version = String(Date.now());
    localStorage.setItem('pcDashboardDataVersion', version);
    window.dispatchEvent(new CustomEvent(DASHBOARD_DATA_UPDATED_EVENT, { detail: { source, version } }));
  } catch {
    window.dispatchEvent(new CustomEvent(DASHBOARD_DATA_UPDATED_EVENT, { detail: { source } }));
  }
}

// Main card UI that exposes the two update actions.
export function UpdateClient() {
  const [prqStatus, setPrqStatus] = useState<UpdateStatus>('idle');
  const [prqMessage, setPrqMessage] = useState('');

  const [viseoproStatus, setViseoproStatus] = useState<UpdateStatus>('idle');
  const [viseoproMessage, setViseoproMessage] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Syncs Report PRQ with the latest rows from PRITI DATA.
  async function handleSyncPRQ() {
    setPrqStatus('loading');
    setPrqMessage('');

    try {
      const { ok, data } = await postJson<UpdateResponse>('/api/sheets/update/sync-prq');

      if (!ok) {
        setPrqStatus('error');
        setPrqMessage(data.error || data.message || 'Sync failed');
        return;
      }

      setPrqStatus('success');
      setPrqMessage(withStrategy(buildSuccessMessage(data.message, data.synced, 'records synced'), data.strategy));
      broadcastDashboardUpdate('sync-prq');

      // Let the success state linger briefly before clearing it.
      setTimeout(() => setPrqStatus('idle'), 3000);
    } catch (error) {
      setPrqStatus('error');
      setPrqMessage(toErrorMessage(error, 'Network error'));
    }
  }

  // Uploads an XLSX file and appends only newer VISEEPRO rows.
  async function handleUploadViseepro(file: File) {
    setViseoproStatus('loading');
    setViseoproMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { ok, data } = await postJson<UpdateResponse>('/api/sheets/update/upload-viseepro', formData);

      if (!ok) {
        setViseoproStatus('error');
        setViseoproMessage(data.error || data.message || 'Upload failed');
        setUploadedFileName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setViseoproStatus('success');
      setViseoproMessage(withStrategy(buildSuccessMessage(data.message, data.synced, 'records added'), data.strategy));
      broadcastDashboardUpdate('upload-viseepro');

      // Clear the highlighted filename once the success state fades out.
      setTimeout(() => {
        setViseoproStatus('idle');
        setUploadedFileName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
    } catch (error) {
      setViseoproStatus('error');
      setViseoproMessage(toErrorMessage(error, 'Network error'));
      setUploadedFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // Starts the upload flow after a file is selected.
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      handleUploadViseepro(file);
    }
  }

  // Opens the file picker without exposing the hidden input.
  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  return (
    <div className="relative mx-auto max-w-7xl space-y-6">
      {/* Feature 1: Sync Report PRQ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Sync Report PRQ
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Pull the latest rows from PRITI DATA and append only new records.
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <button
            onClick={handleSyncPRQ}
            disabled={prqStatus === 'loading'}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors',
              prqStatus === 'loading'
                ? 'cursor-not-allowed bg-blue-100 text-blue-600'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            ].join(' ')}
          >
            {prqStatus === 'loading' ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5" />
                Update Report PRQ
              </>
            )}
          </button>

          {(prqStatus === 'success' || prqStatus === 'error') && (
            <div
              className={[
                'flex items-center gap-2 text-sm font-medium',
                prqStatus === 'success' ? 'text-green-600' : 'text-red-600'
              ].join(' ')}
            >
              {prqStatus === 'success' ? (
                <CheckCircle className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{prqMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Feature 2: Upload XLSX to Viseepro */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Update VISEEPRO
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Upload new VISEEPRO data, and we&apos;ll automatically update the latest one.
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={viseoproStatus === 'loading'}
            className="hidden"
          />

          <button
            onClick={triggerFileInput}
            disabled={viseoproStatus === 'loading'}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors',
              viseoproStatus === 'loading'
                ? 'cursor-not-allowed bg-green-100 text-green-600'
                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
            ].join(' ')}
          >
            {viseoproStatus === 'loading' ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <FileUp className="h-5 w-5" />
                Select XLSX File
              </>
            )}
          </button>

          {uploadedFileName && (
            <div className="w-fit rounded bg-slate-100 px-3 py-2">
              <p className="text-sm font-medium text-slate-700">{uploadedFileName}</p>
            </div>
          )}

          {(viseoproStatus === 'success' || viseoproStatus === 'error') && (
            <div
              className={[
                'flex items-center gap-2 text-sm font-medium',
                viseoproStatus === 'success' ? 'text-green-600' : 'text-red-600'
              ].join(' ')}
            >
              {viseoproStatus === 'success' ? (
                <CheckCircle className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{viseoproMessage}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
