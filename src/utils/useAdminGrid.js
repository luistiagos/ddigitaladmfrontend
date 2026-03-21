import { useState } from 'react';

/**
 * useAdminGrid — manages sort column/direction and current page for admin grids.
 *
 * Usage:
 *   const { page, setPage, sortColumn, sortDirection, handleSort } =
 *     useAdminGrid({ defaultSort: 'datetime', defaultDir: 'desc' });
 */
export default function useAdminGrid({ defaultSort = 'id', defaultDir = 'desc' } = {}) {
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState(defaultSort);
  const [sortDirection, setSortDirection] = useState(defaultDir);

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  }

  return { page, setPage, sortColumn, sortDirection, handleSort };
}
