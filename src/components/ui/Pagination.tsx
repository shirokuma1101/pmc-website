import Link from "next/link";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  pageParam?: string;
  ariaLabel?: string;
}

function pageHref(basePath: string, pageParam: string, page: number) {
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}${pageParam}=${page}`;
}

function visiblePages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  pageParam = "page",
  ariaLabel = "ページを選択",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(currentPage, 1), totalPages);

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      {current > 1 ? (
        <Link className="pagination__direction" href={pageHref(basePath, pageParam, current - 1)}>
          <span aria-hidden="true">←</span> 前へ
        </Link>
      ) : (
        <span className="pagination__direction pagination__direction--disabled">← 前へ</span>
      )}
      <ol className="pagination__pages">
        {visiblePages(current, totalPages).map((page, index) =>
          page === "ellipsis" ? (
            <li key={`ellipsis-${index}`} className="pagination__ellipsis" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                className="pagination__page"
                href={pageHref(basePath, pageParam, page)}
                aria-current={page === current ? "page" : undefined}
                aria-label={`${page}ページ目${page === current ? "、現在のページ" : ""}`}
              >
                {page}
              </Link>
            </li>
          ),
        )}
      </ol>
      {current < totalPages ? (
        <Link className="pagination__direction" href={pageHref(basePath, pageParam, current + 1)}>
          次へ <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className="pagination__direction pagination__direction--disabled">次へ →</span>
      )}
    </nav>
  );
}
