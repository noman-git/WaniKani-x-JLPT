"use client";

import { useState, useEffect } from "react";
import GrammarClozeQuiz, { GrammarQuizItem } from "../components/GrammarClozeQuiz";
import { useRouter } from "next/navigation";
import GrammarDetailModal from "../components/GrammarDetailModal";
import { useNoteSaver } from "../components/useNoteSaver";
import {
  LessonHero,
  LessonBottomNav,
  useKnownToggle,
  useLessonKeys,
} from "../components/LessonScaffold";
import { readStudyTrack, withTrack } from "../components/useStudyTrack";

type LessonPhase = "loading" | "lesson" | "quiz" | "done";

function GrammarNoteCard({ grammarPointId, initialNote }: { grammarPointId: number; initialNote: string }) {
  const { note, setNote, saveState, handleSave, btnLabel } = useNoteSaver({
    endpoint: "/api/grammar/notes",
    idField: "grammarPointId",
    id: grammarPointId,
    initialNote,
  });

  return (
    <div className="cs-card">
      <h3 className="cs-card-title">
        <span className="cs-card-dot" style={{ backgroundColor: '#eab308' }} />
        Personal Notes
      </h3>
      <div className="note-section">
        <div className="note-header">
          <span className="note-title">Note</span>
        </div>
        <textarea
          className="note-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add your personal note for this grammar point…"
          rows={4}
        />
        <div className="note-footer">
          <button
            className={`note-save-btn note-save-${saveState}`}
            onClick={handleSave}
            disabled={saveState === "saving"}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GrammarLearnPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<LessonPhase>("loading");
  const [batch, setBatch] = useState<GrammarQuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const known = useKnownToggle({ endpoint: "/api/grammar/srs/submit", idField: "grammarPointId" });

  useEffect(() => {
    async function loadQueue() {
      try {
        const res = await fetch(withTrack("/api/grammar/lessons?limit=3", readStudyTrack()));
        const data = await res.json();
        if (!data.lessons || data.lessons.length === 0) {
          setPhase("done");
          return;
        }
        setBatch(data.lessons);
        setPhase("lesson");
      } catch {
        setPhase("done");
      }
    }
    loadQueue();
  }, []);

  const nextSlide = () => {
    if (currentIndex + 1 >= batch.length) setPhase("quiz");
    else setCurrentIndex(curr => curr + 1);
  };
  const prevSlide = () => {
    if (currentIndex > 0) setCurrentIndex(curr => curr - 1);
  };

  const handleToggleKnown = () => {
    const item = batch[currentIndex];
    if (item) known.toggle(item.id);
  };

  useLessonKeys({
    enabled: phase === "lesson",
    onPrev: prevSlide,
    onNext: nextSlide,
    onToggleKnown: handleToggleKnown,
  });

  useEffect(() => {
    if (phase === "lesson") {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex, phase]);

  if (phase === "loading") return (
    <div className="loading-container"><div className="loading-spinner" /><span>Constructing your grammar queue…</span></div>
  );

  if (phase === "done") return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color: 'var(--ink)' }}>
        You&apos;re caught up on grammar.
      </div>
      <button onClick={() => router.push('/')} className="btn btn-outline">Return to Dashboard</button>
    </div>
  );

  if (phase === "lesson") {
    const item = batch[currentIndex];
    return (
      <div className="cs-lesson-page">
        <div className="cs-card-stack">
          <LessonHero
            typeBadge="grammar"
            typeColor="var(--accent-grammar)"
            extraBadges={item.jlptLevel ? [item.jlptLevel.toUpperCase()] : []}
            isKnown={known.isKnown(item.id)}
            onToggleKnown={handleToggleKnown}
            knownPending={known.pending}
          >
            <div className="cs-hero-char" style={{ color: 'var(--accent-grammar)' }}>{item.title}</div>
          </LessonHero>

          {/* Body — tags / structure / explanation / examples / related rendered as cs-cards via CSS */}
          <GrammarDetailModal key={item.slug} slug={item.slug} onClose={() => {}} inline={true} />

          <GrammarNoteCard grammarPointId={item.id} initialNote="" />
        </div>

        <LessonBottomNav
          currentIndex={currentIndex}
          total={batch.length}
          onPrev={prevSlide}
          onNext={nextSlide}
        />
      </div>
    );
  }

  // Quiz Phase
  return (
    <GrammarClozeQuiz items={batch} mode="lesson-quiz" onComplete={() => location.reload()} />
  );
}
