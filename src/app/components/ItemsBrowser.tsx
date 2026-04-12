"use client";

import { useState, useEffect, useCallback } from "react";
import ItemModal from "@/app/components/ItemModal";

interface Item {
  id: number;
  expression: string;
  reading: string;
  meaning: string;
  type: string;
  jlptLevel: string;
  status: string;
  wkSubjectId: number | null;
  wkLevel: number | null;
  wkCharacters: string | null;
  matchType: string | null; // "exact" | "reading" | "prefix_strip" | null
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ItemsBrowser({ 
  apiUrl, 
  title, 
  itemType 
}: { 
  apiUrl: string; 
  title: string; 
  itemType: "kanji" | "vocab" | "radical"
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [modalTarget, setModalTarget] = useState<{ type: "item"; id: number } | { type: "radical"; wkSubjectId: number } | null>(null);

  // Filters
  const [level, setLevel] = useState<string>("");

  const [search, setSearch] = useState<string>("");
  const [onWanikani, setOnWanikani] = useState<string>("");
  const [page, setPage] = useState(1);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (level) params.set("level", level);

    if (search) params.set("search", search);
    if (onWanikani) params.set("onWanikani", onWanikani);
    params.set("page", page.toString());
    params.set("limit", "30");

    try {
      const res = await fetch(`${apiUrl}?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 30, total: 0, totalPages: 0 });
    } catch { /* */ }
    setLoading(false);
  }, [apiUrl, level, search, onWanikani, page]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [level, search, onWanikani]);



  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  // Build external URLs
  const getWkUrl = (item: Item) => {
    if (!item.wkSubjectId || item.matchType === "pseudo") return null;
    let wkExpr = item.wkCharacters || item.expression;
    if (item.type === "radical") {
       wkExpr = item.meaning.toLowerCase();
    }
    const wkType = item.type === "kanji" ? "kanji" : item.type === "radical" ? "radicals" : "vocabulary";
    return `https://www.wanikani.com/${wkType}/${encodeURIComponent(wkExpr)}`;
  };

  const getJishoUrl = (item: Item) => {
    return `https://jisho.org/search/${encodeURIComponent(item.expression)}`;
  };

  // Does the WK expression differ from the JLPT expression?
  const hasAltExpression = (item: Item) => {
    if (item.matchType === "pseudo") return false;
    return item.wkCharacters && item.wkCharacters !== item.expression;
  };

  const openItem = (item: Item) => {
    setModalTarget({ type: "item", id: item.id });
  };

  const FilterBtn = ({ label, value, current, setter }: { label: string; value: string; current: string; setter: (v: string) => void }) => (
    <button
      className={`filter-btn ${current === value ? "active" : ""}`}
      onClick={() => setter(current === value ? "" : value)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{pagination.total} items found</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search kanji, reading, or meaning..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <FilterBtn label="N5" value="N5" current={level} setter={setLevel} />
        <FilterBtn label="N4" value="N4" current={level} setter={setLevel} />
        <FilterBtn label="Other" value="other" current={level} setter={setLevel} />

        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>|</span>
        <FilterBtn label="On WK" value="true" current={onWanikani} setter={setOnWanikani} />
        <FilterBtn label="Not on WK" value="false" current={onWanikani} setter={setOnWanikani} />
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <span>Loading items...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-text">No items found</div>
          <p style={{ color: "var(--text-muted)" }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div className="items-grid">
          {items.map((item) => (
            <div key={item.id} className="item-card" onClick={() => openItem(item)} style={{ cursor: "pointer" }}>
              <div className="item-card-header">
                <div className="item-expression-col">
                  <div className="item-expression">{item.expression}</div>
                  {hasAltExpression(item) && (
                    <span className="item-wk-alt" title={`WaniKani uses: ${item.wkCharacters}`}>
                      WK: {item.wkCharacters}
                    </span>
                  )}
                </div>
                <div className="item-links" onClick={(e) => e.stopPropagation()}>
                  {getWkUrl(item) && (
                    <a
                      href={getWkUrl(item)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="item-link-icon"
                      title="Open on WaniKani"
                    >
                      🐊
                    </a>
                  )}
                  <a
                    href={getJishoUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="item-link-icon"
                    title="Open on Jisho.org"
                  >
                    📖
                  </a>
                </div>
              </div>
              <div className="item-reading">{item.reading}</div>
              <div className="item-meaning">{item.meaning}</div>
              <div className="item-meta">
                <span className={`badge badge-${item.jlptLevel.toLowerCase()}`}>{item.jlptLevel}</span>
                <span className={`badge badge-${item.type}`}>{item.type === "kanji" ? "漢字" : item.type === "radical" ? "部首" : "語彙"}</span>
                {item.wkSubjectId && item.matchType !== "pseudo" && (
                  <span className="badge badge-wk">WK Lv.{item.wkLevel}</span>
                )}
                {item.matchType === "pseudo" && (
                  <span className="badge badge-wk" style={{backgroundColor: "rgba(99, 102, 241, 0.1)", color: "var(--accent-blue)", border: "1px solid rgba(99, 102, 241, 0.3)"}}>✨ AI Context</span>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-outline btn-sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
            ← Prev
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button className="btn btn-outline btn-sm" onClick={() => setPage(Math.min(pagination.totalPages, page + 1))} disabled={page >= pagination.totalPages}>
            Next →
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      {/* Detail Modal */}
      {modalTarget && (() => {
        let onNext, onPrev;
        if (modalTarget.type === "item") {
          const idx = items.findIndex((i) => i.id === modalTarget.id);
          if (idx !== -1) {
            if (idx > 0) onPrev = () => setModalTarget({ type: "item", id: items[idx - 1].id });
            if (idx < items.length - 1) onNext = () => setModalTarget({ type: "item", id: items[idx + 1].id });
          }
        }
        return (
          <ItemModal
            target={modalTarget}
            onClose={() => {
              setModalTarget(null);
              loadItems();
            }}
            onNavigateItem={(id: number) => setModalTarget({ type: "item", id })}
            onNavigateRadical={(wkSubjectId: number) => setModalTarget({ type: "radical", wkSubjectId })}
            onNext={onNext}
            onPrev={onPrev}
          />
        );
      })()}
    </>
  );
}
