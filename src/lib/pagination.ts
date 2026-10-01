// Page numbers to show: first, last, and a window around the current page
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const keep = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...keep].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}
