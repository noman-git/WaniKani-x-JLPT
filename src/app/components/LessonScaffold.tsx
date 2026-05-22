"use client";

/**
 * Shared building blocks for the lesson card-stack used by both /learn
 * (kanji / vocab / radical) and /grammar-learn. Centralising these so the
 * two surfaces stay visually identical and any future change happens in
 * one place.
 *
 * Exports:
 *   - <LessonHero>          → anchor card with badges, glyph, Mark Known toggle
 *   - <LessonBottomNav>     → progress bar + Prev / counter / Next or Quiz
 *   - useKnownToggle()      → stateful Mark Known / Mark Unknown w/ optimistic flip
 *   - useLessonKeys()       → vim-style (h/j/k/l) + arrow nav, Y (or ⌃Y/⌘Y) toggle known
 */

import { ReactNode, useState, useEffect, useCallback } from "react";

/* ============================================================
   useKnownToggle — stateful, optimistic, idempotent
   ============================================================ */
type ToggleOpts = {
  /** API endpoint that accepts forceKnown / forceUnknown */
  endpoint: string;
  /** Body key for the item id, e.g. "jlptItemId" or "grammarPointId" */
  idField: string;
};

export function useKnownToggle({ endpoint, idField }: ToggleOpts) {
  const [knownSet, setKnownSet] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);

  const isKnown = useCallback((id: number) => knownSet.has(id), [knownSet]);

  const toggle = useCallback(async (id: number) => {
    if (!id || pending) return;
    const wasKnown = knownSet.has(id);
    setKnownSet(prev => {
      const next = new Set(prev);
      if (wasKnown) next.delete(id);
      else next.add(id);
      return next;
    });
    setPending(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [idField]: id,
          isCorrect: true,
          timeToAnswerMs: 100,
          mistakeType: null,
          forceKnown: !wasKnown,
          forceUnknown: wasKnown,
        }),
      });
      if (!res.ok) throw new Error("submit failed");
    } catch {
      setKnownSet(prev => {
        const next = new Set(prev);
        if (wasKnown) next.add(id);
        else next.delete(id);
        return next;
      });
    } finally {
      setPending(false);
    }
  }, [endpoint, idField, knownSet, pending]);

  return { isKnown, toggle, pending };
}

/* ============================================================
   useLessonKeys — vim-style nav (h/j/k/l) + arrows, Y (or ⌃Y/⌘Y) toggle known
   ============================================================ */
type KeysOpts = {
  enabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleKnown: () => void;
};

const SCROLL_STEP = 80;

export function useLessonKeys({ enabled, onPrev, onNext, onToggleKnown }: KeysOpts) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const inField = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      // ⌃Y / ⌘Y — toggle known (works even while typing in a note field)
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        onToggleKnown();
        return;
      }
      if (inField) return;
      // Arrow keys keep working for non-vim users.
      if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        window.scrollBy({ top: SCROLL_STEP, behavior: "smooth" });
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        window.scrollBy({ top: -SCROLL_STEP, behavior: "smooth" });
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        onToggleKnown();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onPrev, onNext, onToggleKnown]);
}

/* ============================================================
   <LessonHero>
   ============================================================ */
type Badge = { label: string; color?: string };

export function LessonHero({
  typeBadge,
  typeColor,
  extraBadges = [],
  isKnown,
  onToggleKnown,
  knownPending,
  children,
}: {
  /** First (type) badge — e.g. "KANJI", "GRAMMAR" */
  typeBadge: string;
  /** Signature colour for the type badge + glyph */
  typeColor: string;
  /** Plain extra badges shown after the type badge (e.g. JLPT level, WK level) */
  extraBadges?: Array<Badge | string>;
  isKnown: boolean;
  onToggleKnown: () => void;
  knownPending: boolean;
  /** Whatever sits centred in the hero — usually the big glyph */
  children: ReactNode;
}) {
  return (
    <div className="cs-card cs-card-hero">
      <div className="cs-hero-badges">
        <span
          className="cs-hero-badge"
          style={{ color: typeColor, borderColor: typeColor }}
        >
          {typeBadge}
        </span>
        {extraBadges.map((b, i) => {
          const badge = typeof b === "string" ? { label: b } : b;
          return (
            <span
              key={i}
              className="cs-hero-badge"
              style={badge.color ? { color: badge.color, borderColor: badge.color } : undefined}
            >
              {badge.label}
            </span>
          );
        })}
      </div>

      <button
        onClick={onToggleKnown}
        disabled={knownPending}
        className={`cs-known-btn ${isKnown ? "is-known" : ""}`}
        title={isKnown
          ? "Marked known — click (or press Y) to unmark"
          : "Already know this? Click (or press Y) to mark known"}
      >
        {isKnown ? "✓ Known" : "★ Mark known"}
        <kbd className="cs-known-kbd">Y</kbd>
      </button>

      {children}
    </div>
  );
}

/* ============================================================
   <LessonBottomNav>
   ============================================================ */
export function LessonBottomNav({
  currentIndex,
  total,
  onPrev,
  onNext,
  lastLabel = "Start Quiz",
}: {
  currentIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** Label shown on the "next" button when on the final slide */
  lastLabel?: string;
}) {
  const isLast = currentIndex >= total - 1;
  return (
    <div className="cs-bottom-nav">
      <div className="cs-progress-line">
        <div
          className="cs-progress-fill"
          style={{ width: `${((currentIndex + 1) / Math.max(total, 1)) * 100}%` }}
        />
      </div>
      <div className="cs-bottom-nav-buttons">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="cs-nav-btn"
        >
          ← Prev
        </button>
        <span className="cs-nav-counter">{currentIndex + 1} / {total}</span>
        {isLast ? (
          <button onClick={onNext} className="cs-nav-btn cs-nav-quiz">{lastLabel} →</button>
        ) : (
          <button onClick={onNext} className="cs-nav-btn">Next →</button>
        )}
      </div>
    </div>
  );
}
