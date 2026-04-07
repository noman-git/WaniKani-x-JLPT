"use client";

import { useState, useEffect } from "react";
import GrammarClozeQuiz, { GrammarQuizItem } from "../components/GrammarClozeQuiz";
import { useRouter } from "next/navigation";
import GrammarDetailModal from "../components/GrammarDetailModal";

type LessonPhase = "loading" | "lesson" | "quiz" | "done";
type NoteSaveState = "idle" | "saving" | "saved" | "error";

function GrammarNoteManager({ grammarPointId, initialNote }: { grammarPointId: number, initialNote: string }) {
  const [note, setNote] = useState(initialNote);
  const [saveState, setSaveState] = useState<NoteSaveState>("idle");

  const handleSave = async () => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/grammar/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grammarPointId, content: note }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const btnLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "saved"  ? "Saved ✓" :
    saveState === "error"  ? "Error — retry" :
    "Save Note";

  return (
    <div className="srs-breakdown-section">
      <h4 className="srs-info-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="srs-info-color-tick" style={{backgroundColor: '#eab308'}}></span> 
            📝 Personal Note
         </span>
         <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            style={{ 
               backgroundColor: saveState === "saved" ? '#10b981' : saveState === "error" ? '#ef4444' : 'var(--bg-card)', 
               color: saveState === "saved" || saveState === "error" ? "white" : 'var(--text-primary)',
               border: saveState === "idle" || saveState === "saving" ? '1px solid var(--border-medium)' : 'none',
               padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
            }}
         >
           {btnLabel}
         </button>
      </h4>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaveState("idle");
        }}
        placeholder="Add your personal notes, custom hints, or reminders for this grammar point..."
        style={{
           width: '100%', minHeight: '100px', backgroundColor: 'var(--bg-document)',
           border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px',
           color: 'var(--text-primary)', resize: 'vertical', fontSize: '14px', lineHeight: '1.5'
        }}
      />
    </div>
  );
}

export default function GrammarLearnPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<LessonPhase>("loading");
  const [batch, setBatch] = useState<GrammarQuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function loadQueue() {
      try {
        const res = await fetch("/api/grammar/lessons?limit=3");
        const data = await res.json();
        
        if (!data.lessons || data.lessons.length === 0) {
           setPhase("done");
           return;
        }

        setBatch(data.lessons);
        setPhase("lesson");
      } catch (e) {
        setPhase("done");
      }
    }
    loadQueue();
  }, []);

  const handleMarkKnown = async () => {
    const item = batch[currentIndex];
    await fetch("/api/grammar/srs/submit", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         grammarPointId: item.id,
         isCorrect: true,
         timeToAnswerMs: 100,
         mistakeType: null,
         forceKnown: true
       })
    });
    nextSlide();
  };

  const nextSlide = () => {
    if (currentIndex + 1 >= batch.length) {
       setPhase("quiz");
    } else {
       setCurrentIndex(curr => curr + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
       setCurrentIndex(curr => curr - 1);
    }
  };

  useEffect(() => {
    if (phase === "lesson") {
       const handleKey = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
          if (e.key === "ArrowRight") nextSlide();
          else if (e.key === "ArrowLeft") prevSlide();
       };
       window.addEventListener("keydown", handleKey);
       return () => window.removeEventListener("keydown", handleKey);
    }
  }, [phase, currentIndex, batch.length]);

  if (phase === "loading") return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Constructing your Grammar Queue...</div>;
  if (phase === "done") return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          <div style={{ fontSize: '30px', color: 'var(--text-primary)', fontWeight: 'bold' }}>You are totally caught up on Grammar!</div>
          <button onClick={() => router.push('/')} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-medium)', padding: '12px 24px', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>
            Return to Dashboard
          </button>
      </div>
  );

  if (phase === "lesson") {
    const item = batch[currentIndex];
    return (
      /* Lock body scroll purely for the container, rely on internal modal scrolling */
      <div className="srs-learn-container" style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', height: 'calc(100vh - 65px)', minHeight: '0', boxSizing: 'border-box' }}>
        
        {/* Responsive Grid Layout */}
        <div className="srs-learn-grid">
          
          {/* Main Flashcard Card */}
          <div className="srs-learn-main srs-card" style={{ height: 'calc(100vh - 200px)', minHeight: '600px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', textAlign: 'left', margin: 0, padding: 0, overflow: 'hidden' }}>
            
            {/* Seamless Header - Now Statically Pinned in the Flex Column */}
            <div className="srs-learn-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, backgroundColor: 'var(--bg-secondary)', padding: '16px 24px', borderBottom: '1px solid var(--border-medium)', maxWidth: '100%', gap: '16px' }}>
              <div className="srs-learn-progress" style={{ flex: 1 }}>
                {batch.map((_, i) => (
                  <div key={i} className={`srs-learn-progress-tick ${i <= currentIndex ? 'active' : 'inactive'}`} />
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                 <button onClick={prevSlide} disabled={currentIndex === 0} style={{ padding: '6px 12px', backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: currentIndex === 0 ? 'var(--border-medium)' : 'var(--text-primary)', cursor: currentIndex === 0 ? 'default' : 'pointer', fontSize: '13px' }}>
                   ← Prev
                 </button>
                 {currentIndex < batch.length - 1 ? (
                   <button onClick={nextSlide} style={{ padding: '6px 16px', backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                     Next ➔
                   </button>
                 ) : (
                   <button onClick={nextSlide} style={{ padding: '6px 16px', backgroundColor: '#6366f1', border: '1px solid #4f46e5', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                     Start Quiz ➔
                   </button>
                 )}
              </div>
            </div>

            <div className="srs-display-block" style={{ flexShrink: 0 }}>
              <button 
                 onClick={handleMarkKnown}
                 className="srs-deep-check"
                 style={{ top: '16px', right: '16px', position: 'absolute' }}
              >
                 <span className="srs-star">★</span>
                 <span>Deep Check-in (Mark Known)</span>
              </button>

              <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                 <span className="srs-type-badge" style={{ position: 'static' }}>grammar</span>
                 <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px' }}>{item.jlptLevel.toUpperCase()}</span>
              </div>
              <h2 className="srs-character-display">{item.title}</h2>
            </div>
            
            {/* Scrollable Content Panel */}
            <div className="srs-content-panel" style={{ flex: '1', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <GrammarDetailModal key={item.slug} slug={item.slug} onClose={() => {}} inline={true} />
            </div>
          </div>
          
          {/* Sidecar for Grid */}
          <div className="srs-learn-sidecar">
            <div style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', height: '100%' }}>
              <div style={{ padding: '24px' }}>
                <GrammarNoteManager grammarPointId={item.id} initialNote={""} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Phase
  return (
    <div className="srs-learn-container">
      <GrammarClozeQuiz items={batch} mode="lesson-quiz" onComplete={() => location.reload()} />
    </div>
  );
}
