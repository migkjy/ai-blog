'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    }
  }

  // Insert ellipsis markers (represented as -1)
  const withEllipsis: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) {
      withEllipsis.push(-1);
    }
    withEllipsis.push(pages[i]);
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        이전
      </button>
      {withEllipsis.map((p, idx) =>
        p === -1 ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-sm text-[var(--color-text-muted)]">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${
              p === page
                ? 'bg-[var(--color-primary)] text-white font-semibold'
                : 'border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        다음
      </button>
    </nav>
  );
}
