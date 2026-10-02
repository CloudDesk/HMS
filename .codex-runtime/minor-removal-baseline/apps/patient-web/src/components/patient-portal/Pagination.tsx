type PaginationProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav className="portal-pagination" aria-label="Pagination">
      <small className="portal-pagination-info">
        Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong>
      </small>
      <div className="portal-pagination-controls">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <i className="ph ph-caret-left" /> Previous
        </button>
        <span className="portal-pagination-pages">
          Page {currentPage} of {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          Next <i className="ph ph-caret-right" />
        </button>
      </div>
    </nav>
  );
}
