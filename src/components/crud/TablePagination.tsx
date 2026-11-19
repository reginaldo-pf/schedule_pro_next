"use client";

import React, { useState } from "react";

export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(totalItems, startIndex + pageSize);
  const paginatedItems = items.slice(startIndex, endIndex);

  const handlePageChange = (nextPage: number) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages));
  };

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  };

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    paginatedItems,
    setPage: handlePageChange,
    setPageSize: handlePageSizeChange,
  };
}

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) {
    pages.push("...");
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) {
    pages.push("...");
  }
  pages.push(total);
  return pages;
}

export function TablePagination({
  page,
  pageSize,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalItems === 0) return null;

  const pageRange = buildPageRange(page, totalPages);

  return (
    <div className="card-footer bg-white border-top py-2 px-4 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div className="d-flex align-items-center gap-3 small text-muted">
        <span>
          Exibindo <strong className="text-dark">{startIndex + 1}</strong> a{" "}
          <strong className="text-dark">{endIndex}</strong> de{" "}
          <strong className="text-dark">{totalItems}</strong> registro(s)
        </span>
        <div className="d-flex align-items-center gap-1">
          <span>Por página:</span>
          <select
            className="form-select form-select-sm py-0 ps-2 pe-4"
            style={{ width: "auto", height: 28, fontSize: "0.8rem" }}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <nav aria-label="Paginação de registros">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
            <button
              type="button"
              className="page-link"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Anterior
            </button>
          </li>

          {pageRange.map((p, idx) =>
            p === "..." ? (
              <li key={`ellipsis-${idx}`} className="page-item disabled">
                <span className="page-link">...</span>
              </li>
            ) : (
              <li
                key={p}
                className={`page-item ${p === page ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="page-link"
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </button>
              </li>
            )
          )}

          <li className={`page-item ${page >= totalPages ? "disabled" : ""}`}>
            <button
              type="button"
              className="page-link"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Próxima
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
