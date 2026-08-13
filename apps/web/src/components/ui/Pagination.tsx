type PaginationProps = {
  page: number;
  pageCount: number;
  totalLabel: string;
};

export function Pagination({ page, pageCount, totalLabel }: PaginationProps) {
  return (
    <div className="pagination">
      <span>{totalLabel}</span>
      <div className="pagination-controls" aria-label="Pagination">
        <button type="button" aria-label="Previous page">
          <i className="ph ph-caret-left" aria-hidden="true" />
        </button>
        <button className="active" type="button" aria-current="page">
          {page}
        </button>
        <button type="button">{Math.min(page + 1, pageCount)}</button>
        <button type="button" aria-label="Next page">
          <i className="ph ph-caret-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
