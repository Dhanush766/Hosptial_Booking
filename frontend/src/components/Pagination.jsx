// Page buttons for a DRF-paginated list: <Pagination page={1} count={42} pageSize={10} onChange={setPage} />
export default function Pagination({ page, count, pageSize = 10, onChange }) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  // Show at most 5 page numbers around the current page.
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const last = Math.min(totalPages, first + 4);
  const numbers = [];
  for (let number = first; number <= last; number += 1) numbers.push(number);

  return (
    <nav aria-label="Pages" className="mt-3">
      <ul className="pagination justify-content-center flex-wrap mb-0">
        <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
          <button type="button" className="page-link" onClick={() => onChange(page - 1)} disabled={page <= 1}>
            Previous
          </button>
        </li>
        {numbers.map((number) => (
          <li key={number} className={`page-item ${number === page ? "active" : ""}`}>
            <button type="button" className="page-link" onClick={() => onChange(number)}>
              {number}
            </button>
          </li>
        ))}
        <li className={`page-item ${page >= totalPages ? "disabled" : ""}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}
