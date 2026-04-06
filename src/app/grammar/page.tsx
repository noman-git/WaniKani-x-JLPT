"use client";

import { useState, useEffect, useCallback } from "react";
import GrammarDetailModal from "@/app/components/GrammarDetailModal";

interface GrammarPoint {
  id: number;
  slug: string;
  title: string;
  titleRomaji: string;
  meaning: string;
  structure: string;
  jlptLevel: string;
  lessonNumber: number;
  lessonTitle: string;
  tags: string[];
  userStatus: string;
}

interface GrammarStats {
  total: number;
  known: number;
  learning: number;
  notStarted: number;
}

export default function GrammarPage() {
  const [points, setPoints] = useState<GrammarPoint[]>([]);
  const [stats, setStats] = useState<GrammarStats>({ total: 0, known: 0, learning: 0, notStarted: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  // Filters
  const [level, setLevel] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const loadGrammar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (status) params.set("status", status);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/grammar?${params}`);
      const data = await res.json();
      setPoints(data.points || []);
      setStats(data.stats || { total: 0, known: 0, learning: 0, notStarted: 0 });
    } catch { /* */ }
    setLoading(false);
  }, [level, status, search]);

  useEffect(() => { loadGrammar(); }, [loadGrammar]);

  const updateStatus = async (pointId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/grammar/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grammarPointId: pointId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setPoints((prev) => prev.map((p) => p.id === pointId ? { ...p, userStatus: newStatus } : p));
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

  const FilterBtn = ({ label, value, current, setter }: { label: string; value: string; current: string; setter: (v: string) => void }) => (
    <button
      className={`filter-btn ${current === value ? "active" : ""}`}
      onClick={() => setter(current === value ? "" : value)}
    >
      {label}
    </button>
  );

  const progressPercent = stats.total > 0 ? Math.round(((stats.known + stats.learning) / stats.total) * 100) : 0;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="grammar-icon">文</span>
          Grammar
        </h1>
        <p className="page-subtitle">{stats.total} grammar points</p>
      </div>

      {/* Stats Bar */}
      <div className="grammar-stats-bar">
        <div className="grammar-stat">
          <span className="grammar-stat-number grammar-stat-known">{stats.known}</span>
          <span className="grammar-stat-label">Known</span>
        </div>
        <div className="grammar-stat">
          <span className="grammar-stat-number grammar-stat-learning">{stats.learning}</span>
          <span className="grammar-stat-label">Learning</span>
        </div>
        <div className="grammar-stat">
          <span className="grammar-stat-number grammar-stat-new">{stats.notStarted}</span>
          <span className="grammar-stat-label">Not Started</span>
        </div>
        <div className="grammar-progress-bar-container">
          <div className="grammar-progress-bar">
            <div className="grammar-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="grammar-progress-text">{progressPercent}% studied</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search grammar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <FilterBtn label="N5" value="N5" current={level} setter={setLevel} />
        <FilterBtn label="N4" value="N4" current={level} setter={setLevel} />
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>|</span>
        <FilterBtn label="✅ Known" value="known" current={status} setter={setStatus} />
        <FilterBtn label="📖 Learning" value="learning" current={status} setter={setStatus} />
        <FilterBtn label="🆕 New" value="not-started" current={status} setter={setStatus} />
      </div>

      {/* Grammar Grid */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <span>Loading grammar...</span>
        </div>
      ) : points.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-text">No grammar points found</div>
          <p style={{ color: "var(--text-muted)" }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grammar-grid">
          {points.map((point) => (
            <div
              key={point.id}
              className={`grammar-card grammar-card-${point.userStatus}`}
              onClick={() => setSelectedSlug(point.slug)}
            >
              <div className="grammar-card-header">
                <span className="grammar-card-title">{point.title}</span>
                <span className={`badge badge-${point.jlptLevel.toLowerCase()}`}>{point.jlptLevel}</span>
              </div>
              <div className="grammar-card-romaji">{point.titleRomaji}</div>
              <div className="grammar-card-meaning">{point.meaning}</div>
              <div className="grammar-card-footer">
                <div className="status-toggle" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`status-toggle-btn ${point.userStatus === "not-started" || point.userStatus === "unknown" ? "active-unknown" : ""}`}
                    onClick={() => updateStatus(point.id, "unknown")}
                  >
                    Unknown
                  </button>
                  <button
                    className={`status-toggle-btn ${point.userStatus === "learning" ? "active-learning" : ""}`}
                    onClick={() => updateStatus(point.id, "learning")}
                  >
                    Learning
                  </button>
                  <button
                    className={`status-toggle-btn ${point.userStatus === "known" ? "active-known" : ""}`}
                    onClick={() => updateStatus(point.id, "known")}
                  >
                    Known
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      {/* Detail Modal */}
      {selectedSlug && (
        <GrammarDetailModal
          slug={selectedSlug}
          onClose={() => {
            setSelectedSlug(null);
            loadGrammar();
          }}
        />
      )}
    </>
  );
}
