"use client";

import { useState, useEffect } from "react";
import SrsQuiz, { QuizItem } from "../components/SrsQuiz";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import QuizItemInfo from "../components/QuizItemInfo";

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

        const items: QuizItem[] = await Promise.all(data.lessons.map(async (r: any) => {
           // Deep Hydration directly from the legacy modal API!
           const detailRes = await fetch(`/api/items/${r.item.id}`);
           const detail = await detailRes.json();
           
           let parsedReadings = [];
           let parsedMeanings = [];
           let advancedReadings: Array<{reading: string; type: string; primary: boolean}> | undefined = undefined;
           try {
              const wkReadings = detail.wanikani?.readings || [];
              const wkMeanings = detail.wanikani?.meanings || [];
              parsedReadings = wkReadings.map((reading: any) => reading.reading);
              parsedMeanings = wkMeanings.map((m: any) => m.meaning);
              advancedReadings = wkReadings.map((r: any) => ({ reading: r.reading, type: r.type || "nanori", primary: !!r.primary }));
           } catch(e) {}

           if (parsedReadings.length === 0 && detail.item.reading) parsedReadings.push(detail.item.reading);
           if (parsedMeanings.length === 0 && detail.item.meaning) parsedMeanings.push(detail.item.meaning);

           return {
             id: detail.item.id,
             jlptItemId: detail.item.id,
             type: detail.item.type,
             jlptLevel: detail.item.jlptLevel,
             characters: detail.item.expression,
             readings: parsedReadings,
             advancedReadings,
             meanings: parsedMeanings,
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
             linkedGrammar: detail.linkedGrammar
           };
        }));

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
      <div className="srs-learn-container">
        <div className="srs-learn-header">
          <h1 className="srs-learn-title">Learning Phase</h1>
          <div className="srs-learn-progress">
            {batch.map((_, i) => (
              <div key={i} className={`srs-learn-progress-tick ${i <= currentIndex ? 'active' : 'inactive'}`} />
            ))}
          </div>
        </div>

        <div className="srs-card">
          <button 
             onClick={handleMarkKnown}
             className="srs-deep-check"
          >
             <span className="srs-star">★</span>
             <span>Deep Check-in (Mark Known)</span>
          </button>

          <div className="srs-display-block">
            <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
               <span className="srs-type-badge" style={{ position: 'static' }}>{item.type}</span>
               {item.jlptLevel && <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px' }}>{item.jlptLevel.toUpperCase()}</span>}
               {item.wkLevel && <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px' }}>WK Lv {item.wkLevel}</span>}
            </div>
            <h2 className="srs-character-display">{item.characters}</h2>
          </div>
          <div className="srs-content-panel">
            <QuizItemInfo item={item} />
          </div>
          
          <div className="srs-action-footer">
            <button 
              onClick={nextSlide} 
              className="srs-next-btn"
            >
              {currentIndex + 1 >= batch.length ? "Start Quiz ➔" : "Next Document ➔"}
            </button>
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
