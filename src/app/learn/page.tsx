"use client";

import { useState, useEffect } from "react";
import SrsQuiz, { QuizItem } from "../components/SrsQuiz";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import LessonModal, { QuizNoteManager } from "../components/LessonModal";

type LessonPhase = "loading" | "lesson" | "quiz" | "done";

export default function LearnPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<LessonPhase>("loading");
  const [batch, setBatch] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function loadQueue() {
      try {
        const res = await fetch("/api/srs/lessons?limit=5");
        const data = await res.json();
        
        if (!data.lessons || data.lessons.length === 0) {
           setPhase("done");
           return;
        }

        const lessonIds = data.lessons.map((r: any) => r.item.id);
        const bulkRes = await fetch(`/api/items/bulk?ids=${lessonIds.join(",")}`);
        const bulkData = await bulkRes.json();
        
        const items: QuizItem[] = [];
        for (const id of lessonIds) {
           const detail = bulkData.items[id];
           if (!detail) continue;
           
           let parsedReadings = [];
           let parsedMeanings = [];
           let advancedReadings: Array<{reading: string; type: string; primary: boolean}> | undefined = undefined;
           let advancedMeanings: Array<{meaning: string; primary: boolean}> | undefined = undefined;
           try {
              const wkReadings = detail.wanikani?.readings || [];
              const wkMeanings = detail.wanikani?.meanings || [];
              parsedReadings = wkReadings.map((reading: any) => reading.reading);
              parsedMeanings = wkMeanings.map((m: any) => m.meaning);
              advancedReadings = wkReadings.map((r: any) => ({ reading: r.reading, type: r.type || "nanori", primary: !!r.primary }));
              advancedMeanings = wkMeanings.map((m: any) => ({ meaning: m.meaning, primary: !!m.primary }));
           } catch(e) {}

           if (parsedReadings.length === 0 && detail.item.reading) parsedReadings.push(detail.item.reading);
           if (parsedMeanings.length === 0 && detail.item.meaning) parsedMeanings.push(detail.item.meaning);

           items.push({
             id: detail.item.id,
             jlptItemId: detail.item.id,
             type: detail.item.type,
             jlptLevel: detail.item.jlptLevel,
             characters: detail.item.expression,
             readings: parsedReadings,
             advancedReadings,
             meanings: parsedMeanings,
             advancedMeanings,
             note: detail.note,
             meaningMnemonic: detail.wanikani?.meaningMnemonic,
             readingMnemonic: detail.wanikani?.readingMnemonic,
             meaningHint: detail.wanikani?.meaningHint,
             readingHint: detail.wanikani?.readingHint,
             contextSentences: detail.wanikani?.contextSentences,
             partsOfSpeech: detail.wanikani?.partsOfSpeech,
             matchType: detail.wanikani?.matchType,
             wkLevel: detail.wanikani?.level,
             radicals: detail.wanikani?.radicals,
             componentKanji: detail.componentKanji,
             relatedVocab: detail.relatedVocab
           });
        }

        setBatch(items);
        setPhase("lesson");
      } catch (e) {
        setPhase("done");
      }
    }
    loadQueue();
  }, []);

  const handleMarkKnown = async () => {
    const item = batch[currentIndex];
    await fetch("/api/srs/submit", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         jlptItemId: item.jlptItemId,
         isCorrect: true,
         timeToAnswerMs: 100,
         mistakeType: null,
         forceKnown: true // Deep check-in safety net!
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

  if (phase === "loading") return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Constructing your Queue...</div>;
  if (phase === "done") return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          <div style={{ fontSize: '30px', color: 'var(--text-primary)', fontWeight: 'bold' }}>You are totally caught up!</div>
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
                 <span className="srs-type-badge" style={{ position: 'static' }}>{item.type}</span>
                 {item.jlptLevel && <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px' }}>{item.jlptLevel.toUpperCase()}</span>}
                 {item.wkLevel && <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px' }}>WK Lv {item.wkLevel}</span>}
              </div>
              <h2 className="srs-character-display">{item.characters}</h2>
            </div>
            
            {/* Scrollable Content Panel! */}
            <div className="srs-content-panel" style={{ flex: '1', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <LessonModal item={item} />
            </div>
          </div>
          
          {/* Sidecar for Grid */}
          <div className="srs-learn-sidecar">
            <div style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', height: '100%' }}>
              <div style={{ padding: '24px' }}>
                <QuizNoteManager itemId={item.jlptItemId} initialNote={item.note || ""} />
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
      <SrsQuiz items={batch} mode="lesson-quiz" onComplete={() => location.reload()} />
    </div>
  );
}
