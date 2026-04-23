// Builds a compact page number list around the current page for pagination controls.
export function getVisiblePageNumbers(currentPage: number, maxPage: number) {
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(maxPage, start + 4);

  if (end - start < 4) {
    start = Math.max(1, end - 4);
  }

  const pages: number[] = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}
