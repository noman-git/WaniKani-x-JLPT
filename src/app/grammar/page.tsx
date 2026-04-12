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

  const [search, setSearch] = useState<string>("");

  const loadGrammar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (level) params.set("level", level);

    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/grammar?${params}`);
      const data = await res.json();
      setPoints(data.points || []);
      setStats(data.stats || { total: 0, known: 0, learning: 0, notStarted: 0 });
    } catch { /* */ }
    setLoading(false);
  }, [level, search]);

  useEffect(() => { loadGrammar(); }, [loadGrammar]);



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



  return (
    <>
      <div className="page-header">
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="grammar-icon">文</span>
          Grammar
        </h1>
        <p className="page-subtitle">{stats.total} grammar points</p>
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
