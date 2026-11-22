"use client";

import React, { useEffect, useRef, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
  badge?: string;
  badgeClass?: string;
}

function sameSelection(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((v) => setA.has(v));
}

export function MultiSelectCheckbox({
  options,
  selected,
  onChange,
  placeholder,
  disabled = false,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<string[]>(selected);
  const selectedRef = useRef<string[]>(selected);
  const onChangeRef = useRef(onChange);

  selectedRef.current = selected;
  onChangeRef.current = onChange;

  useEffect(() => {
    setDraft(selected);
    draftRef.current = selected;
  }, [selected]);

  const updateDraft = (next: string[]) => {
    setDraft(next);
    draftRef.current = next;
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        if (!sameSelection(draftRef.current, selectedRef.current)) {
          onChangeRef.current(draftRef.current);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleValue = (val: string) => {
    if (draft.includes(val)) {
      updateDraft(draft.filter((v) => v !== val));
    } else {
      updateDraft([...draft, val]);
    }
  };

  const selectAll = () => {
    updateDraft(options.map((o) => o.value));
  };

  const clearAll = () => {
    updateDraft([]);
  };

  const handleApply = () => {
    setOpen(false);
    if (!sameSelection(draft, selected)) {
      onChange(draft);
    }
  };

  const activeList = open ? draft : selected;
  const buttonText =
    activeList.length === 0
      ? placeholder
      : activeList.length === 1
      ? options.find((o) => o.value === activeList[0])?.label || activeList[0]
      : `${activeList.length} selecionados`;

  return (
    <div className="position-relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        className={`form-select form-select-sm text-start text-truncate ${
          selected.length > 0 ? "border-primary fw-semibold text-primary" : ""
        }`}
        onClick={() => {
          if (open) {
            setOpen(false);
            if (!sameSelection(draft, selected)) {
              onChange(draft);
            }
          } else {
            updateDraft(selected);
            setOpen(true);
          }
        }}
        title={
          selected.length > 0
            ? selected
                .map((v) => options.find((o) => o.value === v)?.label || v)
                .join(", ")
            : placeholder
        }
      >
        {buttonText}
      </button>

      {open && !disabled && (
        <div
          className="dropdown-menu show p-2 shadow-sm"
          style={{
            minWidth: "100%",
            width: "max-content",
            maxWidth: 420,
            zIndex: 1060,
          }}
        >
          <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2 px-1">
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              onClick={selectAll}
            >
              Marcar todos
            </button>
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
              onClick={clearAll}
            >
              Limpar
            </button>
          </div>

          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {options.length === 0 ? (
              <div className="text-muted small px-2 py-1">
                Nenhuma opção disponível
              </div>
            ) : (
              options.map((opt) => {
                const checked = draft.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="dropdown-item rounded px-2 py-1 d-flex align-items-center justify-content-between gap-3"
                    style={{ cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    <span className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input m-0 flex-shrink-0"
                        checked={checked}
                        onChange={() => toggleValue(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </span>
                    {opt.badge && (
                      <span
                        className={`badge flex-shrink-0 ${
                          opt.badgeClass || "bg-light text-dark"
                        }`}
                        style={{ fontSize: "0.68rem" }}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <div className="border-top pt-2 mt-2 d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm px-3"
              onClick={handleApply}
            >
              <i className="bi bi-check2 me-1" />
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
