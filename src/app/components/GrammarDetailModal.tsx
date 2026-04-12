"use client";

import { useState, useEffect, useRef } from "react";
import ItemModal from "./ItemModal";

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

interface LinkedItem {
  id: number;
  expression: string;
  reading: string | null;
  meaning: string;
  type: string;
  jlptLevel: string;
  wkReadings?: string | null;
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
  linkedItems: LinkedItem[];
}

export default function GrammarDetailModal({
  slug,
  onClose,
  inline = false,
}: {
  slug: string;
  onClose: () => void;
  inline?: boolean;
}) {
  const [data, setData] = useState<GrammarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [selectedVocabId, setSelectedVocabId] = useState<number | null>(null);
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
      // Only close if no other modal is stacked above, and not inline
      if (e.key === "Escape" && !selectedVocabId && !inline) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose, inline, selectedVocabId]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
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

  const handleTooltipPosition = (e: React.MouseEvent<HTMLElement>) => {
    const parentRect = e.currentTarget.getBoundingClientRect();
    const tooltip = e.currentTarget.querySelector('.inline-tooltip') as HTMLElement;
    if (!tooltip) return;
    
    // Clear previous dynamic classes
    e.currentTarget.classList.remove('tooltip-left', 'tooltip-right');
    // Clear inline styles if any residue exists
    tooltip.style.left = '';
    tooltip.style.right = '';
    tooltip.style.transform = '';

    // Set layout constraining classes dynamically based on active mouse position bounding rules
    if (parentRect.left < 100) {
      e.currentTarget.classList.add('tooltip-left');
    } else if (window.innerWidth - parentRect.right < 100) {
      e.currentTarget.classList.add('tooltip-right');
    }
  };

  const parseSentence = (sentence: string, linkedItems: LinkedItem[]) => {
    if (!linkedItems || linkedItems.length === 0) return [sentence];

    const sortedItems = [...linkedItems].sort((a, b) => b.expression.length - a.expression.length);
    const escapedExpressions = sortedItems.map(i => i.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedExpressions.join('|')})`, 'g');
    const chunks = sentence.split(regex);
    
    return chunks.map((chunk, i) => {
      const match = sortedItems.find(item => item.expression === chunk);
      if (match) {
        let displayReading = match.reading;
        if (match.wkReadings) {
          try {
            const wkParsed = JSON.parse(match.wkReadings);
            if (Array.isArray(wkParsed) && wkParsed.length > 0) {
              displayReading = wkParsed.map(r => r.reading).join(', ');
            }
          } catch (e) {
            // fallback to default reading
          }
        }

        return (
          <span 
            key={i} 
            className="inline-vocab" 
            tabIndex={0}
            onMouseEnter={handleTooltipPosition}
          >
            {chunk}
            <span className="inline-tooltip">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '6px' }}>
                <div style={{ paddingRight: '12px' }}>
                  {displayReading && displayReading !== match.expression && (
                    <span className="inline-tooltip-reading" style={{ display: 'block' }}>{displayReading}</span>
                  )}
                  <span className="inline-tooltip-meaning" style={{ display: 'block' }}>{match.meaning}</span>
                </div>
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedVocabId(match.id); }}
                  className="tooltip-open-btn"
                  title="Open Details"
                >
                  ↗
                </button>
              </div>
              <div className="inline-tooltip-meta">
                <span className={`badge badge-${match.jlptLevel.toLowerCase()}`} style={{fontSize: 9}}>{match.jlptLevel}</span>
                <span className={`badge badge-${match.type === 'kanji' ? 'kanji' : 'vocab'}`} style={{fontSize: 9}}>{match.type}</span>
              </div>
            </span>
          </span>
        );
      }
      return <span key={i}>{chunk}</span>;
    });
  };

  return (
    <div className={inline ? "grammar-detail-inline-wrapper" : "modal-overlay"} ref={overlayRef} onClick={inline ? undefined : handleOverlayClick}>
      <div className={inline ? "" : "modal-wrapper"}>
        <div className={`modal-content grammar-modal ${inline ? "inline-mode" : ""}`} style={inline ? {boxShadow: 'none', border: 'none', padding: 0, position: 'relative' as const} : {}}>
          {!inline && (
            <div className="modal-header" style={{ paddingBottom: '12px', borderBottom: 'none' }}>
              <div className="modal-header-actions" style={{display: "flex", gap: "10px", alignItems: "center", position: "absolute", top: "16px", right: "16px", zIndex: 10}}>
                <button 
                  className={`modal-toggle-note-btn ${isNotesOpen ? 'open' : ''} ${noteContent ? 'has-note' : ''}`}
                  onClick={() => setIsNotesOpen(!isNotesOpen)}
                  title="Toggle Notes"
                >
                  📝 Notes {noteContent && '(1)'}
                </button>
                <button className="modal-close" onClick={onClose} style={{ position: "relative", top: 0, right: 0 }}>✕</button>
              </div>
            </div>
          )}
          
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
                      <div className="grammar-example-ja">{parseSentence(ex.ja, data.linkedItems)}</div>
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


          </div>
        )}
      </div>

      {/* Sliding Notes Drawer - only in modal mode */}
      {!inline && (
        <div className={`modal-notes-drawer ${isNotesOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
          {!loading && data && (
            <div className="note-section">
              <div className="note-header">
                <span className="note-title">📝 My Note</span>
              </div>
              <textarea
                className="note-textarea"
                value={noteContent}
                onChange={(e) => { setNoteContent(e.target.value); setNoteSaved(false); }}
                placeholder="Add your personal note for this grammar point..."
                rows={4}
              />
              <div className="note-footer">
                <button
                  className={`note-save-btn ${noteSaving ? "note-save-saving" : noteSaved ? "note-save-saved" : "note-save-idle"}`}
                  onClick={saveNote}
                  disabled={noteSaving}
                >
                  {noteSaving ? "Saving..." : noteSaved ? "✓ Saved" : "Save Note"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Render stacked Item Modal */}
      {selectedVocabId !== null && (() => {
        let onNext, onPrev;
        if (data && data.linkedItems) {
          const idx = data.linkedItems.findIndex((v: LinkedItem) => v.id === selectedVocabId);
          if (idx !== -1) {
            if (idx > 0) onPrev = () => setSelectedVocabId(data.linkedItems[idx - 1].id);
            if (idx < data.linkedItems.length - 1) onNext = () => setSelectedVocabId(data.linkedItems[idx + 1].id);
          }
        }
        return (
          <ItemModal
            target={{ type: "item", id: selectedVocabId }}
            onClose={() => setSelectedVocabId(null)}
            onNavigateItem={(id) => setSelectedVocabId(id)}
            onNext={onNext}
            onPrev={onPrev}
          />
        );
      })()}
    </div>
  );
}
