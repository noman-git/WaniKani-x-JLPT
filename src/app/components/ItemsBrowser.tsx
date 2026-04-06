"use client";

import { useState, useEffect, useCallback } from "react";
import ItemDetailModal from "@/app/components/ItemDetailModal";

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
  itemType: "kanji" | "vocab" 
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [modalTarget, setModalTarget] = useState<{ type: "item"; id: number } | { type: "radical"; wkSubjectId: number } | null>(null);

  // Filters
  const [level, setLevel] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [onWanikani, setOnWanikani] = useState<string>("");
  const [page, setPage] = useState(1);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (status) params.set("status", status);
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
  }, [apiUrl, level, status, search, onWanikani, page]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [level, status, search, onWanikani]);

  const toggleStatus = async (itemId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "unknown" ? "learning" : currentStatus === "learning" ? "known" : "unknown";
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: nextStatus } : i));
        showToast(`Marked as ${nextStatus}`, "success");
      }
    } catch {
      showToast("Failed to update", "error");
    }
  };

  const setStatusDirect = async (itemId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: newStatus } : i));
        showToast(`Marked as ${newStatus}`, "success");
      }
    } catch {
      showToast("Failed to update", "error");
    }
  };

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  // Build external URLs
  const getWkUrl = (item: Item) => {
    if (!item.wkSubjectId || item.matchType === "pseudo") return null;
    const wkExpr = item.wkCharacters || item.expression;
    const wkType = item.type === "kanji" ? "kanji" : "vocabulary";
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
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>|</span>
        <FilterBtn label="✅ Known" value="known" current={status} setter={setStatus} />
        <FilterBtn label="📖 Learning" value="learning" current={status} setter={setStatus} />
        <FilterBtn label="❓ Unknown" value="unknown" current={status} setter={setStatus} />
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
                <span className={`badge badge-${item.type}`}>{item.type === "kanji" ? "漢字" : "語彙"}</span>
                {item.wkSubjectId && item.matchType !== "pseudo" && (
                  <span className="badge badge-wk">WK Lv.{item.wkLevel}</span>
                )}
                {item.matchType === "pseudo" && (
                  <span className="badge badge-wk" style={{backgroundColor: "rgba(99, 102, 241, 0.1)", color: "var(--accent-blue)", border: "1px solid rgba(99, 102, 241, 0.3)"}}>✨ AI Context</span>
                )}
              </div>
              <div className="status-toggle" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`status-toggle-btn ${item.status === "unknown" ? "active-unknown" : ""}`}
                  onClick={() => setStatusDirect(item.id, "unknown")}
                >
                  Unknown
                </button>
                <button
                  className={`status-toggle-btn ${item.status === "learning" ? "active-learning" : ""}`}
                  onClick={() => setStatusDirect(item.id, "learning")}
                >
                  Learning
                </button>
                <button
                  className={`status-toggle-btn ${item.status === "known" ? "active-known" : ""}`}
                  onClick={() => setStatusDirect(item.id, "known")}
                >
                  Known
                </button>
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
          <ItemDetailModal
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
