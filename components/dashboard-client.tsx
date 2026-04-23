"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpWideNarrow,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  LoaderCircle,
  Search,
  X
} from 'lucide-react';
import Chart from 'chart.js/auto';
import type { DashboardStats, FilterOptions, MainDashboardPayload, MainRow } from '../lib/types';
import { getVisiblePageNumbers } from '../lib/pagination';
import { formatCurrency, formatNumber, getWarmMainDashboardPromise, readMainDashboardCache, warmMainDashboardCache, writeMainDashboardCache, MAIN_DASHBOARD_BOOT_LIMIT } from '../lib/sheets';

type DashboardClientProps = {
  initialData?: {
    rows: MainRow[];
    filterOptions: FilterOptions;
    stats: DashboardStats;
  } | null;
};

type SortSaldo = 'DEFAULT' | 'LOWEST' | 'HIGHEST';
type FilterKey = 'datel' | 'billCategory' | 'umurCustomer' | 'status';

type DashboardFilters = {
  datel: string[];
  billCategory: string[];
  umurCustomer: string[];
  status: string[];
};

type ExportColumn = {
  key: keyof MainRow | 'paidStatus';
  label: string;
  getValue: (row: MainRow) => string | number;
};

const DEFAULT_FILTERS: DashboardFilters = {
  datel: [],
  billCategory: [],
  umurCustomer: [],
  status: []
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'snd', label: 'SND', getValue: (row) => row.snd },
  { key: 'sndGroup', label: 'SND Group', getValue: (row) => row.sndGroup },
  { key: 'nama', label: 'Name', getValue: (row) => row.nama },
  { key: 'alamat', label: 'Address', getValue: (row) => row.alamat },
  { key: 'datel', label: 'Datel', getValue: (row) => row.datel },
  { key: 'billCategory', label: 'Bill Category', getValue: (row) => row.billCategory },
  { key: 'saldo', label: 'Saldo', getValue: (row) => row.saldo },
  { key: 'umurCustomer', label: 'Customer Age', getValue: (row) => row.umurCustomer },
  { key: 'noHp', label: 'Phone Number', getValue: (row) => row.noHp },
  { key: 'email', label: 'Email', getValue: (row) => row.email },
  { key: 'paidStatus', label: 'Status', getValue: (row) => row.paidL11 || 'UNPAID' }
];

function ChartCard({
  title,
  chartType,
  labels,
  values,
  colors,
  legend,
  footer
}: {
  title: string;
  chartType: 'bar' | 'doughnut';
  labels: string[];
  values: number[];
  colors: string[];
  legend: Array<{ label: string; value: string; color: string }>;
  footer?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const chartConfig = {
      type: chartType,
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: chartType === 'bar'
            ? (context: { chart: Chart }) => {
                const { chart } = context;
                const { ctx, chartArea } = chart;
                if (!chartArea) {
                  return 'rgba(20, 184, 166, 0.95)';
                }

                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, 'rgba(20, 184, 166, 0.95)');
                gradient.addColorStop(1, 'rgba(56, 189, 248, 0.55)');
                return gradient;
              }
            : colors,
          borderColor: chartType === 'bar' ? 'transparent' : '#ffffff',
          borderWidth: chartType === 'bar' ? 0 : 4,
          hoverOffset: chartType === 'doughnut' ? 8 : 0,
          spacing: chartType === 'doughnut' ? 1 : 0,
          borderRadius: chartType === 'bar' ? 10 : 0,
          maxBarThickness: chartType === 'bar' ? 46 : undefined,
          barPercentage: chartType === 'bar' ? 0.7 : undefined,
          categoryPercentage: chartType === 'bar' ? 0.74 : undefined
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: chartType === 'doughnut' ? '68%' : undefined,
        rotation: chartType === 'doughnut' ? -90 : undefined,
        scales: chartType === 'bar' ? {
          x: {
            grid: {
              display: false
            },
            border: {
              display: false
            },
            ticks: {
              color: '#64748b',
              font: {
                size: 13,
                family: 'Inter, sans-serif'
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#dbe4f0',
              drawBorder: false
            },
            border: {
              display: false
            },
            ticks: {
              color: '#64748b',
              font: {
                size: 13,
                family: 'Inter, sans-serif'
              },
              callback(value: string | number) {
                const numericValue = Number(value);
                if (numericValue === 0) {
                  return '0K';
                }

                if (numericValue >= 1_000_000_000) {
                  return `${(numericValue / 1_000_000_000).toFixed(1)}B`;
                }

                if (numericValue >= 1_000_000) {
                  return `${(numericValue / 1_000_000).toFixed(1)}M`;
                }

                if (numericValue >= 1_000) {
                  return `${(numericValue / 1_000).toFixed(1)}K`;
                }

                return `${numericValue}K`;
              }
            }
          }
        } : undefined,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            displayColors: true
          }
        }
      }
    } as any;

    const chart = new Chart(canvas, chartConfig);

    return () => chart.destroy();
  }, [chartType, colors, labels, values]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">{title}</h2>
      <div className={chartType === 'bar' ? 'flex flex-1 flex-col' : 'flex flex-1 flex-col items-center'}>
        <div className={chartType === 'bar' ? 'relative h-[320px] w-full' : 'relative mx-auto h-72 w-72'}>
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>

        {chartType === 'doughnut' ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium tracking-wide">{item.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        ) : footer ? (
          <div className="mt-4 text-center text-sm font-medium text-slate-600">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [rows, setRows] = useState<MainRow[]>(initialData?.rows ?? []);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(initialData?.filterOptions ?? { datel: [], billCategory: [], umurCustomer: [] });
  const [stats, setStats] = useState<DashboardStats>(initialData?.stats ?? { categoryStats: {}, paidCount: 0, unpaidCount: 0 });
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [hydrationDone, setHydrationDone] = useState(Boolean(initialData));

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortSaldo, setSortSaldo] = useState<SortSaldo>('DEFAULT');
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [openPopup, setOpenPopup] = useState<FilterKey | null>(null);
  const [detailModal, setDetailModal] = useState<{ label: string; value: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCurrentPageOnly, setExportCurrentPageOnly] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(EXPORT_COLUMNS.map((column) => String(column.key)));
  const hasInitializedFilters = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const cachedPayload = readMainDashboardCache();
        if (cachedPayload) {
          setRows(cachedPayload.rows || []);
          setFilterOptions(cachedPayload.filterOptions || { datel: [], billCategory: [], umurCustomer: [] });
          setStats(cachedPayload.stats || { categoryStats: {}, paidCount: 0, unpaidCount: 0 });
          setLoading(false);
          setHydrationDone(true);
          return;
        }

        if (initialData) {
          setRows(initialData.rows || []);
          setFilterOptions(initialData.filterOptions || { datel: [], billCategory: [], umurCustomer: [] });
          setStats(initialData.stats || { categoryStats: {}, paidCount: 0, unpaidCount: 0 });
          setLoading(false);
          setHydrationDone(true);

          if ((initialData.rows || []).length > 0 && (initialData.rows || []).length <= MAIN_DASHBOARD_BOOT_LIMIT) {
            void warmMainDashboardCache()
              .then((fullPayload: MainDashboardPayload | null) => {
                if (cancelled || !fullPayload?.rows?.length) {
                  return;
                }

                setRows(fullPayload.rows);
                setFilterOptions(fullPayload.filterOptions || { datel: [], billCategory: [], umurCustomer: [] });
                setStats(fullPayload.stats || { categoryStats: {}, paidCount: 0, unpaidCount: 0 });
              })
              .catch(() => null);
          }

          return;
        }

        const warmPromise = getWarmMainDashboardPromise();
        if (warmPromise) {
          const warmedPayload = await warmPromise;
          if (cancelled) {
            return;
          }

          if (warmedPayload) {
            if (!warmedPayload.rows?.length) {
              setLoading(false);
              setHydrationDone(true);
              return;
            }

            setRows(warmedPayload.rows || []);
            setFilterOptions(warmedPayload.filterOptions || { datel: [], billCategory: [], umurCustomer: [] });
            setStats(warmedPayload.stats || { categoryStats: {}, paidCount: 0, unpaidCount: 0 });
            setLoading(false);
            setHydrationDone(true);
            return;
          }
        }

        setLoading(true);
        const bootResponse = await fetch('/api/sheets/main?limit=1200', {
          cache: 'no-store'
        });
        const bootPayload = await bootResponse.json() as {
          rows?: MainRow[];
          filterOptions?: FilterOptions;
          stats?: DashboardStats;
          message?: string;
        };

        if (!bootResponse.ok) {
          throw new Error(bootPayload.message || 'Failed to load dashboard data');
        }

        if (cancelled) {
          return;
        }

        if (bootPayload.rows?.length) {
          setRows(bootPayload.rows || []);
          setFilterOptions(bootPayload.filterOptions || { datel: [], billCategory: [], umurCustomer: [] });
          setStats(bootPayload.stats || { categoryStats: {}, paidCount: 0, unpaidCount: 0 });
        }
        setLoading(false);

        if ((bootPayload.rows || []).length >= 1200) {
          void fetch('/api/sheets/main', { cache: 'no-store' })
            .then((response) => response.json())
            .then((fullPayload: {
              rows?: MainRow[];
              filterOptions?: FilterOptions;
              stats?: DashboardStats;
            }) => {
              if (cancelled || !fullPayload.rows) {
                return;
              }

              const payload = {
                rows: fullPayload.rows,
                filterOptions: fullPayload.filterOptions || { datel: [], billCategory: [], umurCustomer: [] },
                stats: fullPayload.stats || { categoryStats: {}, paidCount: 0, unpaidCount: 0 }
              };

              if (!fullPayload.rows?.length) {
                return;
              }

              writeMainDashboardCache(payload);
              setRows(fullPayload.rows);
              setFilterOptions(payload.filterOptions);
              setStats(payload.stats);
            })
            .catch(() => null);
        }

        if (!cancelled) {
          setHydrationDone(true);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard data');
        setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  useEffect(() => {
    if (hasInitializedFilters.current) {
      return;
    }

    if (
      filterOptions.datel.length === 0
      && filterOptions.billCategory.length === 0
      && filterOptions.umurCustomer.length === 0
    ) {
      return;
    }

    setFilters({
      datel: [...filterOptions.datel],
      billCategory: [...filterOptions.billCategory],
      umurCustomer: [...filterOptions.umurCustomer],
      status: ['PAID', 'UNPAID']
    });
    hasInitializedFilters.current = true;
  }, [filterOptions]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-filter-popup], [data-filter-button]')) {
        setOpenPopup(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filteredRows = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    const nextRows = rows.filter((row) => {
      const matchSearch = !term || row._namaLower.includes(term) || row._sndLower.includes(term);
      const matchDatel = filters.datel.includes(row.datel);
      const matchCategory = filters.billCategory.includes(row.billCategory);
      const matchUmur = filters.umurCustomer.includes(row.umurCustomer);
      const matchStatus = filters.status.includes(row._paidStatus);
      return matchSearch && matchDatel && matchCategory && matchUmur && matchStatus;
    });

    if (sortSaldo === 'LOWEST') {
      nextRows.sort((left, right) => left.saldo - right.saldo);
    } else if (sortSaldo === 'HIGHEST') {
      nextRows.sort((left, right) => right.saldo - left.saldo);
    }

    return nextRows;
  }, [deferredSearchTerm, filters, rows, sortSaldo]);

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
  }, [searchTerm, sortSaldo, filters.datel, filters.billCategory, filters.umurCustomer, filters.status, limit]);

  function toggleFilterValue(key: FilterKey, value: string) {
    setFilters((current) => {
      const currentValues = current[key];

      if (currentValues.includes(value)) {
        return {
          ...current,
          [key]: currentValues.filter((item) => item !== value)
        };
      }

      return {
        ...current,
        [key]: [...currentValues, value]
      };
    });
  }

  function clearFilterValues(key: FilterKey) {
    setFilters((current) => ({ ...current, [key]: [] }));
  }

  function getFilterValuesByKey(key: FilterKey) {
    if (key === 'datel') {
      return filterOptions.datel;
    }

    if (key === 'billCategory') {
      return filterOptions.billCategory;
    }

    if (key === 'umurCustomer') {
      return filterOptions.umurCustomer;
    }

    return ['PAID', 'UNPAID'];
  }

  function toggleSelectAllFilterValues(key: FilterKey) {
    const allValues = getFilterValuesByKey(key);
    setFilters((current) => {
      const allSelected = allValues.length > 0 && current[key].length === allValues.length;

      return {
        ...current,
        [key]: allSelected ? [] : [...allValues]
      };
    });
  }

  function hasActiveFilter(key: FilterKey) {
    const totalValues = getFilterValuesByKey(key).length;
    if (totalValues === 0) {
      return false;
    }

    return filters[key].length !== totalValues;
  }

  function cycleSortSaldo() {
    setSortSaldo((current) => {
      if (current === 'DEFAULT') {
        return 'LOWEST';
      }

      if (current === 'LOWEST') {
        return 'HIGHEST';
      }

      return 'DEFAULT';
    });
  }

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
    if (!hydrationDone) {
      window.alert('Data is still syncing in background. Please wait a moment and try again.');
      return;
    }

    const selectedColumns = EXPORT_COLUMNS.filter((column) => selectedExportColumns.includes(String(column.key)));

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

    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
    const suffix = exportCurrentPageOnly ? `_page${currentPage}` : '';
    const filename = `dashboard_${stamp}${suffix}.xlsx`;

    // Call export API
    fetch('/api/export/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        sheetName: 'Dashboard',
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

  const totalSaldo = useMemo(
    () => Object.values(stats.categoryStats).reduce((sum, value) => sum + value, 0),
    [stats.categoryStats]
  );

  const categoryEntries = useMemo(
    () => Object.entries(stats.categoryStats)
      .sort((left, right) => right[1] - left[1])
      .map(([label, value], index) => ({
        label,
        value,
        color: ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f97316', '#e11d48', '#22c55e', '#64748b'][index % 7]
      })),
    [stats.categoryStats]
  );

  const statusEntries = [
    { label: 'Paid', value: stats.paidCount, color: '#14b8a6' },
    { label: 'Unpaid', value: stats.unpaidCount, color: '#f97316' }
  ];

  const totalStatus = stats.paidCount + stats.unpaidCount;

  if (loading) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm transition-opacity duration-300">
        <LoaderCircle className="mb-4 h-10 w-10 animate-spin text-brand-500" />
        <p className="mt-2 font-medium text-slate-700">Please wait a moment</p>
        <p className="mt-1 text-sm text-slate-500">We are loading your dashboard data.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 text-rose-600 shadow-sm">
        <div className="flex items-center gap-3">
          <X className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold text-rose-700">Dashboard failed to load</h2>
            <p className="text-sm text-rose-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
        <ChartCard
          title="Total Saldo per Bill Category"
          chartType="bar"
          labels={categoryEntries.length ? categoryEntries.map((entry) => entry.label) : ['No data']}
          values={categoryEntries.length ? categoryEntries.map((entry) => entry.value) : [1]}
          colors={categoryEntries.length ? categoryEntries.map((entry) => entry.color) : ['#cbd5e1']}
          legend={[]}
          footer={`Total saldo: ${formatCurrency(totalSaldo)}`}
        />

        <ChartCard
          title="Payment Status"
          chartType="doughnut"
          labels={statusEntries.map((entry) => entry.label)}
          values={statusEntries.map((entry) => entry.value)}
          colors={statusEntries.map((entry) => entry.color)}
          legend={statusEntries.map((entry) => ({
            label: entry.label,
            value: formatNumber(entry.value),
            color: entry.color
          }))}
        />
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center">
          <h2 className="text-lg font-semibold text-slate-800">Customer Data</h2>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="openExportMainModal"
              type="button"
              onClick={openExportModal}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Download className="mr-1 inline-block h-4 w-4" />
              Download XLSX
            </button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="searchInput"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search..."
                className="w-48 rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <select
              id="pageSizeSelect"
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
        </div>

        <div className="table-container relative w-full overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 shadow-sm">
              <tr>
                <th className="px-4 py-4 border-b border-slate-200">SND</th>
                <th className="px-4 py-4 border-b border-slate-200">SND Group</th>
                <th className="px-4 py-4 border-b border-slate-200">Name</th>
                <th className="px-4 py-4 border-b border-slate-200">Address</th>
                <th className="relative px-4 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    Datel
                    <button data-filter-button type="button" onClick={() => setOpenPopup((current) => (current === 'datel' ? null : 'datel'))} className={hasActiveFilter('datel') ? 'text-brand-600' : 'text-slate-400 hover:text-brand-600'}>
                      <Filter className="h-3 w-3" />
                    </button>
                  </div>
                  {openPopup === 'datel' ? (
                    <div data-filter-popup className="absolute left-3 top-12 z-20 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Filter Datel</p>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {`${filters.datel.length} selected`}
                        </span>
                        <button type="button" onClick={() => toggleSelectAllFilterValues('datel')} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          {filters.datel.length === filterOptions.datel.length && filterOptions.datel.length > 0 ? 'Uncheck All' : 'Select All'}
                        </button>
                      </div>
                      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                        {filterOptions.datel.map((option) => (
                          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                            <input type="checkbox" checked={filters.datel.includes(option)} onChange={() => toggleFilterValue('datel', option)} className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                            <span className="truncate">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </th>
                <th className="relative px-4 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    Category
                    <button data-filter-button type="button" onClick={() => setOpenPopup((current) => (current === 'billCategory' ? null : 'billCategory'))} className={hasActiveFilter('billCategory') ? 'text-brand-600' : 'text-slate-400 hover:text-brand-600'}>
                      <Filter className="h-3 w-3" />
                    </button>
                  </div>
                  {openPopup === 'billCategory' ? (
                    <div data-filter-popup className="absolute left-3 top-12 z-20 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Filter Bill Category</p>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {`${filters.billCategory.length} selected`}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSelectAllFilterValues('billCategory')}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          {filters.billCategory.length === filterOptions.billCategory.length && filterOptions.billCategory.length > 0 ? 'Uncheck All' : 'Select All'}
                        </button>
                      </div>
                      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                        {filterOptions.billCategory.map((option) => (
                          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={filters.billCategory.includes(option)}
                              onChange={() => toggleFilterValue('billCategory', option)}
                              className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                            />
                            <span className="truncate">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </th>
                <th className="px-4 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    Balance
                    <button
                      id="sortSaldoBtn"
                      type="button"
                      onClick={cycleSortSaldo}
                      title={`Sort Saldo: ${sortSaldo.toLowerCase()}`}
                      className={sortSaldo === 'DEFAULT' ? 'text-slate-400 hover:text-brand-600' : 'text-brand-600'}
                    >
                      {sortSaldo === 'LOWEST' ? <ArrowUpWideNarrow className="h-3 w-3" /> : sortSaldo === 'HIGHEST' ? <ArrowDownWideNarrow className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  </div>
                </th>
                <th className="relative px-4 py-4 border-b border-slate-200 text-center whitespace-nowrap">
                  <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                    <span>Age</span>
                    <button data-filter-button type="button" onClick={() => setOpenPopup((current) => (current === 'umurCustomer' ? null : 'umurCustomer'))} className={[hasActiveFilter('umurCustomer') ? 'text-brand-600' : 'text-slate-400 hover:text-brand-600', 'shrink-0'].join(' ')}>
                      <Filter className="h-3 w-3" />
                    </button>
                  </div>
                  {openPopup === 'umurCustomer' ? (
                    <div data-filter-popup className="absolute left-1/2 top-12 z-40 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Filter Customer Age</p>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {`${filters.umurCustomer.length} selected`}
                        </span>
                        <button type="button" onClick={() => toggleSelectAllFilterValues('umurCustomer')} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          {filters.umurCustomer.length === filterOptions.umurCustomer.length && filterOptions.umurCustomer.length > 0 ? 'Uncheck All' : 'Select All'}
                        </button>
                      </div>
                      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                        {filterOptions.umurCustomer.map((option) => (
                          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                            <input type="checkbox" checked={filters.umurCustomer.includes(option)} onChange={() => toggleFilterValue('umurCustomer', option)} className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                            <span className="truncate">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </th>
                <th className="relative px-4 py-4 border-b border-slate-200 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2">
                    Status
                    <button data-filter-button type="button" onClick={() => setOpenPopup((current) => (current === 'status' ? null : 'status'))} className={hasActiveFilter('status') ? 'text-brand-600' : 'text-slate-400 hover:text-brand-600'}>
                      <Filter className="h-3 w-3" />
                    </button>
                  </div>
                  {openPopup === 'status' ? (
                    <div data-filter-popup className="absolute right-3 top-12 z-20 w-56 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Filter Status</p>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {`${filters.status.length} selected`}
                        </span>
                        <button type="button" onClick={() => toggleSelectAllFilterValues('status')} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          {filters.status.length === 2 ? 'Uncheck All' : 'Select All'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {['PAID', 'UNPAID'].map((option) => (
                          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                            <input type="checkbox" checked={filters.status.includes(option)} onChange={() => toggleFilterValue('status', option)} className="rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                            <span className="truncate">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody id="tableBody" className="divide-y divide-slate-100 bg-white">
              {pageRows.map((row, index) => {
                const isPaid = row.paidL11.toUpperCase() === 'PAID';
                const badgeStyle = isPaid
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                  : 'border-rose-200 bg-rose-100 text-rose-700';

                return (
                  <tr key={`${row.snd}-${index}`} className={index % 2 === 0 ? 'bg-white hover:bg-brand-50' : 'bg-slate-50/50 hover:bg-brand-50'}>
                    <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-600">{row.snd}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                      <span className="block w-full truncate text-left">{row.sndGroup || '-'}</span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-800">
                      <button
                        type="button"
                        onClick={() => openDetailModal('Name', row.nama || '-')}
                        className="block w-full truncate text-left hover:text-brand-600"
                      >
                        {row.nama || '-'}
                      </button>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                      <button
                        type="button"
                        onClick={() => openDetailModal('Address', row.alamat || '-')}
                        className="block w-full truncate text-left hover:text-brand-600"
                      >
                        {row.alamat || '-'}
                      </button>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                      <button
                        type="button"
                        onClick={() => openDetailModal('Datel', row.datel || '-')}
                        className="block w-full truncate text-left hover:text-brand-600"
                      >
                        {row.datel || '-'}
                      </button>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3">
                      <span className="inline-flex max-w-full items-center rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600" title={row.billCategory || 'Unknown'}>
                        <span className="truncate">{row.billCategory || 'Unknown'}</span>
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(row.saldo)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-center text-slate-500 whitespace-nowrap">{row.umurCustomer}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-center whitespace-nowrap">
                      <span className={['rounded-lg border px-2 py-1 text-[11px] font-medium', badgeStyle].join(' ')}>{row.paidL11 || 'UNPAID'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pageRows.length === 0 ? (
            <div id="emptyState" className="flex flex-col items-center justify-center bg-white py-12 text-center text-slate-500">
              <Search className="mb-3 h-10 w-10 text-slate-300" />
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
              id="prevBtn"
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="mr-1 inline-block h-4 w-4" />
              Previous
            </button>
            <div id="pageNumbers" className="flex space-x-1">
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
              id="nextBtn"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setDetailModal(null);
          }
        }}>
          <div className="m-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{detailModal.label}</h3>
              <button type="button" onClick={() => setDetailModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="break-words leading-relaxed text-slate-700">{detailModal.value}</p>
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
