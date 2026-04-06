"use client";

import { useState, useEffect, useRef } from "react";

interface Example {
  ja: string;
  romaji: string;
  en: string;
}

interface RelatedGrammar {
  slug: string;
  title: string;
  meaning: string;
  jlptLevel: string;
}

interface GrammarDetail {
  id: number;
  slug: string;
  title: string;
  titleRomaji: string;
  meaning: string;
  structure: string;
  explanation: string;
  jlptLevel: string;
  lessonNumber: number;
  lessonTitle: string;
  examples: Example[];
  tags: string[];
  userStatus: string;
  userNote: string;
  relatedGrammar: RelatedGrammar[];
}

export default function GrammarDetailModal({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<GrammarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [currentSlug, setCurrentSlug] = useState(slug);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSlug(slug);
  }, [slug]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/grammar/${currentSlug}`);
        if (res.ok) {
          const detail = await res.json();
          setData(detail);
          setNoteContent(detail.userNote || "");
        }
      } catch { /* */ }
      setLoading(false);
    };
    load();
  }, [currentSlug]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const updateStatus = async (newStatus: string) => {
    if (!data) return;
    try {
      const res = await fetch("/api/grammar/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grammarPointId: data.id, status: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        setData((prev) => prev ? { ...prev, userStatus: newStatus } : null);
      }
    } catch { /* */ }
  };

  const saveNote = async () => {
    if (!data) return;
    setNoteSaving(true);
    try {
      const res = await fetch("/api/grammar/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grammarPointId: data.id, content: noteContent }),
      });
      const result = await res.json();
      if (result.success) {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      }
    } catch { /* */ }
    setNoteSaving(false);
  };

  const navigateRelated = (relatedSlug: string) => {
    setCurrentSlug(relatedSlug);
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-content grammar-modal">
        <button className="modal-close" onClick={onClose}>×</button>

        {loading ? (
          <div className="loading-container" style={{ minHeight: 300 }}>
            <div className="loading-spinner" />
            <span>Loading grammar point...</span>
          </div>
        ) : !data ? (
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <div className="empty-state-text">Grammar point not found</div>
          </div>
        ) : (
          <div className="grammar-detail">
            {/* Header */}
            <div className="grammar-detail-header">
              <div className="grammar-detail-title-row">
                <h2 className="grammar-detail-title">{data.title}</h2>
                <span className={`badge badge-${data.jlptLevel.toLowerCase()}`}>{data.jlptLevel}</span>
              </div>
              <div className="grammar-detail-romaji">{data.titleRomaji}</div>
              <div className="grammar-detail-meaning">{data.meaning}</div>
              <div className="grammar-detail-lesson">
                Lesson {data.lessonNumber}: {data.lessonTitle}
              </div>
            </div>

            {/* Tags */}
            {data.tags.length > 0 && (
              <div className="grammar-tags">
                {data.tags.map((tag) => (
                  <span key={tag} className="grammar-tag">{tag}</span>
                ))}
              </div>
            )}

            {/* Structure Box */}
            <div className="grammar-section">
              <h3 className="grammar-section-title">📐 Structure</h3>
              <div className="grammar-structure-box">
                {data.structure.split("\n").map((line, i) => (
                  <div key={i} className="grammar-structure-line">{line}</div>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <div className="grammar-section">
              <h3 className="grammar-section-title">📖 Explanation</h3>
              <div className="grammar-explanation">
                {data.explanation.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>

            {/* Examples */}
            {data.examples.length > 0 && (
              <div className="grammar-section">
                <h3 className="grammar-section-title">✏️ Examples</h3>
                <div className="grammar-examples">
                  {data.examples.map((ex, i) => (
                    <div key={i} className="grammar-example">
                      <div className="grammar-example-ja">{ex.ja}</div>
                      <div className="grammar-example-romaji">{ex.romaji}</div>
                      <div className="grammar-example-en">{ex.en}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Grammar */}
            {data.relatedGrammar.length > 0 && (
              <div className="grammar-section">
                <h3 className="grammar-section-title">🔗 Related Grammar</h3>
                <div className="grammar-related">
                  {data.relatedGrammar.map((rel) => (
                    <button
                      key={rel.slug}
                      className="grammar-related-chip"
                      onClick={() => navigateRelated(rel.slug)}
                    >
                      <span className="grammar-related-title">{rel.title}</span>
                      <span className="grammar-related-meaning">{rel.meaning}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="grammar-section">
              <h3 className="grammar-section-title">📝 My Notes</h3>
              <div className="note-section">
                <textarea
                  className="note-textarea"
                  value={noteContent}
                  onChange={(e) => { setNoteContent(e.target.value); setNoteSaved(false); }}
                  placeholder="Add your notes about this grammar point..."
                  rows={4}
                />
                <button
                  className={`note-save-btn ${noteSaving ? "saving" : ""} ${noteSaved ? "saved" : ""}`}
                  onClick={saveNote}
                  disabled={noteSaving}
                >
                  {noteSaving ? "Saving..." : noteSaved ? "✓ Saved" : "Save Note"}
                </button>
              </div>
            </div>

            {/* Progress Buttons */}
            <div className="modal-footer">
              <div className="modal-status-buttons">
                {(["unknown", "learning", "known"] as const).map((s) => (
                  <button
                    key={s}
                    className={`status-btn ${(data.userStatus === s || (s === "unknown" && data.userStatus === "not-started")) ? "active" : ""} status-${s}`}
                    onClick={() => updateStatus(s)}
                  >
                    {s === "unknown" ? "❓" : s === "learning" ? "📖" : "✅"}{" "}
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
