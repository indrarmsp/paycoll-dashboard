'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getVisiblePageNumbers } from '../lib/pagination';
import { formatNumber } from '../lib/sheets';

// Reusable pagination bar with previous/next and page number buttons.
export function PaginationControls({
  currentPage,
  maxPage,
  totalFiltered,
  limit,
  onPageChange,
  idPrefix = ''
}: {
  currentPage: number;
  maxPage: number;
  totalFiltered: number;
  limit: number;
  onPageChange: (page: number) => void;
  idPrefix?: string;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">
        Showing{' '}
        <span className="font-semibold text-slate-700">
          {formatNumber(totalFiltered === 0 ? 0 : (currentPage - 1) * limit + 1)}
        </span>{' '}
        to{' '}
        <span className="font-semibold text-slate-700">
          {formatNumber(Math.min(currentPage * limit, totalFiltered))}
        </span>{' '}
        of{' '}
        <span className="font-semibold text-slate-700">{formatNumber(totalFiltered)}</span> entries
      </div>
      <div className="flex items-center space-x-2">
        <button
          id={`${idPrefix}prevBtn`}
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="mr-1 inline-block h-4 w-4" />
          Previous
        </button>
        <div id={`${idPrefix}pageNumbers`} className="flex space-x-1">
          {getVisiblePageNumbers(currentPage, maxPage).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={[
                'min-w-[32px] h-8 px-2 rounded text-sm font-medium transition-colors',
                item === currentPage
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                  : 'bg-white border text-slate-600 hover:bg-slate-50'
              ].join(' ')}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          id={`${idPrefix}nextBtn`}
          type="button"
          onClick={() => onPageChange(Math.min(maxPage, currentPage + 1))}
          disabled={currentPage === maxPage}
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="ml-1 inline-block h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
