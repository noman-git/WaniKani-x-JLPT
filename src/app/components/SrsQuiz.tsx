"use client";

import { useState, useRef, useEffect } from "react";
import * as wanakana from "wanakana";
import DOMPurify from "dompurify";
import LessonModal, { QuizNoteManager } from "./LessonModal";

export type QuizItem = {
  id: number;
  type: "kanji" | "vocab";
  characters: string;
  meanings: string[];
  readings: string[];
  advancedReadings?: Array<{ reading: string; type: string; primary: boolean }> | null;
  advancedMeanings?: Array<{ meaning: string; primary: boolean }> | null;
  note?: string | null;
  meaningMnemonic?: string | null;
  readingMnemonic?: string | null;
  meaningHint?: string | null;
  readingHint?: string | null;
  contextSentences?: Array<{en: string; ja: string}> | null;
  partsOfSpeech?: string[] | null;
  matchType?: string | null;
  wkLevel?: number | null;
  radicals?: Array<{ id: number; characters: string | null; meaning: string; imageUrl: string | null; level: number; }> | null;
  componentKanji?: Array<{ id: number | null; expression: string; reading: string; meaning: string; jlptLevel: string | null; wkLevel: number | null; }> | null;
  relatedVocab?: Array<{ id: number; expression: string; reading: string; meaning: string; jlptLevel: string; }> | null;
  jlptItemId: number;
  jlptLevel?: string | null;
};

type QuizTask = {
  item: QuizItem;
  questionType: "reading" | "meaning";
};

type Props = {
  items: QuizItem[];
  onComplete: () => void;
  mode: "lesson-quiz" | "review";
};

export default function SrsQuiz({ items, onComplete, mode }: Props) {
  const [queue, setQueue] = useState<QuizTask[]>([]);
  const [currentTask, setCurrentTask] = useState<QuizTask | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "typo" | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const startTime = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Track errors so if you miss reading, meaning also counts as bad for the item interval
  const itemMistakeState = useRef<Record<number, "reading" | "meaning" | "both" | "none">>({});

  // Initialize Queue Randomly
  useEffect(() => {
    const freshQueue: QuizTask[] = [];
    items.forEach(item => {
      itemMistakeState.current[item.id] = "none";
      freshQueue.push({ item, questionType: "meaning" });
      freshQueue.push({ item, questionType: "reading" });
    });
    // Shuffle
    freshQueue.sort(() => Math.random() - 0.5);
    setQueue(freshQueue);
    setCurrentTask(freshQueue[0] || null);
    startTime.current = Date.now();
  }, [items]);

  // Bind WanaKana exclusively when reading
  useEffect(() => {
    const inputEl = inputRef.current;
    if (inputEl && currentTask?.questionType === "reading") {
      wanakana.bind(inputEl, { IMEMode: true });
      return () => {
        try {
          wanakana.unbind(inputEl);
        } catch (e) {
          // silently catch internal wanakana serialization errors during unbind
        }
      };
    }
  }, [currentTask]);

  const popNext = () => {
    const nextQueue = queue.slice(1);
    setQueue(nextQueue);
    setInputValue("");
    setFeedback(null);
    setShowInfo(false);
    setCurrentTask(nextQueue[0] || null);
    startTime.current = Date.now();

    if (nextQueue.length === 0) {
      onComplete(); // All done!
    }
  };

  const reInsertAndPop = () => {
    // Put current task somewhere in the first 5 slots randomly
    const newQueue = queue.slice(1);
    const insertIdx = Math.floor(Math.random() * Math.min(newQueue.length, 5));
    newQueue.splice(insertIdx, 0, currentTask!);
    setQueue(newQueue);
    setInputValue("");
    setFeedback(null);
    setShowInfo(false);
    setCurrentTask(newQueue[0] || null);
    startTime.current = Date.now();
  };

  const checkAnswer = async () => {
    if (!currentTask || !inputValue.trim() || loading) return;
    setLoading(true);

    const timeToAnswerMs = Date.now() - startTime.current;
    let isCorrect = false;
    let isTypo = false;

    // Local grading algorithm relying loosely on API structures or simple string match
    const answerNorm = inputValue.trim().toLowerCase();

    if (currentTask.questionType === "reading") {
       // Exact match for hiragana readings
       const cleanExpected = currentTask.item.readings.map(r => r.replace(/[^ぁ-んァ-ンー]/g, ''));
       if (cleanExpected.includes(answerNorm)) {
          isCorrect = true;
       }
    } else {
       // Check against API typo logic directly, but for now perform local naive checks
       const expected = currentTask.item.meanings.map(m => m.toLowerCase());
       if (expected.includes(answerNorm)) {
         isCorrect = true;
       } else {
         // Local Levenshtein distance simplified check for typos
         for(const ex of expected) {
            if (ex.length > 3 && levenshteinDistanceLocal(answerNorm, ex) === 1) {
              isCorrect = true;
              isTypo = true;
              break;
            }
         }
       }
    }

    if (isCorrect) {
      setFeedback(isTypo ? "typo" : "correct");
      // If it's a review, we don't submit to API until BOTH reading and meaning are complete!
      // But for simplicity, we immediately POST the grade snippet!
      
      const itemStatus = itemMistakeState.current[currentTask.item.id];
      const hasPreviousMistake = itemStatus === "both" || itemStatus === currentTask.questionType || (itemStatus !== "none" && itemStatus !== currentTask.questionType);
      
      // Submit Grade exactly once BOTH are finished, OR sequentially. Sequentially is safer mathematically per-interaction.
      // E.g. we instantly submit the grade to the backend.
      try {
        await fetch("/api/srs/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jlptItemId: currentTask.item.jlptItemId,
            isCorrect: !hasPreviousMistake, // Mathematically penalize if they EVER got either half wrong
            timeToAnswerMs,
            mistakeType: hasPreviousMistake ? itemMistakeState.current[currentTask.item.id] : null,
            forceKnown: false
          })
        });
      } catch(e) {}
      
      setLoading(false); // Let handleKeyDown pop it strictly on Enter
    } else {
      setFeedback("incorrect");
      const currentErr = itemMistakeState.current[currentTask.item.id];
      itemMistakeState.current[currentTask.item.id] = currentErr === "none" ? currentTask.questionType : "both";
      
      setLoading(false); // Let handleKeyDown queue it on Enter
    }
  };

  // Allow enter key
  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
       if (feedback === "incorrect") {
          reInsertAndPop();
       } else if (feedback === "correct" || feedback === "typo") {
          popNext();
       } else {
          checkAnswer();
       }
    }
  };

  if (!currentTask) return null;

  return (
    <div className="srs-quiz-wrapper">
      <div className="srs-quiz-header" style={{ alignItems: 'center' }}>
         <span>{queue.length} items remaining</span>
         <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {currentTask.item.jlptLevel && (
               <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px' }}>
                 {currentTask.item.jlptLevel.toUpperCase()}
               </span>
            )}
            {currentTask.item.wkLevel && (
               <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px' }}>
                 WK Lv {currentTask.item.wkLevel}
               </span>
            )}
            <span style={{ textTransform: 'uppercase', letterSpacing: '2px', color: '#6366f1' }}>{currentTask.item.type}</span>
         </div>
      </div>

      <div className="srs-quiz-character">
        {currentTask.item.characters}
      </div>

      <div className="srs-input-container">
        <label className="srs-input-label">
          TYPE THE {currentTask.questionType === "reading" ? "READING (Hiragana)" : "MEANING (English)"}
        </label>
        
        <input
          ref={inputRef}
          type="text"
          lang={currentTask.questionType === "reading" ? "ja" : "en"}
          autoFocus
          readOnly={loading || feedback !== null}
          disabled={loading}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`srs-quiz-input ${feedback ? feedback : ''}`}
        />

        {feedback === "typo" && (
           <div className="srs-typo-warning">
             Almost! (Typo allowed)
           </div>
        )}
        
        {feedback === "incorrect" && (
           <div className="srs-incorrect-hint">
             Press Enter to continue. 
           </div>
        )}
      </div>

      {feedback !== null && (
        <div style={{ width: '100%', marginTop: '32px', textAlign: 'center' }}>
          {!showInfo ? (
             <button 
               onClick={() => setShowInfo(true)}
               className="srs-info-toggle-btn"
             >
               <span>👁️</span> Show Item Info
             </button>
          ) : (
             <div className="srs-item-details-box" style={{ padding: '0', backgroundColor: 'transparent', boxShadow: 'none', border: 'none', display: 'flex', justifyContent: 'center', height: 'calc(100vh - 200px)', minHeight: '0', boxSizing: 'border-box' }}>
                
                {/* Responsive Grid Layout */}
                <div className="srs-learn-grid" style={{ width: '100%', maxWidth: '1152px' }}>
                  
                   <div className="srs-learn-main" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', textAlign: 'left', margin: 0, overflow: 'hidden' }}>
                      <div style={{ flex: '1', overflowY: 'auto', padding: '24px', WebkitOverflowScrolling: 'touch' }}>
                         <LessonModal item={currentTask.item} />
                      </div>
                   </div>
                   
                   {/* Sidecar */}
                   <div className="srs-learn-sidecar" style={{ height: '100%' }}>
                      <div style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'left', height: '100%' }}>
                         <div style={{ padding: '24px' }}>
                            <QuizNoteManager itemId={currentTask.item.jlptItemId} initialNote={currentTask.item.note || ""} />
                         </div>
                      </div>
                   </div>
                   
                </div>
             </div>
          )}
        </div>
      )}

      <div className="srs-quiz-progress-track">
        <div 
           className="srs-quiz-progress-bar"
           style={{ 
             width: `${Math.max(5, (1 - queue.length / (items.length * 2)) * 100)}%` 
           }}
        />
      </div>
    </div>
  );
}

// Quick local levenshtein for the UI
function levenshteinDistanceLocal(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
