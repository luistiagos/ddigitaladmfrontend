import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, perPage, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-end gap-1 text-sm text-gray-400">
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages[0] > 1 && (
          <>
            <PageBtn page={1} current={page} onClick={onChange} />
            {pages[0] > 2 && <span className="px-1">…</span>}
          </>
        )}

        {pages.map((p) => (
          <PageBtn key={p} page={p} current={page} onClick={onChange} />
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1">…</span>}
            <PageBtn page={totalPages} current={page} onClick={onChange} />
          </>
        )}

        <button
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
    </div>
  );
}

function PageBtn({ page, current, onClick }) {
  const active = page === current;
  return (
    <button
      onClick={() => onClick(page)}
      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-violet-600 text-white'
          : 'hover:bg-gray-700 text-gray-400'
      }`}
    >
      {page}
    </button>
  );
}
